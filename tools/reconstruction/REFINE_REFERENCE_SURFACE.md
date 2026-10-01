# Curated reference surface refinement

`refine_reference_surface.py` refines the already normalized angry_dog
reconstruction. It is an explicit asset profile, not an automatic replacement
for the general Hunyuan splitter or a new reconstruction provider.

The input is the matching pair of preserved v4 `head.glb` and `hair.glb` files
produced with `postprocess_hunyuan_mesh.py --preserve-source-surface`. Coordinates
must be canonical metres, with +Y up, +Z forward and the combined crown at 0.30 m.
It requires the same NumPy, SciPy and trimesh environment as the existing postprocessor.

```powershell
python tools/reconstruction/refine_reference_surface.py `
  --head path/to/preserved/head.glb `
  --hair path/to/preserved/hair.glb `
  --output-dir path/to/new/candidate `
  --skin-color '#f0b697' `
  --profile stylized_reference_v2
```

The script writes a new head, hair and `refinement.json`, including input/output
SHA-256 checksums and measured geometry changes. It does not change
source media, database records, character parameters or revision history.
Use a separate candidate directory and visually inspect front, quarter, profile
and back views before applying it to an active character.

The profile constrains skin labels to the face, ears and neck, eliminating
skin-colored fragments among the hair. Small disconnected scraps are removed.
The original central neck triangle assignment is retained through canonical Y=0.055 m,
so it remains compatible with the editor's fitted neck join. This attachment
protection covers |X|<0.055 m, Z=-0.052…0.066 m. Central neck labels are also
preserved through Y=0.10 m inside |X|<0.050 m, Z=-0.049…0.066 m; falsely labeled
hair tips beyond these regions can still be reassigned.
Hair and face surface colors are subtle authored albedo
details; eyes, brows and the headband are supplied by the editor.

The default `stylized_reference_v2` profile adds bounded face-surface cleanup
and authored shoulder-length hair locks. Explicit `--profile stylized_reference_v1`
retains the previous geometry and optical metadata. Saved v1 assets are not
rewritten; the editor chooses the corresponding appearance behavior from the
asset's profile. This distinction makes previous saved appearances reproducible.

The exported mesh names are `reconstructed_skin_surface_v5` and
`generated_hair_surface_v5`. Both meshes carry these glTF extras:

- `sourceProfile: "stylized_reference_v2"` scopes the new editor appearance logic;
  legacy generation writes `stylized_reference_v1`.
- `colorMode: "relative_linear"` identifies normalized `COLOR_0` values as linear
  RGB multipliers of the editable skin/hair material color, in the range 0–1.
- `canonicalCrownY: 0.30` records the combined head and hair crown. The skin-only
  bounds stop at the hairline and must not be used as the crown when fitting.
- `neckPreservedThroughY: 0.055` records the protected attachment region.

The head additionally carries `referenceFace` eye centers and target aperture
dimensions. Both profiles retain centers `[-0.0319546, 0.1603329, 0.0806809]` and
`[0.0321932, 0.1603329, 0.0806809]`. V2 uses width 0.035 m, height 0.018 m and
iris diameter 0.019 m; v1 retains 0.030/0.0135/0.0158 m. These are optical
construction metadata, not a translation or rescaling of the source mesh.
V2 also exports `referenceFace.anchors` with `chinY: 0.0607`, `mouthY: 0.096`,
and `noseY: 0.1275`. `chinY` means the lower frontal face extent, including a
0.32 mm margin below the measured central lower contour at Y=0.06101995 m;
the forward chin prominence is higher, at approximately Y=0.0739 m.
The anchors come from triangle/plane sections of the canonical mesh: the
central lip crease is at Y=0.09525 m, the lower/upper lip prominences at
0.0929/0.10005 m, and the nose tip at Y=0.12735 m. Runtime slider masks and
picking should use these anchors rather than the legacy face-selection box:
its minimum Y=0.09289 m cuts through the lips, not the bottom of the face.
V1 metadata omits the new anchors so prior behavior remains reproducible.
Consumers must enable vertex colors on the materials and preserve
the profile extras when preparing the meshes. The palette used for this profile
is skin `#f0b697`, hair `#c68852`, and eyes `#5a98bc`; these are editable colors,
not absolute colors baked into the vertices.

V2 face polish fits a local quadratic depth surface to suppress small reconstruction
bumps and the old embossed brow tails. It changes Z only, preserving every X/Y
coordinate and triangle index. It excludes the nose, optical aperture, lips,
ears and neck using smooth region weights. Total displacement is capped at
0.65 mm over ordinary face regions and up to 2.9 mm at the old brow tails. The
real curated candidate measures approximately 1.52 mm maximum and 0.114 mm mean
displacement among changed vertices. All positions and imported normals below
Y=0.10 m remain exactly unchanged. Broader face proportions remain editor parameters.

V2 replaces torn outer lower ribbons and the folded rear patch with ten broad,
closed locks. They follow measured source crown dimensions, sweep behind the
ears and flare at curved shoulder-length tips around Y=0.041–0.054 m. A recessed
inner scalp closes the area behind the pinna. Smooth interpolated side/back
contours suppress the source's horizontal folds instead of reproducing them.
The front swept hairline and upper crown remain source geometry. Small crown
roughness is filtered with fixed boundary vertices and a 1.2 mm displacement
cap; the real candidate's measured maximum is about 0.75 mm. Neither the lower
locks nor their inner scalp replace protected source neck triangles.

The legacy v1 path retains its fitted inset back-half shell, imported crown
normals and original outer side strands. The lower side curtains still close
torn ribbon gaps. V1 does not apply the new face or crown smoothing.

This profile is specific to the existing angry_dog geometry. It cannot guarantee
identity from arbitrary photographs or reconstruct every missing original
strand. The new locks are authored broad forms, not individually recovered
strands; some coarse source forelock relief remains. This is an offline
preparation command, not an automatic fitting service. It requires visual
review with the runtime appearance controls and the character's actual
reference images before a separate authorized asset/revision save.

The source posterior jaw/neck surface is incomplete near the area below the
ear. Short skin-colored strips can remain visible between the neck and hair,
especially after moving the outer locks backward. Raycast inspection confirms
that this area includes real jaw and neck triangles: deleting the visible
strip opens the side of the face. Fixing it completely needs a fitted local
surface patch or retopology; widening the outer locks enough to hide it can
introduce an unnatural bend. The current profile retains the source skin and
attachment rather than deleting that anatomy.

For the reviewed revision-110 pair, the separate
[posterior neck repair](REPAIR_REFERENCE_NECK.md) now supplies that fitted patch
and removes confirmed detached skin/hair fragments beside the throat. It writes
a new candidate with guarded source hashes; it does not change this refinement
command or rewrite historical v1/v2 outputs.

For an actual candidate, compare protected triangle coordinates against both
input assets, compare head X/Y coordinates and neck positions/normals against
the prior saved surface, and check finite normals, relative colors and glTF
profile metadata. Inspect front, quarter, profile and back views in the real
editor; CPU flat-shaded renders alone cannot confirm optical fit or seams.

Run focused checks with:

```powershell
python -m unittest discover -s tools/reconstruction -p test_refine_reference_surface.py -v
```
