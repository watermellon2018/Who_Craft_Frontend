#!/usr/bin/env python3
"""Normalize a Hunyuan mesh and render deterministic CPU previews."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Sequence

import cv2
import numpy as np
import trimesh


AXES = {
    "+x": np.asarray((1.0, 0.0, 0.0)),
    "-x": np.asarray((-1.0, 0.0, 0.0)),
    "+y": np.asarray((0.0, 1.0, 0.0)),
    "-y": np.asarray((0.0, -1.0, 0.0)),
    "+z": np.asarray((0.0, 0.0, 1.0)),
    "-z": np.asarray((0.0, 0.0, -1.0)),
}

HEAD_CUT_Y = 0.045
HAIR_VOXEL_PITCH = 0.0025
BACKING_MIN_SOURCE_FACES = 1_000
BACKING_CENTER = np.asarray((0.0, 0.165, -0.012))
BACKING_SCALE = np.asarray((0.88, 0.93, 0.87))


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--hair-output", required=True, type=Path)
    parser.add_argument("--front-reference", type=Path)
    parser.add_argument("--profile-reference", type=Path)
    parser.add_argument("--hair-color", default="#1e1a18")
    parser.add_argument("--skin-color", default="#d8ab8a")
    parser.add_argument("--preview-dir", required=True, type=Path)
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--source-up", choices=AXES, default="+y")
    parser.add_argument("--source-front", choices=AXES, default="+z")
    parser.add_argument("--height-metres", type=float, default=0.30)
    parser.add_argument("--render-size", type=int, default=640)
    parser.add_argument("--min-component-faces", type=int, default=100)
    return parser.parse_args()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_mesh(path: Path) -> trimesh.Trimesh:
    if not path.is_file():
        raise FileNotFoundError(f"mesh does not exist: {path}")
    loaded = trimesh.load(path, force="mesh", process=False)
    if not isinstance(loaded, trimesh.Trimesh):
        raise TypeError(f"expected a triangle mesh, got {type(loaded)!r}")
    if loaded.vertices.size == 0 or loaded.faces.size == 0:
        raise ValueError("mesh is empty")
    if not np.isfinite(loaded.vertices).all():
        raise ValueError("mesh contains non-finite vertices")
    return loaded


def _filter_components(
    mesh: trimesh.Trimesh,
    *,
    min_faces: int,
) -> tuple[trimesh.Trimesh, list[int]]:
    """Drop disconnected fragments below a conservative face threshold."""
    if min_faces < 1:
        raise ValueError("minimum component faces must be positive")
    components = list(mesh.split(only_watertight=False))
    counts = [len(component.faces) for component in components]
    kept_indices = [
        index
        for index, count in enumerate(counts)
        if count >= min_faces
    ]
    if not kept_indices:
        kept_indices = [int(np.argmax(counts))]
    kept = [components[index] for index in kept_indices]
    dropped = [
        count
        for index, count in enumerate(counts)
        if index not in kept_indices
    ]
    if len(kept) == 1:
        return kept[0], sorted(dropped)
    return trimesh.util.concatenate(kept), sorted(dropped)


def _axis_transform(
    vertices: np.ndarray,
    *,
    source_up: str,
    source_front: str,
) -> tuple[np.ndarray, np.ndarray]:
    """Map source axes to output +Y up and +Z front."""
    up = AXES[source_up]
    front = AXES[source_front]
    if not np.isclose(float(up @ front), 0.0):
        raise ValueError("source up and front axes must be perpendicular")
    right = np.cross(up, front)
    basis = np.column_stack((right, up, front))
    return np.asarray(vertices, dtype=np.float64) @ basis, basis


def _normalize_vertices(
    vertices: np.ndarray,
    *,
    height_metres: float,
) -> tuple[np.ndarray, float, np.ndarray]:
    if height_metres <= 0.0:
        raise ValueError("height must be positive")
    bounds = np.asarray((vertices.min(axis=0), vertices.max(axis=0)))
    source_height = float(bounds[1, 1] - bounds[0, 1])
    if source_height <= 1e-9:
        raise ValueError("mesh has zero height on the output Y axis")
    scale = height_metres / source_height
    normalized = np.asarray(vertices, dtype=np.float64) * scale
    scaled_bounds = np.asarray(
        (normalized.min(axis=0), normalized.max(axis=0))
    )
    translation = np.asarray(
        (
            -float(scaled_bounds[:, 0].mean()),
            -float(scaled_bounds[0, 1]),
            -float(scaled_bounds[:, 2].mean()),
        )
    )
    normalized += translation
    return normalized, scale, translation


def _rotation_y(degrees: float) -> np.ndarray:
    radians = math.radians(degrees)
    cosine = math.cos(radians)
    sine = math.sin(radians)
    return np.asarray(
        (
            (cosine, 0.0, -sine),
            (0.0, 1.0, 0.0),
            (sine, 0.0, cosine),
        ),
        dtype=np.float64,
    )


def _render_mesh(
    vertices: np.ndarray,
    faces: np.ndarray,
    output: Path,
    *,
    yaw_degrees: float,
    size: int,
    clay_rgb: Sequence[int] = (205, 164, 135),
) -> None:
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

    background_top = np.asarray((37, 39, 46), dtype=np.float64)
    background_bottom = np.asarray((13, 15, 20), dtype=np.float64)
    rows = np.linspace(0.0, 1.0, size)[:, None, None]
    canvas = np.repeat(
        background_top * (1.0 - rows) + background_bottom * rows,
        size,
        axis=1,
    ).astype(np.uint8)

    triangle_vertices = camera_vertices[faces]
    order = np.argsort(triangle_vertices[:, :, 2].mean(axis=1))
    light = np.asarray((0.35, 0.55, 1.0), dtype=np.float64)
    light /= np.linalg.norm(light)
    base_bgr = np.asarray(tuple(reversed(clay_rgb)), dtype=np.float64)
    for face_index in order:
        triangle = triangle_vertices[face_index]
        normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
        normal_length = np.linalg.norm(normal)
        if normal_length < 1e-12:
            continue
        normal /= normal_length
        shade = 0.38 + 0.62 * abs(float(normal @ light))
        colour = tuple(
            int(value) for value in np.clip(base_bgr * shade, 0, 255)
        )
        cv2.fillConvexPoly(
            canvas,
            pixels[faces[face_index]],
            colour,
            lineType=cv2.LINE_AA,
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), canvas):
        raise OSError(f"OpenCV could not write preview: {output}")


def _read_metadata(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"benchmark metadata does not exist: {path}")
    with path.open("r", encoding="utf-8") as handle:
        metadata = json.load(handle)
    if metadata.get("status") != "complete":
        raise ValueError("benchmark metadata is not complete")
    return metadata


def _parse_hex_rgb(value: str) -> np.ndarray:
    """Parse a CSS-style RGB hex colour into an unsigned-byte vector."""
    normalized = value.strip().lstrip("#")
    if len(normalized) == 3:
        normalized = "".join(channel * 2 for channel in normalized)
    if len(normalized) != 6:
        raise ValueError(f"invalid RGB colour: {value!r}")
    try:
        return np.asarray(
            [int(normalized[index : index + 2], 16) for index in (0, 2, 4)],
            dtype=np.uint8,
        )
    except ValueError as error:
        raise ValueError(f"invalid RGB colour: {value!r}") from error


def _reference_hair_region(
    path: Path,
    *,
    hair_color: str,
    skin_color: str,
) -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    """Extract the connected scalp/hair region from the prepared front RGBA."""
    image = cv2.imread(str(path.resolve()), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise FileNotFoundError(f"front reference does not exist: {path}")
    if image.ndim != 3 or image.shape[2] not in (3, 4):
        raise ValueError("front reference must be an RGB or RGBA image")

    rgb = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2RGB)
    alpha = (
        image[:, :, 3]
        if image.shape[2] == 4
        else np.full(image.shape[:2], 255, dtype=np.uint8)
    )
    foreground = alpha >= 64
    y_values, x_values = np.where(foreground)
    if not len(x_values):
        raise ValueError("front reference has no foreground alpha")
    bounds = (
        int(x_values.min()),
        int(y_values.min()),
        int(x_values.max()),
        int(y_values.max()),
    )

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float64)
    targets = np.asarray(
        [[_parse_hex_rgb(hair_color), _parse_hex_rgb(skin_color)]],
        dtype=np.uint8,
    )
    target_lab = cv2.cvtColor(targets, cv2.COLOR_RGB2LAB).astype(np.float64)[0]
    hair_delta = lab - target_lab[0]
    skin_delta = lab - target_lab[1]
    hair_delta[:, :, 0] *= 0.35
    skin_delta[:, :, 0] *= 0.35
    hair_distance = np.linalg.norm(hair_delta, axis=2)
    skin_distance = np.linalg.norm(skin_delta, axis=2)
    candidate = foreground & (hair_distance + 4.0 < skin_distance)
    candidate = cv2.morphologyEx(
        candidate.astype(np.uint8),
        cv2.MORPH_CLOSE,
        np.ones((7, 7), dtype=np.uint8),
    )
    candidate = cv2.morphologyEx(
        candidate,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)),
    )

    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    _, y_min, _, y_max = bounds
    minimum_area = max(64, int(foreground.sum() * 0.005))
    eligible = [
        label
        for label in range(1, count)
        if stats[label, cv2.CC_STAT_AREA] >= minimum_area
        and stats[label, cv2.CC_STAT_TOP] <= y_min + (y_max - y_min) * 0.5
    ]
    if not eligible:
        raise ValueError("front reference contains no connected hair region")
    hair_label = max(eligible, key=lambda label: stats[label, cv2.CC_STAT_AREA])
    hair_region = labels == hair_label
    hair_region = (
        cv2.dilate(
            hair_region.astype(np.uint8),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)),
        ).astype(bool)
        & foreground
    )

    inverse = (~hair_region).astype(np.uint8)
    hole_count, hole_labels, hole_stats, _ = cv2.connectedComponentsWithStats(
        inverse,
        8,
    )
    maximum_hole_area = max(256, int(foreground.sum() * 0.008))
    for label in range(1, hole_count):
        left = hole_stats[label, cv2.CC_STAT_LEFT]
        top = hole_stats[label, cv2.CC_STAT_TOP]
        width = hole_stats[label, cv2.CC_STAT_WIDTH]
        height = hole_stats[label, cv2.CC_STAT_HEIGHT]
        touches_border = (
            left == 0
            or top == 0
            or left + width == hair_region.shape[1]
            or top + height == hair_region.shape[0]
        )
        if (
            not touches_border
            and hole_stats[label, cv2.CC_STAT_AREA] <= maximum_hole_area
        ):
            hair_region[hole_labels == label] = True
    return hair_region, alpha, bounds


def _reference_guided_skin_mask(
    vertices: np.ndarray,
    faces: np.ndarray,
    visible: np.ndarray,
    base_skin: np.ndarray,
    reference_path: Path,
    *,
    profile_reference: Path | None,
    hair_color: str,
    skin_color: str,
) -> np.ndarray:
    """Refine front and side face/hair splits using locked reference views."""
    centroids = vertices[faces].mean(axis=1)
    visible_vertices = vertices[np.unique(faces[visible])]
    mesh_min = visible_vertices.min(axis=0)
    mesh_max = visible_vertices.max(axis=0)
    skin = base_skin.copy()

    if profile_reference is not None:
        profile_hair, profile_alpha, profile_bounds = _reference_hair_region(
            profile_reference,
            hair_color=hair_color,
            skin_color=skin_color,
        )
        x_min, y_min, x_max, y_max = profile_bounds
        depth_span = max(float(mesh_max[2] - mesh_min[2]), 1e-9)
        height_span = max(float(mesh_max[1] - mesh_min[1]), 1e-9)
        positive_side = centroids[:, 0] >= 0.0
        profile_horizontal = np.where(
            positive_side,
            -centroids[:, 2],
            centroids[:, 2],
        )
        profile_minimum = np.where(
            positive_side,
            -mesh_max[2],
            mesh_min[2],
        )
        profile_u = np.rint(
            x_min
            + (profile_horizontal - profile_minimum)
            / depth_span
            * (x_max - x_min)
        ).astype(np.int64)
        profile_v = np.rint(
            y_min
            + (mesh_max[1] - centroids[:, 1])
            / height_span
            * (y_max - y_min)
        ).astype(np.int64)
        profile_u = np.clip(profile_u, 0, profile_alpha.shape[1] - 1)
        profile_v = np.clip(profile_v, 0, profile_alpha.shape[0] - 1)
        profile_supported = (
            visible
            & (centroids[:, 1] > 0.155)
            & (np.abs(centroids[:, 0]) > 0.018)
            & (
                (centroids[:, 2] < -0.015)
                | (centroids[:, 1] > 0.195)
            )
            & (profile_alpha[profile_v, profile_u] >= 64)
        )
        profile_hair_supported = profile_supported & profile_hair[
            profile_v,
            profile_u,
        ]
        skin[profile_hair_supported] = False

    front_hair, front_alpha, front_bounds = _reference_hair_region(
        reference_path,
        hair_color=hair_color,
        skin_color=skin_color,
    )
    x_min, y_min, x_max, y_max = front_bounds
    width = max(float(mesh_max[0] - mesh_min[0]), 1e-9)
    height = max(float(mesh_max[1] - mesh_min[1]), 1e-9)
    front_u = np.rint(
        x_min + (centroids[:, 0] - mesh_min[0]) / width * (x_max - x_min)
    ).astype(np.int64)
    front_v = np.rint(
        y_min + (mesh_max[1] - centroids[:, 1]) / height * (y_max - y_min)
    ).astype(np.int64)
    front_u = np.clip(front_u, 0, front_alpha.shape[1] - 1)
    front_v = np.clip(front_v, 0, front_alpha.shape[0] - 1)
    front_supported = (
        visible
        & (centroids[:, 2] > 0.012)
        & (front_alpha[front_v, front_u] >= 64)
    )
    skin[front_supported] = ~front_hair[
        front_v[front_supported],
        front_u[front_supported],
    ]
    return skin


def _skin_point_mask(points: np.ndarray) -> np.ndarray:
    """Classify normalized Hunyuan points using the editor's asset contract."""
    x_values = points[:, 0]
    y_values = points[:, 1]
    z_values = points[:, 2]
    face_vertical = (y_values - 0.175) / 0.082
    face_half_width = 0.068 * np.sqrt(
        np.maximum(0.0, 1.0 - face_vertical * face_vertical)
    )
    frontal_face = (
        (y_values >= 0.093)
        & (y_values <= 0.255)
        & (np.abs(x_values) <= np.maximum(0.027, face_half_width))
        & (z_values > 0.012)
    )
    jaw_progress = np.clip((y_values - 0.072) / 0.095, 0.0, 1.0)
    jaw_half_width = 0.07 + 0.025 * np.sin(jaw_progress * np.pi * 0.5)
    lower_face = (
        (y_values >= 0.072)
        & (y_values <= 0.19)
        & (np.abs(x_values) <= jaw_half_width)
        & (z_values > -0.13)
    )
    face = frontal_face | lower_face
    ear = (
        (y_values >= 0.13)
        & (y_values <= 0.22)
        & (np.abs(x_values) >= 0.072)
        & (np.abs(x_values) <= 0.092)
        & (z_values > 0.012)
    )
    neck = (
        (y_values < 0.115)
        & (np.abs(x_values) < 0.067)
        & (z_values > -0.075)
        & (z_values < 0.065)
    )
    return face | ear | neck


