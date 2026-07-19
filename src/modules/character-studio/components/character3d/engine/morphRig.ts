import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';
import {getAncestors} from '../zones';
import {
  disposeReconstructedHead,
  keepGeometryBelowY,
  prepareReconstructedHead,
  RECONSTRUCTED_HEAD_GLB_URL,
} from './reconstructedHead';
import type {PreparedReconstructedHead} from './reconstructedHead';
import type {Rig, ZoneParams} from './rig';

// SMPL morph-target engine (A1). The SECOND 3D engine, sitting RIGHT NEXT TO
// the procedural CharacterRig (engine/rig.ts) and implementing the same public
// surface, so the viewport/drag/outline/camera code around it never changes and
// the editor uses the anatomical mesh directly.
//
// Where the procedural rig assembles a stylized mannequin from primitives and
// drives it with formulas, this one loads a real anatomical SMPL body mesh
// (base + shape blend shapes baked as glTF morph targets by
// tools/smpl/convert_smpl_to_glb.py) and drives `morphTargetInfluences` from a
// β-mapping table. That is the realism ceiling of the parametric approach — the
// Sims-level "body instead of mannequin" the A1 plan targets — with NO
// generative network: SMPL morphs are PCA components learned from real scans,
// an analytic parametric basis.
//
// SMPL's baked β space describes the body silhouette (build, weight,
// proportions). Face controls use deterministic local vertex deformation around
// the baked SMPL-X landmarks, so portrait/profile measurements change the real
// head surface instead of adding primitives or painting a reference onto it.

// Default URL the converter writes to (CRA serves public/ at the web root).
export const MORPH_GLB_URL = '/models/body.glb';

// Slider extreme → β value the morph deltas were baked at (must match
// BETA_SCALE in convert_smpl_to_glb.py). The deltas are stored at β = ±3, so a
// morph influence of 1.0 reproduces β = +3 and an influence of −1.0 → β = −3.
const BETA_SCALE = 3.0;

// ─────────── β mapping table (the intellectual core of A1) ───────────
//
// SMPL-X βs are abstract PCA components, not "shoulder width" knobs. This table
// maps the body-shape sliders our zones expose onto β combinations, CALIBRATED
// from the measured geometric effect of each β on the neutral SMPL-X mesh
// (tools-side measurement, ±3 each):
//   β0 — STATURE: height 1.72→2.01 (+3) / →1.43 (−3); widths scale with it. The
//        dominant axis is height, so don't pump β0 for "broader" — it makes the
//        figure TALLER. We leave β0 free of width sliders (no height slider yet).
//   β1 — WEIGHT/bulk: POSITIVE β1 = HEAVIER (chest depth 0.264→0.336, wider
//        waist/hips); negative = slimmer. (The earlier table had this inverted.)
//   β2 — PROPORTION: POSITIVE = wider hips / narrower shoulders (pear); negative
//        = wider shoulders / narrower hips (V / inverted triangle).
//   β3 — HIP WIDTH (finer): positive widens the hips/pelvis, negative narrows.
// Each entry adds to a β; several sliders can push the same β. Sums are clamped
// then divided by BETA_SCALE into a morph influence. `value` is the slider
// in [-1, 1]. Sliders with no honest β analogue (limb length, single-limb
// volume, face) are absent and stay at the neutral base — the documented limit.
interface BetaTerm {
  beta: number;
  // β contribution at slider = +1 (scaled by the live slider value).
  scale: number;
}

const BETA_MAPPING: Record<string, Record<string, BetaTerm[]>> = {
  shoulders: {
    // Broader shoulders = V-taper → β2 toward shoulders (negative). A touch of
    // β1 so broad shoulders also read a little heavier up top.
    shouldersWidth: [{beta: 2, scale: -1.2}, {beta: 1, scale: 0.3}],
  },
  torso: {
    // Chest width/back = upper-body bulk → β1 (weight). Chest depth is the
    // clearest β1 signal (depth 0.264→0.336 at +3).
    chestWidth: [{beta: 1, scale: 0.7}],
    chestDepth: [{beta: 1, scale: 1.2}],
    backWidth: [{beta: 1, scale: 0.5}, {beta: 2, scale: -0.3}],
  },
  waist: {
    // A wider waist reads as more weight → β1 up; a touch of β3 thickness.
    waistWidth: [{beta: 1, scale: 1.4}, {beta: 3, scale: 0.4}],
    // Silhouette: hourglass(−) ↔ straight(+). A straighter torso is heavier
    // (less waist taper) and less pear → +β1, −β2.
    torsoCurve: [{beta: 1, scale: 0.6}, {beta: 2, scale: -0.4}],
  },
  hips: {
    // Wider hips = lower-body bulk → β2 toward hips (pear) + β3 hip width.
    hipsWidth: [{beta: 2, scale: 1.1}, {beta: 3, scale: 0.7}],
    // Hip shape: rounder/fuller hips → β3 width + a little β1 weight.
    hipsShape: [{beta: 3, scale: 0.8}, {beta: 1, scale: 0.4}],
  },
};

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth01 = (v: number): number => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const bell = (value: number, center: number, radius: number): number =>
  smooth01(1 - Math.abs(value - center) / Math.max(radius, 1e-6));

const BODY_LANDMARK_FRACTIONS = {
  ankle: 0.04,
  elbowX: 0.29,
  hip: 0.5,
  knee: 0.25,
  neckSeam: 0.855,
  shoulderX: 0.11,
  wristX: 0.44,
} as const;
const BODY_LENGTH_SCALE = {
  calf: 0.035,
  forearm: 0.028,
  thigh: 0.045,
  upperArm: 0.032,
} as const;
const NECK_SEAM_SEGMENTS = 32;
const NECK_SEAM_HALF_HEIGHT_FRACTION = 0.008;
const RECONSTRUCTED_HAIR_LOWER_SHRINK = 0.03;

type MatKind = 'skin' | 'hair' | 'clothing';
type MorphPositionAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

// ─────────── Clothing (A5) ───────────
//
// A basic top + bottom garment layered on the SMPL-X body. Each garment is a
// THICKENED, BAND-MASKED COPY of the body's own triangles: we keep the body
// faces whose vertices fall in the garment's resting Y-band, then on every
// applyParams we re-derive each kept vertex's LIVE morphed position
// (base + Σ influenceᵢ·morphDeltaᵢ) — the same thing the GPU does to the body —
// recompute the band's smooth normals from those positions, and push each
// garment vertex out along its normal by a small fabric standoff. So the
// garment is literally "the current body surface + a few mm", and it hugs the
// figure for ANY β configuration the sliders produce.
//
// Why CPU re-derivation and not GPU morph sharing: a scene-graph child does NOT
// inherit a mesh's per-vertex morph deformation (morphs run in the body's own
// vertex shader). Sharing the body's morph attributes on a cloned garment would
// morph it on the GPU for free, but then the garment would sit EXACTLY on the
// skin and z-fight — pushing it out along normals needs the positions on the
// CPU anyway (a custom shader is the only GPU alternative). applyParams fires on
// slider change, not per frame (tick() is a no-op in A1), so the bounded CPU
// pass over the band is cheap.
//
// Known v1 limitation: an all-in-band mask of the closed body is a skin-tight
// "base layer", not a draped garment, and a constant normal offset can still
// poke through in deep concavities (armpit/crotch). Acceptable for A5 v1 —
// material polygonOffset + a small standoff mask depth fighting; true drape
// needs dedicated garment geometry (later). Visual polish is the user's to
// judge (Claude's preview can't render WebGL); we verify the math by numbers.

// Outward fabric standoff (meters) per garment — how far the shell sits off the
// skin along the surface normal. Tuned so the shell stays proud without ballooning.
const GARMENT_THICKNESS: Record<string, number> = {
  clothing_top: 0.012,
  clothing_bottom: 0.014,
};

// Default fabric colors (mirrors the zones.ts swatch defaults) used until the
// palette drives them.
const GARMENT_DEFAULT_COLOR: Record<string, string> = {
  clothing_top: '#3b5266',
  clothing_bottom: '#2d2d33',
};

// Resting Y-band (fraction of figure height, feet=0 to head=1) each garment is
// cut from the body. Top stops below the measured neck seam; bottom keeps a
// trousers-sized superset whose shorter prefix renders as shorts. Membership
// is fixed at the base pose so morphs move vertices without reselecting faces.
const GARMENT_BANDS: Record<string, {yLo: number; yHi: number}> = {
  clothing_top: {
    yLo: 0.55,
    yHi: BODY_LANDMARK_FRACTIONS.neckSeam - NECK_SEAM_HALF_HEIGHT_FRACTION,
  },
  clothing_bottom: {yLo: 0.04, yHi: 0.56},
};

const GARMENT_STYLE_ORDER: Record<string, string[]> = {
  clothing_top: ['sleeveless', 'tshirt', 'long_sleeve'],
  clothing_bottom: ['shorts', 'trousers'],
};

const GARMENT_DEFAULT_STYLE: Record<string, string> = {
  clothing_top: 'tshirt',
  clothing_bottom: 'shorts',
};

// Per-garment runtime state. Geometry/material/buffers are allocated ONCE in the
// constructor and reused; applyParams only rewrites the position/normal arrays.
interface SurfaceShellSlot {
  id: string;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  // localToBodyVid[k] = the body vertex index that garment-local vertex k copies.
  localToBodyVid: Int32Array;
  // Triangles as garment-LOCAL indices (length = 3·triangleCount).
  localIndex: Uint32Array;
  thick: number;
  // Reused per-apply scratch so there is no allocation on the interactive path.
  scratchPos: Float32Array; // K·3 live morphed body positions for kept verts
  scratchNrm: Float32Array; // K·3 smooth normals of the band
  visible: boolean;
}

interface GarmentSlot extends SurfaceShellSlot {
  // Cumulative index counts for nested style silhouettes. setDrawRange lets a
  // single independent garment asset expose different reference-derived cuts.
  styleCounts: Record<string, number>;
  style: string;
}

type HairShellKind = 'cap' | 'bangs' | 'back' | 'sides';
type HairShellId = 'hair_cap' | 'hair_bangs' | 'hair_back' | 'hair_sides';

interface HairShellSlot extends SurfaceShellSlot {
  id: HairShellId;
  kind: HairShellKind;
  // Extra downward offset after the shell has been rebuilt from the live scalp.
  drop: number;
}

const HAIR_DEFAULT_COLOR = '#1E1A18';
const HAIR_SHELL_CONFIGS: Array<{id: HairShellId; kind: HairShellKind}> = [
  {id: 'hair_cap', kind: 'cap'},
  {id: 'hair_bangs', kind: 'bangs'},
  {id: 'hair_back', kind: 'back'},
  {id: 'hair_sides', kind: 'sides'},
];
const HAIR_BASE_THICKNESS: Record<HairShellKind, number> = {
  cap: 0.014,
  bangs: 0.017,
  back: 0.018,
  sides: 0.017,
};
const HAIR_MAX_DROP: Record<HairShellKind, number> = {
  cap: 0,
  bangs: 0.025,
  back: 0.24,
  sides: 0.14,
};

interface HairStyleProfile {
  cap: number;
  bangs: number;
  back: number;
  sides: number;
  puff: number;
}

