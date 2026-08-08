#!/usr/bin/env python3
"""Prepare consistent transparent head crops for Hunyuan3D-2mv."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np


MAX_FOREGROUND_RATIO = 0.72
MAX_BORDER_FOREGROUND_RATIO = 0.08


@dataclass(frozen=True)
class FaceBox:
    """Face bounding box in source-image pixel coordinates."""

    left: float
    top: float
    right: float
    bottom: float

    @property
    def width(self) -> float:
        """Return box width in pixels."""
        return self.right - self.left

    @property
    def height(self) -> float:
        """Return box height in pixels."""
        return self.bottom - self.top


def _parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metrics", type=Path)
    parser.add_argument("--front", required=True, type=Path)
    parser.add_argument("--left", type=Path)
    parser.add_argument("--back", type=Path)
    parser.add_argument("--right", type=Path)
    parser.add_argument(
        "--left-reference-type",
        choices=("profile", "three_quarter"),
        default="profile",
    )
    parser.add_argument(
        "--right-reference-type",
        choices=("profile", "three_quarter"),
        default="three_quarter",
    )
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--background-threshold", type=float, default=12.0)
    return parser.parse_args()


def _read_metrics(path: Path) -> dict[str, Any]:
    """Read task-1 face detections used to define consistent crops."""
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError as error:
        raise FileNotFoundError(
            f"metrics file does not exist: {path}"
        ) from error
    except json.JSONDecodeError as error:
        raise ValueError(f"metrics file is invalid JSON: {path}") from error
    if not isinstance(data, dict) or not isinstance(data.get("views"), list):
        raise ValueError("metrics must contain a views list")
    return data


def _face_box(metrics: dict[str, Any], view_name: str) -> FaceBox:
    """Return the detected face box for a named reference view."""
    for view in metrics["views"]:
        if view.get("name") != view_name:
            continue
        values = view.get("face_bbox_pixels")
        if not isinstance(values, list) or len(values) != 4:
            raise ValueError(f"view {view_name!r} has no valid face box")
        box = FaceBox(*(float(value) for value in values))
        if box.width <= 0.0 or box.height <= 0.0:
            raise ValueError(f"view {view_name!r} has an empty face box")
        return box
    raise ValueError(f"metrics have no view named {view_name!r}")


def _read_image(path: Path) -> np.ndarray:
    """Read a source image as BGR pixels."""
    if not path.is_file():
        raise FileNotFoundError(f"reference image does not exist: {path}")
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"OpenCV could not decode image: {path}")
    return image


def _source_digest(path: Path) -> str:
    """Return a content digest used to avoid preparing duplicate views."""
    if not path.is_file():
        raise FileNotFoundError(f"reference image does not exist: {path}")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _ordered_unique_sources(
    args: argparse.Namespace,
) -> tuple[dict[str, tuple[Path, str]], list[str]]:
    """Return available sources in Hunyuan order, skipping equal files."""
    candidates = (
        ("front", args.front, "portrait"),
        (
            "left",
            getattr(args, "left", None),
            getattr(args, "left_reference_type", "profile"),
        ),
        ("back", getattr(args, "back", None), "back_view"),
        (
            "right",
            getattr(args, "right", None),
            getattr(args, "right_reference_type", "three_quarter"),
        ),
    )
    sources: dict[str, tuple[Path, str]] = {}
    skipped_duplicates: list[str] = []
    seen_digests: set[str] = set()
    for output_name, source_path, metrics_name in candidates:
        if source_path is None:
            continue
        digest = _source_digest(source_path)
        if digest in seen_digests:
            skipped_duplicates.append(output_name)
            continue
        seen_digests.add(digest)
        sources[output_name] = (source_path, metrics_name)
    return sources, skipped_duplicates


def _heuristic_face_box(image_shape: tuple[int, ...]) -> FaceBox:
    """Return a conservative upper-centre face box when detection fails."""
    height, width = image_shape[:2]
    return FaceBox(
        left=width * 0.32,
        top=height * 0.08,
        right=width * 0.68,
        bottom=height * 0.50,
    )


def _detect_face_box(image: np.ndarray) -> FaceBox:
    """Detect one face with MediaPipe, falling back for stylized references."""
    try:
        import mediapipe

        with mediapipe.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.4,
        ) as face_mesh:
            result = face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    except (AttributeError, ImportError, RuntimeError, ValueError):
        return _heuristic_face_box(image.shape)

    if not result.multi_face_landmarks:
        return _heuristic_face_box(image.shape)
    height, width = image.shape[:2]
    points = result.multi_face_landmarks[0].landmark
    xs = [float(point.x) * width for point in points]
    ys = [float(point.y) * height for point in points]
    box = FaceBox(min(xs), min(ys), max(xs), max(ys))
    if box.width < 8.0 or box.height < 8.0:
        return _heuristic_face_box(image.shape)
    return box


def _square_crop_bounds(
    box: FaceBox,
    image_shape: tuple[int, ...],
) -> tuple[int, int, int, int]:
    """Build a head-and-hair square around a detected face."""
    height, width = image_shape[:2]
    side = int(round(max(box.width * 2.0, box.height * 2.0)))
    side = min(max(side, 64), height, width)
    center_x = (box.left + box.right) * 0.5
    center_y = (box.top + box.bottom) * 0.5
    left = int(round(center_x - side * 0.5))
    top = int(round(center_y - side * 0.5))
    right = left + side
    bottom = top + side

    if left < 0:
        right -= left
        left = 0
    if right > width:
        left -= right - width
        right = width
    if top < 0:
        bottom -= top
        top = 0
    if bottom > height:
        top -= bottom - height
        bottom = height
    return max(0, left), max(0, top), right, bottom


def _component_intersecting_face(
    mask: np.ndarray,
    local_face: tuple[int, int, int, int],
) -> np.ndarray:
    """Keep the connected foreground component overlapping the face most."""
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if count <= 1:
        raise RuntimeError("foreground segmentation produced no component")

    left, top, right, bottom = local_face
    face_labels = labels[top:bottom, left:right]
    overlaps = np.bincount(face_labels.ravel(), minlength=count)
    overlaps[0] = 0
    selected = int(overlaps.argmax())
    if overlaps[selected] == 0:
        selected = 1 + int(stats[1:, cv2.CC_STAT_AREA].argmax())
    return np.where(labels == selected, 255, 0).astype(np.uint8)


def _foreground_is_suspicious(alpha: np.ndarray) -> bool:
    """Return whether a mask still contains a large part of the background."""
    foreground = alpha > 127
    border = np.concatenate(
        (
            foreground[0],
            foreground[-1],
            foreground[1:-1, 0],
            foreground[1:-1, -1],
        )
    )
    return bool(
        np.mean(foreground) > MAX_FOREGROUND_RATIO
        or np.mean(border) > MAX_BORDER_FOREGROUND_RATIO
    )


def _grabcut_foreground_alpha(
    image: np.ndarray,
    local_face: tuple[int, int, int, int],
) -> np.ndarray:
    """Segment a centred character when a gradient defeats colour distance."""
    height, width = image.shape[:2]
    margin_x = max(2, int(round(width * 0.035)))
    margin_y = max(2, int(round(height * 0.01)))
    rectangle = (
        margin_x,
        margin_y,
        width - 2 * margin_x,
        height - 2 * margin_y,
    )
    mask = np.full((height, width), cv2.GC_BGD, dtype=np.uint8)
    background_model = np.zeros((1, 65), dtype=np.float64)
    foreground_model = np.zeros((1, 65), dtype=np.float64)
    try:
        cv2.grabCut(
            image,
            mask,
            rectangle,
            background_model,
            foreground_model,
            7,
            cv2.GC_INIT_WITH_RECT,
        )
    except cv2.error as error:
        raise RuntimeError("GrabCut could not segment the reference") from error
    binary = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = _component_intersecting_face(binary, local_face)
    return cv2.GaussianBlur(binary, (5, 5), 0)


def _foreground_alpha(
    image: np.ndarray,
    local_face: tuple[int, int, int, int],
    threshold: float,
) -> np.ndarray:
    """Estimate alpha by distance from the reference's neutral background."""
    if not 1.0 <= threshold <= 100.0:
        raise ValueError("background threshold must be between 1 and 100")
    height, width = image.shape[:2]
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    border_size = max(4, int(round(min(height, width) * 0.06)))
    border = np.concatenate(
        (
            lab[:border_size].reshape(-1, 3),
            lab[-border_size:].reshape(-1, 3),
            lab[border_size:-border_size, :border_size].reshape(-1, 3),
            lab[border_size:-border_size, -border_size:].reshape(-1, 3),
        )
    )
    background = np.median(border, axis=0)
    distance = np.linalg.norm(lab - background, axis=2)
    binary = np.where(distance > threshold, 255, 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = _component_intersecting_face(binary, local_face)
    transition_start = max(0.0, threshold - 5.0)
    soft_alpha = np.clip(
        (distance - transition_start) / 10.0,
        0.0,
        1.0,
    )
    alpha = (
        soft_alpha * (binary.astype(np.float32) / 255.0) * 255.0
    ).round().astype(np.uint8)
    if _foreground_is_suspicious(alpha):
        return _grabcut_foreground_alpha(image, local_face)
    return alpha


def _save_prepared_view(
    source_path: Path,
    box: FaceBox,
    output_path: Path,
    preview_path: Path,
    size: int,
    background_threshold: float,
) -> dict[str, Any]:
    """Segment, square, resize, and save one transparent reference view."""
    if size < 128:
        raise ValueError("output size must be at least 128 pixels")
    image = _read_image(source_path)
    left, top, right, bottom = _square_crop_bounds(box, image.shape)
    crop = image[top:bottom, left:right]
    local_face = (
        max(0, int(round(box.left - left))),
        max(0, int(round(box.top - top))),
        min(crop.shape[1], int(round(box.right - left))),
        min(crop.shape[0], int(round(box.bottom - top))),
    )
    alpha = _foreground_alpha(
        crop,
        local_face,
        background_threshold,
    )
    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    rgba = cv2.resize(rgba, (size, size), interpolation=cv2.INTER_AREA)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), rgba):
        raise OSError(f"failed to write prepared view: {output_path}")

    checker = np.full((size, size, 3), (198, 164, 92), dtype=np.uint8)
    alpha_float = rgba[:, :, 3:4].astype(np.float32) / 255.0
    composite = (
        rgba[:, :, :3].astype(np.float32) * alpha_float
        + checker.astype(np.float32) * (1.0 - alpha_float)
    ).round().astype(np.uint8)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(preview_path), composite):
        raise OSError(f"failed to write mask preview: {preview_path}")

    foreground_ratio = float(np.mean(rgba[:, :, 3] > 127))
    return {
        "source": str(source_path.resolve()),
        "output": str(output_path.resolve()),
        "crop_xyxy": [left, top, right, bottom],
        "face_xyxy": [box.left, box.top, box.right, box.bottom],
        "foreground_ratio": foreground_ratio,
        "size": size,
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    """Prepare every available unique view and write its metadata."""
    metrics = _read_metrics(args.metrics) if args.metrics else None
    output_dir = args.out_dir.resolve()
    prepared_dir = output_dir / "inputs"
    preview_dir = output_dir / "mask-previews"
    sources, skipped_duplicates = _ordered_unique_sources(args)

    def box_for(source_path: Path, metrics_name: str) -> FaceBox:
        if metrics is not None:
            return _face_box(metrics, metrics_name)
        return _detect_face_box(_read_image(source_path))

    views = {
        output_name: _save_prepared_view(
            source_path=source_path,
            box=box_for(source_path, metrics_name),
            output_path=prepared_dir / f"{output_name}.png",
            preview_path=preview_dir / f"{output_name}.png",
            size=args.size,
            background_threshold=args.background_threshold,
        )
        for output_name, (source_path, metrics_name) in sources.items()
    }
    report = {
        "method": (
            "facemesh_box_background_distance_grabcut_v3"
            if metrics is not None
            else "live_facemesh_or_heuristic_background_distance_grabcut_v3"
        ),
        "views": views,
        "skipped_duplicate_views": skipped_duplicates,
        "known_limitations": [
            (
                "Fine hair close to the neutral background may become "
                "transparent."
            ),
            (
                "Saved profile and three-quarter references do not record "
                "their physical facing direction; left/right are Hunyuan "
                "conditioning slots."
            ),
        ],
    }
    report_path = output_dir / "input-metadata.json"
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return report


def main() -> None:
    """Run the command-line entry point."""
    args = _parse_arguments()
    try:
        report = run(args)
    except (FileNotFoundError, OSError, RuntimeError, ValueError) as error:
        raise SystemExit(f"error: {error}") from error
    print(
        "Prepared Hunyuan views: "
        + ", ".join(sorted(report["views"])),
        flush=True,
    )


if __name__ == "__main__":
    main()
