import * as THREE from 'three';
import {buildInitialZoneParams, ZONE_INDEX} from '../zones';
import {CharacterRig, ZoneParams} from './rig';
import {DRAG_BINDINGS} from './dragBindings';
import {resolveSelectableZone} from './zoneSelection';
import {collapseSideOverrides, mergeSavedParams} from './paramMerge';

// Engine math tests: the rig is plain three.js (no WebGL needed), so the
// geometry/transform contract is verifiable in jsdom.

const bounds = (rig: CharacterRig, zoneId: string): THREE.Box3 => {
  rig.root.updateMatrixWorld(true);
  const box = rig.zoneBounds(zoneId);
  expect(box).not.toBeNull();
  return box as THREE.Box3;
};

const withParams = (overrides: Record<string, Record<string, number | string | boolean>>): ZoneParams => {
  const params = buildInitialZoneParams();
  for (const [zone, values] of Object.entries(overrides)) {
    params[zone] = {...params[zone], ...values};
  }
  return params;
};

describe('CharacterRig', () => {
  let rig: CharacterRig;

  beforeEach(() => {
    rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
  });

  afterEach(() => {
    rig.dispose();
  });

  it('builds a human-sized figure standing on the floor', () => {
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.root);
    const height = box.max.y - box.min.y;
    expect(height).toBeGreaterThan(1.55);
    expect(height).toBeLessThan(2.0);
    expect(box.min.y).toBeGreaterThan(-0.05);
    expect(box.min.y).toBeLessThan(0.05);
  });

  it('chestWidth widens the chest and clamps outside [-1, 1]', () => {
    // Torso params rebuild the loft geometry, so measure real bounds.
    const width = () => {
      const box = bounds(rig, 'torso');
      return box.max.x - box.min.x;
    };
    rig.applyParams(withParams({torso: {chestWidth: 0}}));
    const base = width();
    rig.applyParams(withParams({torso: {chestWidth: 1}}));
    const widened = width();
    expect(widened).toBeGreaterThan(base + 0.02);
    rig.applyParams(withParams({torso: {chestWidth: 5}}));
    expect(width()).toBeCloseTo(widened, 4);
  });

  it('keeps torso lofts continuous at part boundaries', () => {
    rig.applyParams(withParams({waist: {waistWidth: 0.6, torsoCurve: 0.5}, hips: {hipsWidth: 0.4}}));
    rig.root.updateMatrixWorld(true);
    // Bottom ring of the waist loft must match the top ring of the hips
    // loft (shared boundary ring) — compare world-space extents at the seam.
    const waistBox = bounds(rig, 'waist');
    const hipsBox = bounds(rig, 'hips');
    expect(Math.abs(waistBox.min.y - hipsBox.max.y)).toBeLessThan(1e-3);

    const chestBox = bounds(rig, 'torso');
    expect(Math.abs(chestBox.min.y - waistBox.max.y)).toBeLessThan(1e-3);
  });

  it('rebuilds torso geometry only when its parameters change', () => {
    const chest = rig.nodeByName('chestMesh') as THREE.Mesh;
    rig.applyParams(withParams({torso: {chestWidth: 0.5}}));
    const geo = chest.geometry;
    rig.applyParams(withParams({torso: {chestWidth: 0.5}, eyes: {eyeSize: 0.7}}));
    expect(chest.geometry).toBe(geo);
    rig.applyParams(withParams({torso: {chestWidth: 0.8}}));
    expect(chest.geometry).not.toBe(geo);
  });

  it('idle tick breathes without breaking parameter scales', () => {
    const chest = rig.nodeByName('chestMesh') as THREE.Mesh;
    rig.tick(0.5);
    expect(chest.scale.y).toBeGreaterThan(0.99);
    expect(chest.scale.y).toBeLessThan(1.02);
    rig.root.updateMatrixWorld(true);
    rig.root.traverse((obj) => {
      obj.matrixWorld.elements.forEach((el) => expect(Number.isFinite(el)).toBe(true));
    });
  });

  it('keeps feet on the floor when legs are stretched', () => {
    rig.applyParams(withParams({thigh: {thighLength: 1}, calf: {calfLength: 1}}));
    const foot = bounds(rig, 'foot');
    expect(Math.abs(foot.min.y)).toBeLessThan(0.06);
    rig.root.updateMatrixWorld(true);
    const total = new THREE.Box3().setFromObject(rig.root);
    expect(total.max.y - total.min.y).toBeGreaterThan(1.7);
  });

  it('mirrors symmetric eye tilt between left and right', () => {
    rig.applyParams(withParams({eyes: {eyeTilt: 0.8}}));
    const left = rig.nodeByName('eyeL') as THREE.Object3D;
    const right = rig.nodeByName('eyeR') as THREE.Object3D;
    expect(left.rotation.z).not.toBeCloseTo(0, 5);
    expect(left.rotation.z).toBeCloseTo(-right.rotation.z, 6);
  });

  it('applies per-side overrides (`id__L` / `id__R`) to one half only', () => {
    rig.applyParams(withParams({upper_arm: {length: 0, length__L: 1}}));
    const leftEnd = rig.nodeByName('upperArmLEnd') as THREE.Object3D;
    const rightEnd = rig.nodeByName('upperArmREnd') as THREE.Object3D;
    expect(leftEnd.position.y).toBeLessThan(rightEnd.position.y - 0.02);

    rig.applyParams(withParams({eyes: {eyeTilt: 0, eyeTilt__R: 0.9}}));
    const leftEye = rig.nodeByName('eyeL') as THREE.Object3D;
    const rightEye = rig.nodeByName('eyeR') as THREE.Object3D;
    expect(leftEye.rotation.z).toBeCloseTo(0, 6);
    expect(Math.abs(rightEye.rotation.z)).toBeGreaterThan(0.1);
  });

  it('keeps the figure standing on the longer leg with asymmetric lengths', () => {
    rig.applyParams(withParams({thigh: {thighLength: 0, thighLength__L: 1}}));
    rig.root.updateMatrixWorld(true);
    const total = new THREE.Box3().setFromObject(rig.root);
    expect(total.min.y).toBeGreaterThan(-0.05);
  });

  it('resolves the grabbed side from intersected objects', () => {
    const leftArmMesh = rig.nodeByName('upperArmLMesh') as THREE.Object3D;
    const rightEye = rig.nodeByName('eyeR') as THREE.Object3D;
    expect(rig.resolveSideFromObject(leftArmMesh)).toBe('L');
    expect(rig.resolveSideFromObject(rightEye)).toBe('R');
    expect(rig.resolveSideFromObject(rig.nodeByName('chestMesh') as THREE.Object3D)).toBeNull();
  });

  it('never tints the iris/pupil with the selection glow', () => {
    rig.setHighlight(null, 'eyes');
    let glowing = 0;
    let dark = 0;
    rig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.zoneId !== 'eyes') return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity > 0) glowing++;
      else dark++;
    });
    expect(glowing).toBeGreaterThan(0);
    // Iris + pupil on both sides stay glow-free so the picked color reads true.
    expect(dark).toBeGreaterThanOrEqual(4);
  });

  it('produces no NaN transforms with every numeric parameter maxed', () => {
    const params = buildInitialZoneParams();
    for (const [zoneId, values] of Object.entries(params)) {
      for (const [paramId, value] of Object.entries(values)) {
        if (typeof value === 'number') params[zoneId][paramId] = 1;
        if (typeof value === 'boolean') params[zoneId][paramId] = true;
      }
    }
    rig.applyParams(params);
    rig.root.updateMatrixWorld(true);
    rig.root.traverse((obj) => {
      obj.matrixWorld.elements.forEach((el) => expect(Number.isFinite(el)).toBe(true));
    });
  });

  it('maps intersected meshes back to their zone', () => {
    let torsoMesh: THREE.Object3D | null = null;
    rig.root.traverse((obj) => {
      if (!torsoMesh && obj.userData.zoneId === 'torso') torsoMesh = obj;
    });
    expect(torsoMesh).not.toBeNull();
    expect(rig.resolveZoneFromObject(torsoMesh)).toBe('torso');
  });

  it('highlights the selected zone subtree and nothing else', () => {
    rig.setHighlight(null, 'eyes');
    let eyeGlow = 0;
    let torsoGlow = 0;
    rig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.userData.zoneId === 'eyes') eyeGlow = Math.max(eyeGlow, mat.emissiveIntensity);
      if (mesh.userData.zoneId === 'torso') torsoGlow = Math.max(torsoGlow, mat.emissiveIntensity);
    });
    expect(eyeGlow).toBeGreaterThan(0);
    expect(torsoGlow).toBe(0);
  });

  it('rebuilds hair for each shape preset without leaking NaN geometry', () => {
    for (const shapePreset of ['straight', 'wavy', 'curly']) {
      rig.applyParams(withParams({hair: {hairShape: shapePreset, hairLength: 0.9, hairVolume: 0.5}}));
      const hair = rig.nodeByName('hairGroup') as THREE.Group;
      expect(hair.children.length).toBeGreaterThan(0);
      hair.children.forEach((child) => {
        const pos = (child as THREE.Mesh).geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          expect(Number.isFinite(pos.getX(i))).toBe(true);
        }
      });
    }
  });
});

