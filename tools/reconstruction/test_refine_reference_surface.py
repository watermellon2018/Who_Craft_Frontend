"""Regressions for the explicit angry_dog reference surface profile."""

from __future__ import annotations

import json
from pathlib import Path
import struct
import tempfile
import unittest

import numpy as np
import trimesh

from refine_reference_surface import (
    LEGACY_PROFILE,
    PROFILE,
    _back_hair_shell,
    _export,
    _hair_colors,
    _polish_face,
    _polished_hair,
    _relative_color,
    _remove_scraps,
    _skin_colors,
    _skin_region,
    refine,
)


class ReferenceSurfaceTests(unittest.TestCase):
    def test_refinement_refuses_to_overwrite_input_assets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "must not overwrite"):
                refine(root / "head.glb", root / "hair.glb", root, skin_color="#f0b697")

    def test_relabels_hair_strips_but_retains_face_ears_and_neck(self) -> None:
        points = np.asarray([
            [0.0, 0.195, 0.100],
            [0.050, 0.145, 0.070],
            [0.080, 0.158, -0.001],
            [0.076, 0.230, 0.010],
            [0.035, 0.190, -0.075],
            [0.079, 0.079, 0.028],
            [0.0, 0.070, -0.035],
        ])
        actual = _skin_region(points, np.ones(len(points), dtype=bool))
        np.testing.assert_array_equal(actual, [True, True, True, False, False, False, True])

    def test_preserves_existing_neck_assignment_even_outside_envelope(self) -> None:
        points = np.asarray([
            [0.053, 0.05, 0.01], [0.0, 0.05, 0.03], [0.048, 0.095, -0.047],
        ])
        original = np.asarray([True, False, True])
        np.testing.assert_array_equal(_skin_region(points, original), original)

    def test_distant_hair_tips_are_not_mistaken_for_protected_neck(self) -> None:
        points = np.asarray([[0.102, 0.05, 0.01], [-0.09, 0.052, -0.03]])
        actual = _skin_region(points, np.ones(2, dtype=bool))
        np.testing.assert_array_equal(actual, [False, False])

    def test_eye_temple_and_jaw_skin_stay_continuous(self) -> None:
        points = np.asarray([
            [0.058, 0.180, 0.075],
            [-0.058, 0.180, 0.075],
            [0.067, 0.120, 0.015],
            [0.031, 0.190, 0.095],
            [0.065, 0.207, 0.027],
        ])
        actual = _skin_region(points, np.asarray([False, False, False, True, True]))
        np.testing.assert_array_equal(actual, [True, True, True, True, False])

    def test_reference_hairline_overrides_old_strip_labels(self) -> None:
        points = np.asarray([
            [0.053, 0.217, 0.065],
            [0.063, 0.217, 0.050],
            [0.074, 0.120, -0.004],
            [0.078, 0.160, 0.009],
        ])
        actual = _skin_region(points, np.asarray([False, True, True, True]))
        np.testing.assert_array_equal(actual, [True, False, False, True])

    def test_actual_raycast_ridges_pinna_and_earlobes(self) -> None:
        points = np.asarray([
            [0.07306, 0.17568, 0.03926],
            [0.07631, 0.17485, 0.02150],
            [0.07679, 0.16659, 0.01018],
            [0.07101, 0.13080, 0.00526],
            [0.07129, 0.12893, 0.00471],
            [0.03185, 0.09363, -0.04142],
            [0.03711, 0.09515, -0.04064],
        ])
        actual = _skin_region(points, np.ones(len(points), dtype=bool))
        np.testing.assert_array_equal(actual, [False, False, True, True, True, True, True])

    def test_albedo_keeps_neck_neutral_and_lips_tinted(self) -> None:
        vertices = np.asarray([
            [0.0, 0.049, 0.035],
            [0.0, 0.0955, 0.105],
            [0.0, 0.220, 0.1],
        ])
        colors = _skin_colors(vertices, skin_color="#f0b697")
        np.testing.assert_array_equal(colors[0], [1.0, 1.0, 1.0])
        self.assertGreater(colors[1, 0], colors[1, 1])
        self.assertLess(colors[1, 1], colors[2, 1])
        self.assertTrue(np.isfinite(colors).all())
        self.assertTrue(((colors >= 0) & (colors <= 1)).all())

    def test_relative_color_uses_linear_rgb_not_srgb_ratios(self) -> None:
        actual = _relative_color("#808080", "#ffffff")
        np.testing.assert_allclose(actual, [0.2158605] * 3, atol=1e-6)

    def test_hair_albedo_is_bounded_and_varies_with_strands(self) -> None:
        vertices = np.asarray([[0.02, 0.24, 0.05], [0.04, 0.24, 0.05]])
        colors = _hair_colors(vertices)
        self.assertTrue(((colors >= 0) & (colors <= 1)).all())
        self.assertFalse(np.allclose(colors[0], colors[1]))

    def test_scrap_cleanup_keeps_neck_but_removes_remote_fragment(self) -> None:
        mesh = trimesh.Trimesh(
            vertices=[
                [0, 0.05, 0], [0.01, 0.05, 0], [0, 0.06, 0],
                [0, 0.2, 0], [0.01, 0.2, 0], [0, 0.21, 0],
            ],
            faces=[[0, 1, 2], [3, 4, 5]],
            process=False,
        )
        result = _remove_scraps(mesh, min_faces=2)
        self.assertEqual(len(result.faces), 1)
        self.assertLess(result.vertices[:, 1].max(), 0.1)

    def test_cleanup_does_not_repair_or_cap_protected_neck(self) -> None:
        mesh = trimesh.Trimesh(
            vertices=[[0, 0.05, 0], [0.01, 0.05, 0], [0, 0.06, 0], [0, 0.05, 0.01]],
            faces=[[0, 1, 2], [0, 3, 1], [0, 2, 3]],
            process=False,
        )
        result = _remove_scraps(mesh, min_faces=2)
        self.assertEqual(len(result.faces), 3)

    def test_hair_shell_remains_behind_ears_and_outside_attachment(self) -> None:
        theta, height = np.meshgrid(np.linspace(0, 2 * np.pi, 48), np.linspace(0.045, 0.27, 30))
        points = np.column_stack((
            0.09 * np.sin(theta.ravel()),
            height.ravel(),
            -0.018 + 0.09 * np.cos(theta.ravel()),
        ))
        shell = _back_hair_shell(points)
        ear_height = shell.vertices[:, 1] >= 0.125
        self.assertLess(shell.vertices[ear_height, 2].max(), -0.018)
        self.assertGreater(shell.vertices[~ear_height, 2].max(), -0.005)
        self.assertLess(shell.vertices[~ear_height, 2].max(), 0.020)
        self.assertGreater(shell.vertices[:, 1].min(), 0.043)
        neck = (
            (np.abs(shell.vertices[:, 0]) < 0.055)
            & (shell.vertices[:, 2] > -0.052)
            & (shell.vertices[:, 1] <= 0.055)
        )
        self.assertFalse(neck.any())
        self.assertTrue(np.isfinite(shell.vertices).all())
        radii = np.hypot(shell.vertices[:, 0], shell.vertices[:, 2] + 0.018)
        self.assertLess(radii.max(), 0.09)
        radial = shell.triangles_center[:, [0, 2]] - np.asarray([0, -0.018])
        self.assertTrue((np.sum(shell.face_normals[:, [0, 2]] * radial, axis=1) > 0).all())

    def test_hair_shell_rejects_thin_radial_shelf(self) -> None:
        theta, height = np.meshgrid(np.linspace(0, 2 * np.pi, 80), np.linspace(0.045, 0.27, 90))
        radius = 0.09 + 0.03 * (np.abs(height - 0.15) < 0.005)
        points = np.column_stack((
            (radius * np.sin(theta)).ravel(),
            height.ravel(),
            (-0.018 + radius * np.cos(theta)).ravel(),
        ))
        shell = _back_hair_shell(points)
        shell_radius = np.hypot(shell.vertices[:, 0], shell.vertices[:, 2] + 0.018)
        self.assertLess(shell_radius.max(), 0.091)

    def test_shell_joins_imported_crown_normals(self) -> None:
        theta, height = np.meshgrid(np.linspace(0, 2 * np.pi, 80), np.linspace(0.043, 0.275, 90))
        radius = 0.09 - 0.4 * np.maximum(height - 0.220, 0)
        points = np.column_stack((
            (radius * np.sin(theta)).ravel(),
            height.ravel(),
            (-0.018 + radius * np.cos(theta)).ravel(),
        ))
        normals = np.column_stack((
            np.sin(theta).ravel(),
            (0.4 * (height > 0.220)).ravel(),
            np.cos(theta).ravel(),
        ))
        normals /= np.linalg.norm(normals, axis=1)[:, None]
        shell = _back_hair_shell(points, normals)
        upper = shell.vertices[:, 1] > 0.250
        self.assertGreater(shell.vertex_normals[upper, 1].min(), 0.36)
        self.assertLess(shell.vertex_normals[upper, 1].max(), 0.39)
        np.testing.assert_allclose(np.linalg.norm(shell.vertex_normals, axis=1), 1.0, atol=1e-6)

    def test_export_carries_normalized_linear_color_and_profile(self) -> None:
        mesh = trimesh.creation.icosphere(subdivisions=1, radius=0.1)
        colors = np.full((len(mesh.vertices), 3), 0.5)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "head.glb"
            _export(mesh, path, "reconstructed_skin_surface_v5", colors)
            data = path.read_bytes()
        json_length = struct.unpack_from("<I", data, 12)[0]
        document = json.loads(data[20:20 + json_length])
        exported = document["meshes"][0]
        self.assertEqual(exported["extras"]["sourceProfile"], PROFILE)
        self.assertEqual(exported["extras"]["colorMode"], "relative_linear")
        self.assertEqual(exported["extras"]["referenceFace"]["eyeHeight"], 0.018)
        self.assertEqual(exported["extras"]["referenceFace"]["irisDiameter"], 0.019)
        self.assertEqual(exported["extras"]["referenceFace"]["anchors"], {
            "chinY": 0.0607, "mouthY": 0.096, "noseY": 0.1275,
        })
        attribute = exported["primitives"][0]["attributes"]["COLOR_0"]
        accessor = document["accessors"][attribute]
        self.assertEqual(accessor["count"], len(mesh.vertices))
        self.assertTrue(accessor["normalized"])
        self.assertEqual(accessor["componentType"], 5121)

    def test_legacy_export_retains_original_profile_and_eye_dimensions(self) -> None:
        mesh = trimesh.creation.icosphere(subdivisions=1, radius=0.1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "head.glb"
            _export(mesh, path, "reconstructed_skin_surface_v5", np.ones((len(mesh.vertices), 3)), profile=LEGACY_PROFILE)
            data = path.read_bytes()
        json_length = struct.unpack_from("<I", data, 12)[0]
        extras = json.loads(data[20:20 + json_length])["meshes"][0]["extras"]
        self.assertEqual(extras["sourceProfile"], LEGACY_PROFILE)
        self.assertEqual(extras["referenceFace"]["eyeWidth"], 0.030)
        self.assertEqual(extras["referenceFace"]["eyeHeight"], 0.0135)
        self.assertEqual(extras["referenceFace"]["irisDiameter"], 0.0158)
        self.assertNotIn("anchors", extras["referenceFace"])

    def test_face_polish_flattens_brow_relief_but_preserves_neck_and_landmarks(self) -> None:
        x, y = np.meshgrid(np.linspace(-0.08, 0.08, 101), np.linspace(0.04, 0.25, 121))
        bump = 0.003 * np.exp(-((x - 0.052) / 0.002) ** 2 - ((y - 0.185) / 0.005) ** 2)
        z = 0.080 - 1.4 * x ** 2 + bump
        vertices = np.column_stack((x.ravel(), y.ravel(), z.ravel()))
        faces = []
        for row in range(120):
            for column in range(100):
                a = row * 101 + column
                faces.extend(((a, a + 1, a + 101), (a + 1, a + 102, a + 101)))
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        result, report = _polish_face(mesh)
        peak = np.argmax(bump.ravel())
        self.assertLess(result.vertices[peak, 2], vertices[peak, 2] - 0.001)
        np.testing.assert_array_equal(result.vertices[:, :2], vertices[:, :2])
        np.testing.assert_array_equal(result.faces, mesh.faces)
        neck = vertices[:, 1] <= 0.10
        np.testing.assert_array_equal(result.vertices[neck], vertices[neck])
        np.testing.assert_array_equal(result.vertex_normals[neck], mesh.vertex_normals[neck])
        self.assertLessEqual(report["maximumDisplacementM"], 0.0029)
        self.assertTrue(report["xyLandmarksUnchanged"])
        self.assertTrue(report["neckVerticesUnchanged"])

    def test_polished_hair_has_closed_locks_clear_of_attachment_and_ears(self) -> None:
        theta, height = np.meshgrid(np.linspace(0, 2 * np.pi, 65), np.linspace(0.044, 0.30, 61))
        radius = 0.09 - 0.7 * np.maximum(height - 0.23, 0)
        vertices = np.column_stack(((radius * np.sin(theta)).ravel(), height.ravel(), (-0.018 + radius * np.cos(theta)).ravel()))
        faces = []
        for row in range(60):
            for column in range(64):
                a = row * 65 + column
                faces.extend(((a, a + 1, a + 65), (a + 1, a + 66, a + 65)))
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        result, report = _polished_hair(mesh)
        self.assertEqual(report["broadLowerLocks"], 10)
        self.assertTrue(report["closedLockMeshes"])
        self.assertLessEqual(report["retainedCrownMaximumDisplacementM"], 0.0012 + 1e-9)
        self.assertTrue(np.isfinite(result.vertices).all())
        locks = result.vertices[-report["lockVertices"]:]
        attachment = (np.abs(locks[:, 0]) < 0.055) & (locks[:, 2] > -0.052) & (locks[:, 1] <= 0.055)
        self.assertFalse(attachment.any())
        ears = (locks[:, 1] > 0.143) & (locks[:, 1] < 0.175)
        self.assertLess(locks[ears, 2].max(), 0.0)
        self.assertGreater(np.ptp(locks[locks[:, 1] < 0.06, 1]), 0.012)
        backing = result.vertices[
            -report["lockVertices"] - report["backingVertices"]:-report["lockVertices"]
        ]
        # The recessed scalp must not leave a flat forward panel next to the
        # lower neck, even though it reaches farther forward above the ear.
        self.assertLess(backing[backing[:, 1] < 0.105, 2].max(), 0.001)


if __name__ == "__main__":
    unittest.main()
