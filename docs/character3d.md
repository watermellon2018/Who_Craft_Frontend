# Editable reference characters

This is the current implementation guide for Character Studio's 3D editor. The
goal is a recognizable character fitted to its reference images, with immediate
local shape editing and durable saved versions. It does not promise recovery of
unobserved geometry or pixel-identical reconstruction from arbitrary pictures.

## Entry point and data flow

The project character's **3D model** stage opens
`/project/:projectId/characters/:characterId/3d-model`. Reading requires project
access; saving and restoring require the existing `edit_content` permission.

1. Locked, identity-consistent portrait, profile, back and quarter references
   identify a reconstruction by fingerprint.
2. A durable character job runs Hunyuan in a separate configured Python runtime.
   Private head/hair GLBs remain outside Git and the database stores metadata.
3. `MorphRig` combines the licensed local SMPL-X body with reconstructed head and
   hair. `body_fit.beta00`–`beta15` establish a measured base; UI parameters add
   local edits to it. The fitted neck joins the current body to the head.
4. The viewport edits geometry locally. The page owns undo/redo and unsaved
   changes. Apply persists parameters and a character revision through the API.
5. Prepared source profiles can opt into additional face/hair surface treatment.
   Unmarked meshes use the legacy renderer.

## Ownership and contracts

| Concern | Implementation |
| --- | --- |
| Parameter registry/defaults | `src/modules/character-studio/components/character3d/zones.ts` |
| Editing session and save baseline | `pages/Character3DEditorPage.tsx` |
| Picking, gestures and camera | `components/character3d/CharacterViewport.tsx` |
| Body/face deformation and garment attachment | `engine/morphRig.ts` |
| Head preparation, coordinates and disposal | `engine/reconstructedHead.ts` |
| Profile eye/lid/brow construction | `engine/referenceFace.ts` |
| Fitted headband | `engine/referenceHair.ts` |
| Surface preparation | `tools/reconstruction/refine_reference_surface.py` |
| Revision/asset selection | backend `character_studio/services/` |

Paths without a module prefix above are under
`src/modules/character-studio/` (engine under `components/character3d/`).
The source-profile geometry/color contract and preparation command are in
[surface refinement](../tools/reconstruction/REFINE_REFERENCE_SURFACE.md).
Body fitting inputs and limitations are in [SMPL tools](../tools/smpl/README.md).

## Visual acceptance

Compare actual WebGL output to the same character's portrait, quarter, profile
and back references. Check face silhouette and expression, embedded eyes with
continuous lids, hairline/part/ends, ear clearance, neck continuity, and clothing.
Use the application lighting in comparison previews. A painted mock-up or a
passing topology test is not evidence of visual likeness.

New assets must be written to a new immutable location, with provenance and
checksums. Preserve source assets and all existing fitted parameters not being
intentionally edited. Review the candidate before selecting it for the character.
Keep preparation/runtime versions explicit so restoring a saved asset does not
silently apply a different profile's facial construction.

## Reference appearance and clothing

Checkpoint `6a00b9c` preserves the September appearance work: measured body fit,
neck join, v1 eyes/headband and relative linear vertex colors. The local angry_dog
example was saved as revision 109, asset version 2. Its prior test checkpoint is
125 engine tests. This checkpoint still has conspicuous eye and hair artifacts.

`stylized_reference_v2` opts into rounded, recessed optical eyes, fitted lids,
bounded source-surface cleanup, broad shaped hair locks and a headband fitted to
the outer hair envelope. V1 remains a distinct rendering/preparation profile for
historical assets. Relative linear vertex colors multiply editable skin/hair
colors; they are not baked sRGB values interpreted as linear light.

The curated v2 face carries measured `chinY`, `mouthY` and `noseY` anchors.
The deformation mask includes the lower face and mouth corners while protecting
the neck. Do not infer these landmarks from the legacy coarse face bounds: that
placed this character's mouth about 24 mm above its actual geometry.

