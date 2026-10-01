# Curated posterior neck repair

`repair_reference_neck.py` repairs the visible gap and loose fragments below
angry_dog's ears after the v2 appearance refinement. It is an offline operation
for the reviewed revision-110 source pair. It does not run reconstruction,
change editor parameters, modify the database, or replace saved revisions.
Use the existing reconstruction environment with NumPy, SciPy and trimesh.

```powershell
python tools/reconstruction/repair_reference_neck.py `
  --head path/to/revision-110/head.glb `
  --hair path/to/revision-110/hair.glb `
  --output-dir path/to/new/candidate
```

The destination must be fresh. The command refuses in-place output, an existing
candidate, a different source pair, unexpected v2 face anchors, changed measured
contours, or invalid patch topology. It writes `head.glb`, `hair.glb` and
`repair.json`, including input/output SHA-256 checksums and geometry measurements.
The required source hashes are:

- Head: `00facc3a995ab9f395fcc21914d14643c9a080b4c1392babac59707c9fb98cd3`.
- Hair: `6c3fdafa1f907d9582485eecae8436d931b1a29e2059ce030449b9b80576cda4`.

These guards deliberately prevent applying character-specific contours to a
different mesh. A different reconstruction needs its own measured repair.
The original v1/v2 refinement command and its outputs remain unchanged.

## Geometry and preservation

The source has an open posterior jaw edge, a separate rear neck surface, a thin
rear sheet, and a disconnected 109-triangle side flap. Five fitted panels connect
the measured jaw and rear-neck boundaries, from canonical Y=0.045380 to 0.135650 m.
Four narrow side panels use harmonic interpolation with fixed boundary vertices;
the upper rear panel uses a curved Coons surface. A shared row at Y=0.075074 m
preserves the runtime's triangle-centroid alignment-band measurement.

The repair adds 3,270 vertices and 6,926 triangles. It removes 3,487 triangles
from the separate rear sheet above Y=0.075 m and the entire 109-triangle side
flap. It does not move any original vertex or change its color; original normals
are retained, with only float32 serialization rounding below 1e-7. The front
face, eyes, lips, ears and authored facial anchors are unchanged.

Four disconnected hair remnants immediately beside the lower throat are also
removed: 241, 11, 201 and 25 triangles, 478 total. Their complete components lie
inside |X|=0.041–0.044 m, Y<0.056 m and Z=−0.030…0 m. The main crown, inner scalp,
ten shoulder-length locks, and all retained hair positions, normals and colors
are unchanged. Removing these fragments is necessary: they sat in front of the
repaired skin and appeared as brown stripes even after the gap was closed.

Both outputs retain `sourceProfile: stylized_reference_v2`, editable
`colorMode: relative_linear`, crown metadata and the existing `referenceFace`
eye dimensions/anchors. The head adds `posteriorNeckRepair`; the hair adds
`neckShardRepair`. `neckPreservedThroughY` becomes 0.044 m because detached
fragments above that level are deliberately removed. No runtime appearance
profile or palette change is needed.

Removing the false side flap changes only the canonical alignment bound maxX,
from 0.0430885553 to 0.0426198207 m. The other five bounds are exact. With the
reviewed saved parameters, actual `MorphRig` head scale remains
1.1710320294769097 on all axes; head Y/Z remain unchanged. Head X moves from
−0.0000866782442 to −0.0000409363033 m, a 0.045742 mm centering correction.
Body-fit parameters remain unchanged. The editor derives its neck-to-body seam
from the repaired surface; the new lower panels reach below that seam's section.

## Verification and limits

The real candidate passed intersection checks on the affected geometry, with
no new self-intersections, degenerate triangles, inconsistent winding or
non-manifold edges. Its 82 open patch edges are the intentional upper edge under
the hair and lower edge at the editor's neck join. This is not a watertight
standalone head for printing. The new posterior volume is interpolated from
the existing mesh contours.

Front, quarter, profile and back views were accepted in the actual WebGL editor.
For any later repair, use the actual captured camera matrix and canvas dimensions
when relating pixels to geometry; a stale canvas height can misidentify the
canonical location. CPU previews alone do not verify runtime seams or foreground
hair overlaps. Applying a reviewed output must create a new immutable character
revision through the normal asset publication flow.

Portable regression tests cover boundary corners, consistent patch winding,
harmonic interpolation, centroid-based neck bounds, source guards and refusal
to overwrite files. The additional real-asset test checks preserved original
coordinates/normals/colors, untouched main hair, optical metadata and bounds:

```powershell
python -m unittest discover -s tools/reconstruction -p test_repair_reference_neck.py -v

$env:REFERENCE_NECK_HEAD = 'path/to/revision-110/head.glb'
$env:REFERENCE_NECK_HAIR = 'path/to/revision-110/hair.glb'
python -m unittest discover -s tools/reconstruction -p test_repair_reference_neck.py -v
```

Without the two environment variables, only the real-asset test is skipped;
private generated assets are not committed to the repository.
