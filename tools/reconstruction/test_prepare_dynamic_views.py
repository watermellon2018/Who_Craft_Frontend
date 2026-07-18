"""Tests for reference preparation without a precomputed metrics file."""

from __future__ import annotations

import argparse
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import cv2
import numpy as np

import prepare_hunyuan_views as preparation


class DynamicViewPreparationTests(unittest.TestCase):
    def test_heuristic_box_targets_upper_centre(self) -> None:
        box = preparation._heuristic_face_box((1000, 800, 3))
        self.assertEqual((box.left, box.right), (256.0, 544.0))
        self.assertEqual((box.top, box.bottom), (80.0, 500.0))

    def test_run_without_metrics_detects_each_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = np.full((256, 256, 3), 210, dtype=np.uint8)
            cv2.ellipse(source, (128, 112), (55, 75), 0, 0, 360, (60, 130, 215), -1)
            front = root / "front.png"
            left = root / "left.png"
            cv2.imwrite(str(front), source)
            cv2.imwrite(str(left), source)
            args = argparse.Namespace(
                metrics=None,
                front=front,
                left=left,
                out_dir=root / "prepared",
                size=128,
                background_threshold=12.0,
            )
            face_box = preparation.FaceBox(75.0, 35.0, 181.0, 190.0)
            with mock.patch.object(
                preparation,
                "_detect_face_box",
                return_value=face_box,
            ) as detector:
                report = preparation.run(args)

            self.assertEqual(detector.call_count, 2)
            self.assertIn("heuristic", report["method"])
            self.assertTrue((root / "prepared" / "inputs" / "front.png").is_file())
            self.assertTrue((root / "prepared" / "inputs" / "left.png").is_file())


if __name__ == "__main__":
    unittest.main()
