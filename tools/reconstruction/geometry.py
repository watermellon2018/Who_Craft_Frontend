"""Pure geometry helpers for the local multi-view reconstruction spike."""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np


@dataclass(frozen=True)
class SimilarityTransform:
    """A row-vector similarity transform: ``scale * points @ R + t``."""

    scale: float
    rotation: np.ndarray
    translation: np.ndarray

    def apply(self, points: np.ndarray) -> np.ndarray:
        """Apply the transform to an ``(N, 3)`` point array."""
        values = np.asarray(points, dtype=np.float64)
        return self.scale * values @ self.rotation + self.translation


def fit_similarity(
    source: np.ndarray,
    target: np.ndarray,
    *,
    allow_reflection: bool = False,
) -> SimilarityTransform:
    """Fit a least-squares 3D similarity transform with Umeyama/Kabsch.

    Args:
        source: Source points shaped ``(N, 3)``.
        target: Corresponding target points shaped ``(N, 3)``.
        allow_reflection: Permit a mirrored rotation when true.

    Returns:
        Transform mapping ``source`` onto ``target``.

    Raises:
        ValueError: If inputs are incompatible or geometrically degenerate.
    """
    source = np.asarray(source, dtype=np.float64)
    target = np.asarray(target, dtype=np.float64)
    if (
        source.shape != target.shape
        or source.ndim != 2
        or source.shape[1] != 3
    ):
        raise ValueError("source and target must have the same (N, 3) shape")
    if len(source) < 3:
        raise ValueError("at least three correspondences are required")

    source_center = source.mean(axis=0)
    target_center = target.mean(axis=0)
    source_zero = source - source_center
    target_zero = target - target_center
    source_energy = float(np.sum(source_zero * source_zero))
    if source_energy <= np.finfo(np.float64).eps:
        raise ValueError("source points are degenerate")

    u_matrix, singular_values, vt_matrix = np.linalg.svd(
        source_zero.T @ target_zero
    )
    rotation = u_matrix @ vt_matrix
    if not allow_reflection and np.linalg.det(rotation) < 0.0:
        u_matrix[:, -1] *= -1.0
        singular_values[-1] *= -1.0
        rotation = u_matrix @ vt_matrix
    scale = float(singular_values.sum() / source_energy)
    translation = target_center - scale * source_center @ rotation
    return SimilarityTransform(scale, rotation, translation)


def root_mean_square(values: np.ndarray) -> float:
    """Return RMS Euclidean magnitude for an ``(N, D)`` array."""
    values = np.asarray(values, dtype=np.float64)
    if values.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.sum(values * values, axis=-1))))


def fuse_aligned_shapes(
    shapes: Sequence[np.ndarray],
    stable_indices: Sequence[int],
) -> tuple[np.ndarray, list[float], list[np.ndarray]]:
    """Similarity-align landmark clouds to the first view and average them.

    The first view is the canonical camera frame. Rigid head pose and image
    scale are removed from the other views while their estimated 3D facial
    shape remains available to the average.
    """
    if not shapes:
        raise ValueError("at least one landmark shape is required")
    reference = np.asarray(shapes[0], dtype=np.float64)
    indices = np.asarray(stable_indices, dtype=np.int64)
    if reference.ndim != 2 or reference.shape[1] != 3:
        raise ValueError("landmark shapes must have shape (N, 3)")
    if (
        indices.size < 3
        or indices.min() < 0
        or indices.max() >= len(reference)
    ):
        raise ValueError(
            "stable_indices do not describe valid correspondences"
        )

    aligned_shapes = [reference.copy()]
    alignment_rms = [0.0]
    for shape in shapes[1:]:
        shape = np.asarray(shape, dtype=np.float64)
        if shape.shape != reference.shape:
            raise ValueError("all landmark shapes must have the same shape")
        transform = fit_similarity(shape[indices], reference[indices])
        aligned = transform.apply(shape)
        aligned_shapes.append(aligned)
        alignment_rms.append(
            root_mean_square(aligned[indices] - reference[indices])
        )
    return np.mean(aligned_shapes, axis=0), alignment_rms, aligned_shapes


