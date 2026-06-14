#!/usr/bin/env python3
"""Convert an SMPL ``.pkl`` body model into a GLB with shape morph targets.

This is Phase 1 of the A1 plan (docs/character-studio/model3d-a1-morph-targets-plan.md):
turn the SMPL base mesh + the first N shape blend shapes (the β PCA components)
into a runtime-morphable ``body.glb`` — base shape + N POSITION morph targets —
WITHOUT Blender. Deterministic and reproducible: same input → byte-identical
output.

Security note: SMPL ``.pkl`` files are pickles, which can execute arbitrary code
on load. We only ever load the user's own model files downloaded from the
official Max Planck SMPL site (smpl.is.tue.mpg.de) — a trusted source, not
untrusted input — and we read them through :mod:`chumpy_shim`, which substitutes
plain placeholder objects for chumpy types.

What we bake (A1 = shape only):
  • v_template            → base POSITION (translated so the feet rest on y=0)
  • shapedirs[:, :, :N]   → N morph targets (per-β vertex deltas, scaled to the
                            slider extreme so morph weight 1.0 ≈ β = +BETA_SCALE)
Pose/skeleton (J, weights, kintree_table, posedirs) belong to A2 and are
intentionally ignored here.

Usage:
  python convert_smpl_to_glb.py [--model PATH] [--betas N] [--out PATH]

Defaults resolve the neutral model under ../../../smpl_assets and write to
../../public/models/body.glb (served by CRA at runtime, kept out of git).
"""
from __future__ import annotations

import argparse
import os
import pickle  # nosec B403 - trusted local SMPL model files only (see module docstring)

import numpy as np

import chumpy_shim
from glb_writer import write_glb

# How many SMPL shape PCs (β) to expose as morph targets. The official SMPL
# shape space is 10 components; later columns carry negligible displacement
# (verified: beta10+ max < 3 mm), so 10 captures the full body-shape range.
DEFAULT_BETAS = 10

# Slider 1.0 maps to this β value. SMPL βs are ~standard-normal; ±3 spans a
# strong-but-plausible build (very slim ↔ very heavy / short ↔ tall). The morph
# delta is baked at this scale so the editor can drive weights in [-1, 1].
BETA_SCALE = 3.0

_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_MODEL = os.path.normpath(
    os.path.join(
        _HERE,
        "..", "..", "..", "smpl_assets",
        "SMPL_python_v.1.1.0", "SMPL_python_v.1.1.0",
        "smpl", "models", "basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl",
    )
)
_DEFAULT_OUT = os.path.normpath(os.path.join(_HERE, "..", "..", "public", "models", "body.glb"))


def load_smpl(model_path: str):
    """Load v_template, faces and shapedirs from an SMPL ``.pkl``."""
    chumpy_shim.install()
    with open(model_path, "rb") as handle:
        data = pickle.load(handle, encoding="latin1")  # nosec B301 - trusted local file
    v_template = chumpy_shim.as_array(data["v_template"]).astype(np.float64)
    faces = chumpy_shim.as_array(data["f"]).astype(np.uint32)
    shapedirs = chumpy_shim.as_array(data["shapedirs"]).astype(np.float64)
    return v_template, faces, shapedirs


def build_morphs(v_template: np.ndarray, shapedirs: np.ndarray, n_betas: int):
    """Return (base, targets, names) for the first ``n_betas`` shape PCs.

    base: (V, 3) with feet translated to y=0 (matches the editor's floor).
    targets: list of (V, 3) POSITION deltas at slider-extreme scale.
    names: ``betaNN`` labels surfaced in the GLB's targetNames.
    """
    n_betas = min(n_betas, shapedirs.shape[2])
    # Drop the figure so its lowest vertex sits on the floor plane (y=0), like
    # the procedural rig. X/Z stay centered (SMPL is already ~centered there).
    base = v_template.copy()
    base[:, 1] -= base[:, 1].min()

    targets = [shapedirs[:, :, i] * BETA_SCALE for i in range(n_betas)]
    names = [f"beta{i:02d}" for i in range(n_betas)]
    return base, targets, names


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=_DEFAULT_MODEL, help="path to SMPL .pkl")
    parser.add_argument("--betas", type=int, default=DEFAULT_BETAS, help="shape PCs to bake")
    parser.add_argument("--out", default=_DEFAULT_OUT, help="output .glb path")
    args = parser.parse_args()

    if not os.path.exists(args.model):
        raise SystemExit(
            f"SMPL model not found: {args.model}\n"
            "Download it from smpl.is.tue.mpg.de and place it under smpl_assets/ "
            "(see docs/character-studio/model3d-a1-morph-targets-plan.md)."
        )

    print(f"Reading SMPL model: {args.model}")
    v_template, faces, shapedirs = load_smpl(args.model)
    print(f"  vertices={v_template.shape[0]} faces={faces.shape[0]} shapedirs={shapedirs.shape}")

    base, targets, names = build_morphs(v_template, shapedirs, args.betas)
    height = base[:, 1].max() - base[:, 1].min()
    print(f"  baked {len(targets)} morph targets; figure height ≈ {height:.3f} m, feet at y=0")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    write_glb(args.out, base, faces, targets, names)
    size_kb = os.path.getsize(args.out) / 1024
    print(f"Wrote {args.out} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
