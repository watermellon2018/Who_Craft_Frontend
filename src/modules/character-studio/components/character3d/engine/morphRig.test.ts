import * as THREE from 'three';
import {buildInitialZoneParams} from '../zones';
import {MorphRig} from './morphRig';
import type {ZoneParams} from './rig';

// MorphRig math tests. The rig is plain three.js once the mesh is loaded, so we
// build a synthetic morph mesh (no GLB/network needed) and exercise the same
// public surface the viewport relies on.

// A figure-shaped point cloud: vertices spread from y=0 (feet) to y≈1.7 (head),
// with 10 named shape morph targets (beta00…beta09) like the real body.glb.
function makeMorphMesh(): THREE.Mesh {
  const rows = 18;
  const positions: number[] = [];
  for (let i = 0; i < rows; i++) {
    const y = (i / (rows - 1)) * 1.7;
    // four points around the axis so bounds have width/depth
    positions.push(0.1, y, 0, -0.1, y, 0, 0, y, 0.08, 0, y, -0.08);
  }
  const base = new Float32Array(positions);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));

  // Build 10 morph deltas. beta00 pushes every vertex outward in X (a clear,
  // measurable "widen" signal we can assert on); the rest are small distinct
  // deltas so the dictionary/index wiring is exercised.
  const targets: THREE.BufferAttribute[] = [];
  for (let b = 0; b < 10; b++) {
    const delta = new Float32Array(base.length);
    for (let v = 0; v < base.length; v += 3) {
      if (b === 0) delta[v] = base[v] * 0.5; // widen X proportionally
      else delta[v + 1] = 0.001 * b; // tiny unique Y nudge
    }
    targets.push(new THREE.BufferAttribute(delta, 3));
  }
  geo.morphAttributes.position = targets;

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.morphTargetInfluences = new Array(10).fill(0);
  mesh.morphTargetDictionary = Object.fromEntries(
    targets.map((_, i) => [`beta${String(i).padStart(2, '0')}`, i]),
  );
  return mesh;
}

// An INDEXED tube mesh for the clothing (A5) tests. Band-masking is an indexed
// operation (keep triangles whose 3 vertices are in a Y-band, then compact the
// used vertices), so it must run against a mesh with a real index — like the
// production body.glb — not the non-indexed makeMorphMesh above. Rings of
// `around` points are stacked over `rows` heights and stitched into a tube; one
// morph (beta00) widens the tube radially so we can assert morph tracking.
const TUBE_ROWS = 18;
const TUBE_AROUND = 8;
const TUBE_RADIUS = 0.12;
const TUBE_HEIGHT = 1.7;

function makeIndexedMorphMesh(): THREE.Mesh {
  const positions: number[] = [];
  for (let r = 0; r < TUBE_ROWS; r++) {
    const y = (r / (TUBE_ROWS - 1)) * TUBE_HEIGHT;
    for (let a = 0; a < TUBE_AROUND; a++) {
      const ang = (a / TUBE_AROUND) * Math.PI * 2;
      positions.push(TUBE_RADIUS * Math.cos(ang), y, TUBE_RADIUS * Math.sin(ang));
    }
  }
  const base = new Float32Array(positions);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));

  // Stitch each pair of adjacent rings into two triangles per quad. Many of
  // these triangles span a row boundary, so a band cut genuinely drops the
  // straddling triangles (not just whole rings) — the real masking behavior.
  const index: number[] = [];
  for (let r = 0; r < TUBE_ROWS - 1; r++) {
    for (let a = 0; a < TUBE_AROUND; a++) {
      const a2 = (a + 1) % TUBE_AROUND;
      const v0 = r * TUBE_AROUND + a;
      const v1 = r * TUBE_AROUND + a2;
      const v2 = (r + 1) * TUBE_AROUND + a;
      const v3 = (r + 1) * TUBE_AROUND + a2;
      index.push(v0, v2, v1, v1, v2, v3);
    }
  }
  geo.setIndex(index);

  // 10 morphs; beta00 widens the tube radially (X and Z proportional to base),
  // a clear signal the garment shell must track. The rest are tiny Y nudges.
  const targets: THREE.BufferAttribute[] = [];
  for (let b = 0; b < 10; b++) {
    const delta = new Float32Array(base.length);
    for (let v = 0; v < base.length; v += 3) {
      if (b === 0) {
        delta[v] = base[v] * 0.5;
        delta[v + 2] = base[v + 2] * 0.5;
      } else {
        delta[v + 1] = 0.0005 * b;
      }
    }
    targets.push(new THREE.BufferAttribute(delta, 3));
  }
  geo.morphAttributes.position = targets;

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.morphTargetInfluences = new Array(10).fill(0);
  mesh.morphTargetDictionary = Object.fromEntries(
    targets.map((_, i) => [`beta${String(i).padStart(2, '0')}`, i]),
  );
  return mesh;
}

