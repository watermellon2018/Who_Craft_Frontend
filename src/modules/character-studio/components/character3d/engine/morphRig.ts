import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';
import {getAncestors} from '../zones';
import {CharacterRig} from './rig';
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
  // SMPL's β space carries no face detail (A1 = shape only). Rather than leave a
  // featureless head until SMPL-X/FLAME (Phase 5), we borrow the procedural
  // rig's fully-parametric head subtree (eyes, brows, nose, mouth, ears, hair)
  // and graft it onto the SMPL body's crown. The host CharacterRig's BODY is
  // never added to the scene — only its `head` node is reparented here — and all
  // face/hair/eye-color params forward to it, so every facial slider keeps
  // working in morph mode for free.
  private headDonor: CharacterRig;
  private headAnchor: THREE.Group;
  private headNode: THREE.Object3D | undefined;
  // Measured SMPL head center/radius (resting pose) so the grafted features seat
  // on it. The center shifts up/down with the shape morphs at runtime.
  private smplHeadCenter = new THREE.Vector3(0, 1.6, 0.05);
  private smplHeadRadius = 0.09;
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

    // Measure the SMPL head so the grafted procedural head lands ON it (not
    // floating above the crown). The head is the narrow region in the top
    // ~10% of the figure; average its vertices for the center, halve its
    // X-spread for the radius.
    this.measureSmplHead(pos);

    this.root.add(mesh);

    // ── Borrow ONLY the facial features from the procedural head ──
    // The SMPL body already has a good smooth head; grafting the whole
    // procedural head produced a second, toy-looking head floating above it.
    // So we keep the donor's eyes / brows / nose / mouth (the features SMPL
    // lacks) and HIDE everything that would duplicate or clash with the SMPL
    // head: its skull, jaw, chin, ears, cheeks, hair and skin decorations. The
    // surviving features overlay the real SMPL head.
    this.headDonor = new CharacterRig();
    this.headAnchor = new THREE.Group();
    this.headAnchor.name = 'smpl_head_anchor';
    // Procedural skull radius is M.headR ≈ 0.114; scale the feature cluster to
    // the measured SMPL head radius so eyes/mouth land at the right spread.
    this.headAnchor.scale.setScalar(this.smplHeadRadius / 0.114);
    const head = this.headDonor.nodeByName('head');
    if (head) {
      head.parent?.remove(head);
      head.rotation.set(0, 0, 0);
      this.headAnchor.add(head);
      this.hideNonFeatureMeshes(head);
    }
    this.headNode = head ?? undefined;
    this.root.add(this.headAnchor);
    this.positionHead();

    this.applyParams({});
  }

  // Zones whose meshes are real facial FEATURES the bare SMPL head lacks. Every
  // other head mesh (skull/jaw/chin/ears/cheeks/decoration/hair) is hidden so we
  // overlay features onto the SMPL head instead of stacking a whole second head.
  private static readonly FEATURE_ZONES = new Set(['eyes', 'brows', 'nose', 'mouth']);

  private hideNonFeatureMeshes(head: THREE.Object3D): void {
    head.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      const zone = m.userData?.zoneId;
      if (!MorphRig.FEATURE_ZONES.has(zone)) m.visible = false;
    });
  }

  /**
   * Locate the SMPL head: average the vertices in the narrow top region of the
   * resting mesh. Stores center + radius so the grafted procedural head can be
   * scaled and seated to coincide with it.
   */
  private measureSmplHead(pos: THREE.BufferAttribute): void {
    const yThreshold = this.baseMinY + 0.9 * (this.baseMaxY - this.baseMinY);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = this.vertexY[i];
      if (y < yThreshold) continue;
      const x = this.vertexX[i];
      sx += x;
      sy += y;
      sz += pos.getZ(i);
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (n === 0) {
      this.smplHeadCenter = new THREE.Vector3(0, this.baseMaxY - 0.12, 0.05);
      this.smplHeadRadius = 0.09;
      return;
    }
    this.smplHeadCenter = new THREE.Vector3(sx / n, sy / n, sz / n);
    this.smplHeadRadius = Math.max(0.05, (maxX - minX) / 2);
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
    // The grafted head carries the face/hair zones; let the donor compute the
    // precise meshes to outline for those (eyes, brows, hair…).
    this.headDonor.setHighlight(hoveredZoneId, selectedZoneId);
  }

  /**
   * Outline target: the whole SMPL body mesh when a body zone is active (a
   * single mesh can't be sub-outlined — the honest A1 degradation), OR the
   * precise head/hair meshes when a face zone is active (those come from the
   * grafted procedural head, which CAN be sub-outlined per feature).
   */
  highlightedMeshes(): {selected: THREE.Mesh[]; hovered: THREE.Mesh[]} {
    const [hovered, selected] = this.lastHighlight;
    if (!this.mesh.visible) return {selected: [], hovered: []};
    // Face/hair zones → delegate to the donor head's per-feature outline.
    const head = this.headDonor.highlightedMeshes();
    if (head.selected.length || head.hovered.length) return head;
    if (selected && this.zoneInBody(selected)) return {selected: [this.mesh], hovered: []};
    if (hovered && this.zoneInBody(hovered)) return {selected: [], hovered: [this.mesh]};
    return {selected: [], hovered: []};
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.headDonor.dispose();
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
    // The crown moves with the shape morphs — re-seat the grafted head.
    this.positionHead();

    // Face features + eye color live on the borrowed features, so forward the
    // full param set to the donor. Its hidden body ignores the body-shape
    // sliders harmlessly; only the surviving feature meshes are in the scene.
    this.headDonor.applyParams(params);
    // The donor's applyParams overwrites head.position.y (to seat it on its own
    // neck) and rebuilds the mouth/hair (re-adding meshes). Undo both: re-pin
    // the head so its skull center sits at our anchor, and re-hide whatever the
    // rebuild re-added.
    if (this.headNode) {
      this.headNode.position.set(0, -0.06, 0);
      this.hideNonFeatureMeshes(this.headNode);
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

  // Drive the borrowed head's idle motion (breathing is on the donor's hidden
  // chest so it's a no-op here, but the blink animates the grafted eyelids).
  tick(timeSeconds: number): void {
    this.headDonor.tick(timeSeconds);
  }

  /** Test/debug access. Only the single body mesh exists in morph mode. */
  nodeByName(name: string): THREE.Object3D | undefined {
    if (name === 'body' || name === 'smpl_body') return this.mesh;
    return undefined;
  }

  // ─────────── Internals ───────────

  /**
   * Seat the grafted head ON the SMPL head (anchor = measured SMPL head center),
   * shifted by however much the shape morphs have moved the crown so a taller
   * build lifts the face with the body. The anchor scale already matches the
   * head to the SMPL head radius; the donor head was offset so its SKULL CENTER
   * sits at the anchor origin.
   */
  private positionHead(): void {
    this.mesh.geometry.computeBoundingBox();
    const bb = this.mesh.geometry.boundingBox;
    const crownShift = bb ? bb.max.y - this.baseMaxY : 0;
    this.headAnchor.position.set(
      this.smplHeadCenter.x,
      this.smplHeadCenter.y + crownShift,
      this.smplHeadCenter.z,
    );
  }

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
