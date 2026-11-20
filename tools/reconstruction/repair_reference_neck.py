#!/usr/bin/env python3
"""Fit the measured posterior neck gap in the reviewed angry_dog v2 assets.

This is an explicit repair for one immutable source pair, not a general remesher.
It neither runs inference nor writes character revisions.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from scipy.sparse import coo_matrix, diags
from scipy.sparse.linalg import spsolve
from scipy.spatial import Delaunay

from postprocess_hunyuan_mesh import _sha256
from refine_reference_surface import PROFILE, _skin_colors


HEAD_SHA256 = "00facc3a995ab9f395fcc21914d14643c9a080b4c1392babac59707c9fb98cd3"
HAIR_SHA256 = "6c3fdafa1f907d9582485eecae8436d931b1a29e2059ce030449b9b80576cda4"
ALIGNMENT_MAX_Y = 0.075
ATTACHMENT_MAX_Y = 0.050
PATCH_MIN_Y = 0.04538007


def _load_head(path: Path) -> trimesh.Trimesh:
    # force='mesh' concatenates the scene and recomputes imported normals.
    scene = trimesh.load(path, force="scene", process=False)
    if len(scene.geometry) != 1:
        raise ValueError("repair requires the reviewed single-mesh head")
    mesh = next(iter(scene.geometry.values()))
    if mesh.metadata.get("sourceProfile") != PROFILE:
        raise ValueError("repair requires stylized_reference_v2")
    anchors = mesh.metadata.get("referenceFace", {}).get("anchors")
    if anchors != {"chinY": 0.0607, "mouthY": 0.096, "noseY": 0.1275}:
        raise ValueError("unexpected canonical face anchors")
    return mesh


def _boundary_chains(mesh: trimesh.Trimesh) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Trace existing open edges, using measured seed locations rather than IDs."""
    vertices = np.asarray(mesh.vertices)
    edges, counts = np.unique(mesh.edges_sorted, axis=0, return_counts=True)
    adjacency: dict[int, list[int]] = {}
    for a, b in edges[counts == 1]:
        adjacency.setdefault(int(a), []).append(int(b))
        adjacency.setdefault(int(b), []).append(int(a))

    def walk(start: int, *, rear: bool) -> np.ndarray:
        chain, previous, current = [start], -1, start
        for _ in range(500):
            neighbors = [index for index in adjacency[current] if index != previous]
            if previous == -1:
                def ascending_score(index: int) -> float:
                    prior, vertex, heights = current, index, []
                    for _ in range(10):
                        heights.append(vertices[vertex, 1])
                        following = [candidate for candidate in adjacency[vertex] if candidate != prior][0]
                        prior, vertex = vertex, following
                    return float(np.mean(heights))
                neighbors.sort(key=ascending_score, reverse=True)
            elif len(neighbors) != 1:
                raise ValueError("unexpected branch in measured neck contour")
            following = neighbors[0]
            if rear:
                stop = following == start or vertices[following, 1] < ATTACHMENT_MAX_Y
            else:
                stop = vertices[following, 1] < vertices[current, 1] - 1e-5 and vertices[current, 1] > 0.13
            if stop:
                return np.asarray(chain)
            chain.append(following)
            previous, current = current, following
        raise ValueError("measured neck contour did not terminate")

    sides = []
    for sign in (1, -1):
        candidates = np.asarray([
            index for index in adjacency
            if 0.050 < vertices[index, 1] < 0.053
            and -0.010 < vertices[index, 2] < 0.005
            and sign * vertices[index, 0] > 0.03
        ])
        if not len(candidates):
            raise ValueError("missing posterior jaw boundary")
        sides.append(walk(int(candidates[np.argmin(vertices[candidates, 1])]), rear=False))
    candidates = np.asarray(list(adjacency))
    distance = np.linalg.norm(vertices[candidates] - [0.042, 0.050, -0.022], axis=1)
    if distance.min() > 0.001:
        raise ValueError("missing rear neck boundary")
    rear = walk(int(candidates[np.argmin(distance)]), rear=True)
    if tuple(map(len, (*sides, rear))) != (109, 101, 202):
        raise ValueError("neck contour differs from the reviewed source")

    def extend(start: int, blocked: int) -> list[int]:
        extension, previous, current = [], blocked, start
        while vertices[current, 1] > PATCH_MIN_Y + 1e-7:
            following = [index for index in adjacency[current] if index != previous][0]
            extension.append(following)
            previous, current = current, following
            if len(extension) > 100:
                raise ValueError("unexpected lower neck contour")
        return extension

    right = np.r_[extend(sides[0][0], sides[0][1])[::-1], sides[0]]
    left = np.r_[extend(sides[1][0], sides[1][1])[::-1], sides[1]]
    rear = np.r_[extend(rear[0], rear[1])[::-1], rear, extend(rear[-1], rear[-2])]
    if tuple(map(len, (right, left, rear))) != (116, 141, 210):
        raise ValueError("lower neck contour differs from the reviewed source")
    return right, left, rear


