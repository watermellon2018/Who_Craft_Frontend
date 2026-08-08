"""Render a deterministic QA preview of the Character Studio body/head merge."""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np
import pymeshlab
import trimesh
from numpy.typing import NDArray


FloatArray = NDArray[np.float64]
IndexArray = NDArray[np.int64]
ColorArray = NDArray[np.uint8]


@dataclass(frozen=True)
class RenderMesh:
    """Triangle mesh and one RGB color per triangle."""

    vertices: FloatArray
    faces: IndexArray
    colors: ColorArray


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for the QA renderer."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--body", required=True, type=Path)
    parser.add_argument("--head", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--size", type=int, default=720)
    parser.add_argument("--head-faces", type=int, default=80_000)
    return parser.parse_args()


def load_mesh(path: Path) -> trimesh.Trimesh:
    """Load and concatenate every mesh in a GLB scene."""

    if not path.is_file():
        raise FileNotFoundError(f"Mesh does not exist: {path}")
    loaded = trimesh.load(path, force="scene")
    geometries = [geometry for geometry in loaded.geometry.values()]
    if not geometries:
        raise ValueError(f"GLB contained no mesh: {path}")
    return trimesh.util.concatenate(geometries)


def simplify_mesh(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """Create a bounded-size copy for fast CPU preview rasterization."""

    if target_faces <= 0:
        raise ValueError("target_faces must be positive")
    if len(mesh.faces) <= target_faces:
        return mesh.copy()
    mesh_set = pymeshlab.MeshSet()
    mesh_set.add_mesh(
        pymeshlab.Mesh(
            vertex_matrix=np.asarray(mesh.vertices, dtype=np.float64),
            face_matrix=np.asarray(mesh.faces, dtype=np.int32),
        )
    )
    mesh_set.meshing_decimation_quadric_edge_collapse(
        targetfacenum=target_faces,
        preservenormal=True,
        preservetopology=True,
    )
    simplified = mesh_set.current_mesh()
    return trimesh.Trimesh(
        vertices=simplified.vertex_matrix(),
        faces=simplified.face_matrix(),
        process=False,
    )


def skin_mask(points: FloatArray) -> NDArray[np.bool_]:
    """Mirror the fused face/hair split used by reconstructedHead.ts."""

    x, y, z = points.T
    face_vertical = (y - 0.175) / 0.082
    face_half_width = 0.068 * np.sqrt(np.maximum(0.0, 1.0 - face_vertical**2))
    face = (
        (y >= 0.093)
        & (y <= 0.255)
        & (np.abs(x) <= np.maximum(0.027, face_half_width))
        & (z > 0.012)
    )
    ear = (
        (y >= 0.13)
        & (y <= 0.22)
        & (np.abs(x) >= 0.072)
        & (np.abs(x) <= 0.092)
        & (z > 0.012)
    )
    neck = (y < 0.125) & (np.abs(x) < 0.064)
    return face | ear | neck


def prepare_integration(body: trimesh.Trimesh, head: trimesh.Trimesh) -> RenderMesh:
    """Apply the runtime crop, alignment, head replacement, and palette."""

    body_vertices = np.asarray(body.vertices, dtype=np.float64)
    body_faces = np.asarray(body.faces, dtype=np.int64)
    head_vertices = np.asarray(head.vertices, dtype=np.float64)
    head_faces = np.asarray(head.faces, dtype=np.int64)

    body_min_y = float(body_vertices[:, 1].min())
    body_max_y = float(body_vertices[:, 1].max())
    figure_height = max(1e-6, body_max_y - body_min_y)
    head_band = body_vertices[:, 1] >= body_min_y + 0.9 * figure_height
    body_head_center = np.array(
        (
            body_vertices[head_band, 0].mean(),
            body_vertices[head_band, 1].mean(),
            (
                body_vertices[head_band, 2].min()
                + body_vertices[head_band, 2].max()
            )
            / 2,
        ),
        dtype=np.float64,
    )

    head_centroids = head_vertices[head_faces].mean(axis=1)
    kept_head_faces = head_faces[head_centroids[:, 1] >= 0.045]
    used_head_vertices = head_vertices[np.unique(kept_head_faces)]
    source_min = used_head_vertices.min(axis=0)
    source_max = used_head_vertices.max(axis=0)
    source_center = (source_min + source_max) / 2
    target_height = figure_height * 0.14816
    scale = target_height / max(float(source_max[1] - source_min[1]), 1e-6)
    offset = np.array(
        (
            body_head_center[0] - source_center[0] * scale,
            body_max_y - source_max[1] * scale,
            body_head_center[2] - source_center[2] * scale,
        )
    )
    placed_head_vertices = head_vertices * scale + offset
    placed_min_y = float((used_head_vertices * scale + offset)[:, 1].min())
    neck_cut_y = placed_min_y + figure_height * 0.004

    body_centroids = body_vertices[body_faces].mean(axis=1)
    kept_body_faces = body_faces[body_centroids[:, 1] < neck_cut_y]
    body_face_y = body_vertices[kept_body_faces].mean(axis=1)[:, 1]
    body_fraction = (body_face_y - body_min_y) / figure_height
    body_colors = np.tile(np.array((218, 192, 163), dtype=np.uint8), (len(kept_body_faces), 1))
    body_colors[(body_fraction >= 0.55) & (body_fraction < 0.88)] = (36, 55, 78)
    body_colors[(body_fraction >= 0.34) & (body_fraction < 0.56)] = (38, 37, 43)

    semantic_points = head_vertices[kept_head_faces].mean(axis=1)
    head_colors = np.tile(np.array((199, 117, 61), dtype=np.uint8), (len(kept_head_faces), 1))
    head_colors[skin_mask(semantic_points)] = (218, 192, 163)

    combined_vertices = np.vstack((body_vertices, placed_head_vertices))
    combined_faces = np.vstack((kept_body_faces, kept_head_faces + len(body_vertices)))
    combined_colors = np.vstack((body_colors, head_colors))
    return RenderMesh(combined_vertices, combined_faces, combined_colors)


def rotation_y(degrees: float) -> FloatArray:
    """Build the row-vector Y-axis rotation used by the CPU renderer."""

    radians = math.radians(degrees)
    cosine = math.cos(radians)
    sine = math.sin(radians)
    return np.asarray(
        ((cosine, 0.0, -sine), (0.0, 1.0, 0.0), (sine, 0.0, cosine)),
        dtype=np.float64,
    )


def render_mesh(
    mesh: RenderMesh,
    output: Path,
    *,
    yaw_degrees: float,
    size: int,
    background: Sequence[int] = (18, 19, 17),
) -> None:
    """Rasterize a colored orthographic preview with a painter's algorithm."""

    if size < 256:
        raise ValueError("size must be at least 256 pixels")
    centered = mesh.vertices - mesh.vertices.mean(axis=0)
    camera_vertices = centered @ rotation_y(yaw_degrees)
    horizontal = camera_vertices[:, 0]
    vertical = camera_vertices[:, 1]
    padding = max(24, int(size * 0.07))
    scale = min(
        (size - 2 * padding) / max(float(np.ptp(horizontal)), 1e-6),
        (size - 2 * padding) / max(float(np.ptp(vertical)), 1e-6),
    )
    pixels = np.column_stack(
        (size * 0.5 + horizontal * scale, size * 0.5 - vertical * scale)
    ).round().astype(np.int32)
    canvas = np.full((size, size, 3), tuple(reversed(background)), dtype=np.uint8)
    triangle_vertices = camera_vertices[mesh.faces]
    order = np.argsort(triangle_vertices[:, :, 2].mean(axis=1))
    light = np.asarray((0.35, 0.55, 1.0), dtype=np.float64)
    light /= np.linalg.norm(light)

    for face_index in order:
        triangle = triangle_vertices[face_index]
        normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
        normal_length = np.linalg.norm(normal)
        if normal_length < 1e-12:
            continue
        shade = 0.38 + 0.62 * abs(float((normal / normal_length) @ light))
        color_bgr = np.asarray(tuple(reversed(mesh.colors[face_index])), dtype=np.float64)
        color = tuple(int(value) for value in np.clip(color_bgr * shade, 0, 255))
        cv2.fillConvexPoly(
            canvas,
            pixels[mesh.faces[face_index]],
            color,
            lineType=cv2.LINE_AA,
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), canvas):
        raise OSError(f"OpenCV could not write preview: {output}")


def main() -> int:
    """Generate front and three-quarter integration previews."""

    args = parse_args()
    body = load_mesh(args.body.resolve())
    head = simplify_mesh(load_mesh(args.head.resolve()), args.head_faces)
    integrated = prepare_integration(body, head)
    output_dir = args.output_dir.resolve()
    render_mesh(integrated, output_dir / "integrated_front.png", yaw_degrees=0, size=args.size)
    render_mesh(
        integrated,
        output_dir / "integrated_three_quarter.png",
        yaw_degrees=35,
        size=args.size,
    )
    print(
        f"Rendered {len(integrated.faces):,} triangles to {output_dir}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