def barycentric_points(
    vertices: np.ndarray,
    faces: np.ndarray,
    face_indices: np.ndarray,
    barycentric_coordinates: np.ndarray,
) -> np.ndarray:
    """Evaluate mesh points from face indices and barycentric coordinates."""
    vertices = np.asarray(vertices, dtype=np.float64)
    faces = np.asarray(faces, dtype=np.int64)
    face_indices = np.asarray(face_indices, dtype=np.int64)
    barycentric_coordinates = np.asarray(
        barycentric_coordinates,
        dtype=np.float64,
    )
    if barycentric_coordinates.shape != (len(face_indices), 3):
        raise ValueError("barycentric coordinates must have shape (N, 3)")
    triangles = vertices[faces[face_indices]]
    return np.sum(triangles * barycentric_coordinates[:, :, None], axis=1)


def gaussian_rbf_warp(
    points: np.ndarray,
    controls: np.ndarray,
    displacements: np.ndarray,
    *,
    sigma: float,
    regularization: float,
) -> np.ndarray:
    """Interpolate a regularized dense displacement from sparse controls.

    A Gaussian radial basis kernel and Tikhonov diagonal keep noisy FaceMesh
    landmarks from producing unstable spikes. The returned array contains
    displacements only; callers decide where a spatial preservation mask is
    appropriate.
    """
    points = np.asarray(points, dtype=np.float64)
    controls = np.asarray(controls, dtype=np.float64)
    displacements = np.asarray(displacements, dtype=np.float64)
    if controls.shape != displacements.shape or controls.ndim != 2:
        raise ValueError(
            "controls and displacements must have matching (N, D) shapes"
        )
    if points.ndim != 2 or points.shape[1] != controls.shape[1]:
        raise ValueError(
            "points and controls must share their coordinate dimension"
        )
    if sigma <= 0.0:
        raise ValueError("sigma must be positive")
    if regularization < 0.0:
        raise ValueError("regularization must be non-negative")

    control_distance = controls[:, None, :] - controls[None, :, :]
    kernel = np.exp(
        -np.sum(control_distance * control_distance, axis=2)
        / (2.0 * sigma * sigma)
    )
    kernel.flat[:: len(controls) + 1] += regularization
    coefficients = np.linalg.solve(kernel, displacements)

    point_distance = points[:, None, :] - controls[None, :, :]
    point_kernel = np.exp(
        -np.sum(point_distance * point_distance, axis=2)
        / (2.0 * sigma * sigma)
    )
    return point_kernel @ coefficients


def smoothstep(edge0: float, edge1: float, values: np.ndarray) -> np.ndarray:
    """Vectorized Hermite smoothstep with explicit edge validation."""
    if edge1 <= edge0:
        raise ValueError("edge1 must be greater than edge0")
    values = np.asarray(values, dtype=np.float64)
    unit = np.clip((values - edge0) / (edge1 - edge0), 0.0, 1.0)
    return unit * unit * (3.0 - 2.0 * unit)


def count_boundary_edges(faces: np.ndarray) -> int:
    """Count triangle edges referenced exactly once."""
    faces = np.asarray(faces, dtype=np.int64)
    edge_counts = Counter(
        tuple(sorted((int(a), int(b))))
        for triangle in faces
        for a, b in (
            (triangle[0], triangle[1]),
            (triangle[1], triangle[2]),
            (triangle[2], triangle[0]),
        )
    )
    return sum(count == 1 for count in edge_counts.values())


def edge_topology_diagnostics(faces: np.ndarray) -> dict[str, int]:
    """Count boundary, non-manifold, and inconsistent interior edges."""
    directed_counts = Counter(triangle_edges(faces))
    undirected_counts = Counter(
        tuple(sorted(edge))
        for edge, count in directed_counts.items()
        for _ in range(count)
    )
    boundary_edges = sum(
        count == 1 for count in undirected_counts.values()
    )
    non_manifold_edges = sum(
        count > 2 for count in undirected_counts.values()
    )
    orientation_conflicts = sum(
        count == 2
        and (
            directed_counts[(start, end)] != 1
            or directed_counts[(end, start)] != 1
        )
        for (start, end), count in undirected_counts.items()
    )
    return {
        "boundary_edges": boundary_edges,
        "non_manifold_edges": non_manifold_edges,
        "orientation_conflicts": orientation_conflicts,
    }


