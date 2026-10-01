"""Geometry-contract checks for the local reference body fitting tool."""

from __future__ import annotations

import copy
import unittest

import numpy as np

from fit_reference_body import build_parameter_proposal, cross_section_width, length_basis, reference_targets


class SurfaceMeasurementTests(unittest.TestCase):
    def test_section_uses_triangle_intersections_between_vertex_rows(self) -> None:
        # A widening trapezoid: lower width 2, upper width 4. No vertices occur
        # at the measured middle row; taking a narrow vertex band would fail.
        vertices = np.array([[-1, 0, 0], [1, 0, 0], [-2, 2, 0], [2, 2, 0]], dtype=float)
        faces = np.array([[0, 1, 2], [1, 3, 2]])
        self.assertAlmostEqual(cross_section_width(vertices, faces, 1.0), 3.0)
        self.assertAlmostEqual(cross_section_width(vertices, faces, .5), 2.5)

    def test_missing_section_does_not_silently_become_zero_width(self) -> None:
        vertices = np.array([[-1, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=float)
        with self.assertRaisesRegex(ValueError, "No surface intersects"):
            cross_section_width(vertices, np.array([[0, 1, 2]]), 2.0)


class RuntimeLengthContractTests(unittest.TestCase):
    def test_limb_fields_anchor_feet_and_translate_upper_body_as_a_unit(self) -> None:
        base = np.array([[0, 0, 0], [0, .04, 0], [0, .5, 0], [0, .8, 0],
                         [0, 1, 0], [.44, .77, 0], [-.44, .77, 0]])
        fields = length_basis(base)
        # Meter-high fixture: maximal thigh and calf sliders add 45 and 35 mm.
        np.testing.assert_array_equal(fields[:2, :2], 0)
        np.testing.assert_allclose(fields[0, 2:5, 1], .045)
        np.testing.assert_allclose(fields[1, 2:5, 1], .035)
        # Symmetric hands extend horizontally; torso and feet do not widen.
        np.testing.assert_allclose(fields[2, 5:, 0], [.032, -.032])
        np.testing.assert_allclose(fields[3, 5:, 0], [.028, -.028])
        np.testing.assert_array_equal(fields[2:, :5], 0)
        np.testing.assert_array_equal(fields[2:, :, 1:], 0)


class ReferenceRatioTests(unittest.TestCase):
    def test_camera_resize_does_not_change_pose_or_clothing_targets(self) -> None:
        pixels = {"shoulder_to_hip_midline": 300.0, "shoulder_joint_span": 180.0,
                  "hip_joint_y": 650.0,
                  "left_upper_arm": 170.0, "right_upper_arm": 170.0,
                  "left_forearm": 145.0, "right_forearm": 145.0,
                  "left_thigh": 245.0, "right_thigh": 245.0,
                  "left_calf": 230.0, "right_calf": 230.0}
        measurements = {"pose_detections": [{"model": "heavy", "metrics": {"pixels": pixels}}],
                        "clothed_silhouette_sections": {
                            key: {"width_pixels": 180, "pixel_y": 500, "edge_uncertainty_pixels": 4}
                            for key in ("lower_chest_garment", "waist_garment", "shirt_hem", "hip_trousers")}}
        resized = copy.deepcopy(measurements)
        resized["pose_detections"][0]["metrics"]["pixels"] = {key: value * 2 for key, value in pixels.items()}
        for section in resized["clothed_silhouette_sections"].values():
            for key in ("width_pixels", "pixel_y", "edge_uncertainty_pixels"):
                section[key] *= 2
        self.assertEqual(reference_targets(measurements), reference_targets(resized))
        ratios, _ = reference_targets(measurements)
        self.assertAlmostEqual(ratios["shoulder_over_torso"], .6)


class ParameterProposalTests(unittest.TestCase):
    def test_saved_semantic_shape_offsets_are_explicitly_reset(self) -> None:
        proposal = build_parameter_proposal(np.ones(16), np.zeros(4))
        # A saved character may already carry every one of these beta offsets.
        # They must be cleared when the separately fitted base is merged in.
        controls = {
            "shoulders": ("shouldersWidth",),
            "torso": ("chestWidth", "chestDepth", "backWidth"),
            "waist": ("waistWidth", "torsoCurve"),
            "hips": ("hipsWidth", "hipsShape"),
        }
        for zone, keys in controls.items():
            saved = {key: .7 for key in keys}
            saved.update(proposal[zone])
            self.assertTrue(all(saved[key] == 0 for key in keys), zone)
        self.assertEqual(len(proposal["body_fit"]), 16)
        self.assertAlmostEqual(proposal["body_fit"]["beta01"], 1 / 3, places=6)


if __name__ == "__main__":
    unittest.main()