const HAIR_STYLE_PROFILES: Record<string, HairStyleProfile> = {
  default: {cap: 1, bangs: 0.28, back: 0.35, sides: 0.28, puff: 0},
  long: {cap: 1, bangs: 0.32, back: 1, sides: 0.72, puff: 0.004},
  bob: {cap: 1, bangs: 0.48, back: 0.62, sides: 1, puff: 0.006},
  ponytail: {cap: 1, bangs: 0.08, back: 0.16, sides: 0.18, puff: -0.002},
  bun: {cap: 1, bangs: 0, back: 0.08, sides: 0.12, puff: -0.001},
  afro: {cap: 1, bangs: 0.8, back: 0.86, sides: 0.9, puff: 0.055},
  none: {cap: 0, bangs: 0, back: 0, sides: 0, puff: 0},
};

const hairStyleProfileFor = (style: string): HairStyleProfile =>
  HAIR_STYLE_PROFILES[style] ?? HAIR_STYLE_PROFILES.default;

interface ReconstructedHairStyleProfile {
  backSweep: number;
  crownLift: number;
  length: number;
  sideTuck: number;
  volume: number;
}

const RECONSTRUCTED_HAIR_STYLE_PROFILES: Record<string, ReconstructedHairStyleProfile> = {
  default: {backSweep: 0, crownLift: 0, length: 0, sideTuck: 0, volume: 0},
  long: {backSweep: 0, crownLift: 0, length: 0.04, sideTuck: 0, volume: 0.01},
  bob: {backSweep: 0, crownLift: 0, length: -0.03, sideTuck: -0.02, volume: 0.04},
  ponytail: {backSweep: 0.07, crownLift: 0.01, length: 0.01, sideTuck: 0.09, volume: -0.03},
  bun: {backSweep: 0.09, crownLift: 0.05, length: -0.05, sideTuck: 0.12, volume: -0.04},
  afro: {backSweep: 0, crownLift: 0.08, length: -0.01, sideTuck: -0.04, volume: 0.18},
  none: {backSweep: 0, crownLift: 0, length: 0, sideTuck: 0, volume: 0},
};

const reconstructedHairStyleProfileFor = (style: string): ReconstructedHairStyleProfile =>
  RECONSTRUCTED_HAIR_STYLE_PROFILES[style] ?? RECONSTRUCTED_HAIR_STYLE_PROFILES.default;
// Resting face landmark centers baked into the GLB by the converter (from the
// SMPL-X facial landmarks). Used to place LIVE-colored overlays — iris, lips,
// brows — on the real face so the color stays editable from the palette.
type Vec3 = [number, number, number];
interface FaceAnchors {
  eyeL: Vec3;
  eyeR: Vec3;
  mouth: Vec3;
  browL: Vec3;
  browR: Vec3;
  eyeR_size: number;
}

interface RegionBand {
  zone: string;
  yLo: number;
  yHi: number;
}
const REGION_BANDS: RegionBand[] = [
  {zone: 'head_neck', yLo: 0.88, yHi: 1.01},
  {zone: 'shoulders', yLo: 0.8, yHi: 0.88},
  {zone: 'torso', yLo: 0.62, yHi: 0.8},
  {zone: 'waist', yLo: 0.55, yHi: 0.62},
  {zone: 'hips', yLo: 0.45, yHi: 0.55},
  {zone: 'legs', yLo: -0.01, yHi: 0.45},
];

export class MorphRig implements Rig {
  readonly root: THREE.Group;

  private mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;
  private morphIndex: Record<string, number> = {};
  private lastHighlight: [string | null, string | null] = [null, null];
  // Measured head center/radius (resting pose), used to anchor camera zoom for
  // head/face zones on the single mesh. SMPL-X's mesh already has a real face,
  // so no procedural feature graft is needed.
  private smplHeadCenter = new THREE.Vector3(0, 1.6, 0.05);
  private smplHeadRadius = 0.09;
  private smplNeckCenter = new THREE.Vector3(0, 1.47, -0.01);
  private smplNeckRadius = new THREE.Vector2(0.062, 0.074);
  // Live-colored face overlays placed on the real SMPL-X face from its baked
  // landmark anchors: iris discs (eye color), a lip tint, brow arcs. Tiny and
  // editable from the palette — NOT the old whole-head graft.
  private irisMats: THREE.MeshStandardMaterial[] = [];
  private lipMat: THREE.MeshStandardMaterial | null = null;
  private lipMesh: THREE.Mesh | null = null;
  private eyeOverlayGroups: THREE.Group[] = [];
  private faceAnchors: FaceAnchors | null = null;
  private faceBasePositions: Float32Array | null = null;
  private faceOverlayGroup: THREE.Group | null = null;
  private bodyBasePositions: Float32Array;
  // Hair: SMPL-X-native surface shells. Instead of grafting procedural hair made
  // for the old mannequin head, we cut scalp/front/back/side bands from the live
  // SMPL-X head surface and push them outward like clothing. This keeps hair
  // seated on the real skull under body morphs; hairStyle/length/volume choose
  // which shell bands are visible and how far they drop.
  private hairGroup: THREE.Object3D | null = null;
  private hairSlots: HairShellSlot[] = [];
  private hairMaterial: THREE.MeshStandardMaterial | null = null;
  // For each zone, the world-space-independent local Y mid of its vertex band,
  // used only to anchor zoneBounds when a single mesh can't be sub-selected.
  private vertexY: Float32Array;
  private vertexX: Float32Array;
  private baseMinY = 0;
  private baseMaxY = 1;
  // Clothing (A5): top + bottom garments, each a thickened band-masked copy of
  // the body surface that tracks the shape morphs. Built once, updated per apply.
  private garments: GarmentSlot[] = [];
  // The body's morph delta position attributes (geometry.morphAttributes.position),
  // the single source of the per-β vertex deltas the garments re-derive from.
  private morphDeltas: MorphPositionAttribute[] = [];
  // Reused scratch: the body's live morphed position for every vertex, computed
  // ONCE per applyParams and sampled by both garments (no double work).
  private morphedBody: Float32Array | null = null;
  private reconstructedHead: PreparedReconstructedHead | null = null;
  private reconstructedHeadBasePosition: THREE.Vector3 | null = null;
  private neckSeamMesh: THREE.Mesh | null = null;
  private bodyVerticalOffset = 0;

  /**
   * Async factory: the GLB must load before the rig is usable, but the
   * CharacterRig contract is otherwise synchronous. The viewport awaits this
   * and reports a load failure to the viewport if the asset is unavailable.
   */
  static async create(
    url: string = MORPH_GLB_URL,
    reconstructedHeadUrl: string = RECONSTRUCTED_HEAD_GLB_URL,
    reconstructedHairUrl?: string | null,
  ): Promise<MorphRig> {
    const loader = new GLTFLoader();
    // Hair is optional: if its independent asset is unavailable, keep the
    // reconstructed head and fall back to the existing SMPL hair shells.
    const hairPromise = reconstructedHairUrl
      ? loader.loadAsync(reconstructedHairUrl).catch(() => null)
      : Promise.resolve(null);
    const [gltf, reconstructedHeadGltf, reconstructedHairGltf] = await Promise.all([
      loader.loadAsync(url),
      loader.loadAsync(reconstructedHeadUrl),
      hairPromise,
    ]);
    let mesh: THREE.Mesh | null = null;
    gltf.scene.traverse((obj) => {
      if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh;
    });
    if (!mesh) throw new Error('MorphRig: GLB contained no mesh');
    const anchors = (mesh as THREE.Mesh).userData?.faceAnchors as FaceAnchors | undefined;
    const rig = MorphRig.fromMesh(mesh as THREE.Mesh, anchors);
    try {
      rig.attachReconstructedHead(
        reconstructedHeadGltf.scene,
        reconstructedHairGltf?.scene,
      );
      return rig;
    } catch (error) {
      rig.dispose();
      throw error;
    }
  }

  /**
   * Wrap an already-loaded morph mesh. Split out from {@link create} so tests
   * can build a MorphRig from a synthetic mesh without a GLB/network, and so a
   * future loader (a different asset, an embedded buffer) can reuse it.
   */
  static fromMesh(mesh: THREE.Mesh, anchors?: FaceAnchors): MorphRig {
    if (!mesh.morphTargetInfluences?.length) {
      throw new Error('MorphRig: mesh has no morph targets');
    }
    return new MorphRig(mesh, anchors);
  }

