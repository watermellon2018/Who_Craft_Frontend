#!/usr/bin/env python3
"""Build a closed SMPL-X head GLB from three local 2D reference views.

This is an offline, no-download reconstruction baseline. MediaPipe FaceMesh
provides corresponding landmarks in each view; a similarity-aligned fusion is
fitted to the 68 SMPL-X facial landmarks; a regularized Gaussian RBF transfers
the sparse differences to the dense facial surface. The cranium and neck are
explicitly preserved, and every extraction boundary is capped.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Sequence

import cv2
import mediapipe as mp
import numpy as np

from geometry import (
    barycentric_points,
    clip_vector_lengths,
    extract_and_cap_mesh,
    edge_topology_diagnostics,
    fit_similarity,
    fuse_aligned_shapes,
    gaussian_rbf_warp,
    root_mean_square,
    smoothstep,
)

_HERE = Path(__file__).resolve().parent
_SMPL_TOOL_DIR = _HERE.parent / "smpl"
if str(_SMPL_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_SMPL_TOOL_DIR))

from glb_writer import write_glb  # noqa: E402


# SMPL-X stores the 17 yaw-dependent jaw-outline points separately, followed
# by 51 static eyebrow/nose/eye/lip landmarks. These MediaPipe indices follow
# the same conventional 68-landmark semantic order.
MEDIAPIPE_JAW = (
    234,
    93,
    132,
    58,
    172,
    136,
    150,
    149,
    152,
    378,
    379,
    365,
    397,
    288,
    361,
    323,
    454,
)
MEDIAPIPE_STATIC = (
    70,
    63,
    105,
    66,
    107,
    336,
    296,
    334,
    293,
    300,
    168,
    6,
    197,
    195,
    98,
    97,
    2,
    326,
    327,
    33,
    160,
    158,
    133,
    153,
    144,
    362,
    385,
    387,
    263,
    373,
    380,
    61,
    40,
    37,
    0,
    267,
    270,
    291,
    321,
    314,
    17,
    84,
    91,
    78,
    81,
    13,
    311,
    308,
    402,
    14,
    178,
)
MEDIAPIPE_68 = MEDIAPIPE_JAW + MEDIAPIPE_STATIC

HEAD_JOINTS = (15, 22, 23, 24)  # head, jaw, left eye, right eye
HEAD_INFLUENCE_THRESHOLD = 0.05
RBF_SIGMA_METERS = 0.034
RBF_REGULARIZATION = 0.012
MAX_CONTROL_DISPLACEMENT_METERS = 0.024


@dataclass(frozen=True)
class ViewDetection:
    """Serializable diagnostics for one FaceMesh source image."""

    name: str
    path: str
    width: int
    height: int
    landmark_count: int
    face_bbox_pixels: list[float]
    depth_span_pixels: float
    skin_rgb: list[int]


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--portrait", required=True, help="frontal portrait image"
    )
    parser.add_argument(
        "--profile", required=True, help="profile reference image"
    )
    parser.add_argument(
        "--three-quarter",
        required=True,
        dest="three_quarter",
        help="three-quarter reference image",
    )
    parser.add_argument(
        "--model", required=True, help="trusted SMPLX_NEUTRAL.npz"
    )
    parser.add_argument(
        "--out-dir", required=True, help="artifact output directory"
    )
    parser.add_argument(
        "--render-size",
        type=int,
        default=640,
        help="square CPU preview size in pixels (default: 640)",
    )
    return parser.parse_args()


def _read_image(path: Path) -> np.ndarray:
    if not path.is_file():
        raise FileNotFoundError(f"reference image does not exist: {path}")
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"OpenCV could not decode image: {path}")
    return image


def _sample_skin_rgb(image: np.ndarray, landmarks: np.ndarray) -> list[int]:
    """Sample robust cheek color for preview rendering diagnostics."""
    height, width = image.shape[:2]
    image_points = np.column_stack(
        (landmarks[:, 0], -landmarks[:, 1])
    ).astype(np.int32)
    mask = np.zeros((height, width), dtype=np.uint8)
    for indices in ((50, 101, 205, 187), (280, 330, 425, 411)):
        polygon = image_points[np.asarray(indices, dtype=np.int64)]
        cv2.fillConvexPoly(mask, polygon, 255)
    pixels = image[mask > 0]
    if len(pixels) == 0:
        return [222, 176, 148]
    luminance = cv2.cvtColor(
        pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2GRAY
    ).reshape(-1)
    accepted = pixels[(luminance > 35) & (luminance < 245)]
    if len(accepted) == 0:
        accepted = pixels
    bgr = np.median(accepted, axis=0).round().astype(np.uint8)
    return [int(bgr[2]), int(bgr[1]), int(bgr[0])]


def _detect_landmarks(
    detector: Any,
    name: str,
    path: Path,
) -> tuple[np.ndarray, ViewDetection]:
    """Detect 478 landmarks and convert them to image-pixel 3D coordinates."""
    image = _read_image(path)
    height, width = image.shape[:2]
    result = detector.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    faces = result.multi_face_landmarks or []
    if not faces:
        raise RuntimeError(f"FaceMesh did not detect a face in {name}: {path}")
    raw = faces[0].landmark
    landmarks = np.asarray(
        [(item.x * width, -item.y * height, -item.z * width) for item in raw],
        dtype=np.float64,
    )
    image_xy = np.column_stack((landmarks[:, 0], -landmarks[:, 1]))
    bbox_min = image_xy.min(axis=0)
    bbox_max = image_xy.max(axis=0)
    diagnostics = ViewDetection(
        name=name,
        path=str(path.resolve()),
        width=width,
        height=height,
        landmark_count=len(landmarks),
        face_bbox_pixels=[
            float(bbox_min[0]),
            float(bbox_min[1]),
            float(bbox_max[0]),
            float(bbox_max[1]),
        ],
        depth_span_pixels=float(np.ptp(landmarks[:, 2])),
        skin_rgb=_sample_skin_rgb(image, landmarks),
    )
    return landmarks, diagnostics


def _load_model(path: Path) -> dict[str, np.ndarray]:
    """Load only numeric arrays needed from an official SMPL-X NPZ."""
    if not path.is_file():
        raise FileNotFoundError(f"SMPL-X model does not exist: {path}")
    required = {
        "v_template",
        "f",
        "weights",
        "lmk_faces_idx",
        "lmk_bary_coords",
        "dynamic_lmk_faces_idx",
        "dynamic_lmk_bary_coords",
    }
    with np.load(path, allow_pickle=False) as archive:
        missing = sorted(required.difference(archive.files))
        if missing:
            raise ValueError(
                f"SMPL-X model is missing arrays: {', '.join(missing)}"
            )
        return {
            name: np.asarray(archive[name]).copy() for name in required
        }


def _smplx_face_controls(model: dict[str, np.ndarray]) -> np.ndarray:
    vertices = np.asarray(model["v_template"], dtype=np.float64)
    faces = np.asarray(model["f"], dtype=np.int64)
    # Row zero is the frontal-yaw contour in the official SMPL-X table.
    jaw = barycentric_points(
        vertices,
        faces,
        np.asarray(model["dynamic_lmk_faces_idx"])[0],
        np.asarray(model["dynamic_lmk_bary_coords"])[0],
    )
    static = barycentric_points(
        vertices,
        faces,
        np.asarray(model["lmk_faces_idx"]),
        np.asarray(model["lmk_bary_coords"]),
    )
    controls = np.vstack((jaw, static))
    if controls.shape != (68, 3):
        raise ValueError(
            f"expected 68 SMPL-X controls, found {controls.shape}"
        )
    return controls


def _face_preservation_weights(vertices: np.ndarray) -> np.ndarray:
    """Fade deformation away from face front, scalp, ears and neck."""
    front = smoothstep(-0.012, 0.058, vertices[:, 2])
    above_neck = smoothstep(0.178, 0.218, vertices[:, 1])
    below_scalp = 1.0 - smoothstep(0.350, 0.392, vertices[:, 1])
    ear_guard = 1.0 - 0.35 * smoothstep(0.066, 0.094, np.abs(vertices[:, 0]))
    return np.clip(front * above_neck * below_scalp * ear_guard, 0.0, 1.0)


def _deform_head(
    model: dict[str, np.ndarray],
    fused_landmarks: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    vertices = np.asarray(model["v_template"], dtype=np.float64)
    faces = np.asarray(model["f"], dtype=np.int64)
    controls = _smplx_face_controls(model)
    source_controls = fused_landmarks[np.asarray(MEDIAPIPE_68, dtype=np.int64)]
    source_to_model = fit_similarity(source_controls, controls)
    target_controls = source_to_model.apply(source_controls)
    raw_displacements = target_controls - controls
    control_displacements = clip_vector_lengths(
        raw_displacements,
        MAX_CONTROL_DISPLACEMENT_METERS,
    )

    dense_displacements = gaussian_rbf_warp(
        vertices,
        controls,
        control_displacements,
        sigma=RBF_SIGMA_METERS,
        regularization=RBF_REGULARIZATION,
    )
    preservation_weights = _face_preservation_weights(vertices)
    deformed = vertices + dense_displacements * preservation_weights[:, None]

    skinning_weights = np.asarray(model["weights"], dtype=np.float64)
    head_influence = skinning_weights[:, HEAD_JOINTS].sum(axis=1)
    head_mask = head_influence > HEAD_INFLUENCE_THRESHOLD
    head_vertices, head_faces, cap_loop_sizes = extract_and_cap_mesh(
        deformed,
        faces,
        head_mask,
    )
    topology = edge_topology_diagnostics(head_faces)
    if any(topology.values()):
        raise RuntimeError(f"invalid head edge topology: {topology}")

    diagnostics: dict[str, Any] = {
        "smplx_control_count": len(controls),
        "control_rms_before_clip_m": root_mean_square(raw_displacements),
        "control_rms_after_clip_m": root_mean_square(control_displacements),
        "control_max_before_clip_m": float(
            np.linalg.norm(raw_displacements, axis=1).max()
        ),
        "control_max_after_clip_m": float(
            np.linalg.norm(control_displacements, axis=1).max()
        ),
        "dense_max_displacement_m": float(
            np.linalg.norm(
                dense_displacements * preservation_weights[:, None],
                axis=1,
            ).max()
        ),
        "preserved_cranium_max_displacement_m": float(
            np.linalg.norm(
                (deformed - vertices)[vertices[:, 1] > 0.395], axis=1
            ).max(
                initial=0.0
            )
        ),
        "preserved_neck_max_displacement_m": float(
            np.linalg.norm(
                (deformed - vertices)[vertices[:, 1] < 0.175], axis=1
            ).max(
                initial=0.0
            )
        ),
        "head_vertex_count": len(head_vertices),
        "head_triangle_count": len(head_faces),
        "cap_loop_sizes": cap_loop_sizes,
        "boundary_edges_after_cap": topology["boundary_edges"],
        "non_manifold_edges_after_cap": topology["non_manifold_edges"],
        "orientation_conflicts_after_cap": topology["orientation_conflicts"],
        "closed_oriented_edge_manifold": not any(topology.values()),
    }
    return head_vertices, head_faces, diagnostics


def _rotation_y(degrees: float) -> np.ndarray:
    radians = math.radians(degrees)
    cosine = math.cos(radians)
    sine = math.sin(radians)
    return np.asarray(
        ((cosine, 0.0, -sine), (0.0, 1.0, 0.0), (sine, 0.0, cosine)),
        dtype=np.float64,
    )


def _render_mesh(
    vertices: np.ndarray,
    faces: np.ndarray,
    output: Path,
    *,
    yaw_degrees: float,
    size: int,
    skin_rgb: Sequence[int],
) -> None:
    """Render a deterministic orthographic preview with OpenCV on the CPU."""
    if size < 256:
        raise ValueError("render size must be at least 256 pixels")
    centered = vertices - vertices.mean(axis=0)
    camera_vertices = centered @ _rotation_y(yaw_degrees)
    horizontal = camera_vertices[:, 0]
    vertical = camera_vertices[:, 1]
    padding = max(24, int(size * 0.08))
    width_span = max(float(np.ptp(horizontal)), 1e-6)
    height_span = max(float(np.ptp(vertical)), 1e-6)
    scale = min(
        (size - 2 * padding) / width_span,
        (size - 2 * padding) / height_span,
    )
    pixels = np.column_stack(
        (
            size * 0.5 + horizontal * scale,
            size * 0.5 - vertical * scale,
        )
    ).round().astype(np.int32)

    background_top = np.asarray((29, 31, 38), dtype=np.float64)
    background_bottom = np.asarray((11, 13, 18), dtype=np.float64)
    rows = np.linspace(0.0, 1.0, size)[:, None, None]
    canvas = np.repeat(
        (background_top * (1.0 - rows) + background_bottom * rows),
        size,
        axis=1,
    ).astype(np.uint8)

    triangle_vertices = camera_vertices[faces]
    order = np.argsort(triangle_vertices[:, :, 2].mean(axis=1))
    light = np.asarray((0.35, 0.45, 1.0), dtype=np.float64)
    light /= np.linalg.norm(light)
    base_bgr = np.asarray(tuple(reversed(skin_rgb)), dtype=np.float64)
    for face_index in order:
        triangle = triangle_vertices[face_index]
        normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
        normal_length = np.linalg.norm(normal)
        if normal_length < 1e-12:
            continue
        normal /= normal_length
        diffuse = abs(float(normal @ light))
        shade = 0.42 + 0.58 * diffuse
        color = tuple(
            int(value)
            for value in np.clip(base_bgr * shade, 0, 255)
        )
        cv2.fillConvexPoly(
            canvas,
            pixels[faces[face_index]],
            color,
            lineType=cv2.LINE_AA,
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), canvas):
        raise OSError(f"OpenCV could not write preview: {output}")


def run(args: argparse.Namespace) -> dict[str, Any]:
    """Execute the reconstruction pipeline and return serialized metrics."""
    view_paths = (
        ("portrait", Path(args.portrait)),
        ("three_quarter", Path(args.three_quarter)),
        ("profile", Path(args.profile)),
    )
    shapes: list[np.ndarray] = []
    detections: list[ViewDetection] = []
    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.35,
    ) as detector:
        for name, path in view_paths:
            shape, detection = _detect_landmarks(detector, name, path)
            shapes.append(shape)
            detections.append(detection)

    fused, alignment_rms, _ = fuse_aligned_shapes(shapes, MEDIAPIPE_68)
    model = _load_model(Path(args.model))
    head_vertices, head_faces, deformation = _deform_head(model, fused)

    output_dir = Path(args.out_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    head_path = output_dir / "head.glb"
    write_glb(
        str(head_path),
        head_vertices.astype(np.float32),
        head_faces.astype(np.uint32),
        [],
        [],
        extras={
            "reconstruction": {
                "method": "mediapipe_multiview_smplx_rbf_v1",
                "viewCount": len(shapes),
                "closedOrientedEdgeManifold": deformation[
                    "closed_oriented_edge_manifold"
                ],
            }
        },
    )

    skin_rgb = detections[0].skin_rgb
    previews = (
        ("front.png", 0.0),
        ("three_quarter.png", 35.0),
        ("profile.png", 90.0),
    )
    for filename, yaw in previews:
        _render_mesh(
            head_vertices,
            head_faces,
            output_dir / filename,
            yaw_degrees=yaw,
            size=args.render_size,
            skin_rgb=skin_rgb,
        )

    metrics: dict[str, Any] = {
        "method": "mediapipe_multiview_smplx_rbf_v1",
        "model_path": str(Path(args.model).resolve()),
        "views": [asdict(detection) for detection in detections],
        "fusion": {
            "views_used": [name for name, _ in view_paths],
            "stable_landmark_count": len(MEDIAPIPE_68),
            "alignment_rms_pixels_in_portrait_frame": {
                detections[index].name: value
                for index, value in enumerate(alignment_rms)
            },
            "mean_alignment_rms_pixels": float(np.mean(alignment_rms)),
        },
        "deformation": deformation,
        "outputs": {
            "head_glb": str(head_path.resolve()),
            "previews": [
                str((output_dir / name).resolve()) for name, _ in previews
            ],
        },
        "limitations": [
            (
                "FaceMesh infers rather than observes depth from each "
                "stylized 2D view."
            ),
            (
                "The 68 semantic controls preserve SMPL-X topology but do "
                "not recover pores or hair."
            ),
            (
                "Cranium and neck intentionally remain the neutral SMPL-X "
                "baseline."
            ),
            (
                "This spike produces a static head mesh; body seam, rigging "
                "and hair are later tasks."
            ),
        ],
    }
    metrics_path = output_dir / "metrics.json"
    with metrics_path.open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return metrics


def main() -> None:
    args = _parse_arguments()
    try:
        metrics = run(args)
    except (FileNotFoundError, OSError, RuntimeError, ValueError) as error:
        raise SystemExit(f"reconstruction failed: {error}") from error
    print(
        "Reconstruction complete: "
        f"{metrics['deformation']['head_vertex_count']} vertices, "
        f"{metrics['deformation']['head_triangle_count']} triangles"
    )
    print(f"Head GLB: {metrics['outputs']['head_glb']}")
    print(f"Metrics: {Path(args.out_dir).resolve() / 'metrics.json'}")


if __name__ == "__main__":
    main()