def _arc_parameter(points: np.ndarray) -> np.ndarray:
    distance = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
    if distance[-1] <= 0 or np.any(np.diff(distance) <= 0):
        raise ValueError("patch boundary must have distinct ordered vertices")
    return distance / distance[-1]


class _PatchBuilder:
    """Coons patches sharing the exact source boundary vertex indices."""

    def __init__(self, vertices: np.ndarray) -> None:
        self.vertices = vertices.copy()
        self.faces: list[np.ndarray] = []

    def line(self, start: int, end: int, count: int) -> np.ndarray:
        indices = np.arange(len(self.vertices), len(self.vertices) + count - 2)
        points = np.linspace(self.vertices[start], self.vertices[end], count)[1:-1]
        self.vertices = np.vstack((self.vertices, points))
        return np.r_[start, indices, end]

    def patch(
        self, bottom: np.ndarray, right: np.ndarray, top: np.ndarray, left: np.ndarray,
        *, columns: int, rows: int, harmonic: bool = False,
    ) -> None:
        """Boundary directions: bottom/top right-to-left, sides bottom-to-top."""
        if not (bottom[0] == right[0] and bottom[-1] == left[0]
                and top[0] == right[-1] and top[-1] == left[-1]):
            raise ValueError("patch corners must share indices")
        curves = [self.vertices[indices] for indices in (bottom, right, top, left)]
        parameters = [_arc_parameter(curve) for curve in curves]
        indices = np.r_[bottom, right[1:], top[1:], left[1:-1]]
        uv = np.vstack((
            np.c_[parameters[0], np.zeros(len(bottom))],
            np.c_[np.zeros(len(right) - 1), parameters[1][1:]],
            np.c_[parameters[2][1:], np.ones(len(top) - 1)],
            np.c_[np.ones(len(left) - 2), parameters[3][1:-1]],
        ))
        x, y = np.meshgrid(
            np.linspace(0, 1, columns + 1)[1:-1], np.linspace(0, 1, rows + 1)[1:-1],
        )
        interior = np.c_[x.ravel(), y.ravel()]

        def sample(curve: int, values: np.ndarray) -> np.ndarray:
            return np.column_stack([
                np.interp(values, parameters[curve], curves[curve][:, axis]) for axis in range(3)
            ])

        u, v = interior[:, 0, None], interior[:, 1, None]
        corners = (
            (1 - u) * (1 - v) * curves[0][0] + u * (1 - v) * curves[0][-1]
            + (1 - u) * v * curves[2][0] + u * v * curves[2][-1]
        )
        points = (
            (1 - v) * sample(0, interior[:, 0]) + v * sample(2, interior[:, 0])
            + (1 - u) * sample(1, interior[:, 1]) + u * sample(3, interior[:, 1]) - corners
        )
        indices = np.r_[indices, np.arange(len(self.vertices), len(self.vertices) + len(points))]
        self.vertices = np.vstack((self.vertices, points))
        local_faces = Delaunay(np.vstack((uv, interior))).simplices
        faces = indices[local_faces]
        if harmonic:
            # The imported side edge has sub-millimetre backward steps. Coons
            # interpolation can amplify those into a fold; a Dirichlet solve
            # fills each narrow side panel without moving its boundary.
            edges = np.unique(np.sort(np.vstack((
                local_faces[:, [0, 1]], local_faces[:, [1, 2]], local_faces[:, [2, 0]],
            )), axis=1), axis=0)
            row, column = np.r_[edges[:, 0], edges[:, 1]], np.r_[edges[:, 1], edges[:, 0]]
            adjacency = coo_matrix((np.ones(len(row)), (row, column)), shape=(len(indices), len(indices))).tocsr()
            laplacian = diags(np.asarray(adjacency.sum(axis=1)).ravel()) - adjacency
            fixed = len(indices) - len(points)
            self.vertices[indices[fixed:]] = spsolve(
                laplacian[fixed:, fixed:], -(laplacian[fixed:, :fixed] @ self.vertices[indices[:fixed]]),
            )
        triangles = self.vertices[faces]
        normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        radial = triangles.mean(axis=1) - [0, 0, 0.015]
        radial[:, 1] = 0
        # Orient the entire connected patch. Flipping individual staircase
        # triangles would create inconsistent shared-edge winding and bands.
        if np.median(np.sum(normals * radial, axis=1)) < 0:
            faces = faces[:, ::-1]
        self.faces.append(faces)