def _compact_submesh(
    vertices: np.ndarray,
    faces: np.ndarray,
    face_mask: np.ndarray,
) -> trimesh.Trimesh:
    """Return a compact mesh containing exactly the selected triangles."""
    selected_faces = np.asarray(faces, dtype=np.int64)[face_mask]
    if len(selected_faces) == 0:
        raise ValueError("semantic reconstruction region contains no faces")
    used_vertices = np.unique(selected_faces)
    remap = np.full(len(vertices), -1, dtype=np.int64)
    remap[used_vertices] = np.arange(len(used_vertices), dtype=np.int64)
    return trimesh.Trimesh(
        vertices=np.asarray(vertices)[used_vertices],
        faces=remap[selected_faces],
        process=False,
    )


def _inset_backing(mesh: trimesh.Trimesh, name: str) -> trimesh.Trimesh:
    """Inset a semantic copy so incomplete generated surfaces never show gaps."""
    mesh.vertices = BACKING_CENTER + (
        np.asarray(mesh.vertices) - BACKING_CENTER
    ) * BACKING_SCALE
    mesh.metadata["name"] = name
    return mesh


def _semantic_scene(*meshes: trimesh.Trimesh) -> trimesh.Scene:
    scene = trimesh.Scene()
    for mesh in meshes:
        name = str(mesh.metadata["name"])
        scene.add_geometry(mesh, geom_name=name, node_name=name)
    return scene