def _ordered_boundary_loops(faces: np.ndarray) -> list[list[int]]:
    """Return oriented loops formed by the one-use edges of a triangle mesh."""
    directed_edges = [
        (int(a), int(b))
        for triangle in np.asarray(faces, dtype=np.int64)
        for a, b in (
            (triangle[0], triangle[1]),
            (triangle[1], triangle[2]),
            (triangle[2], triangle[0]),
        )
    ]
    edge_counts = Counter(
        tuple(sorted(edge)) for edge in directed_edges
    )
    boundary_edges = [
        edge
        for edge in directed_edges
        if edge_counts[tuple(sorted(edge))] == 1
    ]

    successors: dict[int, int] = {}
    predecessor_counts: Counter[int] = Counter()
    for start, end in boundary_edges:
        if start in successors:
            raise ValueError("mesh boundary branches at a vertex")
        successors[start] = end
        predecessor_counts[end] += 1
    boundary_vertices = set(successors) | set(predecessor_counts)
    if (
        any(count != 1 for count in predecessor_counts.values())
        or set(successors) != boundary_vertices
    ):
        raise ValueError("mesh boundary is not a collection of simple loops")

    loops: list[list[int]] = []
    remaining = set(successors)
    while remaining:
        start = min(remaining)
        loop = [start]
        current = start
        while True:
            if current not in successors:
                raise ValueError("mesh boundary is not closed")
            next_vertex = successors[current]
            if next_vertex == start:
                break
            if next_vertex in loop:
                raise ValueError("self-intersecting mesh boundary")
            loop.append(next_vertex)
            current = next_vertex
        remaining.difference_update(loop)
        loops.append(loop)
    return loops


def extract_and_cap_mesh(
    vertices: np.ndarray,
    faces: np.ndarray,
    vertex_mask: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, list[int]]:
    """Extract fully selected triangles and close every resulting boundary.

    Caps are triangle fans around a new centroid. For the SMPL-X extraction
    this closes the neck cut and the pre-existing mouth opening, producing a
    standalone topologically closed asset.

    Returns:
        ``(vertices, faces, loop_sizes)`` in compact local indexing.
    """
    vertices = np.asarray(vertices, dtype=np.float64)
    faces = np.asarray(faces, dtype=np.int64)
    vertex_mask = np.asarray(vertex_mask, dtype=bool)
    if vertex_mask.shape != (len(vertices),):
        raise ValueError("vertex_mask must contain one value per vertex")

    selected_faces = faces[np.all(vertex_mask[faces], axis=1)]
    if len(selected_faces) == 0:
        raise ValueError("vertex mask selects no complete faces")
    used_vertices = np.unique(selected_faces)
    old_to_new = np.full(len(vertices), -1, dtype=np.int64)
    old_to_new[used_vertices] = np.arange(len(used_vertices), dtype=np.int64)
    compact_vertices = vertices[used_vertices].copy()
    compact_faces = old_to_new[selected_faces]

    loops = _ordered_boundary_loops(compact_faces)
    capped_faces = [compact_faces]
    for loop in loops:
        center_index = len(compact_vertices)
        center = compact_vertices[
            np.asarray(loop, dtype=np.int64)
        ].mean(axis=0)
        compact_vertices = np.vstack((compact_vertices, center))
        fan = np.asarray(
            [
                (loop[(index + 1) % len(loop)], loop[index], center_index)
                for index in range(len(loop))
            ],
            dtype=np.int64,
        )
        capped_faces.append(fan)
    loop_sizes = [len(loop) for loop in loops]
    return compact_vertices, np.vstack(capped_faces), loop_sizes


def clip_vector_lengths(vectors: np.ndarray, maximum: float) -> np.ndarray:
    """Clip vector magnitudes without changing their directions."""
    if maximum <= 0.0:
        raise ValueError("maximum must be positive")
    vectors = np.asarray(vectors, dtype=np.float64)
    lengths = np.linalg.norm(vectors, axis=1, keepdims=True)
    factors = np.minimum(1.0, maximum / np.maximum(lengths, 1e-12))
    return vectors * factors


def triangle_edges(faces: np.ndarray) -> Iterable[tuple[int, int]]:
    """Yield directed triangle edges; useful to diagnostics and consumers."""
    for triangle in np.asarray(faces, dtype=np.int64):
        yield int(triangle[0]), int(triangle[1])
        yield int(triangle[1]), int(triangle[2])
        yield int(triangle[2]), int(triangle[0])