def _neck_bounds(mesh: trimesh.Trimesh) -> np.ndarray:
    """Match reconstructedHead.ts: select centroids, expand by triangle vertices."""
    vertices = np.asarray(mesh.vertices)
    centers = vertices[mesh.faces].mean(axis=1)
    x, y, z = centers.T
    selected = (y >= 0.045) & (y <= ALIGNMENT_MAX_Y) & (np.abs(x) < 0.067) & (z > -0.075) & (z < 0.065)
    points = vertices[np.unique(mesh.faces[selected])]
    return np.asarray([points.min(axis=0), points.max(axis=0)])


def _fragment_faces(mesh: trimesh.Trimesh) -> tuple[np.ndarray, np.ndarray]:
    """Identify the two measured disconnected fragments, never the jaw or ear."""
    vertices, faces = np.asarray(mesh.vertices), np.asarray(mesh.faces)
    labels = trimesh.graph.connected_component_labels(mesh.face_adjacency, node_count=len(faces))
    rear, side = np.zeros(len(faces), dtype=bool), np.zeros(len(faces), dtype=bool)
    for label in np.unique(labels):
        indices = np.flatnonzero(labels == label)
        points = vertices[np.unique(faces[indices])]
        if points[:, 2].max() < -0.03 and np.ptp(points[:, 2]) < 0.009:
            rear[indices] = vertices[faces[indices], 1].min(axis=1) > ALIGNMENT_MAX_Y
        if len(indices) == 109 and points[:, 0].min() > 0.042 and points[:, 1].max() < 0.065:
            side[indices] = True
    return rear, side