def _split_head_and_hair(
    mesh: trimesh.Trimesh,
    *,
    front_reference: Path | None = None,
    profile_reference: Path | None = None,
    hair_color: str = "#1e1a18",
    skin_color: str = "#d8ab8a",
) -> tuple[
    trimesh.Trimesh | trimesh.Scene,
    trimesh.Trimesh | trimesh.Scene,
]:
    """Publish a skin-only head and a newly remeshed independent hair asset."""
    vertices = np.asarray(mesh.vertices)
    faces = np.asarray(mesh.faces)
    centroids = vertices[faces].mean(axis=1)
    visible = centroids[:, 1] >= HEAD_CUT_Y
    base_skin = visible & _skin_point_mask(centroids)
    if front_reference is None:
        skin = base_skin
    else:
        skin = _reference_guided_skin_mask(
            vertices,
            faces,
            visible,
            base_skin,
            front_reference,
            profile_reference=profile_reference,
            hair_color=hair_color,
            skin_color=skin_color,
        )
    hair = visible & ~skin
    lower_plinth = (
        (
            (centroids[:, 1] < 0.085)
            & (np.abs(centroids[:, 0]) < 0.09)
            & (centroids[:, 2] > -0.08)
        )
        | (
            (centroids[:, 1] < 0.155)
            & (np.abs(centroids[:, 0]) > 0.04)
            & (np.abs(centroids[:, 0]) < 0.1)
            & (centroids[:, 2] > -0.02)
        )
    )
    hair &= ~lower_plinth
    hair_seed = _compact_submesh(vertices, faces, hair)
    voxels = hair_seed.voxelized(HAIR_VOXEL_PITCH)
    hair_mesh = voxels.marching_cubes
    hair_mesh.apply_transform(voxels.transform)
    trimesh.smoothing.filter_taubin(
        hair_mesh,
        lamb=0.45,
        nu=0.5,
        iterations=8,
    )
    remeshed_centroids = hair_mesh.triangles_center
    remeshed_lower_face = (
        (remeshed_centroids[:, 1] < 0.155)
        & (np.abs(remeshed_centroids[:, 0]) > 0.04)
        & (np.abs(remeshed_centroids[:, 0]) < 0.1)
        & (remeshed_centroids[:, 2] > -0.02)
    )
    hair_mesh.update_faces(~remeshed_lower_face)
    hair_mesh.remove_unreferenced_vertices()
    hair_components = list(hair_mesh.split(only_watertight=False))
    if hair_components:
        largest_face_count = max(
            len(component.faces) for component in hair_components
        )
        retained_components = [
            component
            for component in hair_components
            if len(component.faces) >= max(
                250,
                int(largest_face_count * 0.01),
            )
        ]
        hair_mesh = (
            retained_components[0]
            if len(retained_components) == 1
            else trimesh.util.concatenate(retained_components)
        )
    hair_mesh.remove_unreferenced_vertices()
    if len(hair_mesh.faces) == 0:
        raise ValueError("generated hair volume contains no faces")

    if front_reference is None:
        head_mesh = _compact_submesh(vertices, faces, visible)
        head_mesh.metadata["name"] = "reconstructed_fused_legacy"
    else:
        head_mesh = _compact_submesh(vertices, faces, skin)
        head_mesh.metadata["name"] = "reconstructed_skin_v2"
    hair_mesh.metadata["name"] = "generated_hair_v2"

    if front_reference is not None and len(faces) >= BACKING_MIN_SOURCE_FACES:
        head_mesh.metadata["name"] = "reconstructed_skin_face_v3"
        side_skin_backing = (
            visible
            & (centroids[:, 1] >= 0.085)
            & (centroids[:, 1] <= 0.195)
            & (np.abs(centroids[:, 0]) <= 0.12)
            & (centroids[:, 2] > -0.03)
        )
        backing_skin_mask = base_skin | side_skin_backing
        backing_skin = _inset_backing(
            _compact_submesh(vertices, faces, backing_skin_mask),
            "reconstructed_skin_backing_v3",
        )
        backing_hair = _inset_backing(
            _compact_submesh(vertices, faces, visible & ~backing_skin_mask),
            "generated_hair_backing_v3",
        )
        head_mesh = _semantic_scene(head_mesh, backing_skin)
        hair_mesh = _semantic_scene(hair_mesh, backing_hair)
    return head_mesh, hair_mesh


