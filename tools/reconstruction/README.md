# Character Studio reconstruction tools

## Current Hunyuan multi-view pipeline

The production path requires four unique, identity-consistent head views in
stable Hunyuan order: portrait/front, profile/left, back, and
three-quarter/right. The tools prepare transparent crops, generate the
character-specific multi-view surface, and publish two URLs:

- head.glb retains fused-hair compatibility for older clients;
- hair.glb is an independent, smoothed voxel-remesh with newly generated
  topology derived from the reconstructed multi-view hair volume.

New clients load hair.glb separately and keep the standard editor hair as a
fallback if that optional asset cannot be loaded.

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

- Python 3.11
- existing environment packages: `numpy`, `opencv-python`, `mediapipe`
- the official local `SMPLX_NEUTRAL.npz`

No installation step is required in this workspace.

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