const withParams = (overrides: Record<string, Record<string, number | string | boolean>>): ZoneParams => {
  const params = buildInitialZoneParams();
  for (const [zone, values] of Object.entries(overrides)) {
    params[zone] = {...params[zone], ...values};
  }
  return params;
};

const makeTubeFaceAnchors = () => ({
  eyeL: [-0.04, 1.5, TUBE_RADIUS] as [number, number, number],
  eyeR: [0.04, 1.5, TUBE_RADIUS] as [number, number, number],
  mouth: [0, 1.43, TUBE_RADIUS] as [number, number, number],
  browL: [-0.05, 1.55, TUBE_RADIUS] as [number, number, number],
  browR: [0.05, 1.55, TUBE_RADIUS] as [number, number, number],
  eyeR_size: 0.02,
});

describe('MorphRig', () => {
  let rig: MorphRig;

  beforeEach(() => {
    rig = MorphRig.fromMesh(makeMorphMesh());
    rig.applyParams(buildInitialZoneParams());
  });

  afterEach(() => rig.dispose());

  it('rejects a mesh without morph targets', () => {
    const bare = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    expect(() => MorphRig.fromMesh(bare)).toThrow(/morph targets/);
  });

  it('starts at the neutral base (all morph influences zero)', () => {
    const mesh = rig.nodeByName('body') as THREE.Mesh;
    mesh.morphTargetInfluences?.forEach((w) => expect(w).toBeCloseTo(0, 6));
  });

  it('drives morph influences from body-shape sliders via the β table', () => {
    const mesh = rig.nodeByName('body') as THREE.Mesh;
    // Broad shoulders → β2 toward shoulders (negative, V-taper) + a little β1.
    rig.applyParams(withParams({shoulders: {shouldersWidth: 1}}));
    const w = mesh.morphTargetInfluences as number[];
    expect(w[2]).toBeLessThan(0); // β2 negative = wider shoulders / V
    expect(w[1]).toBeGreaterThan(0); // β1 slightly up (broad-shouldered bulk)
  });

  it('sums contributions from several sliders into the same β', () => {
    const mesh = rig.nodeByName('body') as THREE.Mesh;
    // chestWidth (β1 +0.7) and chestDepth (β1 +1.2) both push β1 (weight) up.
    rig.applyParams(withParams({torso: {chestWidth: 1, chestDepth: 1}}));
    const both = (mesh.morphTargetInfluences as number[])[1];
    rig.applyParams(withParams({torso: {chestWidth: 1}}));
    const one = (mesh.morphTargetInfluences as number[])[1];
    expect(both).toBeGreaterThan(one);
  });

  it('clamps morph influences to the baked ±1 range', () => {
    const mesh = rig.nodeByName('body') as THREE.Mesh;
    rig.applyParams(
      withParams({
        shoulders: {shouldersWidth: 1},
        torso: {chestWidth: 1, backWidth: 1},
        hips: {hipsWidth: 1},
      }),
    );
    (mesh.morphTargetInfluences as number[]).forEach((wt) => {
      expect(wt).toBeGreaterThanOrEqual(-1);
      expect(wt).toBeLessThanOrEqual(1);
    });
  });

  it('ignores out-of-range slider values (clamped before mapping)', () => {
    const mesh = rig.nodeByName('body') as THREE.Mesh;
    rig.applyParams(withParams({torso: {chestWidth: 99}}));
    const huge = (mesh.morphTargetInfluences as number[])[0];
    rig.applyParams(withParams({torso: {chestWidth: 1}}));
    const maxed = (mesh.morphTargetInfluences as number[])[0];
    expect(huge).toBeCloseTo(maxed, 6);
  });

  it('applies skin color to the shared body material', () => {
    const params = buildInitialZoneParams();
    params.skin_color = {...params.skin_color, skinTone: '#cc8844'};
    rig.applyParams(params);
    const mat = (rig.nodeByName('body') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(mat.color.getHexString()).toBe('cc8844');
  });

  it('maps the body mesh back to a zone and reports no side', () => {
    const mesh = rig.nodeByName('body') as THREE.Object3D;
    expect(rig.resolveZoneFromObject(mesh)).toBe('body');
    // SMPL body is one mesh — asymmetric editing is unsupported (always null).
    expect(rig.resolveSideFromObject()).toBeNull();
  });

  it('zoneBounds returns the whole figure for body/skin and a band for a part', () => {
    rig.root.updateMatrixWorld(true);
    const whole = rig.zoneBounds('body');
    expect(whole).not.toBeNull();
    const wholeH = (whole as THREE.Box3).max.y - (whole as THREE.Box3).min.y;
    expect(wholeH).toBeGreaterThan(1.5);

    const legs = rig.zoneBounds('legs');
    expect(legs).not.toBeNull();
    // The legs band sits in the lower half — its top is well below the head.
    expect((legs as THREE.Box3).max.y).toBeLessThan(wholeH * 0.6);
  });

  it('outlines the whole body for any body-subtree zone', () => {
    rig.setHighlight(null, 'torso');
    const sel = rig.highlightedMeshes();
    expect(sel.selected).toHaveLength(1);
    expect(sel.hovered).toHaveLength(0);

    rig.setHighlight('hips', null);
    const hov = rig.highlightedMeshes();
    expect(hov.hovered).toHaveLength(1);
    expect(hov.selected).toHaveLength(0);
  });

  it('outlines the whole body mesh for a face zone (SMPL-X is one mesh)', () => {
    // The face is part of the single SMPL-X mesh, so selecting a face zone
    // outlines the whole figure (a single mesh can't be sub-outlined).
    rig.setHighlight(null, 'eyes');
    const {selected, hovered} = rig.highlightedMeshes();
    expect(selected).toHaveLength(1);
    expect(hovered).toHaveLength(0);
  });

  it('produces finite influences for every numeric parameter maxed', () => {
    const params = buildInitialZoneParams();
    for (const [zoneId, values] of Object.entries(params)) {
      for (const [paramId, value] of Object.entries(values)) {
        if (typeof value === 'number') params[zoneId][paramId] = 1;
      }
    }
    rig.applyParams(params);
    const mesh = rig.nodeByName('body') as THREE.Mesh;
    (mesh.morphTargetInfluences as number[]).forEach((w) => expect(Number.isFinite(w)).toBe(true));
  });

  it('tick is a no-op that never throws (SMPL-X face has no driven idle yet)', () => {
    expect(() => rig.tick()).not.toThrow();
  });

  it('builds SMPL-native hair shells on the head surface', () => {
    const r = MorphRig.fromMesh(makeIndexedMorphMesh(), makeTubeFaceAnchors());
    r.applyParams(buildInitialZoneParams());

    const body = r.nodeByName('smpl_body') as THREE.Mesh;
    expect(body.isMesh).toBe(true);
    const hairAnchor = r.root.getObjectByName('smpl_hair_anchor');
    expect(hairAnchor).toBeTruthy();

    const cap = r.nodeByName('hair_cap') as THREE.Mesh;
    const bangs = r.nodeByName('hair_bangs') as THREE.Mesh;
    const back = r.nodeByName('hair_back') as THREE.Mesh;
    const sides = r.nodeByName('hair_sides') as THREE.Mesh;
    for (const mesh of [cap, bangs, back, sides]) {
      expect(mesh?.isMesh).toBe(true);
      expect(mesh.userData.zoneId).toBe('hair');
      expect(mesh.visible).toBe(true);
      expect((mesh.geometry.getIndex() as THREE.BufferAttribute).count).toBeGreaterThan(0);
    }

    cap.geometry.computeBoundingBox();
    const capBox = cap.geometry.boundingBox as THREE.Box3;
    expect(capBox.min.y).toBeGreaterThan(TUBE_HEIGHT * 0.78);
    expect(capBox.max.y).toBeLessThanOrEqual(TUBE_HEIGHT + 0.05);

    r.setHighlight(null, 'hair');
    expect(r.highlightedMeshes().selected).toEqual(expect.arrayContaining([cap, bangs, back, sides]));
    expect(r.resolveZoneFromObject(cap)).toBe('hair');
    r.dispose();
  });

  it('keeps SMPL-native hair shells off the anchored face', () => {
    const anchors = makeTubeFaceAnchors();
    const r = MorphRig.fromMesh(makeIndexedMorphMesh(), anchors);

    r.applyParams(withParams({hair: {hairStyle: 'long', hairLength: 1, hairVolume: 0}}));

    const bangs = r.nodeByName('hair_bangs') as THREE.Mesh;
    expect((bangs.geometry.getIndex() as THREE.BufferAttribute).count).toBeGreaterThan(0);
    bangs.geometry.computeBoundingBox();
    const box = bangs.geometry.boundingBox as THREE.Box3;
    expect(box.min.y).toBeGreaterThan(anchors.browL[1] - 0.035);
    r.dispose();
  });

  it('drives SMPL hair shell color, style, length and volume from hair params', () => {
    const r = MorphRig.fromMesh(makeIndexedMorphMesh());
    const cap = r.nodeByName('hair_cap') as THREE.Mesh;
    const back = r.nodeByName('hair_back') as THREE.Mesh;

    r.applyParams(withParams({hair: {hairStyle: 'long', hairLength: 0, hairColor: '#6d3f24', hairVolume: 0}}));
    back.geometry.computeBoundingBox();
    const shortMinY = (back.geometry.boundingBox as THREE.Box3).min.y;
    expect((cap.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('6d3f24');

    r.applyParams(withParams({hair: {hairStyle: 'long', hairLength: 1, hairColor: '#6d3f24', hairVolume: 1}}));
    back.geometry.computeBoundingBox();
    const longMinY = (back.geometry.boundingBox as THREE.Box3).min.y;
    cap.geometry.computeBoundingBox();
    expect(longMinY).toBeLessThan(shortMinY);
    expect((cap.geometry.boundingBox as THREE.Box3).max.y).toBeGreaterThan(TUBE_HEIGHT);

    r.applyParams(withParams({hair: {hairStyle: 'none'}}));
    expect(cap.visible).toBe(false);
    r.setHighlight(null, 'hair');
    expect(r.highlightedMeshes().selected).toHaveLength(0);
    r.dispose();
  });

  it('adds layered eyes (sclera/iris/pupil) + lip tint from baked anchors', () => {
    const anchors = {
      eyeL: [-0.03, 1.61, 0.073] as [number, number, number],
      eyeR: [0.03, 1.61, 0.073] as [number, number, number],
      mouth: [0, 1.546, 0.094] as [number, number, number],
      browL: [-0.037, 1.632, 0.072] as [number, number, number],
      browR: [0.037, 1.632, 0.072] as [number, number, number],
      eyeR_size: 0.022,
    };
    const r = MorphRig.fromMesh(makeMorphMesh(), anchors);
    r.applyParams(withParams({eyes: {eyeColor: '#244a2a'}}));
    const overlay = r.root.getObjectByName('smpl_face_overlay');
    expect(overlay).toBeTruthy();
    // Per eye: sclera + iris + pupil = 3 layers × 2 eyes + 1 lip = 7 meshes.
    let meshes = 0;
    overlay?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes += 1;
    });
    expect(meshes).toBe(7);
    // Eye color applied to the iris material.
    let irisColored = false;
    overlay?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial).color.getHexString() === '244a2a') {
        irisColored = true;
      }
    });
    expect(irisColored).toBe(true);
    r.dispose();
  });


  it('deforms only the SMPL face region from Sims-style face controls', () => {
    const r = MorphRig.fromMesh(makeIndexedMorphMesh(), makeTubeFaceAnchors());
    const body = r.nodeByName('body') as THREE.Mesh;
    const position = body.geometry.getAttribute('position') as THREE.BufferAttribute;
    const base = Float32Array.from(position.array as ArrayLike<number>);

    r.applyParams(withParams({
      face_shape: {shape: 'heart', cheekbones: 1, faceDepth: 1},
      jaw_chin: {jawWidth: 1, chinLength: 1, chinShape: 1},
      nose: {noseLength: 1, noseWidth: 1, noseTip: 1, bridgeHeight: 1},
      mouth: {mouthWidth: 1, upperLip: 1, lowerLip: 1, cornerLift: 1},
    }));

    let changedFaceVertices = 0;
    for (let vertex = 0; vertex < position.count; vertex++) {
      const offset = vertex * 3;
      const delta = Math.hypot(
        position.getX(vertex) - base[offset],
        position.getY(vertex) - base[offset + 1],
        position.getZ(vertex) - base[offset + 2],
      );
      if (base[offset + 1] > 1.3 && delta > 1e-7) changedFaceVertices += 1;
      if (base[offset + 1] < 1.2) expect(delta).toBeLessThan(1e-7);
    }
    expect(changedFaceVertices).toBeGreaterThan(0);
    expect(Array.from(position.array).every(Number.isFinite)).toBe(true);

    r.applyParams(buildInitialZoneParams());
    expect(Array.from(position.array)).toEqual(Array.from(base));
    r.dispose();
  });

  it('uses profile-derived nose projection to move real nose vertices forward', () => {
    const anchors = makeTubeFaceAnchors();
    const r = MorphRig.fromMesh(makeIndexedMorphMesh(), anchors);
    const body = r.nodeByName('body') as THREE.Mesh;
    const position = body.geometry.getAttribute('position') as THREE.BufferAttribute;
    const noseY = anchors.mouth[1] + (anchors.eyeL[1] - anchors.mouth[1]) * 0.46;
    let noseVertex = 0;
    let best = Infinity;
    for (let vertex = 0; vertex < position.count; vertex++) {
      const score = Math.abs(position.getX(vertex)) + Math.abs(position.getY(vertex) - noseY)
        + Math.abs(position.getZ(vertex) - TUBE_RADIUS);
      if (score < best) {
        best = score;
        noseVertex = vertex;
      }
    }
    const before = position.getZ(noseVertex);
    r.applyParams(withParams({nose: {noseTip: 1}}));
    expect(position.getZ(noseVertex)).toBeGreaterThan(before);
    r.dispose();
  });

  it('moves the eye and lip geometry with extracted face controls', () => {
    const r = MorphRig.fromMesh(makeIndexedMorphMesh(), makeTubeFaceAnchors());
    const overlay = r.root.getObjectByName('smpl_face_overlay') as THREE.Group;
    const eyes = overlay.children.filter((child): child is THREE.Group => child.type === 'Group');
    const lips = overlay.children.find((child) => child.type === 'Mesh') as THREE.Mesh;
    expect(eyes).toHaveLength(2);
    expect(lips).toBeDefined();
    const beforeX = eyes.map((eye) => Math.abs(eye.position.x));
    const beforeEyeZ = eyes.map((eye) => eye.position.z);
    const beforeLipZ = lips.position.z;

    r.applyParams(withParams({
      eyes: {eyeDistance: 1, eyeSize: 1, eyeTilt: 1},
      face_shape: {faceDepth: 1},
      mouth: {upperLip: 1, lowerLip: 1},
    }));

    eyes.forEach((eye, index) => {
      expect(Math.abs(eye.position.x)).toBeGreaterThan(beforeX[index]);
      expect(eye.position.z).toBeGreaterThan(beforeEyeZ[index]);
      expect(eye.scale.x).toBeGreaterThan(1);
      expect(Math.abs(eye.rotation.z)).toBeGreaterThan(0);
    });
    expect(lips.position.z).toBeGreaterThan(beforeLipZ);
    r.dispose();
  });
});

