#!/usr/bin/env python3
"""Refine the curated angry_dog surface without running reconstruction again.

This explicit character profile is intentionally separate from the general
Hunyuan splitter. It corrects semantic labels, removes isolated scraps, and
adds editable relative albedo to the existing canonical source surface.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from scipy.interpolate import PchipInterpolator
from scipy.sparse import coo_matrix
from scipy.spatial import cKDTree

from postprocess_hunyuan_mesh import _compact_submesh, _parse_hex_rgb, _sha256


LEGACY_PROFILE = "stylized_reference_v1"
PROFILE = "stylized_reference_v2"
NECK_PRESERVE_MAX_Y = 0.055


def _smoothstep(values: np.ndarray) -> np.ndarray:
    values = np.clip(values, 0.0, 1.0)
    return values * values * (3.0 - 2.0 * values)


def _polish_face(mesh: trimesh.Trimesh) -> tuple[trimesh.Trimesh, dict[str, Any]]:
    """Remove reconstruction relief without moving landmarks or the neck.

    A local quadratic fit preserves broad facial curvature. Only depth changes:
    the existing eye centers, jaw outline, mouth outline and attachment remain
    in the same canonical coordinate frame. Stronger cleanup is confined to the
    old embossed brow tails, which the editor replaces with authored brows.
    """
    original = np.asarray(mesh.vertices).copy()
    result = original.copy()
    x, y, z = original.T
    ax = np.abs(x)
    front = _smoothstep((z - 0.042) / 0.018)
    outline = _smoothstep((0.075 - ax) / 0.013)
    vertical = _smoothstep((y - 0.108) / 0.015) * _smoothstep((0.236 - y) / 0.018)
    brow = np.exp(-((ax - 0.051) / 0.016) ** 4 - ((y - 0.183) / 0.020) ** 4)
    # Avoid smoothing nostril/lip folds or the optical aperture itself.
    eye = np.exp(-((ax - 0.032) / 0.023) ** 6 - ((y - 0.161) / 0.011) ** 6)
    nose = np.exp(-(x / 0.027) ** 6 - ((y - 0.132) / 0.031) ** 6)
    weight = front * outline * vertical * (1.0 - eye) * (1.0 - nose)
    maximum = (0.00065 + 0.00225 * brow) * weight
    active = np.flatnonzero(maximum > 1e-6)
    support = np.flatnonzero((z > 0.040) & (y > 0.105) & (y < 0.245))
    if len(active) and len(support) >= 24:
        tree = cKDTree(original[support, :2])
        distance, nearest = tree.query(original[active, :2], k=min(192, len(support)))
        adjacent = support[nearest]
        delta_xy = (original[adjacent, :2] - original[active, None, :2]) / 0.010
        dx, dy = delta_xy[:, :, 0], delta_xy[:, :, 1]
        basis = np.stack((np.ones_like(dx), dx, dy, dx * dx, dx * dy, dy * dy), axis=2)
        kernels = np.exp(-(distance / 0.007) ** 2)
        # Three fits suppress narrow ridges while the total displacement limit
        # prevents repeated filtering from eroding the source facial volume.
        for _ in range(3):
            for start in range(0, len(active), 4096):
                stop = start + 4096
                b, w = basis[start:stop], kernels[start:stop]
                lhs = np.einsum("nki,nk,nkj->nij", b, w, b)
                lhs += np.eye(6)[None, :, :] * 1e-8
                rhs = np.einsum("nki,nk,nk->ni", b, w, result[adjacent[start:stop], 2])
                depth = np.linalg.solve(lhs, rhs)[:, 0]
                indices = active[start:stop]
                proposed = result[indices, 2] + 0.78 * weight[indices] * (depth - result[indices, 2])
                result[indices, 2] = original[indices, 2] + np.clip(
                    proposed - original[indices, 2], -maximum[indices], maximum[indices],
                )
    polished = trimesh.Trimesh(vertices=result, faces=np.asarray(mesh.faces).copy(), process=False)
    normals = np.asarray(polished.vertex_normals).copy()
    changed = np.abs(result[:, 2] - original[:, 2]) > 1e-12
    affected = np.zeros(len(result), dtype=bool)
    affected[np.unique(np.asarray(mesh.faces)[changed[np.asarray(mesh.faces)].any(axis=1)])] = True
    normals[~affected] = np.asarray(mesh.vertex_normals)[~affected]
    polished.vertex_normals = normals
    displacement = np.linalg.norm(result - original, axis=1)
    return polished, {
        "modifiedVertices": int(changed.sum()),
        "maximumDisplacementM": float(displacement.max(initial=0)),
        "meanModifiedDisplacementM": float(displacement[changed].mean()) if changed.any() else 0.0,
        "xyLandmarksUnchanged": bool(np.array_equal(result[:, :2], original[:, :2])),
        "neckVerticesUnchanged": bool(np.array_equal(result[y <= 0.10], original[y <= 0.10])),
    }


def _linear(rgb: np.ndarray) -> np.ndarray:
    """Convert sRGB values in [0, 1] to linear RGB."""
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def _relative_color(target: str, base: str) -> np.ndarray:
    target_rgb = _linear(_parse_hex_rgb(target) / 255.0)
    base_rgb = _linear(_parse_hex_rgb(base) / 255.0)
    return np.clip(target_rgb / np.maximum(base_rgb, 1e-8), 0.0, 1.0)


def _skin_region(points: np.ndarray, original_skin: np.ndarray) -> np.ndarray:
    """Separate face/ears/neck from long hair in canonical metre coordinates.

    A smooth anatomical envelope avoids the false vertical hair strips caused
    by projecting a slightly turned portrait onto both sides of a 3D mesh.
    Previously classified central triangles near the edited neck join are kept.
    """
    x, y, z = points.T
    ax = np.abs(x)
    widths = np.interp(
        y,
        [
            0.055, 0.075, 0.095, 0.12, 0.15, 0.18, 0.19,
            0.20, 0.215, 0.225, 0.240, 0.250, 0.256,
        ],
        [
            0.042, 0.047, 0.060, 0.072, 0.075, 0.080, 0.076,
            0.071, 0.066, 0.061, 0.050, 0.029, 0.007,
        ],
    )
    face = (y >= 0.057) & (y <= 0.256) & (ax < widths)
    hairline_y = np.interp(
        ax,
        [0.0, 0.020, 0.040, 0.053, 0.063, 0.075, 0.082, 0.10],
        [0.252, 0.248, 0.235, 0.220, 0.200, 0.183, 0.175, 0.140],
    )
    side_weight = np.clip((ax - 0.052) / 0.020, 0, 1)
    side_weight = side_weight * side_weight * (3 - 2 * side_weight)
    temple_weight = np.clip((y - 0.150) / 0.020, 0, 1)
    temple_weight = temple_weight * temple_weight * (3 - 2 * temple_weight)
    face &= (y <= hairline_y) & (z > 0.004 + 0.041 * side_weight * temple_weight)
    # The ears sit behind the cheek surface, with long hair behind them.
    ears = (
        ((ax - 0.077) / 0.012) ** 2
        + ((y - 0.160) / 0.022) ** 2
        + ((z - 0.012) / 0.018) ** 2
    ) < 1.0
    ears &= y >= 0.140
    ears &= y < 0.176 - 1.2 * np.maximum(z - 0.012, 0)
    earlobes = (
        ((ax - 0.072) / 0.012) ** 2
        + ((y - 0.133) / 0.012) ** 2
        + ((z - 0.006) / 0.012) ** 2
    ) < 1.0
    neck = (y < 0.103) & (ax < 0.043) & (z > -0.047) & (z < 0.055)
    skin = face | earlobes | ((ears | neck) & original_skin)
    behind_ear = (y < 0.140) & (ax > 0.058) & (z < -0.010)
    skin[behind_ear] = False
    protected = (
        (y <= NECK_PRESERVE_MAX_Y) & (ax < 0.055) & (z > -0.052) & (z < 0.066)
    ) | (
        (y < 0.10) & (ax < 0.050) & (z > -0.049) & (z < 0.066)
    )
    skin[protected] = original_skin[protected]
    return skin


def _remove_scraps(mesh: trimesh.Trimesh, *, min_faces: int) -> trimesh.Trimesh:
    """Retain sizeable connected surfaces plus the protected neck boundary."""
    parts = mesh.split(only_watertight=False, repair=False)
    keep = [
        part
        for part in parts
        if len(part.faces) >= min_faces
        or np.any(
            (np.asarray(part.vertices)[:, 1] <= NECK_PRESERVE_MAX_Y)
            & (np.abs(np.asarray(part.vertices)[:, 0]) < 0.055)
            & (np.asarray(part.vertices)[:, 2] > -0.052)
            & (np.asarray(part.vertices)[:, 2] < 0.066)
        )
    ]
    if not keep:
        raise ValueError("surface cleanup removed every mesh component")
    return trimesh.util.concatenate(keep)


def _back_hair_shell(
    vertices: np.ndarray,
    source_normals: np.ndarray | None = None,
) -> trimesh.Trimesh:
    """Fit a continuous hair surface behind the ears and below their lobes.

    The source supplies the radius in a cylindrical grid. Local surface
    interpolation closes missing ribbons without a voxel remesh or a new
    silhouette. The front-facing half is absent at face and ear height; only
    the lower side curtains extend forward to cover torn ribbons below the ears.
    """
    rows, columns = 70, 76
    lower_y, upper_y = 0.0435, 0.273
    lower_angle, upper_angle = np.pi * 0.5 + 0.12, np.pi * 1.5 - 0.12
    curtain_sweep = 0.46
    center_z = -0.018
    angle = np.mod(np.arctan2(vertices[:, 0], vertices[:, 2] - center_z), 2 * np.pi)
    supported = (
        (vertices[:, 1] >= lower_y)
        & (vertices[:, 1] <= upper_y)
        & (angle >= lower_angle - curtain_sweep)
        & (angle <= upper_angle + curtain_sweep)
    )
    points = vertices[supported]
    if len(points) < 100:
        raise ValueError("source hair does not support a back surface")
    radius = np.hypot(points[:, 0], points[:, 2] - center_z)
    usable = radius > 0.045
    points = points[usable]
    radius = radius[usable]
    sample_angle = angle[supported][usable]
    if len(points) < 8:
        raise ValueError("source hair has no outer back surface to interpolate")
    heights = np.linspace(lower_y, upper_y, rows)[:, None]
    curtain = np.clip((0.125 - heights) / 0.025, 0, 1)
    curtain = curtain * curtain * (3 - 2 * curtain)
    theta_grid = lower_angle - curtain_sweep * curtain + (
        upper_angle - lower_angle + 2 * curtain_sweep * curtain
    ) * np.linspace(0, 1, columns)[None, :]
    height_grid = np.broadcast_to(heights, theta_grid.shape)
    # Interpolate the observed surface rather than taking the outermost point
    # in a cell: max radius makes a raised lip under the original crown.
    surface_tree = cKDTree(np.column_stack((sample_angle * 0.08, points[:, 1])))
    distance, nearest = surface_tree.query(
        np.column_stack((theta_grid.ravel() * 0.08, height_grid.ravel())), k=8,
    )
    weights = 1.0 / np.maximum(distance, 1e-5) ** 2
    weights /= weights.sum(axis=1, keepdims=True)
    radii = np.sum(radius[nearest] * weights, axis=1).reshape(rows, columns)

    def neighbor_sum(values: np.ndarray) -> np.ndarray:
        padded = np.pad(values, 1, mode="edge")
        return sum(
            padded[y:y + rows, x:x + columns]
            for y in range(3)
            for x in range(3)
        )

    source_radii = radii.copy()
    # Reject a thin generated horizontal fold before smoothing. Keeping that
    # radius spike would reproduce its shelf even after replacing its triangles.
    padded_radii = np.pad(radii, ((7, 7), (0, 0)), mode="edge")
    radii = np.median(
        np.stack([padded_radii[offset:offset + rows] for offset in range(15)]), axis=0,
    )
    for _ in range(8):
        radii = neighbor_sum(radii) / 9.0
    top_blend = np.clip((heights - 0.218) / 0.027, 0.0, 1.0)
    top_blend = top_blend * top_blend * (3.0 - 2.0 * top_blend)
    radii = radii * (1.0 - top_blend) + source_radii * top_blend
    edge_distance = np.minimum(np.arange(columns), np.arange(columns)[::-1])
    side_inset = 0.0025 + 0.0025 * np.exp(-edge_distance / 4.0)
    inset = side_inset[None, :] * (1.0 - top_blend) + 0.00015 * top_blend
    theta = theta_grid
    source_join_y = 0.250 + 0.004 * np.cos(theta * 2.0)
    upper_tuck = np.clip((heights - source_join_y - 0.0005) / 0.012, 0.0, 1.0)
    upper_tuck = upper_tuck * upper_tuck * (3.0 - 2.0 * upper_tuck)
    radii = np.maximum(radii - inset - 0.006 * upper_tuck, 0.015)
    shell_vertices = np.stack(
        (
            radii * np.sin(theta),
            np.broadcast_to(heights, radii.shape),
            center_z + radii * np.cos(theta),
        ),
        axis=2,
    ).reshape(-1, 3)
    faces = []
    for y in range(rows - 1):
        for x in range(columns - 1):
            a = y * columns + x
            b = a + 1
            c = a + columns
            d = c + 1
            faces.extend(((a, b, c), (b, d, c)))
    shell = trimesh.Trimesh(vertices=shell_vertices, faces=faces, process=False)
    if source_normals is not None:
        sampled_normals = np.asarray(source_normals)[supported][usable]
        sampled_normals = np.sum(sampled_normals[nearest] * weights[:, :, None], axis=1)
        sampled_normals /= np.maximum(np.linalg.norm(sampled_normals, axis=1), 1e-8)[:, None]
        normal_blend = np.clip((shell_vertices[:, 1] - 0.220) / 0.022, 0.0, 1.0)
        normal_blend = normal_blend * normal_blend * (3 - 2 * normal_blend)
        blended_normals = (
            np.asarray(shell.vertex_normals) * (1 - normal_blend[:, None])
            + sampled_normals * normal_blend[:, None]
        )
        blended_normals /= np.maximum(np.linalg.norm(blended_normals, axis=1), 1e-8)[:, None]
        shell.vertex_normals = blended_normals
    return shell


def _polished_hair(
    mesh: trimesh.Trimesh,
) -> tuple[trimesh.Trimesh, dict[str, Any]]:
    """Replace torn lower ribbons with ten broad, curved and closed locks.

    The retained crown and swept hairline establish identity. A source-fitted
    backing joins them behind the ears; the new locks create a clean scalloped
    shoulder-length silhouette and hide the backing's lower edge.
    """
    vertices = np.asarray(mesh.vertices)
    faces = np.asarray(mesh.faces)
    centers = vertices[faces].mean(axis=1)
    x, y, z = centers.T
    protected = (y <= NECK_PRESERVE_MAX_Y) & (np.abs(x) < 0.055) & (z > -0.052) & (z < 0.066)
    rear_angle = np.arctan2(x, z + 0.018)
    rear_top = 0.250 + 0.004 * np.cos(rear_angle * 2.0)
    rear_patch = (z < -0.060) & (np.abs(x) < 0.078) & (y < rear_top)
    # Retain the swept temple at the front, but remove every free lower ribbon
    # outside the exact protected attachment triangles.
    lower_patch = (y < 0.254) & ((z < 0.016) | (y < 0.137))
    remove = (rear_patch | lower_patch) & ~protected
    retained = _compact_submesh(vertices, faces, ~remove, vertex_normals=mesh.vertex_normals)
    retained_original = np.asarray(retained.vertices).copy()
    retained_normals = np.asarray(retained.vertex_normals).copy()
    polished_vertices = retained_original.copy()
    # Only high-frequency crown roughness is filtered; boundary vertices and
    # their immediate neighbours are fixed to retain the actual hairline.
    edges = retained.edges_unique
    edge_counts = np.bincount(retained.edges_unique_inverse, minlength=len(edges))
    boundary = np.zeros(len(polished_vertices), dtype=bool)
    boundary[np.unique(edges[edge_counts == 1])] = True
    boundary[edges[boundary[edges].any(axis=1)].ravel()] = True
    crown_weight = _smoothstep((polished_vertices[:, 1] - 0.190) / 0.025)
    crown_weight *= _smoothstep((0.297 - polished_vertices[:, 1]) / 0.012)
    crown_weight[boundary] = 0
    row = np.concatenate((edges[:, 0], edges[:, 1]))
    column = np.concatenate((edges[:, 1], edges[:, 0]))
    adjacency = coo_matrix((np.ones(len(row)), (row, column)), shape=(len(polished_vertices),) * 2).tocsr()
    degree = np.maximum(np.asarray(adjacency.sum(axis=1)).ravel(), 1.0)
    for _ in range(10):
        for factor in (0.48, -0.49):
            average = adjacency @ polished_vertices / degree[:, None]
            polished_vertices += factor * crown_weight[:, None] * (average - polished_vertices)
    displacement = polished_vertices - retained_original
    length = np.linalg.norm(displacement, axis=1)
    polished_vertices = retained_original + displacement * np.minimum(1, 0.0012 / np.maximum(length, 1e-12))[:, None]
    retained.vertices = polished_vertices
    new_normals = np.asarray(retained.vertex_normals).copy()
    new_normals[crown_weight == 0] = retained_normals[crown_weight == 0]
    retained.vertex_normals = new_normals
    center_z = -0.018
    source_angle = np.mod(np.arctan2(vertices[:, 0], vertices[:, 2] - center_z), 2 * np.pi)
    source_radius = np.hypot(vertices[:, 0], vertices[:, 2] - center_z)
    valid = (source_radius > 0.020) & (vertices[:, 1] > 0.038) & (vertices[:, 1] < 0.286)
    support = vertices[valid]
    support_radius = source_radius[valid]
    support_angle = source_angle[valid]
    tree = cKDTree(np.column_stack((support_angle * 0.08, support[:, 1])))
    normal_tree = cKDTree(vertices)
    source_normals = np.asarray(mesh.vertex_normals)
    locks: list[trimesh.Trimesh] = []
    lock_count, rows, columns = 10, 48, 15
    lock_centers = np.linspace(1.23, 2 * np.pi - 1.23, lock_count)
    spacing = lock_centers[1] - lock_centers[0]
    along = np.linspace(0.0, 1.0, rows)[:, None]
    across = np.linspace(-1.0, 1.0, columns)[None, :]
    contour_heights = [0.040, 0.065, 0.10, 0.16, 0.20, 0.23, 0.25, 0.28]
    side_contour = PchipInterpolator(contour_heights, [0.090, 0.086, 0.080, 0.089, 0.090, 0.082, 0.0747, 0.0536])
    back_contour = PchipInterpolator(contour_heights, [0.075, 0.071, 0.064, 0.061, 0.0623, 0.0622, 0.0576, 0.0375])
    for index, angle in enumerate(lock_centers):
        lateral = abs(np.sin(angle))
        top = 0.274 + 0.003 * (1.0 - lateral)
        bottom = 0.041 + 0.005 * (0.5 + 0.5 * np.cos(index * 1.7))
        width = spacing * (0.55 - 0.05 * _smoothstep((along - 0.50) / 0.50))
        # Each shoulder-length lock bends outward at its tip. A small twist
        # keeps the silhouette from becoming a repeated straight curtain.
        twist = 0.045 * np.sin(index * 1.9) * np.sin(np.pi * along)
        theta = angle + across * width + twist
        height = top + (bottom - top) * along + 0.008 * across ** 2 * along ** 6
        height = np.broadcast_to(height, theta.shape)
        ear_clearance = np.exp(-((height - 0.165) / 0.051) ** 2)
        if index == 0:
            theta += 0.48 * ear_clearance
        elif index == lock_count - 1:
            theta -= 0.48 * ear_clearance
        distance, nearest = tree.query(np.column_stack((theta.ravel() * 0.08, height.ravel())), k=24)
        weights = 1.0 / np.maximum(distance, 0.002) ** 2
        weights /= weights.sum(axis=1, keepdims=True)
        source_fit = np.sum(support_radius[nearest] * weights, axis=1).reshape(rows, columns)
        # Sample only the crown join; clean lower contours avoid copying the
        # source's folded shelves and dangling loops into the new locks.
        for _ in range(8):
            padded = np.pad(source_fit, 1, mode="edge")
            source_fit = sum(padded[dy:dy + rows, dx:dx + columns] for dy in range(3) for dx in range(3)) / 9
        side_radius = side_contour(height)
        back_radius = back_contour(height)
        radius = 1.0 / np.sqrt((np.sin(theta) / side_radius) ** 2 + (np.cos(theta) / back_radius) ** 2)
        root_blend = _smoothstep((height - 0.257) / 0.018)
        radius = radius * (1.0 - root_blend) + source_fit * root_blend
        bulge = 0.0045 * np.cos(across * np.pi / 2) ** 2 * np.sin(along * np.pi / 2)
        flare = 0.007 * _smoothstep((along - 0.70) / 0.30)
        # Roots are inset under the retained crown/backing; the clean locks
        # emerge gradually and their edges stay behind neighbouring locks.
        inset = 0.003 * _smoothstep((height - 0.257) / 0.017)
        radius = radius + bulge + flare - inset - 0.0015
        front = np.stack((radius * np.sin(theta), height, center_z + radius * np.cos(theta)), axis=2).reshape(-1, 3)
        back_radius = radius - 0.0025
        back = np.stack((back_radius * np.sin(theta), height, center_z + back_radius * np.cos(theta)), axis=2).reshape(-1, 3)
        count = len(front)
        lock_faces: list[tuple[int, int, int]] = []
        for row_index in range(rows - 1):
            for column_index in range(columns - 1):
                a = row_index * columns + column_index
                b, c, d = a + 1, a + columns, a + columns + 1
                # Rows descend, so reverse the old backing shell winding.
                lock_faces.extend(((a, c, b), (b, c, d), (a + count, b + count, c + count), (b + count, d + count, c + count)))
        perimeter = list(range(columns))
        perimeter += [row_index * columns + columns - 1 for row_index in range(1, rows)]
        perimeter += list(range(rows * columns - 2, (rows - 1) * columns - 1, -1))
        perimeter += [row_index * columns for row_index in range(rows - 2, 0, -1)]
        for a, b in zip(perimeter, perimeter[1:] + perimeter[:1]):
            lock_faces.extend(((a, b, a + count), (b, b + count, a + count)))
        lock = trimesh.Trimesh(vertices=np.vstack((front, back)), faces=lock_faces, process=False)
        normals = np.asarray(lock.vertex_normals).copy()
        _, closest = normal_tree.query(front)
        normal_blend = _smoothstep((front[:, 1] - 0.239) / 0.027)[:, None]
        normals[:count] = normals[:count] * (1 - normal_blend) + source_normals[closest] * normal_blend
        normals /= np.maximum(np.linalg.norm(normals, axis=1), 1e-12)[:, None]
        lock.vertex_normals = normals
        locks.append(lock)
    # The inner scalp closes the area behind the exposed ear. It sits inside
    # the pinna, not in front of it, and remains behind the broad outer locks.
    height = np.broadcast_to(np.linspace(0.070, 0.274, 72)[:, None], (72, 92))
    minimum_angle = 0.77 + 0.58 * (1 - _smoothstep((height - 0.110) / 0.050))
    theta = minimum_angle + (2 * np.pi - 2 * minimum_angle) * np.linspace(0, 1, 92)[None, :]
    radius = 1.0 / np.sqrt((np.sin(theta) / side_contour(height)) ** 2 + (np.cos(theta) / back_contour(height)) ** 2)
    side_edge = np.exp(-((np.minimum(theta - minimum_angle, 2 * np.pi - minimum_angle - theta)) / 0.52) ** 2)
    ear_inset = 0.014 * side_edge * np.exp(-((height - 0.170) / 0.048) ** 4)
    radius -= 0.005 + ear_inset
    shell_vertices = np.stack((radius * np.sin(theta), height, center_z + radius * np.cos(theta)), axis=2).reshape(-1, 3)
    shell_faces = []
    for row_index in range(71):
        for column_index in range(91):
            a = row_index * 92 + column_index
            shell_faces.extend(((a, a + 1, a + 92), (a + 1, a + 93, a + 92)))
    shell = trimesh.Trimesh(vertices=shell_vertices, faces=shell_faces, process=False)
    combined = trimesh.util.concatenate((retained, shell, *locks))
    return combined, {
        "replacedSourceTriangles": int(remove.sum()),
        "protectedSourceTriangles": int(protected.sum()),
        "retainedCrownMaximumDisplacementM": float(np.linalg.norm(polished_vertices - retained_original, axis=1).max(initial=0)),
        "broadLowerLocks": lock_count,
        "closedLockMeshes": bool(all(lock.is_watertight and lock.is_winding_consistent for lock in locks)),
        "backingVertices": len(shell.vertices),
        "backingTriangles": len(shell.faces),
        "lockVertices": sum(len(lock.vertices) for lock in locks),
        "lockTriangles": sum(len(lock.faces) for lock in locks),
        "bounds": combined.bounds.tolist(),
    }


def _skin_colors(vertices: np.ndarray, *, skin_color: str) -> np.ndarray:
    """Paint albedo details, keeping authored illumination out of the asset."""
    x, y, z = vertices.T
    colors = np.ones((len(vertices), 3), dtype=np.float64)
    front = np.clip((z - 0.050) / 0.027, 0.0, 1.0)

    def blend(target: str, weight: np.ndarray) -> None:
        nonlocal colors
        colors = colors * (1.0 - weight[:, None]) + (
            _relative_color(target, skin_color) * weight[:, None]
        )

    cheeks = np.exp(-((np.abs(x) - 0.040) / 0.021) ** 2 - ((y - 0.135) / 0.018) ** 2)
    blend("#e5a292", cheeks * front * 0.48)
    # The small upward arc follows the reconstructed neutral smile.
    mouth_y = 0.0955 + 0.0050 * np.minimum((x / 0.027) ** 2, 1.0)
    lips = np.exp(-(np.abs(x) / 0.0265) ** 6 - ((y - mouth_y) / 0.0040) ** 4)
    blend("#ce877d", lips * front * 0.92)
    lower_lip = np.exp(-(np.abs(x) / 0.021) ** 6 - ((y - 0.0925) / 0.0025) ** 2)
    blend("#e4a194", lower_lip * front * 0.40)
    # The preserved join stays untinted so runtime seam colors still match.
    colors[y <= NECK_PRESERVE_MAX_Y] = 1.0
    return np.clip(colors, 0.0, 1.0)


def _hair_colors(vertices: np.ndarray) -> np.ndarray:
    """Add restrained copper strand variation which follows the 3D surface."""
    x, y, z = vertices.T
    angle = np.arctan2(x, z + 0.018)
    strand = 0.5 + 0.5 * np.sin(angle * 19.0 + y * 13.0)
    fine = 0.5 + 0.5 * np.sin(angle * 63.0 + y * 29.0)
    value = 0.73 + 0.20 * strand + 0.055 * fine
    return np.clip(value[:, None] * np.asarray([1.0, 0.84, 0.98]), 0.0, 1.0)


def _export(
    mesh: trimesh.Trimesh, path: Path, name: str, colors: np.ndarray, *, profile: str = PROFILE,
) -> None:
    """Export glTF linear COLOR_0 multipliers and explicit runtime metadata."""
    rgba = np.column_stack((np.rint(colors * 255.0), np.full(len(colors), 255)))
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=rgba.astype(np.uint8))
    mesh.metadata.update(
        name=name,
        sourceProfile=profile,
        colorMode="relative_linear",
        canonicalCrownY=0.30,
        neckPreservedThroughY=NECK_PRESERVE_MAX_Y,
    )
    if name == "reconstructed_skin_surface_v5":
        mesh.metadata["referenceFace"] = {
            "eyeCenters": [
                [-0.0319546, 0.1603329, 0.0806809],
                [0.0321932, 0.1603329, 0.0806809],
            ],
            "eyeWidth": 0.035 if profile == PROFILE else 0.030,
            "eyeHeight": 0.018 if profile == PROFILE else 0.0135,
            "irisDiameter": 0.019 if profile == PROFILE else 0.0158,
        }
        if profile == PROFILE:
            # The geometry mask's old lower bound cuts through the lips; it
            # must not be interpreted as an anatomical chin landmark. These
            # anchors are measured in the unscaled canonical source frame.
            mesh.metadata["referenceFace"]["anchors"] = {
                "chinY": 0.0607,
                "mouthY": 0.096,
                "noseY": 0.1275,
            }
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=name, geom_name=name)
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_name(f".{path.name}.pending")
    pending.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=True))
    pending.replace(path)


def refine(
    head_path: Path,
    hair_path: Path,
    output_dir: Path,
    *,
    skin_color: str,
    profile: str = PROFILE,
) -> dict[str, Any]:
    """Create a new candidate, leaving source assets and revisions unchanged."""
    if profile not in (LEGACY_PROFILE, PROFILE):
        raise ValueError("unsupported reference surface profile")
    inputs = {head_path.resolve(), hair_path.resolve()}
    if any((output_dir / name).resolve() in inputs for name in ("head.glb", "hair.glb")):
        raise ValueError("output directory must not overwrite a source asset")
    sources = [trimesh.load(path, force="mesh", process=False) for path in (head_path, hair_path)]
    if any(not isinstance(mesh, trimesh.Trimesh) for mesh in sources):
        raise ValueError("head and hair inputs must contain triangle geometry")
    mesh = trimesh.util.concatenate(sources)
    original_skin = np.arange(len(mesh.faces)) < len(sources[0].faces)
    vertices = np.asarray(mesh.vertices)
    faces = np.asarray(mesh.faces)
    skin = _skin_region(vertices[faces].mean(axis=1), original_skin)
    head = _compact_submesh(vertices, faces, skin, vertex_normals=mesh.vertex_normals)
    hair = _compact_submesh(vertices, faces, ~skin, vertex_normals=mesh.vertex_normals)
    # Welding is only for connectivity; coordinates stay at source precision.
    head.merge_vertices(merge_norm=True, merge_tex=True)
    hair.merge_vertices(merge_norm=True, merge_tex=True)
    head = _remove_scraps(head, min_faces=180)
    hair = _remove_scraps(hair, min_faces=450)
    face_polish: dict[str, Any] | None = None
    hair_polish: dict[str, Any] | None = None
    legacy_backing: dict[str, Any] | None = None
    if profile == PROFILE:
        head, face_polish = _polish_face(head)
        hair, hair_polish = _polished_hair(hair)
    else:
        hair, legacy_backing = _legacy_hair_backing(hair)
    _export(
        head,
        output_dir / "head.glb",
        "reconstructed_skin_surface_v5",
        _skin_colors(head.vertices, skin_color=skin_color),
        profile=profile,
    )
    _export(hair, output_dir / "hair.glb", "generated_hair_surface_v5", _hair_colors(hair.vertices), profile=profile)
    report = {
        "profile": profile,
        "colorMode": "relative_linear",
        "skinBaseColor": skin_color,
        "inputs": {str(path): _sha256(path) for path in (head_path, hair_path)},
        "outputs": {name: _sha256(output_dir / name) for name in ("head.glb", "hair.glb")},
        "head": {
            "vertices": len(head.vertices),
            "triangles": len(head.faces),
            "bounds": head.bounds.tolist(),
        },
        "hair": {
            "vertices": len(hair.vertices),
            "triangles": len(hair.faces),
            "bounds": hair.bounds.tolist(),
        },
        "facePolish": face_polish,
        "hairPolish": hair_polish,
        "hairBacking": legacy_backing,
        "preservedNeckMaxY": NECK_PRESERVE_MAX_Y,
        "limitations": [
            "This curated profile is specific to the canonical angry_dog reconstruction.",
            (
                "Lower hair uses authored broad locks; individual source strands are not recovered."
                if profile == PROFILE else
                "A fitted back-half shell replaces malformed rear ribbons; outer side strands and crown remain source geometry."
            ),
            "Face proportions, eyes, brows and headband are adjusted by the editor runtime.",
        ],
    }
    (output_dir / "refinement.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def _legacy_hair_backing(hair: trimesh.Trimesh) -> tuple[trimesh.Trimesh, dict[str, Any]]:
    """Keep v1 geometry reproducible for previously saved appearance assets."""
    hair_shell = _back_hair_shell(np.asarray(hair.vertices), hair.vertex_normals)
    hair_centroids = np.asarray(hair.vertices)[hair.faces].mean(axis=1)
    # The generated rear ribbons fold into a false horizontal shelf. The
    # fitted shell replaces this interior patch while outer curls stay intact.
    rear_angle = np.arctan2(hair_centroids[:, 0], hair_centroids[:, 2] + 0.018)
    rear_top = 0.250 + 0.004 * np.cos(rear_angle * 2.0)
    rear_patch = (
        (hair_centroids[:, 2] < -0.060)
        & (np.abs(hair_centroids[:, 0]) < 0.078)
        & (hair_centroids[:, 1] > 0.0435)
        & (hair_centroids[:, 1] < rear_top)
    )
    hair = _compact_submesh(
        np.asarray(hair.vertices),
        np.asarray(hair.faces),
        ~rear_patch,
        vertex_normals=hair.vertex_normals,
    )
    return trimesh.util.concatenate((hair, hair_shell)), {
        "vertices": len(hair_shell.vertices),
        "triangles": len(hair_shell.faces),
        "bounds": hair_shell.bounds.tolist(),
        "maximumFrontZ": float(hair_shell.vertices[:, 2].max()),
        "replacedRearTriangles": int(rear_patch.sum()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument("--hair", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--skin-color", default="#f0b697")
    parser.add_argument("--profile", choices=(LEGACY_PROFILE, PROFILE), default=PROFILE)
    args = parser.parse_args()
    print(json.dumps(refine(args.head, args.hair, args.output_dir, skin_color=args.skin_color, profile=args.profile)))


if __name__ == "__main__":
    main()
