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

We ship **SMPL-X** as the body, because its base mesh already has a real face
(eye sockets, lips, nose as geometry) — no procedural face graft needed:

```sh
cd who_craft/tools/smpl
python convert_smpl_to_glb.py \
  --model ../../../smpl_assets/smplx/SMPLX_NEUTRAL.npz \
  --betas 16 --out ../../public/models/body.glb
```

The converter also still reads the plain SMPL `.pkl` (bare head) if you point
`--model` at it. Options: `--model PATH` (`.npz` SMPL-X or `.pkl` SMPL),
`--betas N`, `--out PATH`.

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

## Reference body fitting

`fit_reference_body.py` proposes editable proportions from measured frontal
reference landmarks and clothed cross-sections. It requires NumPy, SciPy,
the locally licensed `SMPLX_NEUTRAL.npz`, and its matching 16-target `body.glb`.
It validates the template/topology and does not download models or write to
the database. From this directory:

```sh
python fit_reference_body.py --body ../../public/models/body.glb \
  --model ../../../smpl_assets/smplx/SMPLX_NEUTRAL.npz \
  --measurements /path/to/reference-body-measurements.json \
  --out /path/to/fit-candidate.json --qa /path/to/qa-posing.json
python -m unittest test_fit_reference_body
```

The input includes a `pose_detections` entry with `model: "heavy"`, named
landmarks with pixel coordinates, and a `metrics.pixels` map of measured joint
spans/segment lengths. `clothed_silhouette_sections` provides each section's
`pixel_y`, `width_pixels` and optional `edge_uncertainty_pixels`.
See `reference_targets` in the script for the exact measurement keys. All lengths
are relative to the shoulder–hip torso span, avoiding assumptions about
absolute height or shoe thickness. The optimization fixes beta zero, uses
regularization for unobserved shape/depth, and accounts for clothing clearance.

Review `measurements` and the rendered silhouette before applying `params`
through the existing model3d state/revision flow. `body_fit` contains normalized
beta weights; limb length controls remain independently editable. The proposal
resets all old beta-mapped body slider offsets to zero. Preserve unrelated colors,
face settings and other edits when merging. A reconstructed head's relative
size may need separate visual adjustment with `head_neck.headSize`.

`--qa` emits locally derived joint/weight data for a comparison pose only; it
does not change the editable T-pose or add runtime pose controls. Keep this
licensed derivative private alongside generated media. A clothed frontal
reference constrains the visible silhouette, not a unique underlying anatomy
or a reliable side profile. The tool never claims a complete 3D reconstruction.