// ─────────── Clothing (A5) ───────────
//
// The garment is a thickened, band-masked copy of the body surface that tracks
// the shape morphs. These run against an INDEXED tube (band-masking needs an
// index, like the real body.glb). We assert the MATH — masking, the normal
// standoff, morph tracking, select/color/visibility, dispose, no-NaN — which is
// what jsdom can verify; the garment SILHOUETTE is the user's to judge (no WebGL
// preview here). Concavity poke-through is a documented v1 limit, not asserted.

// The band fractions the rig cuts each garment from (must mirror morphRig.ts).
const TOP_BAND = {yLo: 0.55, yHi: 0.88};
const BOTTOM_BAND = {yLo: 0.34, yHi: 0.56};

// Live morphed body position for a vertex: base + Σ influenceᵢ·deltaᵢ — the same
// reconstruction the rig does, so we can assert the shell sits ~thick off it.
function morphedBodyPos(mesh: THREE.Mesh, vid: number): THREE.Vector3 {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const out = new THREE.Vector3(pos.getX(vid), pos.getY(vid), pos.getZ(vid));
  const deltas = mesh.geometry.morphAttributes.position ?? [];
  const infl = mesh.morphTargetInfluences ?? [];
  for (let i = 0; i < deltas.length; i++) {
    const w = infl[i];
    if (!w) continue;
    out.x += w * deltas[i].getX(vid);
    out.y += w * deltas[i].getY(vid);
    out.z += w * deltas[i].getZ(vid);
  }
  return out;
}