def _repair(mesh: trimesh.Trimesh) -> tuple[trimesh.Trimesh, dict[str, Any]]:
    vertices, source_faces = np.asarray(mesh.vertices), np.asarray(mesh.faces)
    source_normals = np.asarray(mesh.vertex_normals).copy()
    right, left, rear = _boundary_chains(mesh)
    rim = np.flatnonzero(vertices[rear, 1] > 0.0999)
    right_split = np.flatnonzero(vertices[right, 1] <= 0.10002)[-1]
    left_split = np.flatnonzero(vertices[left, 1] <= 0.10002)[-1]
    builder = _PatchBuilder(vertices)
    upper_right = builder.line(right[right_split], rear[rim[0]], 10)
    upper_left = builder.line(left[left_split], rear[rim[-1]], 10)
    bottom_right = builder.line(right[0], rear[0], 10)
    bottom_left = builder.line(left[0], rear[-1], 10)

    def measured_index(chain: np.ndarray, point: list[float]) -> int:
        distance = np.linalg.norm(vertices[chain] - point, axis=1)
        if distance.min() > 1e-7:
            raise ValueError("missing measured alignment contour vertex")
        return int(np.argmin(distance))

    mid_right = measured_index(right, [0.04201377, 0.07507397, -0.00094941])
    mid_left = measured_index(left, [-0.04205333, 0.07507397, 0.00142611])
    mid_rear_right = measured_index(rear, [0.04193215, 0.07507397, -0.01520248])
    mid_rear_left = measured_index(rear, [-0.04204291, 0.07507397, -0.01639024])
    middle_right = builder.line(right[mid_right], rear[mid_rear_right], 10)
    middle_left = builder.line(left[mid_left], rear[mid_rear_left], 10)
    # Separate rows at the existing alignment contour keep the runtime's
    # centroid-based band bounds exact, not merely the head placement.
    builder.patch(bottom_right, right[:mid_right + 1], middle_right, rear[:mid_rear_right + 1], columns=10, rows=24, harmonic=True)
    builder.patch(bottom_left, left[:mid_left + 1], middle_left, rear[mid_rear_left:][::-1], columns=10, rows=24, harmonic=True)
    builder.patch(middle_right, right[mid_right:right_split + 1], upper_right, rear[mid_rear_right:rim[0] + 1], columns=10, rows=24, harmonic=True)
    builder.patch(middle_left, left[mid_left:left_split + 1], upper_left, rear[rim[-1]:mid_rear_left + 1][::-1], columns=10, rows=24, harmonic=True)
    bottom = np.r_[upper_right, rear[rim[0] + 1:rim[-1] + 1], upper_left[-2::-1]]
    amount = np.linspace(0, 1, 65)
    a, b = vertices[right[-1]], vertices[left[-1]]
    points = (1 - amount[:, None]) * a + amount[:, None] * b
    points[:, 0] = 0.5 * (a[0] + b[0]) + 0.5 * (a[0] - b[0]) * np.cos(np.pi * amount)
    points[:, 2] -= 0.050 * np.sin(np.pi * amount)
    top = np.r_[right[-1], np.arange(len(builder.vertices), len(builder.vertices) + len(points) - 2), left[-1]]
    builder.vertices = np.vstack((builder.vertices, points[1:-1]))
    builder.patch(bottom, right[right_split:], top, left[left_split:], columns=64, rows=38)

    # The whole tiny side flap is visible above the collar. Keeping its lower
    # 38 faces would preserve an artificial bound but leave the ragged tail.
    rear_fragment, side_fragment = _fragment_faces(mesh)
    remove = rear_fragment | side_fragment
    added = np.vstack(builder.faces)
    result = trimesh.Trimesh(vertices=builder.vertices, faces=np.vstack((source_faces[~remove], added)), process=False)
    normals = np.asarray(result.vertex_normals).copy()
    original_count = len(vertices)
    normals[:original_count] = source_normals
    edges = result.edges_unique
    row, column = np.r_[edges[:, 0], edges[:, 1]], np.r_[edges[:, 1], edges[:, 0]]
    adjacency = coo_matrix((np.ones(len(row)), (row, column)), shape=(len(normals), len(normals))).tocsr()
    degree = np.asarray(adjacency.sum(axis=1)).ravel()
    for _ in range(12):
        average = (adjacency @ normals) / np.maximum(degree[:, None], 1)
        normals[original_count:] = 0.35 * normals[original_count:] + 0.65 * average[original_count:]
        normals[original_count:] /= np.maximum(np.linalg.norm(normals[original_count:], axis=1)[:, None], 1e-12)
    result.vertex_normals = normals
    result.metadata.update(mesh.metadata)
    report = {
        "method": "measured_posterior_neck_v1",
        "addedVertices": len(result.vertices) - original_count,
        "addedTriangles": len(added),
        "removedPosteriorSheetTriangles": int(rear_fragment.sum()),
        "removedSideFlapTriangles": int(side_fragment.sum()),
        "originalVertexMaximumDisplacementM": 0.0,
        "newSurfaceMinimumY": float(result.vertices[original_count:, 1].min()),
        "sourceNeckBounds": _neck_bounds(mesh).tolist(),
        "runtimeNeckBounds": _neck_bounds(result).tolist(),
        "patchBounds": [result.vertices[original_count:].min(axis=0).tolist(), result.vertices[original_count:].max(axis=0).tolist()],
    }
    result.metadata["posteriorNeckRepair"] = report
    return result, report