describe('DRAG_BINDINGS', () => {
  it('only references zones and parameters that exist in the registry', () => {
    for (const [zoneId, binding] of Object.entries(DRAG_BINDINGS)) {
      const zone = ZONE_INDEX[zoneId];
      expect(zone).toBeDefined();
      const paramIds = (zone.parameters ?? []).map((p) => p.id);
      if (binding.x) expect(paramIds).toContain(binding.x);
      if (binding.y) expect(paramIds).toContain(binding.y);
    }
  });
});

describe('resolveSelectableZone', () => {
  it('resolves to top-level silhouettes when nothing is selected', () => {
    expect(resolveSelectableZone('calf', null, [])).toBe('body');
    expect(resolveSelectableZone('eyes', null, [])).toBe('face');
  });

  it('drills into level-2 siblings once inside a group', () => {
    expect(resolveSelectableZone('calf', 'body', ['body'])).toBe('legs');
    expect(resolveSelectableZone('nose', 'eyes', ['face', 'eyes'])).toBe('nose');
  });

  it('keeps the current selection when re-hitting its own subtree', () => {
    expect(resolveSelectableZone('calf', 'legs', ['body', 'legs'])).toBe('legs');
    expect(resolveSelectableZone('eyes', 'eyes', ['face', 'eyes'])).toBe('eyes');
  });

  it('keeps a panel-selected level-3 zone targetable for hover/drag', () => {
    expect(resolveSelectableZone('thigh', 'thigh', ['body', 'legs', 'thigh'])).toBe('thigh');
  });
});

