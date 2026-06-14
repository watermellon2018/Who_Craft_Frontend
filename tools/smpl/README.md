# SMPL → GLB converter (A1, Phase 1)

Turns the SMPL body model into a runtime-morphable `body.glb` (base shape + the
first 10 shape blend shapes baked as glTF morph targets) **without Blender**.
This is the asset the morph engine (`engine/morphRig.ts`) loads. See the plan:
`docs/character-studio/model3d-a1-morph-targets-plan.md`.

## Prerequisites

- Python 3.x with **numpy** (only dependency).
- The SMPL model file, downloaded by you from <https://smpl.is.tue.mpg.de>
  ("SMPL for Python users", v1.1.0), placed under the repo-root `smpl_assets/`:
  ```
  smpl_assets/SMPL_python_v.1.1.0/SMPL_python_v.1.1.0/smpl/models/basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl
  ```
  (`smpl_assets/` lives next to `who_craft/`, outside the repo, and is also
  `.gitignore`d here.)

## Run

```sh
cd who_craft/tools/smpl
python convert_smpl_to_glb.py            # → ../../public/models/body.glb
```

Options: `--model PATH`, `--betas N` (default 10), `--out PATH`.

The output is **deterministic** (same input → identical bytes) and is served by
CRA at `/models/body.glb` (the URL `MORPH_GLB_URL` in `morphRig.ts`).

## License — do not commit the output

SMPL/SMPL-X forbid redistributing the model file. The repo is public, so both
`smpl_assets/` and any generated `*.glb` under `public/models/` are
`.gitignore`d. Each developer regenerates `body.glb` locally. **Never** commit
the assets or the GLB.

## Files

- `convert_smpl_to_glb.py` — the converter (base mesh + shape morph targets).
- `glb_writer.py` — a tiny numpy-only glTF 2.0 / GLB writer.
- `chumpy_shim.py` — lets the chumpy-pickled SMPL `.pkl` load without the
  unmaintained `chumpy` package (we only read the value arrays).

## Scope

A1 bakes **shape only** (body silhouette). Pose/skeleton (A2) and the face
(SMPL-X / FLAME, Phase 5) are intentionally not included.