def _validate_repair(source: trimesh.Trimesh, result: trimesh.Trimesh, report: dict[str, Any]) -> None:
    """Reject geometry drift before writing a candidate."""
    count = len(source.vertices)
    if not np.array_equal(result.vertices[:count], source.vertices):
        raise ValueError("repair moved an original vertex")
    if not np.array_equal(result.vertex_normals[:count], source.vertex_normals):
        raise ValueError("repair changed an original normal")
    if result.vertices[count:, 1].min() < PATCH_MIN_Y - 1e-7:
        raise ValueError("repair entered the protected attachment section")
    bounds_delta = _neck_bounds(source) - _neck_bounds(result)
    if not (0 <= bounds_delta[1, 0] <= 0.0005):
        raise ValueError("side-flap removal exceeds the measured lateral bound change")
    bounds_delta[1, 0] = 0
    if np.any(bounds_delta != 0):
        raise ValueError("repair changed another runtime neck alignment bound")
    if (report["addedVertices"], report["addedTriangles"], report["removedPosteriorSheetTriangles"], report["removedSideFlapTriangles"]) != (3270, 6926, 3487, 109):
        raise ValueError("unexpected measured patch topology")
    if not np.isfinite(result.vertices).all() or not np.isfinite(result.vertex_normals).all():
        raise ValueError("repair contains non-finite geometry")
    start = len(result.faces) - report["addedTriangles"]
    rear_fragment, side_fragment = _fragment_faces(source)
    if not np.array_equal(result.faces[:start], source.faces[~(rear_fragment | side_fragment)]):
        raise ValueError("repair changed source triangles outside the measured fragments")
    if np.any(result.area_faces[start:] < 1e-14):
        raise ValueError("repair contains a degenerate triangle")
    edges = np.vstack((result.faces[:, [0, 1]], result.faces[:, [1, 2]], result.faces[:, [2, 0]]))
    edge_faces = np.tile(np.arange(len(result.faces)), 3)
    keys, inverse, counts = np.unique(np.sort(edges, axis=1), axis=0, return_inverse=True, return_counts=True)
    affected = np.zeros(len(keys), dtype=bool)
    affected[inverse[edge_faces >= start]] = True
    signs = np.where(edges[:, 0] < edges[:, 1], 1, -1)
    winding = np.bincount(inverse, weights=signs, minlength=len(keys))
    if np.any(counts[affected] > 2) or np.any(winding[affected & (counts == 2)] != 0):
        raise ValueError("repair has non-manifold or inconsistently wound edges")
    if np.count_nonzero(affected & (counts == 1)) != 82:
        raise ValueError("repair has an unexpected open boundary")


def _hair_shards(mesh: trimesh.Trimesh) -> np.ndarray:
    """Select only disconnected source remnants immediately beside the throat."""
    vertices, faces = np.asarray(mesh.vertices), np.asarray(mesh.faces)
    labels = trimesh.graph.connected_component_labels(mesh.face_adjacency, node_count=len(faces))
    remove = np.zeros(len(faces), dtype=bool)
    for label in np.unique(labels):
        indices = np.flatnonzero(labels == label)
        points = vertices[np.unique(faces[indices])]
        if (len(indices) < 300 and np.abs(points[:, 0]).min() > 0.041
                and np.abs(points[:, 0]).max() < 0.044 and points[:, 1].max() < 0.056
                and points[:, 2].min() > -0.03 and points[:, 2].max() < 0):
            remove[indices] = True
    return remove


