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

const withParams = (overrides: Record<string, Record<string, number | string | boolean>>): ZoneParams => {
  const params = buildInitialZoneParams();
  for (const [zone, values] of Object.entries(overrides)) {
    params[zone] = {...params[zone], ...values};
  }
  return params;
};

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

  it('has exactly one body mesh and grafts hair onto the head', () => {
    // The body is a single SMPL-X mesh (its face is intrinsic); the only other
    // meshes are the borrowed hairstyle (A4) seated on the crown.
    const body = rig.nodeByName('smpl_body') as THREE.Mesh;
    expect(body.isMesh).toBe(true);
    const hairAnchor = rig.root.getObjectByName('smpl_hair_anchor');
    expect(hairAnchor).toBeTruthy();
    let hairMeshes = 0;
    hairAnchor?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) hairMeshes += 1;
    });
    expect(hairMeshes).toBeGreaterThan(0);
  });

  it('adds live-colored face overlays (iris/lips/brows) from baked anchors', () => {
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
    // 2 iris + 1 lip = 3 overlay meshes (no brow overlay — SMPL-X has no brow
    // geometry to sit on, so painted arcs would read as stuck-on).
    let meshes = 0;
    overlay?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes += 1;
    });
    expect(meshes).toBe(3);
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
});
