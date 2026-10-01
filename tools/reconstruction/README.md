# Character Studio reconstruction tools

## Current Hunyuan multi-view pipeline

The production path requires four unique, identity-consistent head views in
stable Hunyuan order: portrait/front, profile/left, back, and
three-quarter/right. The tools prepare transparent crops, generate the
character-specific multi-view surface, and publish two URLs:

- **Experimental opt-in:** with `--preserve-source-surface` and prepared
  front/profile references, `head.glb` and `hair.glb` partition
  the original generated surface into skin and scalp-connected hair. Source
  triangles and normals above the shared 0.045 m neck cut are preserved; the
  retained combined silhouette is unchanged. Both assets use this cut so
  hair-classified bust fragments cannot appear below the trimmed head.
  Reference projection uses the complete source bounds before this cut, and
  a profile keeps the same front/back direction on both sides.
- These assets use `reconstructed_skin_surface_v4` and
  `generated_hair_surface_v4` mesh names. They do not add inset shells or
  voxel-remesh the hair, which previously enlarged misplaced hair and removed
  fine strands. Metadata records `source_surface_preserved` and
  `reference_segmented_source_surface_v4`.
- The default reference-backed path keeps its existing voxel hair and inset
  backing behavior. Without a front reference, the older fused head and
  independent smoothed voxel hair remain available for compatibility.

New clients load hair.glb separately and keep the standard editor hair as a
fallback if that optional asset cannot be loaded.

The experimental split still uses approximate color-based segmentation,
with a skin/neck
prior and connected scalp cleanup. It does not create skin hidden under the
hair, facial textures, accessories, or a rig. Hair removal may expose an open
surface. Existing saved assets remain unchanged; reprocess their preserved
raw mesh into a new output directory to review a candidate without rerunning
GPU inference. Keep the original metadata with that candidate for provenance.
The opt-in does not change the worker default or the asset cache fingerprint.
Its metadata records `preserve_source_surface: true`; previews render the
actual exported skin and hair colors together. It is a candidate for visual
review, not an accepted likeness reconstruction.

For the curated angry_dog appearance refinement, see
[`REFINE_REFERENCE_SURFACE.md`](REFINE_REFERENCE_SURFACE.md). That separate
candidate tool cleans skin/hair labels, adds a fitted rear hair surface and
editable linear vertex albedo, and exports the opt-in
`stylized_reference_v1` profile with reference eye dimensions. It leaves the
general reconstruction provider and saved source assets unchanged.

## Legacy FaceMesh and SMPL-X spike

This tool produces a **static triangle-mesh `head.glb` baseline** from the
portrait, three-quarter and profile references already collected by Character
Studio. It does not download a model or call an external service.

Pipeline:

1. detect 478 corresponding MediaPipe FaceMesh landmarks in every image;
2. remove camera scale/rotation/translation and fuse the three 3D estimates;
3. align the conventional 68 facial controls to SMPL-X;
4. transfer their shape difference to the dense face with a regularized
   Gaussian RBF while fading to zero at the cranium, ears and neck;
5. extract vertices controlled by the SMPL-X head/jaw/eye joints and cap the
   neck and mouth boundaries;
6. write `head.glb`, diagnostics JSON and deterministic OpenCV CPU previews.

## Requirements

- Current Hunyuan worker: Python 3.10 and an NVIDIA CUDA 12.1 runtime.
- Install its pinned shape-only dependencies into the separate Conda
  environment used by `MODEL3D_CONDA_ENV` (the current default is `basic`):

  ```powershell
  conda run -n basic python -m pip install -r backend/requirements-3d.txt
  ```

- The legacy FaceMesh/SMPL-X spike uses the same `mediapipe` dependency and
  additionally needs the official local `SMPLX_NEUTRAL.npz`.

The full upstream Hunyuan demo and texture stack is intentionally not installed
by this file; see `external/Hunyuan3D-2/requirements.txt` if those tools are
needed.

## Exact Angry Dog command

Run from the repository root (`generative`):

```powershell
python who_craft/tools/reconstruction/reconstruct_head.py `
  --portrait docs/character-studio/reconstruction-spike/inputs/portrait.png `
  --three-quarter docs/character-studio/reconstruction-spike/inputs/three_quarter.png `
  --profile docs/character-studio/reconstruction-spike/inputs/profile.png `
  --model smpl_assets/smplx/SMPLX_NEUTRAL.npz `
  --out-dir docs/character-studio/reconstruction-spike/output
```

Outputs:

- `head.glb` — standalone closed triangle mesh;
- `metrics.json` — per-view detection, alignment, deformation and topology
  diagnostics;
- `front.png`, `three_quarter.png`, `profile.png` — CPU previews of the output
  mesh itself, not the input images.

## Tests

```powershell
python -m unittest discover -s who_craft/tools/reconstruction -p "test_*.py" -v
```

The tests cover similarity alignment, multi-view fusion, regularized RBF
interpolation, vector clipping, and oriented boundary capping under reordered
and globally reversed face winding. They do not load MediaPipe or the licensed
SMPL-X asset.

## Scope and limitations

This is a measurable prototype, not production identity reconstruction.
The Angry Dog output is structurally valid but did **not** pass the visual
identity-likeness gate: the face still reads as a generic SMPL-X-derived head.
There is no 2D output-to-reference reprojection metric yet. FaceMesh estimates
depth from stylized 2D art; it cannot observe hidden detail.
The original SMPL-X topology, cranium and neck are deliberately retained for a
stable later body integration. Hair is absent only from this legacy spike; the
current Hunyuan path generates a separate asset. This older GLB is static and
has no facial rig or expression blend shapes.