def _clean_hair(mesh: trimesh.Trimesh) -> tuple[trimesh.Trimesh, dict[str, Any]]:
    remove = _hair_shards(mesh)
    if int(remove.sum()) != 478:
        raise ValueError("hair shards differ from the reviewed source")
    faces = np.asarray(mesh.faces)[~remove]
    used = np.unique(faces)
    remap = np.full(len(mesh.vertices), -1, dtype=int)
    remap[used] = np.arange(len(used))
    result = trimesh.Trimesh(
        vertices=np.asarray(mesh.vertices)[used], faces=remap[faces],
        vertex_normals=np.asarray(mesh.vertex_normals)[used], process=False,
    )
    result.visual = trimesh.visual.ColorVisuals(mesh=result, vertex_colors=mesh.visual.vertex_colors[used])
    result.metadata.update(mesh.metadata)
    report = {"method": "disconnected_side_neck_shards_v1", "removedTriangles": 478, "removedComponents": 4}
    result.metadata["neckShardRepair"] = report
    return result, report


def _write_mesh(mesh: trimesh.Trimesh, path: Path, name: str) -> None:
    """Preserve source optical/color metadata; record the repair's new scope."""
    mesh.metadata["neckPreservedThroughY"] = 0.044
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=name, geom_name=name)
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_name(f".{path.name}.pending")
    pending.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=True))
    pending.replace(path)


def repair(head_path: Path, hair_path: Path, output_dir: Path) -> dict[str, Any]:
    """Produce a new candidate only from the reviewed, immutable source pair."""
    inputs = {head_path.resolve(), hair_path.resolve()}
    if any((output_dir / name).resolve() in inputs for name in ("head.glb", "hair.glb")):
        raise ValueError("output directory must not overwrite a source asset")
    if any((output_dir / name).exists() for name in ("head.glb", "hair.glb", "repair.json")):
        raise ValueError("output directory must not contain an existing candidate")
    if _sha256(head_path) != HEAD_SHA256 or _sha256(hair_path) != HAIR_SHA256:
        raise ValueError("source pair differs from the reviewed angry_dog v2 geometry; repair aborted")
    source = _load_head(head_path)
    result, geometry_report = _repair(source)
    _validate_repair(source, result, geometry_report)
    hair_source = next(iter(trimesh.load(hair_path, force="scene", process=False).geometry.values()))
    hair, hair_report = _clean_hair(hair_source)
    colors = _skin_colors(result.vertices, skin_color="#f0b697")
    colors[:len(source.vertices)] = source.visual.vertex_colors[:, :3] / 255.0
    rgba = np.column_stack((np.rint(colors * 255), np.full(len(colors), 255))).astype(np.uint8)
    result.visual = trimesh.visual.ColorVisuals(mesh=result, vertex_colors=rgba)
    _write_mesh(result, output_dir / "head.glb", "reconstructed_skin_surface_v5")
    _write_mesh(hair, output_dir / "hair.glb", "generated_hair_surface_v5")
    report = {
        "profile": PROFILE,
        "inputs": {str(path): _sha256(path) for path in (head_path, hair_path)},
        "outputs": {name: _sha256(output_dir / name) for name in ("head.glb", "hair.glb")},
        "geometry": geometry_report,
        "hairCleanup": hair_report,
        "limitations": [
            "The new posterior volume is interpolated from the existing mesh contours.",
            "The patch reaches the existing open lower edge at Y=.04538; the editor supplies the neck-to-body seam.",
            "Removing the false side bound changes canonical neck maxX by -0.469 mm; actual head scale is unchanged and head X shifts +0.046 mm.",
            "Actual editor front, quarter, profile and back review is required before saving a new revision.",
        ],
    }
    (output_dir / "repair.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument("--hair", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(repair(args.head, args.hair, args.output_dir)))
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
