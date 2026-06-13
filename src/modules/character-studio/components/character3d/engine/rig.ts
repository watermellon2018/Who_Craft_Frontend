import * as THREE from 'three';
import {getAncestors} from '../zones';
import {buildLoft, LoftRing, taperedLimbGeometry} from './geometry';

// Parametric humanoid rig for the 3D character editor.
//
// The figure is a stylized mannequin assembled from primitive parts in a
// joint hierarchy (no skinned mesh). Every parameter from zones.ts maps to
// plain math here:
//   • "bone" params  → joint translations/rotations and segment stretching
//   • "morph" params → per-part scale/offset factors (and for the mouth /
//     hair — geometry rebuilt from parametric curves)
//   • "material"     → material colors
//   • "texture"      → visibility of decoration meshes (freckles, scars…)
//   • "pose"/"blendshape" → joint rotations / feature transforms
//
// Engine is deliberately React-free: it is unit-testable in plain jsdom and
// the viewport only calls applyParams() when the parameter state changes.

export type ZoneParamValues = Record<string, number | string | boolean>;
export type ZoneParams = Record<string, ZoneParamValues>;

// ─────────── Base measurements (meters, Y-up, figure ≈ 1.76 m) ───────────
const M = {
  pelvisY: 0.93,
  hipHalfX: 0.1,
  thighLen: 0.4,
  thighR: 0.077,
  calfLen: 0.39,
  calfR: 0.057,
  spineY: 0.13, // pelvis → spine joint
  chestY: 0.22, // spine → chest joint
  neckBaseY: 0.2, // chest → neck joint
  neckLen: 0.1,
  neckR: 0.046,
  headR: 0.114,
  shoulderX: 0.205,
  shoulderY: 0.165,
  upperArmLen: 0.27,
  forearmLen: 0.25,
};

// Torso loft ring stack in PELVIS space, bottom → top. Parameters scale
// these base radii at rebuild time; boundary rings (hipTop, underChest) are
// computed once and shared by the adjacent parts, so the silhouette is
// continuous across the hips/waist/chest split.
const TORSO_RINGS = {
  crotch: {y: -0.1, rx: 0.108, rzFront: 0.092, rzBack: 0.1},
  hipsMax: {y: -0.015, rx: 0.17, rzFront: 0.122, rzBack: 0.134},
  hipTop: {y: 0.055, rx: 0.152, rzFront: 0.112, rzBack: 0.124},
  waistMid: {y: 0.135, rx: 0.138, rzFront: 0.104, rzBack: 0.114},
  underChest: {y: 0.215, rx: 0.156, rzFront: 0.116, rzBack: 0.128},
  chestMax: {y: 0.3, rx: 0.18, rzFront: 0.132, rzBack: 0.142},
  shoulderTop: {y: 0.42, rx: 0.15, rzFront: 0.1, rzBack: 0.112},
  // Tight against the neck cylinder (r ≈ 0.053 at its base) so the loft's
  // top cap doesn't leave a shadowed ledge around the neck.
  neckBase: {y: 0.52, rx: 0.062, rzFront: 0.055, rzBack: 0.058},
};

// Skull-center–relative anchors for facial features. Z values must clear
// the skull surface (rz ≈ headR·0.96 ≈ 0.109 at the equator) or features
// sink inside the head and disappear.
const FACE = {
  eyeX: 0.043,
  eyeY: 0.012,
  eyeZ: 0.099,
  eyeR: 0.021,
  browY: 0.052,
  browZ: 0.108,
  noseY: -0.012,
  noseZ: 0.104,
  mouthY: -0.064,
  mouthZ: 0.088,
  earX: M.headR * 0.93,
};

// Face-shape presets: baked scale multipliers for skull / jaw / chin.
const FACE_SHAPES: Record<string, {skull: number[]; jaw: number[]; chin: number[]}> = {
  oval: {skull: [1, 1.1, 0.96], jaw: [1, 1, 1], chin: [1, 1, 1]},
  round: {skull: [1.1, 1, 1], jaw: [1.1, 0.95, 1.05], chin: [1.2, 0.85, 1.1]},
  square: {skull: [1.05, 1.02, 0.96], jaw: [1.22, 1.05, 1], chin: [1.5, 0.9, 1]},
  heart: {skull: [1.08, 1.06, 0.95], jaw: [0.86, 1, 0.95], chin: [0.72, 1.15, 0.85]},
};

// Posture presets: baseline offsets the posture sliders add onto.
const POSTURES: Record<string, {straight: number; shouldersFwd: number; tilt: number}> = {
  neutral: {straight: 0, shouldersFwd: 0, tilt: 0},
  confident: {straight: 0.6, shouldersFwd: -0.4, tilt: -0.05},
  relaxed: {straight: -0.35, shouldersFwd: 0.25, tilt: 0},
  dynamic: {straight: 0.3, shouldersFwd: 0, tilt: 0.35},
};

// Deterministic decoration spots (skull-center space). No Math.random —
// the same character must always render the same freckles.
const FRECKLE_SPOTS: Array<[number, number, number]> = [
  [-0.046, -0.014, 0.075], [-0.036, -0.022, 0.082], [-0.026, -0.012, 0.088],
  [-0.014, -0.027, 0.092], [0.014, -0.027, 0.092], [0.026, -0.012, 0.088],
  [0.036, -0.022, 0.082], [0.046, -0.014, 0.075], [-0.008, -0.016, 0.095],
  [0.008, -0.016, 0.095], [-0.03, -0.03, 0.08], [0.03, -0.03, 0.08],
];
const MOLE_SPOTS: Array<[number, number, number]> = [
  [0.031, -0.041, 0.085], [-0.052, 0.02, 0.078],
];

type MatKind =
  | 'skin' | 'hair' | 'brow' | 'lip' | 'mouthInner' | 'eyeWhite' | 'iris'
  | 'pupil' | 'blush' | 'freckle' | 'scar';

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

