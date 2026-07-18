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


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
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
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    normalized_mesh.export(output)

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
            "bounds": normalized_mesh.bounds.tolist(),
            "extents": normalized_mesh.extents.tolist(),
        },
        "previews": [
            str((preview_dir / filename).resolve())
            for filename, _ in previews
        ],
    }
    limitations = metadata.setdefault("known_limitations", [])
    new_limitations = (
        "Shape-only output has no texture or character eye/hair colours.",
        "Hair is fused into the static mesh rather than a separate asset.",
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