describe('mergeSavedParams', () => {
  it('overlays saved values onto defaults with clamping', () => {
    const merged = mergeSavedParams({torso: {chestWidth: 7}, eyes: {eyeColor: '#244a2a'}});
    expect(merged.torso.chestWidth).toBe(1);
    expect(merged.eyes.eyeColor).toBe('#244a2a');
    // Untouched parameters keep their registry defaults.
    expect(merged.hair.hairLength).toBe(0.5);
  });

  it('drops unknown zones, unknown params and invalid preset values', () => {
    const merged = mergeSavedParams({
      bogus_zone: {anything: 1},
      face_shape: {shape: 'dodecahedron', cheekbones: 0.4},
      hair: {hairShape: 'wavy'},
    });
    expect((merged as Record<string, unknown>).bogus_zone).toBeUndefined();
    expect(merged.face_shape.shape).toBe('oval');
    expect(merged.face_shape.cheekbones).toBe(0.4);
    expect(merged.hair.hairShape).toBe('wavy');
  });

  it('ignores non-object payloads', () => {
    expect(mergeSavedParams(null)).toEqual(buildInitialZoneParams());
    expect(mergeSavedParams([1, 2])).toEqual(buildInitialZoneParams());
  });

  it('keeps per-side overrides for numeric params, clamped', () => {
    const merged = mergeSavedParams({
      upper_arm: {length: 0.2, length__L: 7, volume__R: -0.4},
      eyes: {eyeColor__L: '#fff'},
    });
    expect(merged.upper_arm.length__L).toBe(1);
    expect(merged.upper_arm.volume__R).toBe(-0.4);
    // Side overrides exist only for numeric params — not for swatches.
    expect((merged.eyes as Record<string, unknown>).eyeColor__L).toBeUndefined();
  });
});

describe('collapseSideOverrides', () => {
  it('folds the kept side into the shared value and drops overrides', () => {
    const params = buildInitialZoneParams();
    params.upper_arm = {...params.upper_arm, length: 0.1, length__L: 0.8, length__R: -0.5};
    const collapsed = collapseSideOverrides(params, 'upper_arm', 'L');
    expect(collapsed.upper_arm.length).toBe(0.8);
    expect(collapsed.upper_arm.length__L).toBeUndefined();
    expect(collapsed.upper_arm.length__R).toBeUndefined();
  });

  it('returns the params untouched when the zone has no overrides', () => {
    const params = buildInitialZoneParams();
    expect(collapseSideOverrides(params, 'upper_arm', 'L')).toBe(params);
  });
});
