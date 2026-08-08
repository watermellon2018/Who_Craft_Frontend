"""Unit tests for reconstruction geometry helpers (no MediaPipe required)."""
from __future__ import annotations

import math
import unittest

import numpy as np

from geometry import (
    clip_vector_lengths,
    count_boundary_edges,
    edge_topology_diagnostics,
    extract_and_cap_mesh,
    fit_similarity,
    fuse_aligned_shapes,
    gaussian_rbf_warp,
    smoothstep,
)


class SimilarityTests(unittest.TestCase):
    """Similarity alignment must remove camera pose without shape drift."""

    def test_fit_similarity_recovers_known_transform(self) -> None:
        source = np.asarray(
            (
                (0.0, 0.0, 0.0),
                (1.0, 0.0, 0.0),
                (0.0, 2.0, 0.0),
                (0.0, 0.0, 1.0),
            )
        )
        angle = math.radians(32.0)
        rotation = np.asarray(
            (
                (math.cos(angle), 0.0, -math.sin(angle)),
                (0.0, 1.0, 0.0),
                (math.sin(angle), 0.0, math.cos(angle)),
            )
        )
        target = 1.7 * source @ rotation + np.asarray((3.0, -2.0, 0.5))

        fitted = fit_similarity(source, target)

        np.testing.assert_allclose(fitted.apply(source), target, atol=1e-12)

    def test_fuse_aligned_shapes_matches_reference(self) -> None:
        reference = np.asarray(
            (
                (-1.0, 0.0, 0.0),
                (1.0, 0.0, 0.0),
                (0.0, 1.0, 0.2),
                (0.0, -1.0, 0.1),
            )
        )
        translated = 2.0 * reference + np.asarray((5.0, 4.0, -3.0))

        fused, rms, aligned = fuse_aligned_shapes(
            [reference, translated],
            [0, 1, 2, 3],
        )

        np.testing.assert_allclose(aligned[1], reference, atol=1e-12)
        np.testing.assert_allclose(fused, reference, atol=1e-12)
        self.assertLess(rms[1], 1e-12)


class WarpTests(unittest.TestCase):
    """Regularized dense interpolation stays finite and spatially local."""

    def test_gaussian_rbf_interpolates_controls_and_fades_far_away(
        self,
    ) -> None:
        controls = np.asarray(((0.0, 0.0, 0.0), (1.0, 0.0, 0.0)))
        displacement = np.asarray(((0.0, 0.2, 0.0), (0.0, -0.1, 0.0)))
        points = np.vstack((controls, np.asarray((10.0, 10.0, 10.0))))

        dense = gaussian_rbf_warp(
            points,
            controls,
            displacement,
            sigma=0.25,
            regularization=1e-9,
        )

        np.testing.assert_allclose(dense[:2], displacement, atol=1e-7)
        self.assertLess(float(np.linalg.norm(dense[2])), 1e-12)

    def test_vector_length_clipping_preserves_direction(self) -> None:
        clipped = clip_vector_lengths(
            np.asarray(((3.0, 4.0, 0.0), (0.1, 0.0, 0.0))),
            1.0,
        )
        np.testing.assert_allclose(clipped[0], (0.6, 0.8, 0.0))
        np.testing.assert_allclose(clipped[1], (0.1, 0.0, 0.0))

    def test_smoothstep_clamps_and_is_monotonic(self) -> None:
        values = smoothstep(0.0, 1.0, np.asarray((-1.0, 0.0, 0.5, 1.0, 2.0)))
        np.testing.assert_allclose(values, (0.0, 0.0, 0.5, 1.0, 1.0))
        self.assertTrue(np.all(np.diff(values) >= 0.0))


class ExtractionTests(unittest.TestCase):
    """Standalone mesh extraction must close all introduced boundaries."""

    def test_extract_and_cap_closes_open_cube(self) -> None:
        vertices = np.asarray(
            (
                (-1.0, -1.0, -1.0),
                (1.0, -1.0, -1.0),
                (1.0, 1.0, -1.0),
                (-1.0, 1.0, -1.0),
                (-1.0, -1.0, 1.0),
                (1.0, -1.0, 1.0),
                (1.0, 1.0, 1.0),
                (-1.0, 1.0, 1.0),
            )
        )
        # Closed cube except for the z=+1 side.
        faces = np.asarray(
            (
                (0, 2, 1), (0, 3, 2),
                (0, 1, 5), (0, 5, 4),
                (1, 2, 6), (1, 6, 5),
                (2, 3, 7), (2, 7, 6),
                (3, 0, 4), (3, 4, 7),
            ),
            dtype=np.int64,
        )

        variants = (faces, faces[::-1], faces[:, (0, 2, 1)])
        for variant_index, candidate_faces in enumerate(variants):
            with self.subTest(variant=variant_index):
                capped_vertices, capped_faces, loops = extract_and_cap_mesh(
                    vertices,
                    candidate_faces,
                    np.ones(len(vertices), dtype=bool),
                )

                self.assertEqual(loops, [4])
                self.assertEqual(len(capped_vertices), 9)
                self.assertEqual(count_boundary_edges(capped_faces), 0)
                self.assertEqual(
                    edge_topology_diagnostics(capped_faces),
                    {
                        "boundary_edges": 0,
                        "non_manifold_edges": 0,
                        "orientation_conflicts": 0,
                    },
                )


if __name__ == "__main__":
    unittest.main()
