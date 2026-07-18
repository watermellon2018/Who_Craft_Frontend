"""Unit tests for deterministic Hunyuan benchmark preparation."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

import cv2
import numpy as np
from PIL import Image
import trimesh

import postprocess_hunyuan_mesh as postprocess
import run_hunyuan_multiview as benchmark
from prepare_hunyuan_views import (
    FaceBox,
    _foreground_alpha,
    _square_crop_bounds,
)


class ViewPreparationTests(unittest.TestCase):
    """Prepared views must be bounded, transparent, and deterministic."""

    def test_square_crop_stays_inside_image(self) -> None:
        box = FaceBox(left=10.0, top=5.0, right=60.0, bottom=75.0)
        left, top, right, bottom = _square_crop_bounds(
            box,
            (160, 180, 3),
        )
        self.assertGreaterEqual(left, 0)
        self.assertGreaterEqual(top, 0)
        self.assertLessEqual(right, 180)
        self.assertLessEqual(bottom, 160)
        self.assertEqual(right - left, bottom - top)

    def test_oversized_face_crop_is_clamped_to_a_square(self) -> None:
        box = FaceBox(left=240.0, top=100.0, right=520.0, bottom=700.0)
        left, top, right, bottom = _square_crop_bounds(box, (1376, 768, 3))
        self.assertEqual(right - left, bottom - top)
        self.assertEqual(right - left, 768)

    def test_background_distance_keeps_coloured_subject(self) -> None:
        image = np.full((128, 128, 3), 205, dtype=np.uint8)
        cv2.ellipse(
            image,
            (64, 58),
            (30, 45),
            0.0,
            0.0,
            360.0,
            (90, 150, 220),
            thickness=-1,
        )
        alpha = _foreground_alpha(image, (45, 35, 83, 80), 12.0)
        self.assertGreater(int(alpha[58, 64]), 240)
        self.assertEqual(int(alpha[0, 0]), 0)

    def test_gradient_background_uses_grabcut_fallback(self) -> None:
        gradient = np.linspace(110, 220, 160, dtype=np.uint8)
        image = np.repeat(gradient[None, :, None], 160, axis=0)
        image = np.repeat(image, 3, axis=2)
        cv2.ellipse(
            image,
            (80, 72),
            (38, 55),
            0.0,
            0.0,
            360.0,
            (55, 120, 215),
            thickness=-1,
        )

        alpha = _foreground_alpha(image, (58, 42, 102, 105), 12.0)

        border = np.concatenate(
            (alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1])
        )
        self.assertGreater(int(alpha[72, 80]), 240)
        self.assertLess(float(np.mean(alpha > 127)), 0.45)
        self.assertEqual(int(np.count_nonzero(border > 127)), 0)


class BenchmarkValidationTests(unittest.TestCase):
    """Benchmark validation must reject incomplete inputs and weights."""

    def test_settings_require_positive_steps(self) -> None:
        settings = benchmark.BenchmarkSettings(
            seed=1,
            steps=0,
            octree_resolution=256,
            chunks=8000,
            guidance_scale=5.0,
            cpu_offload=False,
        )
        with self.assertRaisesRegex(ValueError, "steps"):
            benchmark._validate_settings(settings)

    def test_rgba_validation_rejects_opaque_image(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "opaque.png"
            Image.new("RGBA", (16, 16), (255, 0, 0, 255)).save(path)
            with self.assertRaisesRegex(ValueError, "alpha"):
                benchmark._validate_rgba(path, "front")

    def test_model_paths_accept_only_expected_safe_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model_dir = (
                root
                / benchmark.MODEL_REPOSITORY
                / benchmark.MODEL_SUBFOLDER
            )
            model_dir.mkdir(parents=True)
            (model_dir / "config.yaml").write_text(
                "model: {}\n",
                encoding="utf-8",
            )
            (model_dir / benchmark.WEIGHT_FILENAME).write_bytes(b"safe")
            with mock.patch.object(
                benchmark,
                "EXPECTED_WEIGHT_SIZE",
                4,
            ):
                config_path, weight_path = benchmark._model_paths(root)
            self.assertEqual(config_path.name, "config.yaml")
            self.assertEqual(weight_path.name, "model.fp16.safetensors")


class PostprocessTests(unittest.TestCase):
    """Axis mapping and provisional metric normalization must be explicit."""

    def test_default_axis_transform_is_identity(self) -> None:
        vertices = np.asarray(((1.0, 2.0, 3.0), (-1.0, -2.0, -3.0)))
        transformed, basis = postprocess._axis_transform(
            vertices,
            source_up="+y",
            source_front="+z",
        )
        np.testing.assert_allclose(transformed, vertices)
        np.testing.assert_allclose(basis, np.eye(3))

    def test_normalization_sets_height_floor_and_horizontal_centre(
        self,
    ) -> None:
        vertices = np.asarray(((-2.0, -1.0, -4.0), (6.0, 3.0, 2.0)))
        normalized, scale, _ = postprocess._normalize_vertices(
            vertices,
            height_metres=0.30,
        )
        bounds = np.asarray((normalized.min(axis=0), normalized.max(axis=0)))
        self.assertAlmostEqual(scale, 0.075)
        self.assertAlmostEqual(float(bounds[0, 1]), 0.0)
        self.assertAlmostEqual(float(np.ptp(normalized[:, 1])), 0.30)
        self.assertAlmostEqual(float(bounds[:, 0].mean()), 0.0)
        self.assertAlmostEqual(float(bounds[:, 2].mean()), 0.0)

    def test_component_filter_drops_tiny_fragments(self) -> None:
        main = trimesh.creation.icosphere(subdivisions=2)
        fragment = trimesh.creation.box(extents=(0.01, 0.01, 0.01))
        fragment.apply_translation((3.0, 0.0, 0.0))
        combined = trimesh.util.concatenate((main, fragment))
        filtered, dropped = postprocess._filter_components(
            combined,
            min_faces=100,
        )
        self.assertEqual(len(filtered.faces), len(main.faces))
        self.assertEqual(dropped, [len(fragment.faces)])


if __name__ == "__main__":
    unittest.main()