export class CharacterRig {
  readonly root: THREE.Group;

  private nodes: Record<string, THREE.Object3D> = {};
  private mats: Array<{mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; kind: MatKind}> = [];
  // mesh → set of zone ids (its own zone + all ancestors) for highlight/bounds.
  private meshZones = new Map<THREE.Mesh, Set<string>>();
  private geometries: THREE.BufferGeometry[] = [];
  private hairKey = '';
  private mouthKey = '';
  private torsoKey = '';
  private lastHighlight: [string | null, string | null] = [null, null];

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'character-rig';
    this.build();
    this.applyParams({});
  }

  // ─────────── Public API ───────────

  /** Map an intersected object to the most specific zone id tagging it. */
  resolveZoneFromObject(obj: THREE.Object3D | null): string | null {
    let cursor: THREE.Object3D | null = obj;
    while (cursor) {
      const zoneId = cursor.userData?.zoneId;
      if (typeof zoneId === 'string') return zoneId;
      cursor = cursor.parent;
    }
    return null;
  }

  /** Which mirrored half (left/right) an intersected object belongs to. */
  resolveSideFromObject(obj: THREE.Object3D | null): 'L' | 'R' | null {
    let cursor: THREE.Object3D | null = obj;
    while (cursor) {
      const side = cursor.userData?.side;
      if (side === 'L' || side === 'R') return side;
      cursor = cursor.parent;
    }
    return null;
  }

  /** World-space bounds of a zone (its meshes + all descendants' meshes). */
  zoneBounds(zoneId: string): THREE.Box3 | null {
    const box = new THREE.Box3();
    let any = false;
    // skin/pose have no geometry of their own — treat as the whole figure.
    const wholeFigure = zoneId === 'skin' || zoneId === 'pose' || zoneId === 'skin_color';
    this.meshZones.forEach((zones, mesh) => {
      if (!mesh.visible) return;
      if (wholeFigure || zones.has(zoneId)) {
        box.expandByObject(mesh);
        any = true;
      }
    });
    return any ? box : null;
  }

  /**
   * Record the hovered/selected zones. The actual highlight is an OUTLINE
   * drawn by the viewport's post-processing pass (see highlightedMeshes) —
   * not an emissive material tint, which washed out on light skin and
   * falsified the very colors the user picks. A mesh belongs to a zone's
   * outline when the zone is the mesh's own zone or any of its ancestors
   * (selecting "Тело" outlines the whole body; "Глаза" only the eyes).
   */
  setHighlight(hoveredZoneId: string | null, selectedZoneId: string | null): void {
    this.lastHighlight = [hoveredZoneId, selectedZoneId];
  }

  /**
   * Visible meshes to outline for the current hover/selection, split so the
   * viewport can style them differently. A mesh appears in `selected` OR
   * `hovered` (never both — selection wins), so the two outline passes never
   * fight over the same silhouette.
   *
   * Color-bearing details (iris, pupil, mouth interior, blush) are excluded:
   * a contour around the iris would obscure the eye-color the user is
   * choosing, and they sit inside a larger zone that already gets outlined.
   */
  highlightedMeshes(): {selected: THREE.Mesh[]; hovered: THREE.Mesh[]} {
    const [hoveredZoneId, selectedZoneId] = this.lastHighlight;
    const noOutline = new Set<MatKind>(['iris', 'pupil', 'mouthInner', 'blush']);
    const selected: THREE.Mesh[] = [];
    const hovered: THREE.Mesh[] = [];
    this.mats.forEach(({mesh, kind}) => {
      if (!mesh.visible || noOutline.has(kind)) return;
      const zones = this.meshZones.get(mesh);
      if (selectedZoneId && zones?.has(selectedZoneId)) {
        selected.push(mesh);
      } else if (hoveredZoneId && zones?.has(hoveredZoneId)) {
        hovered.push(mesh);
      }
    });
    return {selected, hovered};
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.mats.forEach(({material}) => material.dispose());
    this.geometries = [];
    this.mats = [];
    this.meshZones.clear();
  }

  // ─────────── Parameter application (the math) ───────────

  applyParams(params: ZoneParams): void {
    const n = (zone: string, id: string, fallback = 0): number => {
      const v = params[zone]?.[id];
      return typeof v === 'number' && Number.isFinite(v) ? clamp(v) : fallback;
    };
    const s = (zone: string, id: string, fallback: string): string => {
      const v = params[zone]?.[id];
      return typeof v === 'string' ? v : fallback;
    };
    const b = (zone: string, id: string): boolean => params[zone]?.[id] === true;
    // Per-side resolution: `${id}__L` / `${id}__R` overrides win over the
    // shared value. The editor writes overrides when «Применять симметрично»
    // is off; the shared value remains the fallback for both sides.
    const nS = (zone: string, id: string, side: 'L' | 'R', fallback = 0): number => {
      const v = params[zone]?.[`${id}__${side}`];
      return typeof v === 'number' && Number.isFinite(v) ? clamp(v) : n(zone, id, fallback);
    };
    const node = (name: string) => this.nodes[name];

    // ── Torso block: one continuous loft, rebuilt when its inputs change ──
    this.rebuildTorsoIfNeeded({
      chestWidth: n('torso', 'chestWidth'),
      chestDepth: n('torso', 'chestDepth'),
      backWidth: n('torso', 'backWidth'),
      waistWidth: n('waist', 'waistWidth'),
      torsoCurve: n('waist', 'torsoCurve'),
      hipsWidth: n('hips', 'hipsWidth'),
      hipsShape: n('hips', 'hipsShape'),
      // The loft itself is symmetric; per-side shoulder width still moves
      // the arm roots, so use the wider side for the torso silhouette.
      shouldersWidth: Math.max(
        nS('shoulders', 'shouldersWidth', 'L'),
        nS('shoulders', 'shouldersWidth', 'R'),
      ),
    });

    // ── Neck / head size ──
    const neckLen = 1 + 0.4 * n('head_neck', 'neckLength');
    node('neckMesh').scale.set(
      1 + 0.35 * n('head_neck', 'neckThickness'),
      neckLen,
      1 + 0.35 * n('head_neck', 'neckThickness'),
    );
    node('neckMesh').position.y = (M.neckLen * neckLen) / 2;
    node('head').position.y = M.neckLen * neckLen;
    const headScale = 1 + 0.16 * n('head_neck', 'headSize');
    node('head').scale.setScalar(headScale);

    // ── Shoulders + arms attach ──
    const posture = POSTURES[s('posture', 'posturePreset', 'neutral')] ?? POSTURES.neutral;
    const straight = clamp(posture.straight + n('posture', 'postureStraightness'));
    const slouch = Math.max(0, -straight);
    const shouldersFwd = clamp(posture.shouldersFwd + n('posture', 'shouldersForward'));
    const torsoTilt = clamp(posture.tilt + n('posture', 'torsoTilt'));

    // Longer/shorter legs move the whole figure so the feet stay on the
    // floor. With asymmetric legs the figure stands on the longer one —
    // the pelvis follows it so no foot ever sinks below the floor.
    const legLen = (side: 'L' | 'R') =>
      M.thighLen * (1 + 0.2 * nS('thigh', 'thighLength', side)) +
      M.calfLen * (1 + 0.2 * nS('calf', 'calfLength', side));
    this.nodes.pelvis.position.y = 0.02 + Math.max(legLen('L'), legLen('R')) + 0.12;

    (['L', 'R'] as const).forEach((side) => {
      const m = side === 'L' ? -1 : 1;
      const shWidth = nS('shoulders', 'shouldersWidth', side);
      const shSlope = nS('shoulders', 'shouldersSlope', side);
      const shHeight = nS('shoulders', 'shouldersHeight', side);
      const armRoot = node(`armRoot${side}`);
      armRoot.position.set(
        m * M.shoulderX * (1 + 0.3 * shWidth),
        M.shoulderY + 0.022 * shHeight - 0.024 * Math.max(0, shSlope),
        0.035 * shouldersFwd,
      );
      // Slope tips the whole arm slightly outward/downward.
      const raise = Math.max(
        0.03,
        0.16 + 0.55 * nS('arms_pose', 'armsRaise', side) - 0.06 * shSlope,
      );
      armRoot.rotation.set(
        -0.6 * nS('arms_pose', 'armsForward', side),
        -m * 0.22 * shouldersFwd,
        m * raise,
      );
      node(`shoulderMesh${side}`).scale.setScalar(1 + 0.18 * shWidth);

      // Limb segments: mesh stretches, child joint follows the new length.
      this.applySegment(`upperArm${side}`, 1 + 0.22 * nS('upper_arm', 'length', side),
        1 + 0.3 * nS('upper_arm', 'volume', side) + 0.12 * nS('upper_arm', 'definition', side));
      this.applySegment(`forearm${side}`, 1 + 0.22 * nS('forearm', 'length', side),
        1 + 0.3 * nS('forearm', 'thickness', side));
      const hand = node(`handMesh${side}`);
      const handSize = 1 + 0.25 * nS('hand', 'size', side);
      hand.scale.set(handSize, handSize * (1 + 0.3 * nS('hand', 'fingerLength', side)), handSize);

      this.applySegment(`thigh${side}`, 1 + 0.2 * nS('thigh', 'thighLength', side),
        1 + 0.32 * nS('thigh', 'thighVolume', side));
      this.applySegment(`calf${side}`, 1 + 0.2 * nS('calf', 'calfLength', side),
        1 + 0.32 * nS('calf', 'calfVolume', side));
      node(`footMesh${side}`).scale.setScalar(1 + 0.25 * nS('foot', 'footSize', side));
    });

    // ── Posture / head pose ──
    node('spine').rotation.x = 0.1 * slouch + 0.1 * torsoTilt;
    node('chest').rotation.x = 0.08 * slouch + 0.06 * torsoTilt;
    node('neck').rotation.x = -0.07 * slouch - 0.04 * torsoTilt;
    node('head').rotation.set(
      -0.05 * slouch,
      0.6 * n('head_pose', 'headTurn'),
      0.3 * n('head_pose', 'headTilt'),
    );

    // ── Face ──
    const shape = FACE_SHAPES[s('face_shape', 'shape', 'oval')] ?? FACE_SHAPES.oval;
    const cheekbones = n('face_shape', 'cheekbones');
    node('skullMesh').scale.set(
      shape.skull[0] * (1 + 0.05 * Math.max(0, cheekbones)),
      shape.skull[1],
      shape.skull[2],
    );
    const mouthOpen = clamp(n('expression', 'mouthOpen'), 0, 1);
    const jaw = node('jawMesh');
    jaw.scale.set(shape.jaw[0] * (1 + 0.22 * n('jaw_chin', 'jawWidth')), shape.jaw[1], shape.jaw[2]);
    jaw.position.y = -0.03 - 0.01 * mouthOpen;
    const chin = node('chinMesh');
    const chinShape = n('jaw_chin', 'chinShape');
    chin.scale.set(
      shape.chin[0] * (1 + 0.3 * chinShape),
      shape.chin[1] * (1 + 0.3 * n('jaw_chin', 'chinLength')),
      shape.chin[2] * (1 + 0.15 * chinShape),
    );
    chin.position.y = -0.088 - 0.018 * n('jaw_chin', 'chinLength') - 0.012 * mouthOpen;

    const cheekScale = Math.max(0, cheekbones);
    (['L', 'R'] as const).forEach((side) => {
      const cheek = node(`cheekMesh${side}`);
      cheek.visible = cheekScale > 0.03;
      cheek.scale.setScalar(Math.max(0.001, 0.4 + 0.8 * cheekScale));
    });

    // ── Eyes ──
    const squint = clamp(n('expression', 'squint'), 0, 1);
    (['L', 'R'] as const).forEach((side) => {
      const m = side === 'L' ? -1 : 1;
      const eye = node(`eye${side}`);
      eye.position.x = m * (FACE.eyeX + 0.012 * nS('eyes', 'eyeDistance', side));
      eye.rotation.z = -m * 0.28 * nS('eyes', 'eyeTilt', side);
      eye.scale.setScalar(1 + 0.3 * nS('eyes', 'eyeSize', side));
      const lid = node(`eyelid${side}`);
      const lidCover = 0.18 + 0.62 * squint;
      // Record the squint baseline so the idle blink (see tick) can layer a
      // momentary full closure ON TOP of it without clobbering the param.
      lid.userData.lidCover = lidCover;
      this.applyLidCover(lid, lidCover);

      const brow = node(`brow${side}`);
      brow.position.x = m * (FACE.eyeX + 0.012 * nS('eyes', 'eyeDistance', side));
      brow.position.y =
        FACE.browY +
        0.014 * (nS('brows', 'browHeight', side) + clamp(n('expression', 'browRaise'), 0, 1));
      brow.rotation.z = m * 0.45 * nS('brows', 'browAngle', side);
      brow.scale.y = 1 + 0.6 * nS('brows', 'browThickness', side);

      const ear = node(`ear${side}`);
      ear.scale.setScalar(1 + 0.35 * nS('ears', 'earSize', side));
      ear.rotation.y = m * (0.12 + 0.5 * nS('ears', 'earAngle', side));
    });

    // ── Nose ──
    const nose = node('nose');
    nose.scale.set(1 + 0.35 * n('nose', 'noseWidth'), 1 + 0.3 * n('nose', 'noseLength'), 1);
    const bridge = node('noseBridge');
    bridge.position.z = 0.002 + 0.008 * n('nose', 'bridgeHeight');
    bridge.scale.z = 1 + 0.5 * Math.max(0, n('nose', 'bridgeHeight'));
    const tip = node('noseTip');
    tip.position.set(0, -0.018 + 0.005 * n('nose', 'noseTip'), 0.01 + 0.006 * n('nose', 'noseTip'));

    // ── Mouth (parametric tubes — rebuilt only when its inputs change) ──
    this.rebuildMouthIfNeeded({
      width: n('mouth', 'mouthWidth'),
      upper: n('mouth', 'upperLip'),
      lower: n('mouth', 'lowerLip'),
      corner: n('mouth', 'cornerLift'),
      smile: clamp(n('expression', 'smile'), 0, 1),
      open: mouthOpen,
    });

    // ── Hair (rebuilt only when its inputs change) ──
    this.rebuildHairIfNeeded(
      s('hair', 'hairShape', 'wavy'),
      clamp(n('hair', 'hairLength', 0.5), 0, 1),
      n('hair', 'hairVolume'),
    );

    // ── Decorations ──
    node('freckles').visible = b('skin_details', 'freckles');
    node('moles').visible = b('skin_details', 'moles');
    node('scarMesh').visible = b('skin_details', 'scars');
    node('blush').visible = b('skin_details', 'blush');

    // ── Colors ──
    this.applyColors(
      s('skin_color', 'skinTone', '#dac0a3'),
      n('skin_color', 'skinSaturation'),
      s('hair', 'hairColor', '#1E1A18'),
      s('eyes', 'eyeColor', '#3a6ca8'),
    );

    // Hair/mouth rebuilds create fresh materials — re-apply the highlight.
    this.setHighlight(this.lastHighlight[0], this.lastHighlight[1]);
  }

  /** Test/debug access to a named node of the hierarchy. */
  nodeByName(name: string): THREE.Object3D | undefined {
    return this.nodes[name];
  }

  // ─────────── Internals ───────────

  private applySegment(name: string, lengthFactor: number, thicknessFactor: number): void {
    const mesh = this.nodes[`${name}Mesh`];
    const joint = this.nodes[`${name}End`];
    const baseLen = mesh.userData.baseLength as number;
    // Limb geometry is baked in joint space (origin = upper joint), so
    // scaling stretches it downward and the mesh itself never moves.
    mesh.scale.set(thicknessFactor, lengthFactor, thicknessFactor);
    if (joint) joint.position.y = -baseLen * lengthFactor;
  }

  /** Subtle idle motion so the figure doesn't read as a statue. */
  tick(timeSeconds: number): void {
    const chest = this.nodes.chestMesh;
    if (!chest) return;
    const breath = 0.006 * (0.5 + 0.5 * Math.sin(timeSeconds * 1.4));
    chest.scale.set(1 + breath * 0.6, 1 + breath, 1 + breath);

    // Idle blink: a quick, occasional full lid closure layered on top of the
    // squint baseline. Deterministic (no Math.random — same figure blinks the
    // same way), but the period is sine-jittered so it never feels metronomic.
    const blink = this.blinkAmount(timeSeconds);
    (['L', 'R'] as const).forEach((side) => {
      const lid = this.nodes[`eyelid${side}`];
      if (!lid) return;
      const base = (lid.userData.lidCover as number) ?? 0.18;
      // Blend from the resting cover toward a full closure (≈1) by `blink`.
      this.applyLidCover(lid, base + (1.0 - base) * blink);
    });
  }

  /**
   * Blink envelope in [0, 1] for a given time: 0 = eyes at their resting
   * cover, 1 = fully shut. Most of the cycle sits at 0; a blink is a short
   * (~140 ms) close-and-open pulse. The base period is ~4 s, nudged by a slow
   * sine so successive blinks aren't evenly spaced.
   */
  private blinkAmount(timeSeconds: number): number {
    const period = 4.0 + 1.2 * Math.sin(timeSeconds * 0.37);
    const phase = timeSeconds % period;
    const blinkDur = 0.14; // seconds the lids are in motion
    if (phase > blinkDur) return 0;
    // 0 → 1 → 0 over the pulse: closes in the first half, opens in the second.
    return Math.sin((phase / blinkDur) * Math.PI);
  }

  /** Set an eyelid's vertical cover (0.18 ≈ open, ~1 ≈ shut) + matching drop. */
  private applyLidCover(lid: THREE.Object3D, cover: number): void {
    lid.scale.set(1.06, cover, 1.04);
    lid.position.y = FACE.eyeR * (1 - cover * 0.55);
  }

  private applyColors(skinHex: string, saturation: number, hairHex: string, eyeHex: string): void {
    const skin = new THREE.Color(skinHex);
    const hsl = {h: 0, s: 0, l: 0};
    skin.getHSL(hsl);
    skin.setHSL(hsl.h, clamp(hsl.s * (1 + 0.45 * saturation), 0, 1), hsl.l);
    const hair = new THREE.Color(hairHex);
    const brow = hair.clone().lerp(new THREE.Color('#000000'), 0.3);
    const lip = skin.clone().lerp(new THREE.Color('#b0524f'), 0.55);
    const freckle = skin.clone().lerp(new THREE.Color('#5a3a26'), 0.55);
    const scar = skin.clone().lerp(new THREE.Color('#c98c7a'), 0.6);
    const iris = new THREE.Color(eyeHex);

    this.mats.forEach(({material, kind}) => {
      switch (kind) {
        case 'skin': material.color.copy(skin); break;
        case 'hair': material.color.copy(hair); break;
        case 'brow': material.color.copy(brow); break;
        case 'lip': material.color.copy(lip); break;
        case 'iris': material.color.copy(iris); break;
        case 'freckle': material.color.copy(freckle); break;
        case 'scar': material.color.copy(scar); break;
        default: break;
      }
    });
  }

  private material(kind: MatKind): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({roughness: 0.62, metalness: 0.04});
    // Image-based lighting (scene.environment) carries most of the fill;
    // keep its contribution moderate so the skin doesn't look plastic.
    material.envMapIntensity = 0.55;
    switch (kind) {
      case 'eyeWhite': material.color.set('#f4f1ec'); material.roughness = 0.25; break;
      case 'iris': material.roughness = 0.2; break;
      case 'pupil': material.color.set('#14100e'); material.roughness = 0.15; break;
      case 'hair': material.roughness = 0.78; break;
      case 'mouthInner': material.color.set('#4a1e20'); material.roughness = 0.4; break;
      case 'blush':
        material.color.set('#e98a8a');
        material.transparent = true;
        material.opacity = 0.4;
        break;
      default: break;
    }
    return material;
  }

  private mesh(
    geometry: THREE.BufferGeometry,
    kind: MatKind,
    zoneId: string,
    opts: {raycastable?: boolean} = {},
  ): THREE.Mesh {
    const material = this.material(kind);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.userData.zoneId = zoneId;
    mesh.userData.matKind = kind;
    if (opts.raycastable === false) {
      // Decorations (freckles, blush…) must not steal clicks from the face.
      mesh.raycast = () => undefined;
    }
    this.geometries.push(geometry);
    this.mats.push({mesh, material, kind});
    this.meshZones.set(mesh, new Set(getAncestors(zoneId).map((z) => z.id).concat(zoneId)));
    return mesh;
  }

  private group(name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    this.nodes[name] = g;
    return g;
  }

  private ellipsoid(rx: number, ry: number, rz: number): THREE.SphereGeometry {
    const geo = new THREE.SphereGeometry(1, 28, 20);
    geo.scale(rx, ry, rz);
    return geo;
  }

  /**
   * Tapered limb segment: joint at the top, `${name}End` joint at the
   * bottom. Adjacent segments use matching radii at the shared joint so
   * elbows/knees read as one continuous limb instead of stacked capsules.
   */
  private segment(
    parent: THREE.Object3D,
    name: string,
    zoneId: string,
    rTop: number,
    rBottom: number,
    length: number,
  ): THREE.Group {
    const geo = taperedLimbGeometry(rTop, rBottom, length);
    const mesh = this.mesh(geo, 'skin', zoneId);
    mesh.userData.baseLength = length;
    parent.add(mesh);
    this.nodes[`${name}Mesh`] = mesh;
    const end = this.group(`${name}End`, parent, 0, -length, 0);
    return end;
  }

  /** Rebuild the three torso lofts when any silhouette parameter changes. */
  private rebuildTorsoIfNeeded(q: {
    chestWidth: number; chestDepth: number; backWidth: number;
    waistWidth: number; torsoCurve: number;
    hipsWidth: number; hipsShape: number; shouldersWidth: number;
  }): void {
    const key = [
      q.chestWidth, q.chestDepth, q.backWidth, q.waistWidth,
      q.torsoCurve, q.hipsWidth, q.hipsShape, q.shouldersWidth,
    ].map((v) => v.toFixed(3)).join('|');
    if (key === this.torsoKey) return;
    this.torsoKey = key;

    const T = TORSO_RINGS;
    const c = q.torsoCurve;
    const backBulge = 1 + 0.22 * Math.max(0, q.backWidth);
    // The full effective ring stack is computed once; boundary rings are
    // shared by the adjacent lofts, which guarantees a seamless silhouette.
    const rings: LoftRing[] = [
      {y: T.crotch.y, rx: T.crotch.rx * (1 + 0.1 * q.hipsWidth),
        rzFront: T.crotch.rzFront, rzBack: T.crotch.rzBack},
      {y: T.hipsMax.y,
        rx: T.hipsMax.rx * (1 + 0.3 * q.hipsWidth + 0.07 * c + 0.05 * q.hipsShape),
        rzFront: T.hipsMax.rzFront * (1 + 0.2 * q.hipsShape),
        rzBack: T.hipsMax.rzBack * (1 + 0.25 * q.hipsShape)},
      {y: T.hipTop.y,
        rx: T.hipTop.rx * (1 + 0.18 * q.hipsWidth + 0.07 * c) * (1 + 0.1 * q.waistWidth),
        rzFront: T.hipTop.rzFront, rzBack: T.hipTop.rzBack * (1 + 0.1 * q.hipsShape)},
      {y: T.waistMid.y,
        rx: T.waistMid.rx * (1 + 0.3 * q.waistWidth) * (1 - 0.22 * c),
        rzFront: T.waistMid.rzFront * (1 + 0.22 * q.waistWidth) * (1 - 0.12 * c),
        rzBack: T.waistMid.rzBack * (1 + 0.22 * q.waistWidth) * (1 - 0.12 * c)},
      {y: T.underChest.y,
        rx: T.underChest.rx * (1 + 0.15 * q.chestWidth + 0.1 * q.waistWidth) * (1 - 0.08 * c),
        rzFront: T.underChest.rzFront, rzBack: T.underChest.rzBack},
      {y: T.chestMax.y,
        rx: T.chestMax.rx * (1 + 0.28 * q.chestWidth + 0.05 * c + 0.06 * q.backWidth),
        rzFront: T.chestMax.rzFront * (1 + 0.3 * q.chestDepth),
        rzBack: T.chestMax.rzBack * backBulge},
      {y: T.shoulderTop.y,
        rx: T.shoulderTop.rx * (1 + 0.18 * q.chestWidth + 0.2 * q.shouldersWidth),
        rzFront: T.shoulderTop.rzFront * (1 + 0.2 * q.chestDepth),
        rzBack: T.shoulderTop.rzBack * backBulge},
      {y: T.neckBase.y, rx: T.neckBase.rx, rzFront: T.neckBase.rzFront, rzBack: T.neckBase.rzBack},
    ];
    const local = (ring: LoftRing, dy: number): LoftRing => ({...ring, y: ring.y - dy});
    // hipsMesh lives under pelvis (dy 0), waistMesh under spine (+0.13),
    // chestMesh under chest (+0.35) — slice with one shared ring of overlap.
    this.swapGeometry(this.nodes.hipsMesh as THREE.Mesh,
      buildLoft(rings.slice(0, 3).map((r) => local(r, 0)), 32, {bottom: true}));
    this.swapGeometry(this.nodes.waistMesh as THREE.Mesh,
      buildLoft(rings.slice(2, 5).map((r) => local(r, M.spineY)), 32, {}));
    this.swapGeometry(this.nodes.chestMesh as THREE.Mesh,
      buildLoft(rings.slice(4, 9).map((r) => local(r, M.spineY + M.chestY)), 32, {top: true}));
  }

  private build(): void {
    const pelvis = this.group('pelvis', this.root, 0, M.pelvisY, 0);
    // Torso lofts start empty — the first applyParams() builds them from
    // the shared ring stack (rebuildTorsoIfNeeded).
    const hipsMesh = this.mesh(new THREE.BufferGeometry(), 'skin', 'hips');
    pelvis.add(hipsMesh);
    this.nodes.hipsMesh = hipsMesh;

    const spine = this.group('spine', pelvis, 0, M.spineY, 0);
    const waistMesh = this.mesh(new THREE.BufferGeometry(), 'skin', 'waist');
    spine.add(waistMesh);
    this.nodes.waistMesh = waistMesh;

    const chest = this.group('chest', spine, 0, M.chestY, 0);
    const chestMesh = this.mesh(new THREE.BufferGeometry(), 'skin', 'torso');
    chest.add(chestMesh);
    this.nodes.chestMesh = chestMesh;

    // ── Arms ──
    (['L', 'R'] as const).forEach((side) => {
      const m = side === 'L' ? -1 : 1;
      const armRoot = this.group(`armRoot${side}`, chest, m * M.shoulderX, M.shoulderY, 0);
      armRoot.userData.side = side;
      const shoulderMesh = this.mesh(new THREE.SphereGeometry(0.062, 20, 14), 'skin', 'shoulders');
      armRoot.add(shoulderMesh);
      this.nodes[`shoulderMesh${side}`] = shoulderMesh;

      const elbow = this.segment(armRoot, `upperArm${side}`, 'upper_arm', 0.058, 0.047, M.upperArmLen);
      const wrist = this.segment(elbow, `forearm${side}`, 'forearm', 0.047, 0.035, M.forearmLen);
      const handGeo = new THREE.CapsuleGeometry(0.034, 0.062, 5, 10);
      handGeo.scale(1, 1, 0.55);
      const handMesh = this.mesh(handGeo, 'skin', 'hand');
      handMesh.position.y = -0.055;
      wrist.add(handMesh);
      this.nodes[`handMesh${side}`] = handMesh;
    });

    // ── Legs ──
    (['L', 'R'] as const).forEach((side) => {
      const m = side === 'L' ? -1 : 1;
      const legRoot = this.group(`legRoot${side}`, pelvis, m * M.hipHalfX, -0.02, 0);
      legRoot.userData.side = side;
      const knee = this.segment(legRoot, `thigh${side}`, 'thigh', 0.088, 0.064, M.thighLen);
      const ankle = this.segment(knee, `calf${side}`, 'calf', 0.064, 0.044, M.calfLen);
      const footGeo = new THREE.BoxGeometry(0.075, 0.052, 0.21);
      const footMesh = this.mesh(footGeo, 'skin', 'foot');
      footMesh.position.set(0, -0.085, 0.05);
      ankle.add(footMesh);
      this.nodes[`footMesh${side}`] = footMesh;
    });

    // ── Neck + head ──
    const neck = this.group('neck', chest, 0, M.neckBaseY, 0);
    const neckMesh = this.mesh(new THREE.CylinderGeometry(M.neckR, M.neckR * 1.15, M.neckLen + 0.05, 16), 'skin', 'head_neck');
    neckMesh.position.y = M.neckLen / 2;
    neck.add(neckMesh);
    this.nodes.neckMesh = neckMesh;

    const head = this.group('head', neck, 0, M.neckLen, 0);
    // All facial anchors are relative to the skull center.
    const face = this.group('faceRoot', head, 0, 0.06, 0);
    const skullMesh = this.mesh(new THREE.SphereGeometry(M.headR, 32, 24), 'skin', 'face_shape');
    face.add(skullMesh);
    this.nodes.skullMesh = skullMesh;

    const jawMesh = this.mesh(this.ellipsoid(M.headR * 0.86, M.headR * 0.62, M.headR * 0.8), 'skin', 'jaw_chin');
    jawMesh.position.set(0, -0.03, 0.012);
    face.add(jawMesh);
    this.nodes.jawMesh = jawMesh;
    const chinMesh = this.mesh(new THREE.SphereGeometry(0.026, 16, 12), 'skin', 'jaw_chin');
    chinMesh.position.set(0, -0.088, 0.034);
    face.add(chinMesh);
    this.nodes.chinMesh = chinMesh;

    // Eyes, brows, ears, cheeks (mirrored pairs).
    (['L', 'R'] as const).forEach((side) => {
      const m = side === 'L' ? -1 : 1;
      const eye = this.group(`eye${side}`, face, m * FACE.eyeX, FACE.eyeY, FACE.eyeZ);
      eye.userData.side = side;
      const white = this.mesh(new THREE.SphereGeometry(FACE.eyeR, 20, 14), 'eyeWhite', 'eyes');
      white.scale.z = 0.85;
      eye.add(white);
      const iris = this.mesh(new THREE.SphereGeometry(0.0115, 16, 12), 'iris', 'eyes');
      iris.scale.z = 0.35;
      iris.position.z = 0.0155;
      eye.add(iris);
      const pupil = this.mesh(new THREE.SphereGeometry(0.0052, 12, 8), 'pupil', 'eyes');
      pupil.scale.z = 0.3;
      pupil.position.z = 0.0185;
      eye.add(pupil);
      const lid = this.mesh(new THREE.SphereGeometry(FACE.eyeR * 1.02, 16, 12), 'skin', 'eyes', {raycastable: false});
      eye.add(lid);
      this.nodes[`eyelid${side}`] = lid;

      const brow = this.mesh(new THREE.BoxGeometry(0.04, 0.0068, 0.01), 'brow', 'brows');
      brow.position.set(m * FACE.eyeX, FACE.browY, FACE.browZ);
      brow.userData.side = side;
      face.add(brow);
      this.nodes[`brow${side}`] = brow;

      const earGeo = this.ellipsoid(0.011, 0.024, 0.016);
      const ear = this.mesh(earGeo, 'skin', 'ears');
      ear.position.set(m * FACE.earX, 0.005, 0.012);
      ear.userData.side = side;
      face.add(ear);
      this.nodes[`ear${side}`] = ear;

      const cheek = this.mesh(this.ellipsoid(0.02, 0.016, 0.011), 'skin', 'face_shape', {raycastable: false});
      cheek.position.set(m * 0.052, -0.012, 0.062);
      face.add(cheek);
      this.nodes[`cheekMesh${side}`] = cheek;
    });

    // Nose.
    const nose = this.group('nose', face, 0, FACE.noseY, FACE.noseZ);
    const bridge = this.mesh(new THREE.BoxGeometry(0.018, 0.04, 0.024), 'skin', 'nose');
    bridge.position.set(0, 0.004, 0.002);
    nose.add(bridge);
    this.nodes.noseBridge = bridge;
    const noseTip = this.mesh(new THREE.SphereGeometry(0.0125, 14, 10), 'skin', 'nose');
    noseTip.position.set(0, -0.018, 0.01);
    nose.add(noseTip);
    this.nodes.noseTip = noseTip;

    // Mouth: tube meshes whose geometry is rebuilt parametrically.
    const mouth = this.group('mouth', face, 0, FACE.mouthY, FACE.mouthZ);
    const upperLip = this.mesh(new THREE.BufferGeometry(), 'lip', 'mouth');
    const lowerLip = this.mesh(new THREE.BufferGeometry(), 'lip', 'mouth');
    const mouthInner = this.mesh(this.ellipsoid(0.02, 0.01, 0.006), 'mouthInner', 'mouth', {raycastable: false});
    mouthInner.visible = false;
    mouth.add(upperLip, lowerLip, mouthInner);
    this.nodes.upperLip = upperLip;
    this.nodes.lowerLip = lowerLip;
    this.nodes.mouthInner = mouthInner;

    // Hair: rebuilt parametrically into this group.
    this.group('hairGroup', face, 0, 0, 0);

    // Skin detail decorations.
    const freckles = this.group('freckles', face, 0, 0, 0);
    FRECKLE_SPOTS.forEach(([x, y, z]) => {
      const dot = this.mesh(new THREE.SphereGeometry(0.0022, 6, 4), 'freckle', 'skin_details', {raycastable: false});
      dot.position.set(x, y, z);
      freckles.add(dot);
    });
    const moles = this.group('moles', face, 0, 0, 0);
    MOLE_SPOTS.forEach(([x, y, z]) => {
      const dot = this.mesh(new THREE.SphereGeometry(0.0028, 6, 4), 'freckle', 'skin_details', {raycastable: false});
      dot.position.set(x, y, z);
      moles.add(dot);
    });
    const scar = this.mesh(new THREE.BoxGeometry(0.0035, 0.03, 0.0025), 'scar', 'skin_details', {raycastable: false});
    scar.position.set(-0.038, 0.03, 0.086);
    scar.rotation.z = 0.35;
    face.add(scar);
    this.nodes.scarMesh = scar;
    const blush = this.group('blush', face, 0, 0, 0);
    (['L', 'R'] as const).forEach((side) => {
      const m = side === 'L' ? -1 : 1;
      const disk = this.mesh(new THREE.CircleGeometry(0.016, 18), 'blush', 'skin_details', {raycastable: false});
      disk.position.set(m * 0.046, -0.018, 0.0815);
      disk.rotation.y = m * 0.35;
      blush.add(disk);
    });
  }

  // ─────────── Parametric rebuilds ───────────

  private rebuildMouthIfNeeded(p: {
    width: number; upper: number; lower: number; corner: number; smile: number; open: number;
  }): void {
    const key = [p.width, p.upper, p.lower, p.corner, p.smile, p.open]
      .map((v) => v.toFixed(3)).join('|');
    if (key === this.mouthKey) return;
    this.mouthKey = key;

    const hw = 0.0265 * (1 + 0.32 * p.width + 0.1 * p.smile);
    const cornerY = 0.011 * (p.corner + 0.85 * p.smile);
    const centerY = -0.002 - 0.004 * p.smile;
    const gap = 0.013 * p.open;

    const upperCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-hw, cornerY, 0),
      new THREE.Vector3(0, centerY + 0.004 + gap * 0.25, 0.004),
      new THREE.Vector3(hw, cornerY, 0),
    );
    const lowerCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-hw, cornerY - 0.004 - gap * 0.3, 0),
      new THREE.Vector3(0, centerY - 0.006 - gap, 0.004),
      new THREE.Vector3(hw, cornerY - 0.004 - gap * 0.3, 0),
    );
    const upperR = 0.0042 * (1 + 0.55 * p.upper);
    const lowerR = 0.005 * (1 + 0.55 * p.lower);

    this.swapGeometry(this.nodes.upperLip as THREE.Mesh, new THREE.TubeGeometry(upperCurve, 24, upperR, 10, false));
    this.swapGeometry(this.nodes.lowerLip as THREE.Mesh, new THREE.TubeGeometry(lowerCurve, 24, lowerR, 10, false));

    const inner = this.nodes.mouthInner as THREE.Mesh;
    inner.visible = p.open > 0.08;
    inner.scale.set(1 + 0.3 * p.width, 0.4 + 1.6 * p.open, 1);
    inner.position.y = centerY - 0.002 - gap * 0.5;
  }

  private rebuildHairIfNeeded(shapePreset: string, length: number, volume: number): void {
    const key = `${shapePreset}|${length.toFixed(2)}|${volume.toFixed(2)}`;
    if (key === this.hairKey) return;
    this.hairKey = key;

    const hairGroup = this.nodes.hairGroup as THREE.Group;
    // Drop previous hair meshes entirely (geometry + material + registries).
    [...hairGroup.children].forEach((child) => {
      const mesh = child as THREE.Mesh;
      hairGroup.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.meshZones.delete(mesh);
      this.mats = this.mats.filter((entry) => entry.mesh !== mesh);
      this.geometries = this.geometries.filter((g) => g !== mesh.geometry);
    });

    const v = 1 + 0.18 * volume;
    const capR = M.headR * 1.07;
    const capGeo = new THREE.SphereGeometry(capR, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.49);
    this.perturbHair(capGeo, shapePreset, 0.004);
    const cap = this.mesh(capGeo, 'hair', 'hair');
    cap.scale.set(v, 1 + 0.1 * volume, v);
    // Tip the cap BACK (negative x lifts the +z rim): front rim lands at
    // y ≈ +0.53·r (above the brows), back rim at y ≈ −0.49·r (the nape).
    cap.rotation.x = -0.54;
    cap.position.set(0, 0.01, -0.004);
    hairGroup.add(cap);

    // Short hair is simply a hidden curtain — the cap alone reads as a crop.
    if (length > 0.18) {
      const h = 0.1 + 0.55 * length;
      // Back half only, with the side edges pulled behind the ears so the
      // curtain never flanks the face from a front view.
      const curtainGeo = new THREE.CylinderGeometry(
        M.headR * 1.04,
        M.headR * (0.72 + 0.45 * length),
        h,
        24,
        8,
        true,
        Math.PI * 0.6,
        Math.PI * 0.8,
      );
      this.perturbHair(curtainGeo, shapePreset, 0.007);
      const curtain = this.mesh(curtainGeo, 'hair', 'hair');
      (curtain.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      curtain.position.set(0, -h / 2, -0.012);
      curtain.scale.set(v, 1, v);
      hairGroup.add(curtain);
    }
    // New hair meshes must pick up the current colors right away; the next
    // applyParams() call also refreshes them, but rebuilds happen inside it.
  }

  /** Deterministic radial perturbation that fakes wavy/curly strands. */
  private perturbHair(geo: THREE.BufferGeometry, shapePreset: string, amplitude: number): void {
    if (shapePreset !== 'wavy' && shapePreset !== 'curly') return;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      if (r < 1e-5) continue;
      const theta = Math.atan2(x, z);
      const wave = shapePreset === 'wavy'
        ? Math.sin(y * 52 + theta * 2)
        : Math.sin(y * 90) * Math.sin(theta * 7);
      const r2 = r + amplitude * wave;
      pos.setX(i, (x / r) * r2);
      pos.setZ(i, (z / r) * r2);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  private swapGeometry(mesh: THREE.Mesh, next: THREE.BufferGeometry): void {
    const prev = mesh.geometry;
    mesh.geometry = next;
    this.geometries = this.geometries.filter((g) => g !== prev);
    prev.dispose();
    this.geometries.push(next);
  }
}
