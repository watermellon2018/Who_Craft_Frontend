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

type MatKind = 'skin';

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
  // Measured head center/radius (resting pose), used to anchor camera zoom for
  // head/face zones on the single mesh. SMPL-X's mesh already has a real face,
  // so no procedural feature graft is needed.
  private smplHeadCenter = new THREE.Vector3(0, 1.6, 0.05);
  private smplHeadRadius = 0.09;
  // Live-colored face overlays placed on the real SMPL-X face from its baked
  // landmark anchors: iris discs (eye color), a lip tint, brow arcs. Tiny and
  // editable from the palette — NOT the old whole-head graft.
  private irisMats: THREE.MeshStandardMaterial[] = [];
  private lipMat: THREE.MeshStandardMaterial | null = null;
  // Hair: SMPL-X is bald, so we borrow the procedural hairstyle library (A4) —
  // ONLY its `hairGroup` (not the whole head, which floated as a toy before) —
  // scaled and seated on the measured SMPL-X crown. A hidden CharacterRig owns
  // the hairstyle builder; hair params forward to it.
  private hairDonor: CharacterRig | null = null;
  private hairGroup: THREE.Object3D | null = null;
  private hairAnchor: THREE.Object3D | null = null;
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
    const anchors = (mesh as THREE.Mesh).userData?.faceAnchors as FaceAnchors | undefined;
    return MorphRig.fromMesh(mesh as THREE.Mesh, anchors);
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

    // SMPL-X's base mesh carries a REAL face (eye sockets, lips, nose as
    // geometry), so — unlike bare SMPL — no procedural feature graft is needed.
    // The face is part of the body mesh and morphs with it naturally. We only
    // add tiny LIVE-colored overlays (iris, lips, brows) at the baked landmark
    // anchors so eye/lip/brow COLOR stays editable; the SMPL-X face is
    // monochrome geometry otherwise.
    if (anchors) this.buildFaceOverlay(anchors);
    this.buildHair();

    this.applyParams({});
  }

  /**
   * Borrow the procedural hairstyle library (A4) and seat it on the SMPL-X
   * crown. We take ONLY the donor's `hairGroup` (the parametric hair meshes),
   * scale it to the SMPL-X head size and anchor it so the cap sits on the real
   * crown. Hair params (shape/length/volume/color) forward to the donor in
   * applyParams, so the whole A4 hairstyle picker works in morph mode.
   */
  private buildHair(): void {
    this.hairDonor = new CharacterRig();
    const hg = this.hairDonor.nodeByName('hairGroup');
    if (!hg) return;
    hg.parent?.remove(hg);
    const anchor = new THREE.Group();
    anchor.name = 'smpl_hair_anchor';
    // Procedural head radius M.headR ≈ 0.114 → SMPL-X head half-width ≈ 0.091.
    const scale = Math.max(0.05, this.smplHeadRadius) / 0.114;
    anchor.scale.setScalar(scale);
    anchor.add(hg);
    // Seat the hair by MEASURING where it lands, then dropping the anchor so the
    // hair's top sits just on the SMPL-X crown (an estimated cap-rise constant
    // drifted — the cap's internal offsets are easy to mis-derive). Build the
    // default hairstyle once, measure its world top, and correct.
    anchor.position.set(0, this.baseMaxY, this.smplHeadCenter.z);
    this.root.add(anchor);
    this.hairGroup = hg;
    this.hairDonor.applyParams({});
    anchor.updateWorldMatrix(true, true);
    const top = new THREE.Box3().setFromObject(anchor).max.y;
    // Lower the anchor by the overshoot so the hair top meets the crown, then
    // tuck a few mm further so the cap grips the skull rather than floating.
    anchor.position.y -= top - this.baseMaxY + 0.01;
    this.hairAnchor = anchor;
    this.trimCurtain();
  }

  /**
   * Hide the long back "curtain" hair meshes in morph mode. They are modeled to
   * drape over the PROCEDURAL neck/back; on the differently-shaped SMPL-X body
   * they hang off as a flat floating ribbon. The skull-hugging cap fits fine,
   * so we keep meshes that stay around the head and hide any that fall well
   * below the head center (the curtains). Re-run after every hair rebuild.
   */
  private trimCurtain(): void {
    if (!this.hairAnchor) return;
    this.hairAnchor.updateWorldMatrix(true, true);
    // Cutoff sits between the cap (whose bottom reaches ~ear/jaw level) and a
    // back curtain (which falls to the neck/chest). A mesh dipping below this
    // is a curtain that won't drape on the SMPL-X body — hide it; keep the cap.
    const cutoff = this.smplHeadCenter.y - 0.2;
    const box = new THREE.Box3();
    this.hairAnchor.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.visible = true;
      box.setFromObject(m);
      if (box.min.y < cutoff) m.visible = false;
    });
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

    // Iris discs — face +z, so a thin sphere just proud of the eye surface.
    for (const c of [a.eyeL, a.eyeR]) {
      const mat = new THREE.MeshStandardMaterial({color: '#3a6ca8', roughness: 0.25});
      mat.envMapIntensity = 0.55;
      const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 16, 12), mat);
      iris.scale.z = 0.4;
      iris.position.set(c[0], c[1], c[2] + 0.004);
      iris.raycast = () => undefined;
      group.add(iris);
      this.irisMats.push(mat);
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

    // NB: no brow overlay — SMPL-X has no brow geometry to sit on, so painted
    // arcs read as stuck-on. Brows are better done later via a face texture.

    this.root.add(group);
  }

  /**
   * Locate the head region: average the vertices in the narrow top of the
   * resting mesh. Kept for camera bounds / zone anchoring on the single mesh.
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
      const out: THREE.Mesh[] = [];
      this.hairGroup?.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
      });
      return out;
    };
    if (selected === 'hair') return {selected: hairMeshes(), hovered: []};
    if (hovered === 'hair') return {selected: [], hovered: hairMeshes()};
    if (selected && this.zoneInBody(selected)) return {selected: [this.mesh], hovered: []};
    if (hovered && this.zoneInBody(hovered)) return {selected: [], hovered: [this.mesh]};
    return {selected: [], hovered: []};
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    [...this.irisMats, this.lipMat].forEach((m) => m?.dispose());
    this.hairDonor?.dispose();
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

    // Live face-overlay colors from the same palette the procedural engine uses.
    const eyeHex = typeof params.eyes?.eyeColor === 'string' ? params.eyes.eyeColor : '#3a6ca8';
    this.irisMats.forEach((m) => m.color.set(eyeHex));
    if (this.lipMat) this.lipMat.color.copy(skin.clone().lerp(new THREE.Color('#b0524f'), 0.6));

    // Hair: forward the full params to the donor so the A4 hairstyle picker
    // (shape/length/volume/color) drives the grafted hairGroup. The donor's
    // hidden body ignores the rest. A rebuild may re-add curtain meshes, so
    // re-trim the long back curtain that doesn't fit the SMPL-X body.
    if (this.hairDonor) {
      this.hairDonor.applyParams(params);
      this.trimCurtain();
    }
  }

  // No idle morph animation in A1 (the SMPL-X face has no driven blink yet).
  // Kept for interface parity; a future pass could breathe/blink via morphs.
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

  // Every editable zone lives on the one SMPL-X mesh (body AND face), so any
  // real zone outlines the whole figure — a single mesh can't be sub-outlined.
  private zoneInBody(zoneId: string): boolean {
    return !!zoneId;
  }
}
