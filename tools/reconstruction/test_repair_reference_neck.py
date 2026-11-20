"""Regression checks for the explicit posterior-neck repair."""

from pathlib import Path
import os
import tempfile
import unittest

import numpy as np
import trimesh

from repair_reference_neck import _PatchBuilder, _arc_parameter, _hair_shards, _neck_bounds, repair


class ReferenceNeckRepairTests(unittest.TestCase):
    def test_patch_includes_every_boundary_corner_and_edge(self) -> None:
        vertices = np.asarray([
            [0.04, 0.08, 0], [0.04, 0.08, -0.01], [0.04, 0.08, -0.02],
            [0.04, 0.09, 0], [0.04, 0.10, 0],
            [0.04, 0.10, -0.01], [0.04, 0.10, -0.02], [0.04, 0.09, -0.02],
        ])
        builder = _PatchBuilder(vertices)
        builder.patch(np.array([0, 1, 2]), np.array([0, 3, 4]), np.array([4, 5, 6]), np.array([2, 7, 6]), columns=5, rows=5)
        mesh = trimesh.Trimesh(vertices=builder.vertices, faces=np.vstack(builder.faces), process=False)
        edges, counts = np.unique(mesh.edges_sorted, axis=0, return_counts=True)
        boundary = {tuple(edge) for edge in edges[counts == 1]}
        expected = {(0, 1), (1, 2), (0, 3), (3, 4), (4, 5), (5, 6), (6, 7), (2, 7)}
        self.assertEqual(boundary, expected)
        self.assertTrue(mesh.is_winding_consistent)
        self.assertGreater(mesh.face_normals[:, 0].min(), 0.99)
        np.testing.assert_array_equal(builder.vertices[:len(vertices)], vertices)

    def test_harmonic_panel_preserves_boundary_and_has_no_interior_extrema(self) -> None:
        vertices = np.asarray([
            [0.040, 0.08, 0], [0.042, 0.10, 0],
            [0.043, 0.10, -0.02], [0.039, 0.08, -0.02],
        ])
        builder = _PatchBuilder(vertices)
        builder.patch(np.array([0, 3]), np.array([0, 1]), np.array([1, 2]), np.array([3, 2]), columns=9, rows=9, harmonic=True)
        mesh = trimesh.Trimesh(vertices=builder.vertices, faces=np.vstack(builder.faces), process=False)
        np.testing.assert_array_equal(builder.vertices[:4], vertices)
        self.assertTrue(np.isfinite(builder.vertices).all())
        self.assertTrue((builder.vertices[4:] >= vertices.min(axis=0) - 1e-12).all())
        self.assertTrue((builder.vertices[4:] <= vertices.max(axis=0) + 1e-12).all())
        self.assertTrue(mesh.is_winding_consistent)
        self.assertGreater(mesh.area_faces.min(), 1e-10)

    def test_mismatched_patch_corners_are_rejected(self) -> None:
        builder = _PatchBuilder(np.asarray([[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], dtype=float))
        with self.assertRaisesRegex(ValueError, "corners"):
            builder.patch(np.array([0, 3]), np.array([0, 1]), np.array([1, 2]), np.array([2, 3]), columns=3, rows=3)

    def test_zero_length_boundary_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "distinct"):
            _arc_parameter(np.zeros((3, 3)))

    def test_neck_bounds_select_triangle_centroids_then_expand_all_vertices(self) -> None:
        mesh = trimesh.Trimesh(
            vertices=[[0, 0.05, 0], [0.04, 0.06, 0], [0, 0.09, -0.03],
                      [0, 0.09, 0], [0.02, 0.10, 0], [0, 0.11, 0.02]],
            faces=[[0, 1, 2], [3, 4, 5]], process=False,
        )
        np.testing.assert_array_equal(_neck_bounds(mesh), [[0, 0.05, -0.03], [0.04, 0.09, 0]])

    def test_repair_rejects_in_place_or_existing_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            head, hair = root / "head.glb", root / "hair.glb"
            head.write_bytes(b"original head")
            hair.write_bytes(b"original hair")
            with self.assertRaisesRegex(ValueError, "overwrite"):
                repair(head, hair, root)
            output = root / "candidate"
            output.mkdir()
            (output / "head.glb").write_bytes(b"existing candidate")
            with self.assertRaisesRegex(ValueError, "existing candidate"):
                repair(head, hair, output)
            self.assertEqual(head.read_bytes(), b"original head")
            self.assertEqual((output / "head.glb").read_bytes(), b"existing candidate")

    def test_unreviewed_source_pair_does_not_produce_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            head, hair = root / "head.glb", root / "hair.glb"
            head.write_bytes(b"unreviewed geometry")
            hair.write_bytes(b"unreviewed geometry")
            with self.assertRaisesRegex(ValueError, "reviewed"):
                repair(head, hair, root / "candidate")
            self.assertFalse((root / "candidate").exists())


@unittest.skipUnless(os.environ.get("REFERENCE_NECK_HEAD") and os.environ.get("REFERENCE_NECK_HAIR"), "reviewed local source pair not supplied")
class ReviewedAssetRegressionTests(unittest.TestCase):
    def test_real_repair_preserves_source_anatomy_and_main_hair(self) -> None:
        def load(path: Path) -> trimesh.Trimesh:
            return next(iter(trimesh.load(path, force="scene", process=False).geometry.values()))

        head_path, hair_path = Path(os.environ["REFERENCE_NECK_HEAD"]), Path(os.environ["REFERENCE_NECK_HAIR"])
        source_head, source_hair = load(head_path), load(hair_path)
        original_head_bytes, original_hair_bytes = head_path.read_bytes(), hair_path.read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            report = repair(head_path, hair_path, output)
            head, hair = load(output / "head.glb"), load(output / "hair.glb")
        count = len(source_head.vertices)
        np.testing.assert_array_equal(head.vertices[:count], source_head.vertices)
        np.testing.assert_allclose(head.vertex_normals[:count], source_head.vertex_normals, rtol=0, atol=1e-7)
        np.testing.assert_array_equal(head.visual.vertex_colors[:count], source_head.visual.vertex_colors)
        self.assertEqual(head.metadata["referenceFace"], source_head.metadata["referenceFace"])
        self.assertEqual(head.metadata["colorMode"], "relative_linear")
        delta = _neck_bounds(source_head) - _neck_bounds(head)
        self.assertGreater(delta[1, 0], 0)
        self.assertLess(delta[1, 0], 0.0005)
        delta[1, 0] = 0
        np.testing.assert_array_equal(delta, np.zeros((2, 3)))
        # Compare retained source triangle coordinates, independent of the
        # compacted hair vertex indices. No crown or lock is deformed.
        remove = _hair_shards(source_hair)
        self.assertEqual(int(remove.sum()), 478)
        np.testing.assert_array_equal(hair.vertices[hair.faces], source_hair.vertices[source_hair.faces[~remove]])
        used = np.unique(source_hair.faces[~remove])
        np.testing.assert_allclose(hair.vertex_normals, source_hair.vertex_normals[used], rtol=0, atol=1e-7)
        np.testing.assert_array_equal(hair.visual.vertex_colors, source_hair.visual.vertex_colors[used])
        self.assertEqual(report["geometry"]["removedSideFlapTriangles"], 109)
        self.assertEqual(report["geometry"]["addedTriangles"], 6926)
        self.assertEqual(head_path.read_bytes(), original_head_bytes)
        self.assertEqual(hair_path.read_bytes(), original_hair_bytes)


if __name__ == "__main__":
    unittest.main()