The polo style adds a real neck opening, collar stand/leaves, facing, placket,
buttons, piping and cuffs. Its short-sleeve subset retains the source body vertex
mapping, so sleeve cuts and cuffs follow body edits. A continuous hem facing
covers the waist junction, with shading matched to the garment above it. Details
follow barycentric anchors on the changing garment. It is fitted geometric
clothing, without cloth simulation.

## Mouse editing and saved versions

- Select a region, then drag it. Each completed gesture is one undo step; Escape,
  pointer cancellation, focus loss and unmount release the camera controls.
- Picking recovers rest anatomy from the actual deformed triangle. Body/garment
  vertex mapping and full face rest positions are distinct from the compact
  weighted vertex list used for deformation.
- Upper arm, forearm, thigh and calf volume use smooth radial deformation around
  measured section centers, tapering to zero at joints. Garments follow it.
- Registry ranges bound drag values. Unsupported numeric controls and asymmetric
  editing are disabled explicitly for the current morph rig.
- The saved-version selector restores parameters, autofit flags and the exact
  selected head/hair asset, then reloads the viewport and resets local undo.
  Save or discard local changes first. Restoration is unavailable during initial
  loading/autofit and blocks concurrent edits.

The backend stores complete snapshots, validates asset ownership, reference
identity and byte hashes, and selects immutable files. Legacy snapshots without
an asset selection restore their recorded parameters while retaining the current
asset; the UI warns about that limitation. See the backend
`docs/character-model3d-history.md` for the persistence and reviewed-publication
command contract. The FK migration is `0074_studiocharacter_active_model3d_asset`.

## Limits and verification evidence

This profile is curated for angry_dog, not automatic landmark recovery for any
uploaded face. Original crown/forelock relief remains coarse, and the model is
not visually identical to every reference angle. Asymmetry, custom ear/hand/foot
shape and several legacy numeric controls remain unsupported and are disabled.
Body fitting remains the existing 16-beta baseline plus local controls.

The posterior jaw/neck repair fills the source gap below the ear, removes the
isolated skin strip, and cleans small hair fragments protruding through the
neck. It preserves the original face coordinates and body-fit parameters. The
repair is a separate, checksum-guarded offline step for this reviewed asset
pair; it does not change the historical v1/v2 preparation commands. See
`tools/reconstruction/REPAIR_REFERENCE_NECK.md` for its inputs and validation.
The crown-to-lock transition remains visible at some angles.

Local experimental media and check receipts stay outside Git. Visual acceptance
and real viewport drag/export checks accompany automated engine/page tests;
authenticated history and signed-media round trips run against a PostgreSQL test
database. A standalone viewport harness is not a full authenticated application
browser test.

The October 2026 local checkpoint stores angry_dog as revision **111**, asset
version **4**, with all revision-110 parameters and the original body fit
unchanged. The neck repair preserves head scale and vertical/depth placement;
removing a false neck edge shifts head X by only 0.046 mm. Both selected files
were read back through signed media routes and matched the reviewed SHA-256
hashes. Revisions 109 and 110 and their original files remain available.

Verification for this checkpoint and the polo follow-up: **184** editor tests
(172 component/engine tests and 12 page tests), **79** contract tests,
**19** surface-tool tests, **8** neck-repair tests (including the actual reviewed
source pair), and **94** backend cases (93 passed, one platform
skip). TypeScript, API generation check, ESLint and production build passed;
ESLint reports existing/project test warnings. Real viewport nose/mouth/thigh
drags and gesture undo/redo were checked in the browser. GLB export preserves
visible garment triangle cuts on a cloned snapshot and retains morph weights;
the live rig is never changed by export. The final revision-111 browser export
contains 34 meshes and 294,578 triangles, with finite vertex, normal and morph
attributes; its visible shorts cut is retained.

## Verification commands

```sh
npm test -- --watchAll=false --runInBand src/modules/character-studio/components/character3d/engine
npx tsc --noEmit --pretty false
npm run lint
python -m unittest discover -s tools/reconstruction -p test_refine_reference_surface.py
```

Also run the page/gesture tests affected by editing changes, backend revision and
reconstruction tests against PostgreSQL, and the repository contract checks when
the API contract changes. Test actual GLBs as well as synthetic geometry. Record
unavailable checks and remaining visual limitations explicitly.
