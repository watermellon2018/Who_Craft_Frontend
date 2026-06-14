import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';
import {getAncestors} from '../zones';
import type {Rig, ZoneParams} from './rig';

// SMPL morph-target engine (A1). The SECOND 3D engine, sitting RIGHT NEXT TO
// the procedural CharacterRig (engine/rig.ts) and implementing the same public
// surface, so the viewport/drag/outline/camera code around it never changes and
// the two can be swapped with a flag.
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
// A1 is SHAPE only. SMPL's β space describes the body silhouette (build, weight,
// proportions); it carries no face detail, no hands, no pose. So the body-shape
// sliders drive morphs here, while face / fine sliders are deliberately no-ops
// in morph mode (the face comes from SMPL-X/FLAME in Phase 5, pose/skinning in
// A2). The procedural engine remains the full-feature fallback.

// Default URL the converter writes to (CRA serves public/ at the web root).
export const MORPH_GLB_URL = '/models/body.glb';

// Slider extreme → β value the morph deltas were baked at (must match
// BETA_SCALE in convert_smpl_to_glb.py). The deltas are stored at β = ±3, so a
// morph influence of 1.0 reproduces β = +3 and an influence of −1.0 → β = −3.
const BETA_SCALE = 3.0;

// ─────────── β mapping table (the intellectual core of A1) ───────────
//
// SMPL βs are abstract PCA components, NOT "shoulder width" knobs — and they are
// coupled (β0 both heightens AND broadens the figure). So this is an honest,
// best-effort mapping of the body-shape sliders our zones expose onto β
// combinations, calibrated from the measured semantics of the neutral model:
//   β0 — overall build / size (small↔large, the dominant axis)
//   β1 — body depth / weight  (POSITIVE β = slimmer; we invert for "heavier")
//   β2 — upper↔lower proportion (shoulders vs hips, pear/V shift)
//   β3 — finer torso proportion
// Each entry contributes additively to a β; several sliders can push the same β.
// The result is summed per β and clamped, then divided by BETA_SCALE into a
// morph influence. `value` is the slider in [-1, 1].
//
// This is the documented A1 limitation: not 1:1 with the procedural sliders.
// Sliders with no honest β analogue (face, hands, fingers, single-limb volume)
// are simply absent here and stay at the neutral base.
interface BetaTerm {
  beta: number;
  // β contribution at slider = +1 (scaled by the live slider value).
  scale: number;
}

const BETA_MAPPING: Record<string, Record<string, BetaTerm[]>> = {
  shoulders: {
    // Broad shoulders read as a larger/V-taper build → β0 up, β2 toward upper.
    shouldersWidth: [{beta: 0, scale: 1.4}, {beta: 2, scale: -0.6}],
  },
  torso: {
    chestWidth: [{beta: 0, scale: 1.0}],
    // More chest depth = heavier front torso → invert β1.
    chestDepth: [{beta: 1, scale: -1.2}],
    backWidth: [{beta: 0, scale: 0.5}],
  },
  waist: {
    // A wider waist reads as more weight → invert β1; a touch of β3 thickness.
    waistWidth: [{beta: 1, scale: -1.4}, {beta: 3, scale: 0.5}],
    // Silhouette: hourglass(−) ↔ straight(+). Couple to depth + proportion.
    torsoCurve: [{beta: 1, scale: 0.6}, {beta: 2, scale: 0.4}],
  },
  hips: {
    // Wider hips = lower-body bulk → β0 up + β2 toward lower (pear).
    hipsWidth: [{beta: 0, scale: 0.7}, {beta: 2, scale: 1.0}],
    hipsShape: [{beta: 2, scale: 0.8}, {beta: 1, scale: -0.4}],
  },
};

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

type MatKind = 'skin';

// Vertex-region partition for click-selection / zoom bounds. The SMPL body is
// ONE mesh, so we tag vertex index ranges by their resting Y band (and X side)
// to recover which zone a raycast hit falls in and where a zone lives in space.
// Bands are fractions of the figure height (feet=0 → head=1).
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
  // For each zone, the world-space-independent local Y mid of its vertex band,
  // used only to anchor zoneBounds when a single mesh can't be sub-selected.
  private vertexY: Float32Array;
  private vertexX: Float32Array;
  private baseMinY = 0;
  private baseMaxY = 1;

  /**
   * Async factory: the GLB must load before the rig is usable, but the
   * CharacterRig contract is otherwise synchronous. The viewport awaits this
   * and falls back to the procedural rig if the load fails (degradation).
   */
  static async create(url: string = MORPH_GLB_URL): Promise<MorphRig> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    let mesh: THREE.Mesh | null = null;
    gltf.scene.traverse((obj) => {
      if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh;
    });
    if (!mesh) throw new Error('MorphRig: GLB contained no mesh');
    return MorphRig.fromMesh(mesh as THREE.Mesh);
  }

  /**
   * Wrap an already-loaded morph mesh. Split out from {@link create} so tests
   * can build a MorphRig from a synthetic mesh without a GLB/network, and so a
   * future loader (a different asset, an embedded buffer) can reuse it.
   */
  static fromMesh(mesh: THREE.Mesh): MorphRig {
    if (!mesh.morphTargetInfluences?.length) {
      throw new Error('MorphRig: mesh has no morph targets');
    }
    return new MorphRig(mesh);
  }

  private constructor(mesh: THREE.Mesh) {
    this.root = new THREE.Group();
    this.root.name = 'character-rig';
    this.mesh = mesh;
    mesh.name = 'smpl_body';
    mesh.castShadow = true;
    mesh.userData.zoneId = 'body';
    mesh.userData.matKind = 'skin' satisfies MatKind;

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

    // Cache resting vertex Y/X for region resolution + bounds.
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
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

    this.root.add(mesh);
    this.applyParams({});
  }

  // ─────────── Public API (mirrors CharacterRig) ───────────

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
   * The whole body mesh is outlined when any zone in its subtree is the
   * hovered/selected zone. Per-zone outlining isn't possible on a single mesh;
   * outlining the whole figure is the honest degradation for A1.
   */
  highlightedMeshes(): {selected: THREE.Mesh[]; hovered: THREE.Mesh[]} {
    const [hovered, selected] = this.lastHighlight;
    if (!this.mesh.visible) return {selected: [], hovered: []};
    if (selected && this.zoneInBody(selected)) return {selected: [this.mesh], hovered: []};
    if (hovered && this.zoneInBody(hovered)) return {selected: [], hovered: [this.mesh]};
    return {selected: [], hovered: []};
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
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
  }

  // No idle morph animation in A1 (breathing/blink live on the procedural face).
  // Kept for interface parity; a future pass could breathe via a morph.
  tick(): void {
    /* intentionally empty for A1 */
  }

  /** Test/debug access. Only the single body mesh exists in morph mode. */
  nodeByName(name: string): THREE.Object3D | undefined {
    if (name === 'body' || name === 'smpl_body') return this.mesh;
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

  // Is the zone (or any descendant relationship to 'body') part of the figure?
  private zoneInBody(zoneId: string): boolean {
    if (zoneId === 'body' || zoneId === 'skin' || zoneId === 'pose') return true;
    const ancestors = getAncestors(zoneId).map((z) => z.id);
    return ancestors.includes('body') || ancestors.includes('pose');
  }
}
