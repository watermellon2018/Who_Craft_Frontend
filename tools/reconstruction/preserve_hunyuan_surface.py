"""Experimental reference-guided partition of a preserved Hunyuan surface.

Kept separate from the production legacy splitter until visual validation
covers more characters. No model inference or geometry deformation occurs.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from postprocess_hunyuan_mesh import _parse_hex_rgb


def _reference_hair_region(
    path: Path,
    *,
    hair_color: str,
    skin_color: str,
    profile: bool = False,
) -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    """Extract scalp-connected hair without expanding it over face shadows."""
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
    # Luminance changes strongly in neck shadows and hair highlights.
    # Keep chroma dominant so those shadows do not become false hair.
    hair_delta[:, :, 0] *= 0.15
    skin_delta[:, :, 0] *= 0.15
    hair_distance = np.linalg.norm(hair_delta, axis=2)
    skin_distance = np.linalg.norm(skin_delta, axis=2)
    candidate = foreground & (hair_distance + 4.0 < skin_distance)
    x_min, y_min, x_max, y_max = bounds
    rows, columns = np.indices(foreground.shape)
    vertical = (rows - y_min) / max(1, y_max - y_min)
    horizontal = (columns - (x_min + x_max) * 0.5) / max(1, x_max - x_min)
    seeds = np.where(candidate, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
    seeds[~foreground] = cv2.GC_BGD
    skin_core = foreground & (vertical > 0.2) & (vertical < 0.85)
    skin_core &= skin_distance + 5.0 < hair_distance
    if not profile:
        skin_core &= np.abs(horizontal) < 0.14
        skin_core |= (
            foreground & (np.abs(horizontal) < 0.14) & (vertical > 0.77)
        )
    seeds[skin_core] = cv2.GC_BGD
    seeds[foreground & (vertical < 0.12)] = cv2.GC_FGD
    if np.any(seeds == cv2.GC_BGD) and np.any(seeds == cv2.GC_FGD):
        cv2.setRNGSeed(0)
        cv2.grabCut(
            image[:, :, :3],
            seeds,
            None,
            np.zeros((1, 65), dtype=np.float64),
            np.zeros((1, 65), dtype=np.float64),
            5,
            cv2.GC_INIT_WITH_MASK,
        )
        candidate = foreground & (
            (seeds == cv2.GC_FGD) | (seeds == cv2.GC_PR_FGD)
        )
    candidate = cv2.morphologyEx(
        candidate.astype(np.uint8),
        cv2.MORPH_CLOSE,
        np.ones((3, 3), dtype=np.uint8),
    )
    opening_size = max(3, int(round(min(candidate.shape) * 0.018)) | 1)
    candidate = cv2.morphologyEx(
        candidate,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (opening_size, opening_size),
        ),
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
    inverse = (~hair_region).astype(np.uint8)
    hole_count, hole_labels, hole_stats, _ = cv2.connectedComponentsWithStats(
        inverse,
        8,
    )
    maximum_hole_area = max(256, int(foreground.sum() * 0.05))
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
    return hair_region & foreground, alpha, bounds


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
    """Classify the original surface without moving it or inflating hair.

    Reference crops describe the complete source, so projection must use its
    complete bounds, including the neck. Using a cut mesh here shifts the
    reference hair onto the cheeks and jaw. A profile is mirrored across X,
    not across the front/back axis, when reused for the opposite side.
    """
    centroids = vertices[faces].mean(axis=1)
    mesh_min = vertices.min(axis=0)
    mesh_max = vertices.max(axis=0)
    spans = np.maximum(mesh_max - mesh_min, 1e-9)
    # Missing alpha/projection evidence must not turn existing anatomical
    # facial skin into hair (prepared masks can contain holes over the eyes).
    skin = visible & base_skin

    def project(
        reference: Path,
        *,
        profile: bool,
    ) -> tuple[np.ndarray, np.ndarray]:
        hair, alpha, bounds = _reference_hair_region(
            reference,
            hair_color=hair_color,
            skin_color=skin_color,
            profile=profile,
        )
        x_min, y_min, x_max, y_max = bounds
        skin_pixels = (alpha >= 64) & ~hair
        row_start = int(y_min + (y_max - y_min) * 0.25)
        row_end = int(y_min + (y_max - y_min) * 0.68)
        middle_skin = skin_pixels[row_start:row_end]
        _, skin_columns = np.where(middle_skin)
        skin_center = (
            float(np.median(skin_columns))
            if len(skin_columns)
            else (x_min + x_max) * 0.5
        )
        if profile:
            facing_left = skin_center < (x_min + x_max) * 0.5
            horizontal = (
                (mesh_max[2] - centroids[:, 2]) / spans[2]
                if facing_left
                else (centroids[:, 2] - mesh_min[2]) / spans[2]
            )
            projected_x = x_min + horizontal * (x_max - x_min)
        else:
            # A slightly turned portrait and asymmetric hair can shift the
            # foreground box away from the face. Center on the skin region.
            mesh_center = (mesh_min[0] + mesh_max[0]) * 0.5
            projected_x = skin_center + (
                (centroids[:, 0] - mesh_center) / spans[0] * (x_max - x_min)
            )
        projected_y = y_min + (
            (mesh_max[1] - centroids[:, 1]) / spans[1] * (y_max - y_min)
        )
        u = np.clip(
            np.rint(projected_x).astype(np.int64), 0, alpha.shape[1] - 1,
        )
        v = np.clip(
            np.rint(projected_y).astype(np.int64), 0, alpha.shape[0] - 1,
        )
        return alpha[v, u] >= 64, hair[v, u]

    front_supported, front_hair = project(reference_path, profile=False)
    front_supported &= visible & (centroids[:, 2] > 0.0)
    skin[front_supported] = ~front_hair[front_supported]
    if profile_reference is not None:
        side_supported, side_hair = project(profile_reference, profile=True)
        side_supported &= visible & (
            (np.abs(centroids[:, 0]) > 0.065)
            | (centroids[:, 2] <= 0.015)
        )
        skin[side_supported] = ~side_hair[side_supported]

    # Keep the narrow neck under the jaw continuous. The generic face prior
    # is deliberately not used for the surrounding long-hair surface.
    neck = (
        (centroids[:, 1] < 0.10)
        & (np.abs(centroids[:, 0]) < 0.042)
        & (centroids[:, 2] > -0.045)
    )
    skin[visible & neck] = True
    return skin & visible