  private constructor(mesh: THREE.Mesh, anchors?: FaceAnchors) {
    this.root = new THREE.Group();
    this.root.name = 'character-rig';
    this.mesh = mesh;
    mesh.name = 'smpl_body';
    mesh.castShadow = true;
    mesh.userData.zoneId = 'body';
    mesh.userData.matKind = 'skin' satisfies MatKind;

    // The converter writes POSITION + morphs but no NORMAL attribute, so the
    // body renders BLACK under lighting (no normal → no diffuse response).
    // Compute smooth vertex normals from the base geometry; morph targets shift
    // them slightly but this is correct enough for a stylized body.
    if (!mesh.geometry.getAttribute('normal')) {
      mesh.geometry.computeVertexNormals();
    }

    // Replace the imported material with the editor's skin material so colors
    // and lighting match the procedural engine.
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dac0a3'),
      roughness: 0.62,
      metalness: 0.04,
    });
    this.material.envMapIntensity = 0.55;
    this.mesh.material = this.material;

    // Map morph names (beta00…) → influence index.
    const dict = mesh.morphTargetDictionary ?? {};
    this.morphIndex = {...dict};

    // Cache the immutable resting surface. Each apply starts here before face
    // and full-body proportion deformations, so slider updates never accumulate.
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.bodyBasePositions = new Float32Array(pos.count * 3);
    for (let vertex = 0; vertex < pos.count; vertex++) {
      this.bodyBasePositions[vertex * 3] = pos.getX(vertex);
      this.bodyBasePositions[vertex * 3 + 1] = pos.getY(vertex);
      this.bodyBasePositions[vertex * 3 + 2] = pos.getZ(vertex);
    }
    if (anchors) {
      this.faceAnchors = anchors;
      this.faceBasePositions = new Float32Array(pos.count * 3);
      for (let vertex = 0; vertex < pos.count; vertex++) {
        this.faceBasePositions[vertex * 3] = pos.getX(vertex);
        this.faceBasePositions[vertex * 3 + 1] = pos.getY(vertex);
        this.faceBasePositions[vertex * 3 + 2] = pos.getZ(vertex);
      }
    }
    this.vertexY = new Float32Array(pos.count);
    this.vertexX = new Float32Array(pos.count);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      this.vertexY[i] = y;
      this.vertexX[i] = pos.getX(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.baseMinY = minY;
    this.baseMaxY = maxY;

    // Measure the SMPL head so SMPL-native overlays can anchor to it (not
    // floating above the crown). The head is the narrow region in the top
    // ~10% of the figure; average its vertices for the center, halve its
    // X-spread for the radius.
    this.measureSmplHead(pos);
    this.measureSmplNeck(pos);

    this.root.add(mesh);

    // SMPL-X's base mesh carries a REAL face (eye sockets, lips, nose as
    // geometry), so — unlike bare SMPL — no procedural feature graft is needed.
    // The face is part of the body mesh and morphs with it naturally. We only
    // add tiny LIVE-colored overlays (iris, lips, brows) at the baked landmark
    // anchors so eye/lip/brow COLOR stays editable; the SMPL-X face is
    // monochrome geometry otherwise.
    if (anchors) {
      this.buildFaceOverlay(anchors);
    }
    this.buildHair(anchors);
    this.buildGarments();

    this.applyParams({});
  }

  /**
   * Build SMPL-native hair shells from the body's own head triangles. Each shell
   * is a compact copy of a scalp/front/back/side region, updated from the live
   * morphed head surface on every applyParams. This is intentionally more
   * limited than asset hair, but it sits on the SMPL-X skull reliably and keeps
   * the existing color/style/length/volume controls meaningful in morph mode.
   */
  private buildHair(anchors?: FaceAnchors): void {
    const group = new THREE.Group();
    group.name = 'smpl_hair_anchor';
    group.userData.zoneId = 'hair';
    this.root.add(group);
    this.hairGroup = group;

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(HAIR_DEFAULT_COLOR),
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    material.envMapIntensity = 0.35;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    this.hairMaterial = material;

    const pos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const index = this.mesh.geometry.getIndex();
    const bodyIdx: ArrayLike<number> = index
      ? (index.array as ArrayLike<number>)
      : Array.from({length: pos.count}, (_, i) => i);

    const figureHeight = Math.max(1e-6, this.baseMaxY - this.baseMinY);
    const radius = Math.max(0.04, this.smplHeadRadius);
    const center = this.smplHeadCenter;
    const topY = this.baseMaxY;
    const capLo = topY - Math.max(radius * 1.45, figureHeight * 0.07);
    const lowerLo = topY - Math.max(radius * 2.65, figureHeight * 0.16);
    const lowerHighY = topY - radius * 0.08;
    const browY = anchors ? Math.max(anchors.browL[1], anchors.browR[1]) : topY - radius * 0.72;
    const hairlineY = Math.min(topY - radius * 0.12, browY + radius * 0.08);
    const bangLo = Math.min(topY - radius * 0.14, browY + radius * 0.035);
    const faceCutZ = center.z + radius * 0.28;
    const faceHalfX = radius * 0.9;
    const frontZ = center.z + radius * 0.28;
    const capBackZ = center.z + radius * 0.25;
    const backZ = center.z + radius * 0.02;
    const sideX = radius * 0.35;
    const inFaceOval = (vid: number): boolean => {
      const x = this.vertexX[vid];
      const y = this.vertexY[vid];
      const z = pos.getZ(vid);
      return y < hairlineY && z > faceCutZ && Math.abs(x - center.x) < faceHalfX;
    };

    const predicates: Record<HairShellKind, (vid: number) => boolean> = {
      cap: (vid) => {
        const y = this.vertexY[vid];
        const z = pos.getZ(vid);
        return !inFaceOval(vid) && y >= capLo && (y >= hairlineY || z <= capBackZ);
      },
      bangs: (vid) => {
        const y = this.vertexY[vid];
        const z = pos.getZ(vid);
        return !inFaceOval(vid) && z >= frontZ && y >= bangLo && y <= topY + 1e-6;
      },
      back: (vid) => {
        const y = this.vertexY[vid];
        const z = pos.getZ(vid);
        return !inFaceOval(vid) && z <= backZ && y >= lowerLo && y <= lowerHighY;
      },
      sides: (vid) => {
        const y = this.vertexY[vid];
        const x = this.vertexX[vid];
        const z = pos.getZ(vid);
        return (
          !inFaceOval(vid) &&
          Math.abs(x - center.x) >= sideX &&
          z <= center.z + radius * 0.18 &&
          y >= lowerLo &&
          y <= lowerHighY
        );
      },
    };

    for (const config of HAIR_SHELL_CONFIGS) {
      const inRegion = predicates[config.kind];
      const remap = new Map<number, number>();
      const localToBody: number[] = [];
      const localTris: number[] = [];
      const localOf = (vid: number): number => {
        let local = remap.get(vid);
        if (local === undefined) {
          local = localToBody.length;
          remap.set(vid, local);
          localToBody.push(vid);
        }
        return local;
      };

      for (let t = 0; t + 2 < bodyIdx.length; t += 3) {
        const a = bodyIdx[t];
        const b = bodyIdx[t + 1];
        const c = bodyIdx[t + 2];
        if (inRegion(a) && inRegion(b) && inRegion(c)) {
          localTris.push(localOf(a), localOf(b), localOf(c));
        }
      }

      const k = localToBody.length;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k * 3), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(k * 3), 3));
      if (localTris.length) geometry.setIndex(localTris);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = config.id;
      mesh.castShadow = true;
      mesh.userData.zoneId = 'hair';
      mesh.userData.matKind = 'hair' satisfies MatKind;
      mesh.visible = k > 0;
      group.add(mesh);

      this.hairSlots.push({
        id: config.id,
        kind: config.kind,
        mesh,
        geometry,
        material,
        localToBodyVid: Int32Array.from(localToBody),
        localIndex: Uint32Array.from(localTris),
        thick: HAIR_BASE_THICKNESS[config.kind],
        drop: 0,
        scratchPos: new Float32Array(k * 3),
        scratchNrm: new Float32Array(k * 3),
        visible: k > 0,
      });
    }
  }

  /**
   * Place small colored overlays on the real face from the baked landmark
   * anchors: an iris disc in each eye, a lip tint over the mouth, a brow arc
   * over each brow. Anchored to the head so they ride along as the figure
   * morphs (the head moves little under shape morphs, so static anchors are
   * close enough; a future pass could re-seat them from live landmarks).
   */
  private buildFaceOverlay(a: FaceAnchors): void {
    const group = new THREE.Group();
    group.name = 'smpl_face_overlay';
    const r = a.eyeR_size || 0.022;

    // Layered eye on each eyeball surface: a white sclera, the colored iris on
    // top, and a dark pupil — stacked at increasing Z so they don't z-fight and
    // read as a real eye instead of one flat colored dot.
    for (const c of [a.eyeL, a.eyeR]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(c[0], c[1], c[2]);
      group.add(eyeGroup);
      this.eyeOverlayGroups.push(eyeGroup);

      // Sclera (white of the eye) — a flattened disc, the widest layer.
      const scleraMat = new THREE.MeshStandardMaterial({color: '#e9e4dc', roughness: 0.3});
      scleraMat.envMapIntensity = 0.55;
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 18, 12), scleraMat);
      sclera.scale.set(1.25, 0.7, 0.32);
      sclera.position.z = 0.002;
      sclera.raycast = () => undefined;
      eyeGroup.add(sclera);

      // Iris (colored) — sits on the sclera, color driven from the palette.
      const irisMat = new THREE.MeshStandardMaterial({color: '#3a6ca8', roughness: 0.25});
      irisMat.envMapIntensity = 0.55;
      const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 16, 12), irisMat);
      iris.scale.z = 0.4;
      iris.position.z = 0.005;
      iris.raycast = () => undefined;
      eyeGroup.add(iris);
      this.irisMats.push(irisMat);

      // Pupil (dark) — the smallest layer, just proud of the iris.
      const pupilMat = new THREE.MeshStandardMaterial({color: '#14100e', roughness: 0.15});
      pupilMat.envMapIntensity = 0.4;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 12, 8), pupilMat);
      pupil.scale.z = 0.35;
      pupil.position.z = 0.007;
      pupil.raycast = () => undefined;
      eyeGroup.add(pupil);
    }

    // Lip tint — a thin, flattened patch over the lips. Subtle (semi-transparent)
    // so it reads as lip color on the real mouth geometry, not a stuck-on blob.
    this.lipMat = new THREE.MeshStandardMaterial({color: '#b0524f', roughness: 0.5, transparent: true, opacity: 0.5});
    this.lipMat.envMapIntensity = 0.55;
    const lips = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), this.lipMat);
    lips.scale.set(r * 1.4, r * 0.42, r * 0.32);
    lips.position.set(a.mouth[0], a.mouth[1], a.mouth[2]);
    lips.raycast = () => undefined;
    group.add(lips);
    this.lipMesh = lips;

    // NB: no brow overlay — SMPL-X has no brow geometry to sit on, so painted
    // arcs read as stuck-on. They need dedicated geometry, not a painted patch.

    this.root.add(group);
  }

  /**
   * Build the clothing garments (A5): for each garment, mask the body's
   * triangles to its resting Y-band, compact the used vertices to a local index,
   * and allocate a reusable shell geometry/mesh. The shell positions are filled
   * later by {@link updateGarments} (called from applyParams) so the garment
   * tracks the live shape morphs. Membership is computed ONCE here at the base
   * pose so the kept triangle set is stable across β.
   */
  private buildGarments(): void {
    // The single source of the per-β vertex deltas the garments re-derive from.
    // (GLTFLoader's default morph semantics are RELATIVE — deltas from base —
    // which is exactly what base + Σ wᵢ·δᵢ reconstructs.)
    this.morphDeltas = this.mesh.geometry.morphAttributes.position ?? [];

    const pos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    // The body GLB is indexed; fall back to a trivial index for a non-indexed
    // mesh (synthetic test meshes) so band-masking has triangles to scan.
    const index = this.mesh.geometry.getIndex();
    const bodyIdx: ArrayLike<number> = index
      ? (index.array as ArrayLike<number>)
      : Array.from({length: pos.count}, (_, i) => i);

    const h = Math.max(1e-6, this.baseMaxY - this.baseMinY);
    const fracOf = (vid: number): number => (this.vertexY[vid] - this.baseMinY) / h;

    for (const id of Object.keys(GARMENT_BANDS)) {
      const band = GARMENT_BANDS[id];
      // Keep a triangle iff ALL three vertices are in-band (all-in keeps a clean
      // hem; any-in frays the cut edge).
      const inBand = (vid: number): boolean => {
        const f = fracOf(vid);
        return f >= band.yLo && f < band.yHi;
      };
      const selectedTriangles: Array<[number, number, number]> = [];
      for (let t = 0; t + 2 < bodyIdx.length; t += 3) {
        const a = bodyIdx[t];
        const b = bodyIdx[t + 1];
        const c = bodyIdx[t + 2];
        if (inBand(a) && inBand(b) && inBand(c)) {
          selectedTriangles.push([a, b, c]);
        }
      }

      // Styles are nested triangle subsets in one independent garment asset.
      // This keeps editing instant while still changing the actual silhouette:
      // sleeveless subset T-shirt subset long sleeve, shorts subset trousers.
      let orderedTriangles = selectedTriangles;
      const styleCounts: Record<string, number> = {};
      if (id === 'clothing_top') {
        const maxReach = (triangle: [number, number, number]): number =>
          Math.max(...triangle.map((vid) => Math.abs(pos.getX(vid))));
        const sleeveless = selectedTriangles.filter((triangle) => maxReach(triangle) <= h * 0.15);
        const tshirtExtra = selectedTriangles.filter((triangle) => {
          const reach = maxReach(triangle);
          return reach > h * 0.15 && reach <= h * 0.27;
        });
        const longSleeveExtra = selectedTriangles.filter((triangle) => maxReach(triangle) > h * 0.27);
        orderedTriangles = [...sleeveless, ...tshirtExtra, ...longSleeveExtra];
        styleCounts.sleeveless = sleeveless.length * 3;
        styleCounts.tshirt = (sleeveless.length + tshirtExtra.length) * 3;
        styleCounts.long_sleeve = orderedTriangles.length * 3;
      } else {
        const shorts = selectedTriangles.filter((triangle) =>
          triangle.every((vid) => fracOf(vid) >= 0.34),
        );
        const trousersExtra = selectedTriangles.filter((triangle) =>
          triangle.some((vid) => fracOf(vid) < 0.34),
        );
        orderedTriangles = [...shorts, ...trousersExtra];
        styleCounts.shorts = shorts.length * 3;
        styleCounts.trousers = orderedTriangles.length * 3;
      }

      const remap = new Map<number, number>(); // body vid to local id
      const localToBody: number[] = [];
      const localTris: number[] = [];
      const localOf = (vid: number): number => {
        let l = remap.get(vid);
        if (l === undefined) {
          l = localToBody.length;
          remap.set(vid, l);
          localToBody.push(vid);
        }
        return l;
      };
      orderedTriangles.forEach(([a, b, c]) => {
        localTris.push(localOf(a), localOf(b), localOf(c));
      });

      const k = localToBody.length;
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(GARMENT_DEFAULT_COLOR[id] ?? '#3b5266'),
        roughness: 0.82,
        metalness: 0.0,
        side: THREE.DoubleSide, // open hem/neck holes show no backface gap
      });
      material.envMapIntensity = 0.5;
      // Push the depth test off the skin underneath so the tight shell doesn't
      // z-fight even where the normal standoff is thin (a depth-fight fix only —
      // it does not cure true interpenetration in deep concavities).
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;

      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k * 3), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(k * 3), 3));
      if (localTris.length) geometry.setIndex(localTris);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = id;
      mesh.castShadow = true;
      mesh.userData.zoneId = id;
      mesh.userData.matKind = 'clothing' satisfies MatKind;
      // An empty band (no kept triangles) yields a harmless invisible mesh; we
      // never compute a bounding sphere on zero verts (NaN radius).
      mesh.visible = k > 0;

      this.root.add(mesh);
      this.garments.push({
        id,
        mesh,
        geometry,
        material,
        localToBodyVid: Int32Array.from(localToBody),
        localIndex: Uint32Array.from(localTris),
        styleCounts,
        style: GARMENT_DEFAULT_STYLE[id] ?? GARMENT_STYLE_ORDER[id]?.[0] ?? '',
        thick: GARMENT_THICKNESS[id] ?? 0.012,
        scratchPos: new Float32Array(k * 3),
        scratchNrm: new Float32Array(k * 3),
        visible: k > 0,
      });
    }
  }

  /** Restore the authored SMPL-X base before applying non-accumulating local edits. */
  private resetBodySurface(): void {
    const position = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let vertex = 0; vertex < position.count; vertex++) {
      const offset = vertex * 3;
      position.setXYZ(
        vertex,
        this.bodyBasePositions[offset],
        this.bodyBasePositions[offset + 1],
        this.bodyBasePositions[offset + 2],
      );
    }
    position.needsUpdate = true;
  }

  /** Apply full-body-derived limb proportions that have no isolated SMPL beta. */
  private applyReferenceBodyGeometry(params: ZoneParams): void {
    const numberParam = (zone: string, id: string): number => {
      const value = params[zone]?.[id];
      return typeof value === 'number' && Number.isFinite(value) ? clamp(value) : 0;
    };
    const thighLength = numberParam('thigh', 'thighLength');
    const calfLength = numberParam('calf', 'calfLength');
    const upperArmLength = numberParam('upper_arm', 'length');
    const forearmLength = numberParam('forearm', 'length');
    const figureHeight = Math.max(this.baseMaxY - this.baseMinY, 1e-6);
    const calfDelta = calfLength * figureHeight * BODY_LENGTH_SCALE.calf;
    const thighDelta = thighLength * figureHeight * BODY_LENGTH_SCALE.thigh;
    const upperArmDelta = upperArmLength * figureHeight * BODY_LENGTH_SCALE.upperArm;
    const forearmDelta = forearmLength * figureHeight * BODY_LENGTH_SCALE.forearm;
    const totalLegShift = calfDelta + thighDelta;
    this.bodyVerticalOffset = totalLegShift;
    const position = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let vertex = 0; vertex < position.count; vertex++) {
      const offset = vertex * 3;
      const baseX = this.bodyBasePositions[offset];
      const baseY = this.bodyBasePositions[offset + 1];
      const fractionY = (baseY - this.baseMinY) / figureHeight;
      let x = position.getX(vertex);
      let y = position.getY(vertex);
      const z = position.getZ(vertex);

      if (fractionY > BODY_LANDMARK_FRACTIONS.ankle) {
        const calfProgress = smooth01(
          (fractionY - BODY_LANDMARK_FRACTIONS.ankle)
          / (BODY_LANDMARK_FRACTIONS.knee - BODY_LANDMARK_FRACTIONS.ankle),
        );
        y += calfDelta * calfProgress;
      }
      if (fractionY > BODY_LANDMARK_FRACTIONS.knee) {
        const thighProgress = smooth01(
          (fractionY - BODY_LANDMARK_FRACTIONS.knee)
          / (BODY_LANDMARK_FRACTIONS.hip - BODY_LANDMARK_FRACTIONS.knee),
        );
        y += thighDelta * thighProgress;
      }

      const absoluteX = Math.abs(baseX);
      const shoulderX = figureHeight * BODY_LANDMARK_FRACTIONS.shoulderX;
      const elbowX = figureHeight * BODY_LANDMARK_FRACTIONS.elbowX;
      const wristX = figureHeight * BODY_LANDMARK_FRACTIONS.wristX;
      const armVerticalGate =
        smooth01((fractionY - 0.48) / 0.08)
        * smooth01((0.92 - fractionY) / 0.08);
      if (absoluteX > shoulderX && armVerticalGate > 0) {
        const upperProgress = smooth01((absoluteX - shoulderX) / (elbowX - shoulderX));
        const forearmProgress = smooth01((absoluteX - elbowX) / (wristX - elbowX));
        const direction = Math.sign(baseX) || 1;
        x += direction * (
          upperArmDelta * upperProgress + forearmDelta * forearmProgress
        ) * armVerticalGate;
      }

      position.setXYZ(vertex, x, y, z);
    }
    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();

    if (this.faceOverlayGroup) this.faceOverlayGroup.position.y = totalLegShift;
    if (this.reconstructedHead && this.reconstructedHeadBasePosition) {
      this.reconstructedHead.root.position.copy(this.reconstructedHeadBasePosition);
      this.reconstructedHead.root.position.y += totalLegShift;
    }
  }

  /** Rebuild the body's live morphed positions once for every surface attachment. */
  private computeMorphedBodyPositions(): Float32Array {
    const influences = this.mesh.morphTargetInfluences ?? [];
    const basePos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const count = basePos.count;

    if (!this.morphedBody || this.morphedBody.length !== count * 3) {
      this.morphedBody = new Float32Array(count * 3);
    }
    const mb = this.morphedBody;
    for (let v = 0; v < count; v++) {
      mb[v * 3] = basePos.getX(v);
      mb[v * 3 + 1] = basePos.getY(v);
      mb[v * 3 + 2] = basePos.getZ(v);
    }
    for (let i = 0; i < this.morphDeltas.length; i++) {
      const w = influences[i];
      if (!w) continue;
      const d = this.morphDeltas[i];
      for (let v = 0; v < count; v++) {
        mb[v * 3] += w * d.getX(v);
        mb[v * 3 + 1] += w * d.getY(v);
        mb[v * 3 + 2] += w * d.getZ(v);
      }
    }
    return mb;
  }

  /** Deform the separate reconstructed hair asset while preserving its reference silhouette. */
  private updateReconstructedHair(params: ZoneParams): void {
    const head = this.reconstructedHead;
    if (!head) return;
    const hair = params.hair ?? {};
    const style = typeof hair.hairStyle === 'string' ? hair.hairStyle : 'default';
    const length = typeof hair.hairLength === 'number' ? clamp(hair.hairLength, 0, 1) : 0.5;
    const volume = typeof hair.hairVolume === 'number' ? clamp(hair.hairVolume) : 0;
    head.hairGroup.visible = style !== 'none' && head.hairMeshes.length > 0;
    if (!head.hairGroup.visible) return;

    const profile = reconstructedHairStyleProfileFor(style);
    const size = head.hairBounds.getSize(new THREE.Vector3());
    const center = head.hairBounds.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, 1e-6);
    const halfWidth = Math.max(size.x * 0.5, 1e-6);
    const depth = Math.max(size.z, 1e-6);
    const lengthFactor = (length - 0.5) * 0.2 + profile.length;
    const volumeFactor = volume * 0.12 + profile.volume;
    const {backSweep, crownLift, sideTuck} = profile;
    const localPoint = new THREE.Vector3();

    for (const surface of head.hairSurfaces) {
      const position = surface.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const localBounds = new THREE.Box3();
      for (let vertex = 0; vertex < position.count; vertex++) {
        const offset = vertex * 3;
        const baseX = surface.baseCanonicalPositions[offset];
        const baseY = surface.baseCanonicalPositions[offset + 1];
        const baseZ = surface.baseCanonicalPositions[offset + 2];
        const dx = baseX - center.x;
        const dz = baseZ - center.z;
        const lowerWeight = smooth01((head.hairBounds.max.y - baseY) / (height * 0.78));
        const crownWeight = smooth01(
          (baseY - (head.hairBounds.max.y - height * 0.42)) / (height * 0.42),
        );
        const sideWeight = smooth01(Math.abs(dx) / (halfWidth * 0.9));
        const backWeight = smooth01((center.z - baseZ) / (depth * 0.7) + 0.5);
        const radialScale = volumeFactor * (0.32 + lowerWeight * 0.68) + crownLift * crownWeight;

        let x = baseX + dx * radialScale;
        let y = baseY - height * lengthFactor * Math.pow(lowerWeight, 1.35);
        let z = baseZ + dz * radialScale;
        x -= dx * sideTuck * lowerWeight * sideWeight;
        y += height * crownLift * crownWeight;
        z -= depth * backSweep * lowerWeight * (0.25 + backWeight * 0.75);

        // Preserve the source asset's collision-free scalp envelope. Lower
        // strands may tuck slightly, but crown/side hair cannot shrink through
        // the reconstructed skin when volume or a compact style is selected.
        const scalpWeight = smooth01(
          (baseY - (head.hairBounds.min.y + height * 0.25)) / (height * 0.45),
        );
        const baseRadius = Math.hypot(dx, dz);
        const deformedX = x - center.x;
        const deformedZ = z - center.z;
        const deformedRadius = Math.hypot(deformedX, deformedZ);
        const minimumRadius = baseRadius * (
          1 - RECONSTRUCTED_HAIR_LOWER_SHRINK * (1 - scalpWeight)
        );
        if (deformedRadius > 1e-8 && deformedRadius < minimumRadius) {
          const collisionScale = minimumRadius / deformedRadius;
          x = center.x + deformedX * collisionScale;
          z = center.z + deformedZ * collisionScale;
        }

        localPoint.set(x, y, z).applyMatrix4(surface.localFromCanonical);
        position.setXYZ(vertex, localPoint.x, localPoint.y, localPoint.z);
        localBounds.expandByPoint(localPoint);
      }
      position.needsUpdate = true;
      surface.mesh.geometry.boundingBox = localBounds;
      surface.mesh.geometry.boundingSphere = localBounds.getBoundingSphere(new THREE.Sphere());
    }
  }

  /** Apply hair style/color/length/volume to the active hair asset. */
  private updateHair(params: ZoneParams, mb: Float32Array): void {
    if (this.reconstructedHead?.hairMeshes.length) {
      if (this.hairGroup) this.hairGroup.visible = false;
      this.updateReconstructedHair(params);
      return;
    }
    if (this.reconstructedHead) this.reconstructedHead.hairGroup.visible = false;
    if (this.hairGroup) this.hairGroup.visible = true;
    if (!this.hairSlots.length) return;
    const hair = params.hair ?? {};
    const style = typeof hair.hairStyle === 'string' ? hair.hairStyle : 'default';
    const profile = hairStyleProfileFor(style);
    const length = typeof hair.hairLength === 'number' ? clamp(hair.hairLength, 0, 1) : 0.5;
    const volume = typeof hair.hairVolume === 'number' ? clamp(hair.hairVolume) : 0;
    const colorHex = typeof hair.hairColor === 'string' ? hair.hairColor : HAIR_DEFAULT_COLOR;
    this.hairMaterial?.color.set(colorHex);

    for (const slot of this.hairSlots) {
      const amount = profile[slot.kind];
      const visible = amount > 0 && slot.localToBodyVid.length > 0;
      slot.visible = visible;
      slot.mesh.visible = visible;
      if (!visible) continue;

      const volumeOffset = Math.max(0, volume) * 0.018 + Math.min(0, volume) * 0.006;
      slot.thick = Math.max(0.006, HAIR_BASE_THICKNESS[slot.kind] + profile.puff + volumeOffset);
      slot.drop = HAIR_MAX_DROP[slot.kind] * amount * (slot.kind === 'cap' ? 0 : length);
      this.updateSurfaceShell(slot, mb);

      if (slot.drop > 0) {
        const posAttr = slot.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          posAttr.setY(i, posAttr.getY(i) - slot.drop);
        }
        posAttr.needsUpdate = true;
        slot.geometry.computeBoundingSphere();
        slot.geometry.computeBoundingBox();
      }
    }
  }

  /** Update the clothing garments from the shared live morphed body positions. */
  private updateGarments(mb: Float32Array = this.computeMorphedBodyPositions()): void {
    if (!this.garments.length) return;
    for (const g of this.garments) {
      // Skip the CPU shell pass for a hidden garment (interactive-path cost).
      if (!g.visible || g.localToBodyVid.length === 0) continue;
      this.updateSurfaceShell(g, mb);
    }
  }

  /** Fill one surface shell's position/normal from the body's morphed positions `mb`. */
  private updateSurfaceShell(g: SurfaceShellSlot, mb: Float32Array): void {
    const k = g.localToBodyVid.length;
    const sp = g.scratchPos;
    const sn = g.scratchNrm;

    // Gather the morphed positions of this shell's vertices into local order.
    for (let l = 0; l < k; l++) {
      const bv = g.localToBodyVid[l];
      sp[l * 3] = mb[bv * 3];
      sp[l * 3 + 1] = mb[bv * 3 + 1];
      sp[l * 3 + 2] = mb[bv * 3 + 2];
    }

    // Smooth per-vertex normals: accumulate area-weighted face normals, skipping
    // degenerate (zero-area) faces so we never feed a zero vector to normalize.
    sn.fill(0);
    const idx = g.localIndex;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t];
      const b = idx[t + 1];
      const c = idx[t + 2];
      const ax = sp[a * 3];
      const ay = sp[a * 3 + 1];
      const az = sp[a * 3 + 2];
      const ex1 = sp[b * 3] - ax;
      const ey1 = sp[b * 3 + 1] - ay;
      const ez1 = sp[b * 3 + 2] - az;
      const ex2 = sp[c * 3] - ax;
      const ey2 = sp[c * 3 + 1] - ay;
      const ez2 = sp[c * 3 + 2] - az;
      // Cross product = face normal scaled by 2× area (area weighting for free).
      const nx = ey1 * ez2 - ez1 * ey2;
      const ny = ez1 * ex2 - ex1 * ez2;
      const nz = ex1 * ey2 - ey1 * ex2;
      if (nx === 0 && ny === 0 && nz === 0) continue; // degenerate face
      sn[a * 3] += nx;
      sn[a * 3 + 1] += ny;
      sn[a * 3 + 2] += nz;
      sn[b * 3] += nx;
      sn[b * 3 + 1] += ny;
      sn[b * 3 + 2] += nz;
      sn[c * 3] += nx;
      sn[c * 3 + 1] += ny;
      sn[c * 3 + 2] += nz;
    }

    const posAttr = g.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nrmAttr = g.geometry.getAttribute('normal') as THREE.BufferAttribute;
    const pa = posAttr.array as Float32Array;
    const na = nrmAttr.array as Float32Array;
    for (let l = 0; l < k; l++) {
      let nx = sn[l * 3];
      let ny = sn[l * 3 + 1];
      let nz = sn[l * 3 + 2];
      let len = Math.hypot(nx, ny, nz);
      if (len < 1e-8) {
        // Degenerate vertex normal (boundary/degenerate fan): fall back to a
        // radial direction from the figure's vertical axis so the offset is
        // still outward and finite — never NaN.
        nx = sp[l * 3];
        nz = sp[l * 3 + 2];
        ny = 0;
        len = Math.hypot(nx, nz);
        if (len < 1e-8) {
          nx = 0;
          ny = 0;
          nz = 1;
          len = 1;
        }
      }
      const inv = 1 / len;
      nx *= inv;
      ny *= inv;
      nz *= inv;
      na[l * 3] = nx;
      na[l * 3 + 1] = ny;
      na[l * 3 + 2] = nz;
      pa[l * 3] = sp[l * 3] + g.thick * nx;
      pa[l * 3 + 1] = sp[l * 3 + 1] + g.thick * ny;
      pa[l * 3 + 2] = sp[l * 3 + 2] + g.thick * nz;
    }
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
    g.geometry.computeBoundingSphere();
    g.geometry.computeBoundingBox();
  }

  /**
   * Locate the head region: average the vertices in the narrow top of the
   * resting mesh. Kept for camera bounds / zone anchoring on the single mesh.
   */
  private measureSmplHead(pos: THREE.BufferAttribute): void {
    const yThreshold = this.baseMinY + 0.9 * (this.baseMaxY - this.baseMinY);
    let sx = 0;
    let sy = 0;
    let n = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = this.vertexY[i];
      if (y < yThreshold) continue;
      const x = this.vertexX[i];
      sx += x;
      sy += y;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (n === 0) {
      this.smplHeadCenter = new THREE.Vector3(0, this.baseMaxY - 0.12, 0.05);
      this.smplHeadRadius = 0.09;
      return;
    }
    // Second pass over the head band for the Z (front-back) extent + center.
    // The SMPL-X head is DEEPER than it is wide, so a cap scaled only to the
    // X half-width is too small front-to-back and the skull poked through it.
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (this.vertexY[i] < yThreshold) continue;
      const z = pos.getZ(i);
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    this.smplHeadCenter = new THREE.Vector3(sx / n, sy / n, (minZ + maxZ) / 2);
    // Enclosing radius = the LARGER of the half-width and half-depth, so the
    // cap wraps the whole cranium in every direction (no poke-through).
    const halfW = (maxX - minX) / 2;
    const halfD = (maxZ - minZ) / 2;
    this.smplHeadRadius = Math.max(0.05, halfW, halfD);
  }

  /** Measure the narrow base-neck slice that the reconstructed head must meet. */
  private measureSmplNeck(position: THREE.BufferAttribute): void {
    const figureHeight = Math.max(this.baseMaxY - this.baseMinY, 1e-6);
    const targetY = this.baseMinY + figureHeight * BODY_LANDMARK_FRACTIONS.neckSeam;
    const halfBand = figureHeight * NECK_SEAM_HALF_HEIGHT_FRACTION;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let count = 0;

    for (let vertex = 0; vertex < position.count; vertex++) {
      if (Math.abs(this.vertexY[vertex] - targetY) > halfBand) continue;
      minX = Math.min(minX, position.getX(vertex));
      maxX = Math.max(maxX, position.getX(vertex));
      minZ = Math.min(minZ, position.getZ(vertex));
      maxZ = Math.max(maxZ, position.getZ(vertex));
      count++;
    }

    if (count < 3) {
      this.smplNeckCenter.set(0, targetY, this.smplHeadCenter.z);
      return;
    }
    this.smplNeckCenter.set((minX + maxX) / 2, targetY, (minZ + maxZ) / 2);
    this.smplNeckRadius.set(
      Math.max(0.025, (maxX - minX) / 2),
      Math.max(0.03, (maxZ - minZ) / 2),
    );
  }

  /** Allocate a small skin-colored bridge that hides the two open neck cuts. */
  private buildNeckSeam(): void {
    this.disposeNeckSeam();
    const ringCount = 3;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(NECK_SEAM_SEGMENTS * ringCount * 3), 3),
    );
    const indices: number[] = [];
    for (let ring = 0; ring < ringCount - 1; ring++) {
      for (let segment = 0; segment < NECK_SEAM_SEGMENTS; segment++) {
        const next = (segment + 1) % NECK_SEAM_SEGMENTS;
        const lower = ring * NECK_SEAM_SEGMENTS + segment;
        const lowerNext = ring * NECK_SEAM_SEGMENTS + next;
        const upper = (ring + 1) * NECK_SEAM_SEGMENTS + segment;
        const upperNext = (ring + 1) * NECK_SEAM_SEGMENTS + next;
        indices.push(lower, upper, lowerNext, lowerNext, upper, upperNext);
      }
    }
    geometry.setIndex(indices);

    const seam = new THREE.Mesh(geometry, this.material);
    seam.name = 'neck_seam';
    seam.castShadow = true;
    seam.receiveShadow = true;
    seam.userData.zoneId = 'head_neck';
    seam.userData.matKind = 'skin' satisfies MatKind;
    this.root.add(seam);
    this.neckSeamMesh = seam;
  }

  /** Refit the bridge to the live body morphs and the measured head-neck ring. */
  private updateNeckSeam(morphedBody: Float32Array): void {
    const seam = this.neckSeamMesh;
    const head = this.reconstructedHead;
    if (!seam || !head) return;

    const figureHeight = Math.max(this.baseMaxY - this.baseMinY, 1e-6);
    const halfBand = figureHeight * NECK_SEAM_HALF_HEIGHT_FRACTION;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let ySum = 0;
    let count = 0;
    for (let vertex = 0; vertex < this.vertexY.length; vertex++) {
      if (Math.abs(this.vertexY[vertex] - this.smplNeckCenter.y) > halfBand) continue;
      const offset = vertex * 3;
      minX = Math.min(minX, morphedBody[offset]);
      maxX = Math.max(maxX, morphedBody[offset]);
      ySum += morphedBody[offset + 1];
      minZ = Math.min(minZ, morphedBody[offset + 2]);
      maxZ = Math.max(maxZ, morphedBody[offset + 2]);
      count++;
    }

    const bodyCenterX = count >= 3 ? (minX + maxX) / 2 : this.smplNeckCenter.x;
    const bodyCenterY = count >= 3
      ? ySum / count
      : this.smplNeckCenter.y + this.bodyVerticalOffset;
    const bodyCenterZ = count >= 3 ? (minZ + maxZ) / 2 : this.smplNeckCenter.z;
    const bodyRadiusX = count >= 3
      ? Math.max(this.smplNeckRadius.x * 0.65, (maxX - minX) / 2)
      : this.smplNeckRadius.x;
    const bodyRadiusZ = count >= 3
      ? Math.max(this.smplNeckRadius.y * 0.65, (maxZ - minZ) / 2)
      : this.smplNeckRadius.y;

    const scale = head.root.scale.x;
    const neckCenter = head.neckBounds.getCenter(new THREE.Vector3());
    const neckSize = head.neckBounds.getSize(new THREE.Vector3());
    const headCenterX = head.root.position.x + neckCenter.x * scale;
    const headCenterZ = head.root.position.z + neckCenter.z * scale;
    const headBaseY = head.root.position.y + head.neckBounds.min.y * scale;
    const headRadiusX = THREE.MathUtils.clamp(
      neckSize.x * scale * 0.5,
      bodyRadiusX * 0.72,
      bodyRadiusX * 1.18,
    );
    const headRadiusZ = THREE.MathUtils.clamp(
      neckSize.z * scale * 0.5,
      bodyRadiusZ * 0.72,
      bodyRadiusZ * 1.18,
    );
    const bottomY = Math.min(bodyCenterY, headBaseY) - halfBand;
    const topY = Math.max(bodyCenterY, headBaseY) + halfBand;
    const position = seam.geometry.getAttribute('position') as THREE.BufferAttribute;
    const ringCount = 3;

    for (let ring = 0; ring < ringCount; ring++) {
      const t = ring / (ringCount - 1);
      const blend = smooth01(t);
      const centerX = THREE.MathUtils.lerp(bodyCenterX, headCenterX, blend);
      const centerZ = THREE.MathUtils.lerp(bodyCenterZ, headCenterZ, blend);
      const radiusX = THREE.MathUtils.lerp(bodyRadiusX, headRadiusX, blend) * 1.02;
      const radiusZ = THREE.MathUtils.lerp(bodyRadiusZ, headRadiusZ, blend) * 1.02;
      const y = THREE.MathUtils.lerp(bottomY, topY, t);
      for (let segment = 0; segment < NECK_SEAM_SEGMENTS; segment++) {
        const angle = (segment / NECK_SEAM_SEGMENTS) * Math.PI * 2;
        const vertex = ring * NECK_SEAM_SEGMENTS + segment;
        position.setXYZ(
          vertex,
          centerX + Math.cos(angle) * radiusX,
          y,
          centerZ + Math.sin(angle) * radiusZ,
        );
      }
    }
    position.needsUpdate = true;
    seam.geometry.computeVertexNormals();
    seam.geometry.computeBoundingBox();
    seam.geometry.computeBoundingSphere();
  }

  private disposeNeckSeam(): void {
    if (!this.neckSeamMesh) return;
    this.root.remove(this.neckSeamMesh);
    this.neckSeamMesh.geometry.dispose();
    this.neckSeamMesh = null;
  }

  /** Apply reference-derived proportions to the visible reconstructed surface. */
  private applyReconstructedFaceGeometry(params: ZoneParams): void {
    const head = this.reconstructedHead;
    if (!head) return;
    const numberParam = (zone: string, id: string): number => {
      const value = params[zone]?.[id];
      return typeof value === 'number' && Number.isFinite(value) ? clamp(value) : 0;
    };

    const faceSize = head.faceBounds.getSize(new THREE.Vector3());
    const [leftEye, rightEye] = head.eyes.canonicalPositions;
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const eyeY = (leftEye.y + rightEye.y) / 2;
    const eyeSpan = Math.max(Math.abs(leftEye.x - rightEye.x), faceSize.x * 0.32, 1e-6);
    const chinY = head.faceBounds.min.y;
    const foreheadY = head.faceBounds.max.y;
    const faceHeight = Math.max(foreheadY - chinY, eyeSpan * 1.7, 1e-6);
    const faceHalfWidth = Math.max(faceSize.x * 0.5, eyeSpan * 0.78);
    const mouthY = chinY + (eyeY - chinY) * 0.42;

    const shapeName =
      typeof params.face_shape?.shape === 'string' ? params.face_shape.shape : 'oval';
    const shape = {
      heart: {cheek: 0.08, jaw: -0.09, chin: -0.15},
      oval: {cheek: 0, jaw: 0, chin: 0},
      round: {cheek: 0.09, jaw: 0.06, chin: 0.05},
      square: {cheek: 0.04, jaw: 0.13, chin: 0.14},
    }[shapeName] ?? {cheek: 0, jaw: 0, chin: 0};

    const cheekbones = numberParam('face_shape', 'cheekbones');
    const faceDepth = numberParam('face_shape', 'faceDepth');
    const jawWidth = numberParam('jaw_chin', 'jawWidth');
    const chinLength = numberParam('jaw_chin', 'chinLength');
    const chinShape = numberParam('jaw_chin', 'chinShape');
    const eyeSize = numberParam('eyes', 'eyeSize');
    const eyeDistance = numberParam('eyes', 'eyeDistance');
    const eyeTilt = numberParam('eyes', 'eyeTilt');
    const noseLength = numberParam('nose', 'noseLength');
    const noseWidth = numberParam('nose', 'noseWidth');
    const noseTip = numberParam('nose', 'noseTip');
    const bridgeHeight = numberParam('nose', 'bridgeHeight');
    const mouthWidth = numberParam('mouth', 'mouthWidth');
    const upperLip = numberParam('mouth', 'upperLip');
    const lowerLip = numberParam('mouth', 'lowerLip');
    const cornerLift = numberParam('mouth', 'cornerLift');
    const localPoint = new THREE.Vector3();

    for (const surface of head.faceSurfaces) {
      const position = surface.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < surface.faceVertexIndices.length; index++) {
        const vertex = surface.faceVertexIndices[index];
        const offset = index * 3;
        const baseX = surface.baseCanonicalPositions[offset];
        const baseY = surface.baseCanonicalPositions[offset + 1];
        const baseZ = surface.baseCanonicalPositions[offset + 2];
        const faceWeight = surface.faceWeights[index];
        const originalDx = baseX - eyeCenterX;
        const normalizedY = (baseY - chinY) / faceHeight;
        let x = baseX;
        let y = baseY;
        let z = baseZ;

        const cheekWeight = bell(normalizedY, 0.56, 0.32) * faceWeight;
        const jawWeight = bell(normalizedY, 0.2, 0.28) * faceWeight;
        const chinWeight = bell(normalizedY, 0.04, 0.16) * faceWeight;
        const widthFactor =
          shape.cheek * cheekWeight
          + shape.jaw * jawWeight
          + shape.chin * chinWeight
          + 0.12 * jawWidth * jawWeight
          + 0.08 * cheekbones * cheekWeight
          + 0.16 * chinShape * chinWeight;
        x += originalDx * widthFactor;
        y -= faceHeight * 0.07 * chinLength * chinWeight;
        z += faceHeight * (
          0.075 * faceDepth * faceWeight
          + 0.05 * Math.max(0, cheekbones) * cheekWeight
          + 0.04 * chinShape * chinWeight
        );

        const noseCenterY = mouthY + (eyeY - mouthY) * 0.46;
        const noseWeight =
          bell(baseX, eyeCenterX, Math.max(eyeSpan * 0.43, faceHalfWidth * 0.22))
          * bell(baseY, noseCenterY, faceHeight * 0.23)
          * faceWeight;
        if (noseWeight > 0) {
          x += originalDx * 0.3 * noseWidth * noseWeight;
          const bridgeY = eyeY - faceHeight * 0.05;
          y += (baseY - bridgeY) * 0.18 * noseLength * noseWeight;
          const tipWeight = bell(baseY, noseCenterY - faceHeight * 0.025, faceHeight * 0.16);
          const bridgeWeight = bell(baseY, eyeY - faceHeight * 0.05, faceHeight * 0.12);
          z += faceHeight * (
            0.085 * noseTip * tipWeight
            + 0.055 * bridgeHeight * bridgeWeight
          ) * bell(baseX, eyeCenterX, eyeSpan * 0.3) * faceWeight;
        }

        const mouthRegion =
          bell(baseX, eyeCenterX, eyeSpan * 0.86)
          * bell(baseY, mouthY, faceHeight * 0.1)
          * faceWeight;
        if (mouthRegion > 0) {
          x += originalDx * 0.22 * mouthWidth * mouthRegion;
          const upperWeight = bell(baseY, mouthY + faceHeight * 0.012, faceHeight * 0.05);
          const lowerWeight = bell(baseY, mouthY - faceHeight * 0.015, faceHeight * 0.055);
          z += faceHeight * 0.035 * (
            upperLip * upperWeight + lowerLip * lowerWeight
          ) * bell(baseX, eyeCenterX, eyeSpan * 0.68) * faceWeight;
          const cornerWeight = smooth01(
            (Math.abs(originalDx) - eyeSpan * 0.25) / (eyeSpan * 0.38),
          );
          y += faceHeight * 0.025 * cornerLift * cornerWeight * mouthRegion;
        }

        for (const eye of [leftEye, rightEye]) {
          const dx = baseX - eye.x;
          const dy = baseY - eye.y;
          const radius = Math.hypot(
            dx / Math.max(head.eyes.radius * 1.65, 1e-6),
            dy / Math.max(head.eyes.radius * 0.95, 1e-6),
          );
          const eyeWeight = smooth01(1 - radius) * faceWeight;
          if (eyeWeight <= 0) continue;
          const side = Math.sign(eye.x - eyeCenterX) || 1;
          const angle = -side * eyeTilt * 0.18;
          const scale = 1 + eyeSize * 0.22;
          const rotatedX = (dx * Math.cos(angle) - dy * Math.sin(angle)) * scale;
          const rotatedY = (dx * Math.sin(angle) + dy * Math.cos(angle)) * scale;
          x += (
            rotatedX - dx + side * head.eyes.span * 0.13 * eyeDistance
          ) * eyeWeight;
          y += (rotatedY - dy) * eyeWeight;
        }

        localPoint.set(x, y, z).applyMatrix4(surface.localFromCanonical);
        position.setXYZ(vertex, localPoint.x, localPoint.y, localPoint.z);
      }
      // Reconstructed heads can exceed 800k vertices. The deformation is
      // deliberately local and bounded, so retaining the imported smooth
      // normals/bounds avoids a full-mesh CPU pass on every slider event.
      position.needsUpdate = true;
    }
  }

  /** Apply Sims-style local deformations directly to the SMPL-X face surface. */
  private applyFaceGeometry(params: ZoneParams): void {
    if (this.reconstructedHead) {
      this.applyReconstructedFaceGeometry(params);
      return;
    }

    const anchors = this.faceAnchors;
    const base = this.faceBasePositions;
    if (!anchors || !base) return;

    const position = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const numberParam = (zone: string, id: string): number => {
      const raw = params[zone]?.[id];
      return typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw) : 0;
    };

    const centerX = (anchors.eyeL[0] + anchors.eyeR[0]) / 2;
    const eyeY = (anchors.eyeL[1] + anchors.eyeR[1]) / 2;
    const eyeZ = (anchors.eyeL[2] + anchors.eyeR[2]) / 2;
    const eyeSpan = Math.max(0.04, Math.abs(anchors.eyeL[0] - anchors.eyeR[0]));
    const mouthY = anchors.mouth[1];
    const browY = (anchors.browL[1] + anchors.browR[1]) / 2;
    const chinY = mouthY - eyeSpan * 1.18;
    const foreheadY = browY + eyeSpan * 0.78;
    const faceHeight = Math.max(eyeSpan * 2.6, foreheadY - chinY);
    const faceHalfWidth = eyeSpan * 1.62;
    const faceMidY = (chinY + foreheadY) / 2;

    const shapeName =
      typeof params.face_shape?.shape === 'string' ? params.face_shape.shape : 'oval';
    const shape = {
      heart: {cheek: 0.08, jaw: -0.09, chin: -0.15},
      oval: {cheek: 0, jaw: 0, chin: 0},
      round: {cheek: 0.09, jaw: 0.06, chin: 0.05},
      square: {cheek: 0.04, jaw: 0.13, chin: 0.14},
    }[shapeName] ?? {cheek: 0, jaw: 0, chin: 0};

    const cheekbones = numberParam('face_shape', 'cheekbones');
    const faceDepth = numberParam('face_shape', 'faceDepth');
    const jawWidth = numberParam('jaw_chin', 'jawWidth');
    const chinLength = numberParam('jaw_chin', 'chinLength');
    const chinShape = numberParam('jaw_chin', 'chinShape');
    const eyeSize = numberParam('eyes', 'eyeSize');
    const eyeDistance = numberParam('eyes', 'eyeDistance');
    const eyeTilt = numberParam('eyes', 'eyeTilt');
    const noseLength = numberParam('nose', 'noseLength');
    const noseWidth = numberParam('nose', 'noseWidth');
    const noseTip = numberParam('nose', 'noseTip');
    const bridgeHeight = numberParam('nose', 'bridgeHeight');
    const mouthWidth = numberParam('mouth', 'mouthWidth');
    const upperLip = numberParam('mouth', 'upperLip');
    const lowerLip = numberParam('mouth', 'lowerLip');
    const cornerLift = numberParam('mouth', 'cornerLift');

    for (let vertex = 0; vertex < position.count; vertex++) {
      const offset = vertex * 3;
      const baseX = base[offset];
      const baseY = base[offset + 1];
      const baseZ = base[offset + 2];
      let x = baseX;
      let y = baseY;
      let z = baseZ;

      const originalDx = baseX - centerX;
      const normalizedY = (baseY - chinY) / faceHeight;
      const faceEnvelope =
        bell(baseX, centerX, faceHalfWidth)
        * bell(baseY, faceMidY, faceHeight * 0.58);
      const front = smooth01(
        (baseZ - (eyeZ - eyeSpan * 0.72)) / Math.max(eyeSpan * 0.95, 1e-6),
      );
      const faceWeight = faceEnvelope * front;

      if (faceWeight > 0) {
        const cheekWeight = bell(normalizedY, 0.58, 0.34) * faceWeight;
        const jawWeight = bell(normalizedY, 0.18, 0.34) * faceWeight;
        const chinWeight = bell(normalizedY, 0.03, 0.22) * faceWeight;
        const widthFactor =
          shape.cheek * cheekWeight
          + shape.jaw * jawWeight
          + shape.chin * chinWeight
          + 0.12 * jawWidth * jawWeight
          + 0.08 * cheekbones * cheekWeight
          + 0.18 * chinShape * chinWeight;
        x += originalDx * widthFactor;
        y -= eyeSpan * 0.24 * chinLength * chinWeight;
        z += eyeSpan * (
          0.12 * faceDepth * faceWeight
          + 0.08 * Math.max(0, cheekbones) * cheekWeight
          + 0.07 * chinShape * chinWeight
        );

        const noseCenterY = mouthY + (eyeY - mouthY) * 0.46;
        const noseWeight =
          bell(baseX, centerX, eyeSpan * 0.43)
          * bell(baseY, noseCenterY, eyeSpan * 0.58)
          * front;
        if (noseWeight > 0) {
          x += originalDx * 0.32 * noseWidth * noseWeight;
          const bridgeY = eyeY - eyeSpan * 0.12;
          y += (baseY - bridgeY) * 0.2 * noseLength * noseWeight;
          const tipWeight = bell(baseY, noseCenterY - eyeSpan * 0.1, eyeSpan * 0.65);
          const bridgeWeight = bell(baseY, eyeY - eyeSpan * 0.22, eyeSpan * 0.38);
          z += eyeSpan * (
            0.24 * noseTip * tipWeight
            + 0.18 * bridgeHeight * bridgeWeight
          ) * bell(baseX, centerX, eyeSpan * 0.3) * front;
        }

        const mouthRegion =
          bell(baseX, centerX, eyeSpan * 0.86)
          * bell(baseY, mouthY, eyeSpan * 0.28)
          * front;
        if (mouthRegion > 0) {
          x += originalDx * 0.24 * mouthWidth * mouthRegion;
          const upperWeight = bell(baseY, mouthY + eyeSpan * 0.045, eyeSpan * 0.15);
          const lowerWeight = bell(baseY, mouthY - eyeSpan * 0.07, eyeSpan * 0.17);
          z += eyeSpan * 0.1 * (
            upperLip * upperWeight + lowerLip * lowerWeight
          ) * bell(baseX, centerX, eyeSpan * 0.7) * front;
          const cornerWeight = smooth01(
            (Math.abs(originalDx) - eyeSpan * 0.25) / (eyeSpan * 0.38),
          );
          y += eyeSpan * 0.09 * cornerLift * cornerWeight * mouthRegion;
        }

        for (const eye of [anchors.eyeL, anchors.eyeR]) {
          const dx = baseX - eye[0];
          const dy = baseY - eye[1];
          const radius = Math.hypot(dx / (eyeSpan * 0.62), dy / (eyeSpan * 0.34));
          const eyeWeight = smooth01(1 - radius) * front;
          if (eyeWeight <= 0) continue;
          const side = Math.sign(eye[0] - centerX) || 1;
          const angle = -side * eyeTilt * 0.18;
          const scale = 1 + eyeSize * 0.28;
          const rotatedX = (dx * Math.cos(angle) - dy * Math.sin(angle)) * scale;
          const rotatedY = (dx * Math.sin(angle) + dy * Math.cos(angle)) * scale;
          x += (rotatedX - dx + side * eyeSpan * 0.18 * eyeDistance) * eyeWeight;
          y += (rotatedY - dy) * eyeWeight;
        }
      }

      position.setXYZ(vertex, x, y, z);
    }

    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();

    this.eyeOverlayGroups.forEach((eyeGroup, index) => {
      const anchor = index === 0 ? anchors.eyeL : anchors.eyeR;
      const side = Math.sign(anchor[0] - centerX) || 1;
      const depthOffset = eyeSpan * (
        0.12 * faceDepth + 0.03 * Math.max(0, cheekbones)
      );
      eyeGroup.position.set(
        anchor[0] + side * eyeSpan * 0.18 * eyeDistance,
        anchor[1],
        anchor[2] + depthOffset,
      );
      eyeGroup.rotation.z = -side * eyeTilt * 0.18;
      eyeGroup.scale.setScalar(1 + eyeSize * 0.28);
    });
    if (this.lipMesh) {
      const r = anchors.eyeR_size || 0.022;
      const lipFullness = (upperLip + lowerLip) / 2;
      this.lipMesh.position.z =
        anchors.mouth[2]
        + eyeSpan * (0.1 * faceDepth + 0.06 * lipFullness);
      this.lipMesh.scale.set(
        r * 1.4 * (1 + 0.24 * mouthWidth),
        r * 0.42 * (1 + 0.22 * lipFullness),
        r * 0.32 * (1 + 0.18 * lipFullness),
      );
    }
  }

  // ─────────── Public API (mirrors CharacterRig) ───────────

  /** Apply reference-derived eye proportions to the reconstructed eye assets. */
  private updateReconstructedEyes(params: ZoneParams): void {
    const eyes = this.reconstructedHead?.eyes;
    if (!eyes) return;
    const numberParam = (id: string): number => {
      const value = params.eyes?.[id];
      return typeof value === 'number' && Number.isFinite(value) ? clamp(value) : 0;
    };
    const eyeDistance = numberParam('eyeDistance');
    const eyeSize = numberParam('eyeSize');
    const eyeTilt = numberParam('eyeTilt');

    eyes.roots.forEach((eyeRoot, index) => {
      const side = index === 0 ? -1 : 1;
      eyeRoot.position.copy(eyes.basePositions[index]);
      eyeRoot.position.x += side * eyes.span * 0.13 * eyeDistance;
      eyeRoot.position.z -= eyes.radius * 0.15 * eyeSize;
      eyeRoot.rotation.set(0, 0, -side * eyeTilt * 0.18);
      eyeRoot.scale.setScalar(1 + eyeSize * 0.22);
    });
  }

  /** Replace the rendered SMPL head and join its measured neck to the live body. */
  attachReconstructedHead(root: THREE.Object3D, hairRoot?: THREE.Object3D | null): void {
    this.disposeNeckSeam();
    if (this.reconstructedHead) {
      this.root.remove(this.reconstructedHead.root);
      disposeReconstructedHead(this.reconstructedHead);
      this.reconstructedHead = null;
      this.reconstructedHeadBasePosition = null;
    }

    const head = prepareReconstructedHead(root, hairRoot);
    const sourceSize = head.bounds.getSize(new THREE.Vector3());
    const sourceCenter = head.bounds.getCenter(new THREE.Vector3());
    const figureHeight = Math.max(1e-6, this.baseMaxY - this.baseMinY);
    const heightScale = (figureHeight * 0.14816) / Math.max(sourceSize.y, 1e-6);
    const sourceCrownToNeck = Math.max(
      head.bounds.max.y - head.neckBounds.min.y,
      1e-6,
    );
    const targetCrownToNeck = Math.max(
      this.baseMaxY - this.smplNeckCenter.y,
      figureHeight * 0.1,
    );
    const measuredScale = targetCrownToNeck / sourceCrownToNeck;
    const scale = Math.max(
      heightScale * 0.85,
      Math.min(heightScale * 1.15, measuredScale),
    );

    head.root.scale.setScalar(scale);
    head.root.position.set(
      this.smplHeadCenter.x - sourceCenter.x * scale,
      this.baseMaxY - head.bounds.max.y * scale,
      this.smplHeadCenter.z - sourceCenter.z * scale,
    );
    this.reconstructedHeadBasePosition = head.root.position.clone();
    head.root.position.y += this.bodyVerticalOffset;
    this.root.add(head.root);
    this.reconstructedHead = head;
    this.buildNeckSeam();
    this.root.updateMatrixWorld(true);
    this.updateNeckSeam(this.computeMorphedBodyPositions());

    // The cut is anchored to the body's measured neck, never to hair bounds.
    // The seam bridge overlaps both open edges to hide topology differences.
    const halfBand = figureHeight * NECK_SEAM_HALF_HEIGHT_FRACTION;
    const cutY = this.smplNeckCenter.y + this.bodyVerticalOffset + halfBand * 0.5;
    keepGeometryBelowY(this.mesh.geometry, cutY);
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();

    if (this.hairGroup) {
      this.hairGroup.visible = head.hairMeshes.length === 0;
    }
    const legacyFaceOverlay = this.root.getObjectByName('smpl_face_overlay');
    if (legacyFaceOverlay) legacyFaceOverlay.visible = false;
  }

  resolveZoneFromObject(obj: THREE.Object3D | null): string | null {
    let cursor: THREE.Object3D | null = obj;
    while (cursor) {
      const zoneId = cursor.userData?.zoneId;
      if (typeof zoneId === 'string') return zoneId;
      cursor = cursor.parent;
    }
    return null;
  }

  // The SMPL body is a single mesh with no per-side split, so we can't recover
  // which half was grabbed. Asymmetric editing isn't supported in morph mode
  // (A1 is symmetric shape only) — always null.
  resolveSideFromObject(): 'L' | 'R' | null {
    return null;
  }

  /**
   * World-space bounds of a zone. A single mesh can't be sub-meshed, so we
   * build the box from the vertices whose resting Y falls in the zone's band
   * (the whole figure for skin/pose/body). Lets the camera zoom focus on the
   * right region even though the outline covers the whole body.
   */
  zoneBounds(zoneId: string): THREE.Box3 | null {
    if (!this.mesh.visible) return null;
    if (this.reconstructedHead && zoneId === 'eyes') {
      this.reconstructedHead.eyes.group.updateMatrixWorld(true);
      const eyeBox = new THREE.Box3().setFromObject(this.reconstructedHead.eyes.group);
      if (!eyeBox.isEmpty()) return eyeBox;
    }
    if (this.reconstructedHead && zoneId === 'hair') {
      this.reconstructedHead.hairGroup.updateMatrixWorld(true);
      const hairBox = new THREE.Box3().setFromObject(this.reconstructedHead.hairGroup);
      if (!hairBox.isEmpty()) return hairBox;
    }
    if (this.reconstructedHead && this.isReconstructedHeadZone(zoneId)) {
      this.reconstructedHead.root.updateMatrixWorld(true);
      const headBox = this.reconstructedHead.bounds.clone().applyMatrix4(this.reconstructedHead.root.matrixWorld);
      if (!headBox.isEmpty()) return headBox;
    }
    if (zoneId === 'hair' && this.hairGroup) {
      this.hairGroup.updateMatrixWorld(true);
      const hbox = new THREE.Box3();
      let anyHair = false;
      this.hairGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        hbox.expandByObject(m);
        anyHair = true;
      });
      if (anyHair && !hbox.isEmpty()) return hbox;
    }
    // Clothing: frame the garment itself when it's visible; otherwise fall back
    // to the underlying body band so the camera still has somewhere to look.
    if (zoneId.startsWith('clothing')) {
      const g = this.garments.find((s) => s.id === zoneId);
      if (g && g.mesh.visible) {
        g.mesh.updateMatrixWorld(true);
        const gbox = new THREE.Box3().setFromObject(g.mesh);
        if (!gbox.isEmpty()) return gbox;
      }
      // Hidden/empty garment → frame the body band it covers (torso / hips),
      // which the main path below already builds from band vertices.
      return this.zoneBounds(zoneId === 'clothing_bottom' ? 'hips' : 'torso');
    }
    const wholeFigure =
      zoneId === 'skin' || zoneId === 'pose' || zoneId === 'skin_color' || zoneId === 'body';
    this.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const pos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const band = wholeFigure ? null : this.bandFor(zoneId);
    const h = Math.max(1e-6, this.baseMaxY - this.baseMinY);
    let any = false;
    for (let i = 0; i < pos.count; i++) {
      if (band) {
        const frac = (this.vertexY[i] - this.baseMinY) / h;
        if (frac < band.yLo || frac >= band.yHi) continue;
      }
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(this.mesh.matrixWorld);
      box.expandByPoint(v);
      any = true;
    }
    return any ? box : null;
  }

  setHighlight(hoveredZoneId: string | null, selectedZoneId: string | null): void {
    this.lastHighlight = [hoveredZoneId, selectedZoneId];
  }

  /**
   * Outline target: the grafted hair meshes when the hair zone is active, else
   * the whole body mesh (SMPL-X is one mesh — body and face can't be
   * sub-outlined, so the whole figure outlines).
   */
  highlightedMeshes(): {selected: THREE.Mesh[]; hovered: THREE.Mesh[]} {
    const [hovered, selected] = this.lastHighlight;
    if (!this.mesh.visible) return {selected: [], hovered: []};
    const hairMeshes = (): THREE.Mesh[] => {
      if (this.reconstructedHead) {
        if (!this.reconstructedHead.hairGroup.visible) return [];
        return this.reconstructedHead.hairMeshes.filter((mesh) => mesh.visible);
      }
      const out: THREE.Mesh[] = [];
      this.hairGroup?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.visible) out.push(m);
      });
      return out;
    };
    const reconstructedFaceMeshes = (includeSeam = false): THREE.Mesh[] => {
      const meshes = this.reconstructedHead?.skinMeshes.filter((mesh) => mesh.visible) ?? [];
      if (includeSeam && this.neckSeamMesh?.visible) meshes.push(this.neckSeamMesh);
      return meshes;
    };
    const reconstructedEyeMeshes = (): THREE.Mesh[] =>
      this.reconstructedHead?.eyes.meshes.filter((mesh) => mesh.visible) ?? [];
    if (selected === 'eyes' && this.reconstructedHead) {
      return {selected: reconstructedEyeMeshes(), hovered: []};
    }
    if (hovered === 'eyes' && this.reconstructedHead) {
      return {selected: [], hovered: reconstructedEyeMeshes()};
    }
    if (selected === 'hair') return {selected: hairMeshes(), hovered: []};
    if (hovered === 'hair') return {selected: [], hovered: hairMeshes()};
    if (selected && this.isReconstructedHeadZone(selected)) {
      return {selected: reconstructedFaceMeshes(selected === 'head_neck'), hovered: []};
    }
    if (hovered && this.isReconstructedHeadZone(hovered)) {
      return {selected: [], hovered: reconstructedFaceMeshes(hovered === 'head_neck')};
    }
    // Clothing zones outline their own garment mesh (only while it's visible).
    const garment = (zone: string | null): THREE.Mesh[] => {
      const g = this.garments.find((s) => s.id === zone && s.mesh.visible);
      return g ? [g.mesh] : [];
    };
    if (selected && selected.startsWith('clothing')) return {selected: garment(selected), hovered: []};
    if (hovered && hovered.startsWith('clothing')) return {selected: [], hovered: garment(hovered)};
    if (selected && this.zoneInBody(selected)) return {selected: [this.mesh], hovered: []};
    if (hovered && this.zoneInBody(hovered)) return {selected: [], hovered: [this.mesh]};
    return {selected: [], hovered: []};
  }

  dispose(): void {
    this.disposeNeckSeam();
    if (this.reconstructedHead) {
      this.root.remove(this.reconstructedHead.root);
      disposeReconstructedHead(this.reconstructedHead);
      this.reconstructedHead = null;
      this.reconstructedHeadBasePosition = null;
    }
    this.mesh.geometry.dispose();
    this.material.dispose();
    [...this.irisMats, this.lipMat].forEach((m) => m?.dispose());
    this.hairSlots.forEach((h) => h.geometry.dispose());
    this.hairMaterial?.dispose();

    this.garments.forEach((g) => {
      g.geometry.dispose();
      g.material.dispose();
    });
  }

  // ─────────── Parameter application ───────────

  applyParams(params: ZoneParams): void {
    const influences = this.mesh.morphTargetInfluences;
    if (!influences) return;

    // Accumulate β contributions from every mapped slider, then write
    // influences (β / BETA_SCALE, clamped to the baked ±1 range).
    const betaSum = new Array(influences.length).fill(0);
    for (const [zone, paramMap] of Object.entries(BETA_MAPPING)) {
      for (const [paramId, terms] of Object.entries(paramMap)) {
        const raw = params[zone]?.[paramId];
        const value = typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw) : 0;
        if (value === 0) continue;
        for (const term of terms) {
          if (term.beta < betaSum.length) betaSum[term.beta] += value * term.scale;
        }
      }
    }
    for (let i = 0; i < influences.length; i++) {
      influences[i] = clamp(betaSum[i] / BETA_SCALE);
    }

    this.resetBodySurface();
    this.applyFaceGeometry(params);
    this.applyReferenceBodyGeometry(params);

    // Colors: the body shares the skin material with the procedural engine.
    const skinHex =
      typeof params.skin_color?.skinTone === 'string' ? params.skin_color.skinTone : '#dac0a3';
    const saturation =
      typeof params.skin_color?.skinSaturation === 'number' ? params.skin_color.skinSaturation : 0;
    const skin = new THREE.Color(skinHex);
    const hsl = {h: 0, s: 0, l: 0};
    skin.getHSL(hsl);
    skin.setHSL(hsl.h, clamp(hsl.s * (1 + 0.45 * saturation), 0, 1), hsl.l);
    this.material.color.copy(skin);
    this.reconstructedHead?.skinMaterial.color.copy(skin);
    const reconstructedHairHex =
      typeof params.hair?.hairColor === 'string' ? params.hair.hairColor : '#c7753d';
    this.reconstructedHead?.hairMaterial.color.set(reconstructedHairHex);

    // Live face-overlay colors from the same palette the procedural engine uses.
    const eyeHex = typeof params.eyes?.eyeColor === 'string' ? params.eyes.eyeColor : '#3a6ca8';
    this.irisMats.forEach((m) => m.color.set(eyeHex));
    this.reconstructedHead?.eyes.irisMaterial.color.set(eyeHex);
    this.updateReconstructedEyes(params);
    if (this.lipMat) this.lipMat.color.copy(skin.clone().lerp(new THREE.Color('#b0524f'), 0.6));

    const mb = this.computeMorphedBodyPositions();
    this.updateNeckSeam(mb);

    // Hair: color/style/length/volume drive SMPL-native scalp shells rather
    // than borrowed procedural meshes, so the hair stays seated on the skull.
    this.updateHair(params, mb);
    // Clothing (A5): visibility + fabric color from the palette, then re-derive
    // each visible garment from the freshly-morphed body so it tracks the shape.
    for (const g of this.garments) {
      const zone = params[g.id];
      const requestedStyle = typeof zone?.style === 'string' ? zone.style : '';
      const defaultStyle = GARMENT_DEFAULT_STYLE[g.id] ?? GARMENT_STYLE_ORDER[g.id]?.[0] ?? '';
      g.style = Object.prototype.hasOwnProperty.call(g.styleCounts, requestedStyle)
        ? requestedStyle
        : defaultStyle;
      const drawCount = g.styleCounts[g.style] ?? g.localIndex.length;
      g.geometry.setDrawRange(0, drawCount);
      // `enabled` defaults ON: only an explicit false hides a garment. An empty
      // style (no kept triangles) can never become visible.
      const enabled = zone?.enabled !== false && drawCount > 0;
      g.visible = enabled;
      g.mesh.visible = enabled;
      const colorHex =
        typeof zone?.color === 'string' ? zone.color : GARMENT_DEFAULT_COLOR[g.id] ?? '#3b5266';
      g.material.color.set(colorHex);
    }
    this.updateGarments(mb);

  }

  // No idle morph animation in A1 (the SMPL-X face has no driven blink yet).
  // Kept for interface parity; a future pass could breathe/blink via morphs.
  tick(): void {
    /* intentionally empty for A1 */
  }

  /** Test/debug access. The body mesh, SMPL hair shells, plus the A5 garment meshes by zone id. */
  nodeByName(name: string): THREE.Object3D | undefined {
    if (name === 'body' || name === 'smpl_body') return this.mesh;
    if (name === 'reconstructed_head') return this.reconstructedHead?.root;
    if (name === 'neck_seam') return this.neckSeamMesh ?? undefined;
    if (name === 'reconstructed_eyes' || name === 'eyes') {
      return this.reconstructedHead?.eyes.group;
    }
    if ((name === 'hair' || name === 'reconstructed_hair') && this.reconstructedHead) {
      return this.reconstructedHead.hairGroup;
    }
    if (name === 'hair' || name === 'smpl_hair_anchor') return this.hairGroup ?? undefined;
    const h = this.hairSlots.find((s) => s.id === name || s.mesh.name === name);
    if (h) return h.mesh;
    const g = this.garments.find((s) => s.id === name || s.mesh.name === name);
    if (g) return g.mesh;
    return undefined;
  }

  // ─────────── Internals ───────────

  private bandFor(zoneId: string): RegionBand | null {
    // Map a clicked/selected zone to the body band that represents it. Face and
    // hair zones have no morph region; treat them as the head band so the
    // camera still has somewhere sensible to look.
    const direct = REGION_BANDS.find((b) => b.zone === zoneId);
    if (direct) return direct;
    const ancestors = getAncestors(zoneId).map((z) => z.id);
    if (ancestors.includes('arms') || ancestors.includes('legs')) {
      return REGION_BANDS.find((b) => b.zone === 'legs') ?? null;
    }
    if (ancestors.includes('face') || zoneId === 'hair' || ancestors.includes('head_neck')) {
      return REGION_BANDS.find((b) => b.zone === 'head_neck') ?? null;
    }
    return null;
  }

  // Every editable zone lives on the one SMPL-X mesh (body AND face), so any
  // real zone outlines the whole figure — a single mesh can't be sub-outlined.
  private zoneInBody(zoneId: string): boolean {
    return !!zoneId;
  }

  private isReconstructedHeadZone(zoneId: string): boolean {
    if (!this.reconstructedHead) return false;
    if (zoneId === 'face' || zoneId === 'hair' || zoneId === 'head_neck') return true;
    return getAncestors(zoneId).some((zone) => zone.id === 'face' || zone.id === 'head_neck');
  }
}
