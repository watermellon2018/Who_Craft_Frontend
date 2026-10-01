#!/usr/bin/env python3
"""Fit an editable SMPL-X rest body to measured frontal reference proportions.

The input measurements describe pixels and clothed silhouette sections, not a
new naked-body scan. The fitter uses torso-relative ratios, garment clearance,
and a shape prior. Beta zero (stature) stays zero. It writes parameter proposals
and optional local QA data; it never overwrites a model, character, or database.
Only local numeric arrays are read from the licensed SMPL-X model (no pickle).
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path
from typing import Any

import numpy as np
from scipy.optimize import least_squares


JOINTS = {"pelvis": 0, "left_hip": 1, "right_hip": 2, "left_knee": 4,
          "right_knee": 5, "left_ankle": 7, "right_ankle": 8,
          "neck": 12, "head": 15, "left_shoulder": 16, "right_shoulder": 17,
          "left_elbow": 18, "right_elbow": 19, "left_wrist": 20, "right_wrist": 21}
LENGTH_KEYS = (("thigh", "thighLength"), ("calf", "calfLength"),
               ("upper_arm", "length"), ("forearm", "length"))


def read_glb(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Read uncompressed positions, triangles, and baked beta deltas."""
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", raw)
    if magic != 0x46546C67 or version != 2 or length != len(raw):
        raise ValueError("Expected a valid GLB version 2 file")
    json_length, chunk_type = struct.unpack_from("<II", raw, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("Expected a JSON GLB chunk")
    doc = json.loads(raw[20:20 + json_length])
    bin_start = 20 + json_length + 8

    def array(index: int) -> np.ndarray:
        accessor = doc["accessors"][index]
        if "sparse" in accessor:
            raise ValueError("Sparse accessors are not supported")
        view = doc["bufferViews"][accessor["bufferView"]]
        dtype = {5123: "<u2", 5125: "<u4", 5126: "<f4"}[accessor["componentType"]]
        columns = {"SCALAR": 1, "VEC3": 3}[accessor["type"]]
        itemsize = np.dtype(dtype).itemsize
        offset = bin_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", columns * itemsize)
        return np.ndarray((accessor["count"], columns), dtype=dtype, buffer=raw,
                          offset=offset, strides=(stride, itemsize)).copy()

    primitive = doc["meshes"][0]["primitives"][0]
    positions = array(primitive["attributes"]["POSITION"]).astype(np.float64)
    faces = array(primitive["indices"]).reshape(-1, 3).astype(np.int64)
    targets = np.stack([array(target["POSITION"]) for target in primitive["targets"]]).astype(np.float64)
    if len(targets) != 16:
        raise ValueError("This fitter expects the 16-component SMPL-X body asset")
    return positions, faces, targets / 3.0


def smooth(value: np.ndarray) -> np.ndarray:
    """Match the runtime's clamped smoothstep."""
    t = np.clip(value, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def length_basis(base: np.ndarray) -> np.ndarray:
    """Return the runtime's additive thigh/calf/upper-arm/forearm fields."""
    height = float(np.ptp(base[:, 1]))
    fy = (base[:, 1] - base[:, 1].min()) / height
    ax = np.abs(base[:, 0])
    direction = np.sign(base[:, 0])
    arm_gate = smooth((fy - .48) / .08) * smooth((.92 - fy) / .08)
    result = np.zeros((4, len(base), 3), dtype=np.float64)
    result[0, :, 1] = height * .045 * smooth((fy - .25) / (.5 - .25))
    result[1, :, 1] = height * .035 * smooth((fy - .04) / (.25 - .04))
    result[2, :, 0] = direction * height * .032 * smooth((ax / height - .11) / (.29 - .11)) * arm_gate
    result[3, :, 0] = direction * height * .028 * smooth((ax / height - .29) / (.44 - .29)) * arm_gate
    return result


def cross_section_width(vertices: np.ndarray, faces: np.ndarray, level: float) -> float:
    """Measure a horizontal surface intersection, avoiding vertex-band bias."""
    triangles = vertices[faces]
    crossing = (triangles[:, :, 1].min(axis=1) <= level) & (triangles[:, :, 1].max(axis=1) >= level)
    triangles = triangles[crossing]
    hits = []
    for first, second in ((0, 1), (1, 2), (2, 0)):
        a, b = triangles[:, first], triangles[:, second]
        dy = b[:, 1] - a[:, 1]
        valid = (np.abs(dy) > 1e-12) & ((a[:, 1] - level) * (b[:, 1] - level) <= 0)
        if np.any(valid):
            progress = (level - a[valid, 1]) / dy[valid]
            hits.append(a[valid, 0] + progress * (b[valid, 0] - a[valid, 0]))
    if not hits:
        raise ValueError(f"No surface intersects y={level}")
    xs = np.concatenate(hits)
    return float(xs.max() - xs.min())


def joint_metrics(joints: np.ndarray) -> dict[str, float]:
    """Measure proportions using authoritative model joint locations."""
    shoulders = (joints[16] + joints[17]) / 2
    hips = (joints[1] + joints[2]) / 2
    torso = float(np.linalg.norm(shoulders - hips))
    if torso <= 1e-8:
        raise ValueError("Degenerate torso length")
    upper_arm = np.mean([np.linalg.norm(joints[a] - joints[b]) for a, b in ((16, 18), (17, 19))])
    forearm = np.mean([np.linalg.norm(joints[a] - joints[b]) for a, b in ((18, 20), (19, 21))])
    thigh = np.mean([np.linalg.norm(joints[a] - joints[b]) for a, b in ((1, 4), (2, 5))])
    calf = np.mean([np.linalg.norm(joints[a] - joints[b]) for a, b in ((4, 7), (5, 8))])
    return {"torso_length": torso,
            "shoulder_over_torso": float(np.linalg.norm(joints[16] - joints[17]) / torso),
            "leg_over_torso": float((thigh + calf) / torso),
            "arm_over_torso": float((upper_arm + forearm) / torso),
            "thigh_over_calf": float(thigh / calf),
            "upper_arm_over_forearm": float(upper_arm / forearm)}


def reference_targets(measurements: dict[str, Any]) -> tuple[dict[str, float], list[dict[str, Any]]]:
    """Build pose ratios and garment envelopes from measured reference data."""
    detection = next(d for d in measurements["pose_detections"] if d["model"] == "heavy")
    px = detection["metrics"]["pixels"]
    torso = px["shoulder_to_hip_midline"]
    mean = lambda segment: (px[f"left_{segment}"] + px[f"right_{segment}"]) / 2
    targets = {"shoulder_over_torso": px["shoulder_joint_span"] / torso,
               "leg_over_torso": (mean("thigh") + mean("calf")) / torso,
               "arm_over_torso": (mean("upper_arm") + mean("forearm")) / torso,
               "thigh_over_calf": mean("thigh") / mean("calf"),
               "upper_arm_over_forearm": mean("upper_arm") / mean("forearm")}
    sections = []
    for label in ("lower_chest_garment", "waist_garment", "shirt_hem", "hip_trousers"):
        measured = measurements["clothed_silhouette_sections"][label]
        target = measured["width_pixels"] / torso
        sections.append({"name": label, "target": target,
                         "level_above_hip_over_torso": (px["hip_joint_y"] - measured["pixel_y"]) / torso,
                         "standoff": .014 if label == "hip_trousers" else .012,
                         "envelope_lower": target - .035,
                         "envelope_upper": target + measured.get("edge_uncertainty_pixels", 4) / torso,
                         "sigma": .02 if label in ("lower_chest_garment", "waist_garment") else .035})
    return targets, sections


def build_parameter_proposal(beta_values: np.ndarray, length_values: np.ndarray) -> dict[str, dict[str, float]]:
    """Serialize the fitted base without retaining previous semantic offsets."""
    params = {
        "body_fit": {f"beta{i:02d}": round(float(value / 3.0), 7) for i, value in enumerate(beta_values)},
        "shoulders": {"shouldersWidth": 0.0},
        "torso": {"chestWidth": 0.0, "chestDepth": 0.0, "backWidth": 0.0},
        "waist": {"waistWidth": 0.0, "torsoCurve": 0.0},
        "hips": {"hipsWidth": 0.0, "hipsShape": 0.0},
    }
    for (zone, key), value in zip(LENGTH_KEYS, length_values):
        params[zone] = {key: round(float(value), 7)}
    return params


def fit_body(base: np.ndarray, faces: np.ndarray, betas: np.ndarray,
             regressor: np.ndarray, weights: np.ndarray,
             measurements: dict[str, Any]) -> tuple[dict[str, Any], np.ndarray]:
    """Fit bounded, regularized beta and limb fields; return reviewable output."""
    target_metrics, sections = reference_targets(measurements)
    fields = np.concatenate([betas[1:], length_basis(base)], axis=0)
    # Joint regression is linear, so do it once per basis rather than per step.
    base_joints = regressor @ base
    joint_fields = np.stack([regressor @ field for field in fields])
    torso_vertex = weights[:, [0, 1, 2, 3, 6, 9, 12, 13, 14]].sum(axis=1) > .5
    torso_faces = faces[torso_vertex[faces].all(axis=1)]
    sigma = {"shoulder_over_torso": .025, "leg_over_torso": .055,
             "arm_over_torso": .045, "thigh_over_calf": .035,
             "upper_arm_over_forearm": .05}

    def evaluate(values: np.ndarray) -> tuple[np.ndarray, np.ndarray, dict[str, float]]:
        vertices = base + np.einsum("i,ijk->jk", values, fields)
        joints = base_joints + np.einsum("i,ijk->jk", values, joint_fields)
        metrics = joint_metrics(joints)
        hip_y = (joints[1, 1] + joints[2, 1]) / 2
        shoulder_y = (joints[16, 1] + joints[17, 1]) / 2
        torso_y = shoulder_y - hip_y
        for section in sections:
            level = hip_y + section["level_above_hip_over_torso"] * torso_y
            selection = torso_faces if section["level_above_hip_over_torso"] > 0 else faces
            width = cross_section_width(vertices, selection, level)
            metrics[section["name"]] = (width + 2 * section["standoff"]) / metrics["torso_length"]
        return vertices, joints, metrics

    def residual(values: np.ndarray) -> np.ndarray:
        _, _, metrics = evaluate(values)
        errors = [(metrics[key] - target) / sigma[key] for key, target in target_metrics.items()]
        for section in sections:
            predicted = metrics[section["name"]]
            bound = np.clip(predicted, section["envelope_lower"], section["envelope_upper"])
            errors.append((predicted - bound) / section["sigma"])
        # Shape remains near the mean where the image supplies no information.
        errors.extend((values[:15] * .35).tolist())
        errors.extend((values[15:] * .45).tolist())
        return np.asarray(errors)

    initial = np.zeros(19)
    solution = least_squares(residual, initial,
                             bounds=(np.r_[np.full(15, -2.5), np.full(4, -1.0)],
                                     np.r_[np.full(15, 2.5), np.full(4, 1.0)]),
                             loss="soft_l1", f_scale=1.0, max_nfev=180,
                             ftol=1e-8, xtol=1e-8, gtol=1e-8)
    before_vertices, before_joints, before = evaluate(initial)
    fitted, fitted_joints, after = evaluate(solution.x)
    beta_values = np.r_[0.0, solution.x[:15]]
    params = build_parameter_proposal(beta_values, solution.x[15:])
    metric_report = {key: {"target": target, "before": before[key], "after": after[key],
                           "relative_error_before": (before[key] - target) / target,
                           "relative_error_after": (after[key] - target) / target}
                     for key, target in target_metrics.items()}
    for section in sections:
        key = section["name"]
        metric_report[key] = {**section, "before": before[key], "after": after[key],
                              "relative_error_before": (before[key] - section["target"]) / section["target"],
                              "relative_error_after": (after[key] - section["target"]) / section["target"]}
    result = {"schema_version": 1, "params": params, "betas": beta_values.tolist(),
              "optimizer": {"success": bool(solution.success), "message": solution.message,
                            "nfev": solution.nfev, "cost_before": float(np.sum(residual(initial) ** 2) / 2),
                            "cost_after": float(np.sum(residual(solution.x) ** 2) / 2)},
              "measurements": metric_report,
              "unfitted_stature": {"before": float(np.ptp(before_vertices[:, 1])),
                                   "after": float(np.ptp(fitted[:, 1])),
                                   "floor_offset_after": -float(fitted[:, 1].min())},
              "baseline_joints": {name: before_joints[index].tolist() for name, index in JOINTS.items()},
              "fitted_joints": {name: fitted_joints[index].tolist() for name, index in JOINTS.items()},
              "limitations": ["The reference constrains clothed frontal silhouette, not hidden body depth.",
                              "Shoulder/hip landmark definitions are not interchangeable between MediaPipe and SMPL-X; hip joint span is not fitted.",
                              "Beta zero is fixed. Height changes are incidental shape effects; no camera or absolute stature was fitted.",
                              "The output retains editable beta morphs and limb controls in the neutral rest pose."]}
    return result, fitted


def main() -> None:
    """Run the local proposal workflow from explicit files."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--body", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--measurements", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--qa", type=Path)
    args = parser.parse_args()
    base, faces, morphs = read_glb(args.body)
    with np.load(args.model, allow_pickle=False) as data:
        template = data["v_template"].astype(np.float64)
        template[:, 1] -= template[:, 1].min()
        regressor = data["J_regressor"].astype(np.float64)
        weights = data["weights"].astype(np.float64)
    if template.shape != base.shape or not np.allclose(template, base, atol=1e-6):
        raise ValueError("The GLB does not match this model's neutral vertex topology/template")
    measurements = json.loads(args.measurements.read_text(encoding="utf-8"))
    result, _ = fit_body(base, faces, morphs, regressor, weights, measurements)
    result["inputs"] = {"body": str(args.body.resolve()), "model": str(args.model.resolve()),
                        "measurements": str(args.measurements.resolve())}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    if args.qa:
        left_joints = [16, 18, 20, *range(25, 40)]
        right_joints = [17, 19, 21, *range(40, 55)]
        qa = {"vertex_count": len(base), "joint_indices": JOINTS,
              "baseline_joints": result["baseline_joints"], "fitted_joints": result["fitted_joints"],
              "left_arm_weights": np.round(weights[:, left_joints].sum(axis=1), 6).tolist(),
              "right_arm_weights": np.round(weights[:, right_joints].sum(axis=1), 6).tolist(),
              "note": "QA-only arm-down rotations around each shoulder; original body rest pose is unchanged. Apply floor offset to fitted joints consistently with the rendered body."}
        qa["sparse_joint_regressors"] = {}
        for name in ("left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"):
            row = regressor[JOINTS[name]]
            indices = np.flatnonzero(np.abs(row) > 1e-9)
            qa["sparse_joint_regressors"][name] = {
                "indices": indices.tolist(), "weights": row[indices].tolist(),
            }
        detection = next(d for d in measurements["pose_detections"] if d["model"] == "heavy")
        qa["target_arm_angles_radians"] = {}
        qa["arm_rotation_radians"] = {"baseline": {}, "fitted": {}}
        for side in ("left", "right"):
            shoulder = np.asarray(detection["landmarks"][f"{side}_shoulder"]["pixel"])
            wrist = np.asarray(detection["landmarks"][f"{side}_wrist"]["pixel"])
            delta = wrist - shoulder
            target_angle = float(np.arctan2(-delta[1], delta[0]))
            qa["target_arm_angles_radians"][side] = target_angle
            for state in ("baseline", "fitted"):
                points = result[f"{state}_joints"]
                delta = np.asarray(points[f"{side}_wrist"]) - points[f"{side}_shoulder"]
                rotation = target_angle - float(np.arctan2(delta[1], delta[0]))
                qa["arm_rotation_radians"][state][side] = float((rotation + np.pi) % (2 * np.pi) - np.pi)
        args.qa.parent.mkdir(parents=True, exist_ok=True)
        args.qa.write_text(json.dumps(qa, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"out": str(args.out), "params": result["params"],
                      "optimizer": result["optimizer"], "measurements": result["measurements"]}, indent=2))


if __name__ == "__main__":
    main()
