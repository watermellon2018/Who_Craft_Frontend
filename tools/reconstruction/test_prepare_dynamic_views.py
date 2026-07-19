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
            left_source = source.copy()
            left_source[0, 0] = (209, 209, 209)
            right_source = source.copy()
            right_source[0, 0] = (208, 208, 208)
            front = root / "front.png"
            left = root / "left.png"
            right = root / "right.png"
            cv2.imwrite(str(front), source)
            cv2.imwrite(str(left), left_source)
            cv2.imwrite(str(right), right_source)
            args = argparse.Namespace(
                metrics=None,
                front=front,
                left=left,
                right=right,
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

            self.assertEqual(detector.call_count, 3)
            self.assertIn("heuristic", report["method"])
            self.assertTrue((root / "prepared" / "inputs" / "front.png").is_file())
            self.assertTrue((root / "prepared" / "inputs" / "left.png").is_file())
            self.assertTrue((root / "prepared" / "inputs" / "right.png").is_file())

    def test_source_order_skips_equal_optional_views(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            front = root / "front.png"
            left = root / "left.png"
            right = root / "right.png"
            front.write_bytes(b"front")
            left.write_bytes(b"side")
            right.write_bytes(b"side")
            args = argparse.Namespace(
                front=front,
                left=left,
                right=right,
            )

            sources, skipped = preparation._ordered_unique_sources(args)

            self.assertEqual(list(sources), ["front", "left"])
            self.assertEqual(skipped, ["right"])

            right.write_bytes(b"three-quarter")
            sources, skipped = preparation._ordered_unique_sources(args)
            self.assertEqual(
                list(sources),
                ["front", "left", "right"],
            )
            self.assertEqual(skipped, [])

    def test_left_slot_keeps_three_quarter_semantics(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            front = root / "front.png"
            three_quarter = root / "three-quarter.png"
            front.write_bytes(b"front")
            three_quarter.write_bytes(b"three-quarter")
            args = argparse.Namespace(
                front=front,
                left=three_quarter,
                right=None,
                left_reference_type="three_quarter",
            )

            sources, skipped = preparation._ordered_unique_sources(args)

            self.assertEqual(sources["left"], (three_quarter, "three_quarter"))
            self.assertEqual(skipped, [])


if __name__ == "__main__":
    unittest.main()