const isFiniteArray = (a: ArrayLike<number>): boolean => {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
  return true;
};

// Test-only access to a garment's internal slot (the body-vertex map + standoff)
// so we can assert the shell against the live morphed surface. Throws (failing
// the test clearly) if the garment is missing, which also narrows the type.
interface GarmentSlotProbe {
  id: string;
  localToBodyVid: Int32Array;
  thick: number;
}
function garmentSlot(r: MorphRig, id: string): GarmentSlotProbe {
  const slots = (r as unknown as {garments: GarmentSlotProbe[]}).garments;
  const slot = slots.find((g) => g.id === id);
  if (!slot) throw new Error(`garment slot not found: ${id}`);
  return slot;
}

describe('MorphRig clothing (A5)', () => {
  let body: THREE.Mesh;
  let rig: MorphRig;

  beforeEach(() => {
    body = makeIndexedMorphMesh();
    rig = MorphRig.fromMesh(body);
    rig.applyParams(buildInitialZoneParams());
  });

  afterEach(() => rig.dispose());

  it('builds a top and bottom garment mesh, each named and zone-tagged', () => {
    const top = rig.nodeByName('clothing_top') as THREE.Mesh;
    const bottom = rig.nodeByName('clothing_bottom') as THREE.Mesh;
    expect(top?.isMesh).toBe(true);
    expect(bottom?.isMesh).toBe(true);
    expect(top.userData.zoneId).toBe('clothing_top');
    expect(bottom.userData.zoneId).toBe('clothing_bottom');
    // Each kept a non-empty subset of the body's triangles.
    expect((top.geometry.getIndex() as THREE.BufferAttribute).count % 3).toBe(0);
    expect((top.geometry.getIndex() as THREE.BufferAttribute).count).toBeGreaterThan(0);
    expect((bottom.geometry.getIndex() as THREE.BufferAttribute).count).toBeGreaterThan(0);
    // The garment is a strict subset of the body's faces (masking removed some).
    const bodyTris = (body.geometry.getIndex() as THREE.BufferAttribute).count;
    expect((top.geometry.getIndex() as THREE.BufferAttribute).count).toBeLessThan(bodyTris);
  });

  it('keeps only vertices inside the garment band (masking by fraction)', () => {
    const top = rig.nodeByName('clothing_top') as THREE.Mesh;
    const minY = TUBE_HEIGHT * (0 / (TUBE_ROWS - 1)); // 0
    const maxY = TUBE_HEIGHT; // top ring
    const h = maxY - minY;
    const topPos = top.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Every garment vertex (already offset along its normal) sits within the
    // band's Y range, give or take the small standoff — i.e. masking excluded
    // head/leg verts. We check Y fraction against the top band with a margin
    // for the outward offset (which is mostly radial here, so Y barely shifts).
    for (let v = 0; v < topPos.count; v++) {
      const frac = (topPos.getY(v) - minY) / h;
      expect(frac).toBeGreaterThanOrEqual(TOP_BAND.yLo - 0.05);
      expect(frac).toBeLessThanOrEqual(TOP_BAND.yHi + 0.05);
    }
    // And the bottom band is strictly lower than the top band.
    const bottom = rig.nodeByName('clothing_bottom') as THREE.Mesh;
    const botPos = bottom.geometry.getAttribute('position') as THREE.BufferAttribute;
    let botMaxFrac = -Infinity;
    for (let v = 0; v < botPos.count; v++) {
      botMaxFrac = Math.max(botMaxFrac, (botPos.getY(v) - minY) / h);
    }
    expect(botMaxFrac).toBeLessThanOrEqual(BOTTOM_BAND.yHi + 0.05);
  });

  it('offsets each garment vertex ~thickness off the body surface (hugs + standoff)', () => {
    const top = rig.nodeByName('clothing_top') as THREE.Mesh;
    const topPos = top.geometry.getAttribute('position') as THREE.BufferAttribute;
    // For a radially-symmetric tube, the shell radius exceeds the body radius by
    // the standoff. Compare the garment's mean radius to the body's tube radius.
    let sumR = 0;
    for (let v = 0; v < topPos.count; v++) {
      sumR += Math.hypot(topPos.getX(v), topPos.getZ(v));
    }
    const meanR = sumR / topPos.count;
    // Body tube radius is TUBE_RADIUS; the shell should be ~thickness (0.012)
    // larger (the normal on a vertical tube is purely radial).
    expect(meanR).toBeGreaterThan(TUBE_RADIUS + 0.006);
    expect(meanR).toBeLessThan(TUBE_RADIUS + 0.03);
  });

  it('tracks the body shape morphs: garment re-derives from the LIVE morphed surface', () => {
    const slot = garmentSlot(rig, 'clothing_bottom');

    const bottom = rig.nodeByName('clothing_bottom') as THREE.Mesh;
    const widthOf = (m: THREE.Mesh): number => {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox as THREE.Box3;
      return b.max.x - b.min.x;
    };
    const widthNeutral = widthOf(bottom);

    // Drive the body's radial-widen morph (beta00) and re-derive the garments —
    // the same path applyParams takes once it has written the body influences.
    (body.morphTargetInfluences as number[]).fill(0);
    (body.morphTargetInfluences as number[])[0] = 0.9;
    (rig as unknown as {updateGarments: () => void}).updateGarments();

    // The garment widened with the body.
    expect(widthOf(bottom)).toBeGreaterThan(widthNeutral);

    // And every shell vertex sits ~thick off the NEW morphed body surface — i.e.
    // it re-derived from the live morph, not the rest pose.
    const botPos = bottom.geometry.getAttribute('position') as THREE.BufferAttribute;
    let maxErr = 0;
    for (let l = 0; l < botPos.count; l++) {
      const bodyP = morphedBodyPos(body, slot.localToBodyVid[l]);
      const shellP = new THREE.Vector3(botPos.getX(l), botPos.getY(l), botPos.getZ(l));
      maxErr = Math.max(maxErr, Math.abs(shellP.distanceTo(bodyP) - slot.thick));
    }
    expect(maxErr).toBeLessThan(1e-3);
  });

  it('outlines / resolves / colors / toggles a clothing zone', () => {
    const top = rig.nodeByName('clothing_top') as THREE.Mesh;
    // Select → outline the garment mesh only (not the whole body).
    rig.setHighlight(null, 'clothing_top');
    const sel = rig.highlightedMeshes();
    expect(sel.selected).toEqual([top]);
    expect(sel.hovered).toHaveLength(0);
    // Raycast hit on the garment resolves to its zone.
    expect(rig.resolveZoneFromObject(top)).toBe('clothing_top');
    // Color from the palette.
    rig.applyParams(withParams({clothing_top: {color: '#6b3b3b'}}));
    expect((top.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('6b3b3b');
    // Toggle off → hidden and nothing to outline.
    rig.applyParams(withParams({clothing_top: {enabled: false}}));
    expect(top.visible).toBe(false);
    rig.setHighlight(null, 'clothing_top');
    expect(rig.highlightedMeshes().selected).toHaveLength(0);
    // Toggle back on → visible again.
    rig.applyParams(withParams({clothing_top: {enabled: true}}));
    expect(top.visible).toBe(true);
  });

  it('garments default to ENABLED (a fresh character is dressed)', () => {
    // buildInitialZoneParams() (the neutral state applied in beforeEach) leaves
    // both garments visible, because the clothing 'enabled' toggle defaults true.
    expect((rig.nodeByName('clothing_top') as THREE.Mesh).visible).toBe(true);
    expect((rig.nodeByName('clothing_bottom') as THREE.Mesh).visible).toBe(true);
  });

  it('produces finite, deterministic garment geometry', () => {
    const top = rig.nodeByName('clothing_top') as THREE.Mesh;
    const read = (): Float32Array => {
      const p = top.geometry.getAttribute('position') as THREE.BufferAttribute;
      return Float32Array.from(p.array as Float32Array);
    };
    rig.applyParams(withParams({hips: {hipsWidth: 1}, torso: {chestDepth: 1}}));
    const once = read();
    expect(isFiniteArray(once)).toBe(true);
    expect(isFiniteArray((top.geometry.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array)).toBe(true);
    // Same params → byte-identical positions (no Math.random, deterministic).
    rig.applyParams(withParams({hips: {hipsWidth: 1}, torso: {chestDepth: 1}}));
    const twice = read();
    expect(Array.from(twice)).toEqual(Array.from(once));
  });

  it('disposes garment geometry and material', () => {
    const top = rig.nodeByName('clothing_top') as THREE.Mesh;
    const bottom = rig.nodeByName('clothing_bottom') as THREE.Mesh;
    const spies = [top.geometry, top.material, bottom.geometry, bottom.material].map((o) =>
      jest.spyOn(o as {dispose: () => void}, 'dispose'),
    );
    rig.dispose();
    spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
  });

  it('handles a non-indexed body (synthesizes a trivial index, no crash)', () => {
    // The real body.glb is indexed, but the rig must not throw on a non-indexed
    // mesh — it falls back to grouping consecutive vertices into triangles.
    const r = MorphRig.fromMesh(makeMorphMesh());
    expect(() => r.applyParams(buildInitialZoneParams())).not.toThrow();
    const top = r.nodeByName('clothing_top') as THREE.Mesh;
    expect(top?.isMesh).toBe(true);
    const p = (top.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    expect(isFiniteArray(p)).toBe(true);
    r.dispose();
  });
});
