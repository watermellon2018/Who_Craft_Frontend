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
  --skin-color '#f0b697'
```

The script writes a new head, hair and `refinement.json`. It does not change
source media, database records, character parameters or revision history.
Use a separate candidate directory and visually inspect front, quarter, profile
and back views before applying it to an active character.

The profile constrains skin labels to the face, ears and neck, eliminating
skin-colored fragments among the hair. Small disconnected scraps are removed.
The original central neck triangle assignment is retained through canonical Y=0.055 m,
so it remains compatible with the editor's fitted neck join. This attachment
protection covers |X|<0.055 m, Z=-0.052…0.066 m. Central neck labels are also
preserved through Y=0.10 m inside |X|<0.050 m, Z=-0.049…0.066 m; falsely labeled
hair tips beyond these regions can still be reassigned. Source face vertex
positions are retained.
Hair and face surface colors are subtle authored albedo
details; eyes, brows and the headband are supplied by the editor.

The exported mesh names are `reconstructed_skin_surface_v5` and
`generated_hair_surface_v5`. Both meshes carry these glTF extras:

- `sourceProfile: "stylized_reference_v1"` scopes the editor's appearance logic.
- `colorMode: "relative_linear"` identifies normalized `COLOR_0` values as linear
  RGB multipliers of the editable skin/hair material color, in the range 0–1.
- `canonicalCrownY: 0.30` records the combined head and hair crown. The skin-only
  bounds stop at the hairline and must not be used as the crown when fitting.
- `neckPreservedThroughY: 0.055` records the protected attachment region.

The head additionally carries `referenceFace` eye centers and target aperture
dimensions. Consumers must enable vertex colors on the materials and preserve
the profile extras when preparing the meshes. The palette used for this profile
is skin `#f0b697`, hair `#c68852`, and eyes `#5a98bc`; these are editable colors,
not absolute colors baked into the vertices.

An inset shell closes missing ribbons on the back half of the hair and replaces
the central rear patch whose generated ribbons fold into a false shelf. It follows
the original hair's radial bounds, remains behind Z=-0.018 m at ear height and extends to the
existing hair-tip level around Y=0.044 m outside the protected neck region. Its
upper edge blends into the retained source crown, including its imported vertex
normals. Below Y=0.125 m, side curtains extend forward to close torn hair gaps
which exposed the intact rear neck. They stay outside the neck attachment
region; the ears and face remain uncovered. The source crown and outer side strands remain.

This profile is specific to the existing angry_dog geometry. It cannot guarantee
identity from arbitrary photographs or reconstruct every missing original
strand. The profile still requires visual review with the runtime appearance
controls and the character's actual reference images.

Run focused checks with:

```powershell
python -m unittest discover -s tools/reconstruction -p test_refine_reference_surface.py -v
```