def run(args: argparse.Namespace) -> dict[str, Any]:
    mesh = _load_mesh(args.input.resolve())
    mesh, dropped_components = _filter_components(
        mesh,
        min_faces=args.min_component_faces,
    )
    transformed, basis = _axis_transform(
        mesh.vertices,
        source_up=args.source_up,
        source_front=args.source_front,
    )
    normalized, scale, translation = _normalize_vertices(
        transformed,
        height_metres=args.height_metres,
    )
    normalized_mesh = trimesh.Trimesh(
        vertices=normalized,
        faces=np.asarray(mesh.faces),
        process=False,
    )
    head_mesh, hair_mesh = _split_head_and_hair(
        normalized_mesh,
        front_reference=args.front_reference,
        profile_reference=args.profile_reference,
        hair_color=args.hair_color,
        skin_color=args.skin_color,
    )
    output = args.output.resolve()
    hair_output = args.hair_output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    hair_output.parent.mkdir(parents=True, exist_ok=True)
    head_mesh.export(output)
    hair_mesh.export(hair_output)

    previews = (
        ("front.png", 0.0),
        ("three_quarter.png", 35.0),
        ("profile.png", 90.0),
    )
    preview_dir = args.preview_dir.resolve()
    for filename, yaw in previews:
        _render_mesh(
            normalized,
            np.asarray(mesh.faces),
            preview_dir / filename,
            yaw_degrees=yaw,
            size=args.render_size,
        )

    metadata_path = args.metadata.resolve()
    metadata = _read_metadata(metadata_path)
    metadata["normalization"] = {
        "source_up": args.source_up,
        "source_front": args.source_front,
        "target_up": "+y",
        "target_front": "+z",
        "basis_columns_right_up_front": basis.tolist(),
        "scale": scale,
        "translation_metres": translation.tolist(),
        "target_height_metres": args.height_metres,
        "component_cleanup": {
            "minimum_faces": args.min_component_faces,
            "dropped_component_face_counts": dropped_components,
            "kept_components": len(mesh.split(only_watertight=False)),
        },
        "output": {
            "path": str(output),
            "sha256": _sha256(output),
            "bounds": head_mesh.bounds.tolist(),
            "extents": head_mesh.extents.tolist(),
            "semantic_skin_only": args.front_reference is not None,
            "reference_guided_segmentation": args.front_reference is not None,
            "legacy_fused_hair_compatibility": args.front_reference is None,
        },
        "hair_output": {
            "path": str(hair_output),
            "sha256": _sha256(hair_output),
            "bounds": hair_mesh.bounds.tolist(),
            "extents": hair_mesh.extents.tolist(),
            "generation_method": (
                "multiview_hunyuan_voxel_remesh_with_inset_backing_v3"
            ),
            "voxel_pitch_metres": HAIR_VOXEL_PITCH,
        },
        "previews": [
            str((preview_dir / filename).resolve())
            for filename, _ in previews
        ],
    }
    limitations = metadata.setdefault("known_limitations", [])
    new_limitations = (
        "Shape-only output has no texture or character eye/hair colours.",
        (
            "Hair is reconstructed as a new smoothed voxel topology from the "
            "multi-view hair volume and exported as a separate asset."
        ),
        "The mesh has no facial rig, blend shapes, or SMPL-X neck seam.",
        (
            "The 0.30 m height normalization is provisional for later "
            "fitting."
        ),
    )
    for limitation in new_limitations:
        if limitation not in limitations:
            limitations.append(limitation)
    with metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return metadata


def main() -> None:
    try:
        run(_parse_arguments())
    except (FileNotFoundError, OSError, TypeError, ValueError) as error:
        raise SystemExit(f"error: {error}") from error


if __name__ == "__main__":
    main()
