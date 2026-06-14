"""A tiny, dependency-free glTF 2.0 / GLB writer (numpy only).

Just enough to emit a single mesh with POSITION + indices and any number of
morph targets (POSITION deltas). We hand-roll this instead of pulling in
``pygltflib``/``trimesh`` so the converter has no third-party deps beyond
numpy — the converter must stay simple and reproducible.

GLB layout written here: one JSON chunk + one BIN chunk, little-endian, with a
single buffer whose bufferViews are 4-byte aligned. Morph targets are stored as
sparse-free dense POSITION accessors (deltas from the base), which is what
three.js' GLTFLoader expects to populate ``geometry.morphAttributes.position``.
"""
from __future__ import annotations

import json
import struct
from typing import List

import numpy as np

# glTF component / type constants.
_FLOAT = 5126
_UINT = 5125
_ARRAY_BUFFER = 34962
_ELEMENT_ARRAY_BUFFER = 34963


def _pad4(data: bytes, fill: bytes = b"\x00") -> bytes:
    """Pad ``data`` with ``fill`` to a 4-byte boundary."""
    remainder = len(data) % 4
    return data if remainder == 0 else data + fill * (4 - remainder)


def write_glb(
    path: str,
    vertices: np.ndarray,
    faces: np.ndarray,
    morph_targets: List[np.ndarray],
    morph_names: List[str],
    extras: dict | None = None,
) -> None:
    """Write a GLB with one mesh, ``vertices``/``faces`` and POSITION morphs.

    vertices: (V, 3) float32 base positions.
    faces: (F, 3) uint32 triangle indices.
    morph_targets: list of (V, 3) float32 POSITION deltas (target − base).
    morph_names: human-readable names, surfaced as ``mesh.extras.targetNames``.
    extras: extra JSON merged into ``mesh.extras`` (e.g. face anchor positions).
    """
    vertices = np.ascontiguousarray(vertices, dtype=np.float32)
    faces = np.ascontiguousarray(faces.reshape(-1), dtype=np.uint32)
    if len(morph_targets) != len(morph_names):
        raise ValueError("morph_targets and morph_names must be the same length")

    buffer = bytearray()
    buffer_views = []
    accessors = []

    def add_view(blob: bytes, target: int) -> int:
        blob = _pad4(blob)
        offset = len(buffer)
        buffer.extend(blob)
        buffer_views.append(
            {"buffer": 0, "byteOffset": offset, "byteLength": len(blob), "target": target}
        )
        return len(buffer_views) - 1

    def add_vec3_accessor(arr: np.ndarray, view: int) -> int:
        mn = arr.min(axis=0).tolist()
        mx = arr.max(axis=0).tolist()
        accessors.append(
            {
                "bufferView": view,
                "componentType": _FLOAT,
                "count": int(arr.shape[0]),
                "type": "VEC3",
                "min": mn,
                "max": mx,
            }
        )
        return len(accessors) - 1

    # Base POSITION.
    pos_view = add_view(vertices.tobytes(), _ARRAY_BUFFER)
    pos_accessor = add_vec3_accessor(vertices, pos_view)

    # Indices.
    idx_view = add_view(faces.tobytes(), _ELEMENT_ARRAY_BUFFER)
    accessors.append(
        {
            "bufferView": idx_view,
            "componentType": _UINT,
            "count": int(faces.shape[0]),
            "type": "SCALAR",
        }
    )
    idx_accessor = len(accessors) - 1

    # Morph target POSITION deltas (one accessor each).
    targets = []
    for delta in morph_targets:
        delta = np.ascontiguousarray(delta, dtype=np.float32)
        view = add_view(delta.tobytes(), _ARRAY_BUFFER)
        targets.append({"POSITION": add_vec3_accessor(delta, view)})

    primitive = {
        "attributes": {"POSITION": pos_accessor},
        "indices": idx_accessor,
        "mode": 4,  # TRIANGLES
    }
    if targets:
        primitive["targets"] = targets

    mesh = {
        "primitives": [primitive],
        # Neutral resting weights (base shape) — the app overrides at runtime.
        "weights": [0.0] * len(targets),
    }
    mesh_extras: dict = {}
    if morph_names:
        mesh_extras["targetNames"] = list(morph_names)
    if extras:
        mesh_extras.update(extras)
    if mesh_extras:
        mesh["extras"] = mesh_extras

    gltf = {
        "asset": {"version": "2.0", "generator": "who_craft smpl converter"},
        "scenes": [{"nodes": [0]}],
        "scene": 0,
        "nodes": [{"mesh": 0, "name": "smpl_body"}],
        "meshes": [mesh],
        "buffers": [{"byteLength": len(buffer)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_chunk = _pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), fill=b" ")
    bin_chunk = _pad4(bytes(buffer))

    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    with open(path, "wb") as handle:
        handle.write(b"glTF")
        handle.write(struct.pack("<II", 2, total))
        handle.write(struct.pack("<I", len(json_chunk)))
        handle.write(b"JSON")
        handle.write(json_chunk)
        handle.write(struct.pack("<I", len(bin_chunk)))
        handle.write(b"BIN\x00")
        handle.write(bin_chunk)
