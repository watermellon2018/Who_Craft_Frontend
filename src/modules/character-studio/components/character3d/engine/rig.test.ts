import * as THREE from 'three';
import {buildInitialZoneParams, ZONE_INDEX} from '../zones';
import {CharacterRig, ZoneParams} from './rig';
import {DRAG_BINDINGS} from './dragBindings';
import {resolveSelectableZone} from './zoneSelection';
import {mergeSavedParams} from './paramMerge';

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
    const chest = rig.nodeByName('chestMesh') as THREE.Mesh;
    rig.applyParams(withParams({torso: {chestWidth: 0}}));
    const base = chest.scale.x;
    rig.applyParams(withParams({torso: {chestWidth: 1}}));
    const widened = chest.scale.x;
    expect(widened).toBeGreaterThan(base);
    rig.applyParams(withParams({torso: {chestWidth: 5}}));
    expect(chest.scale.x).toBeCloseTo(widened, 6);
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
    for (const shapePreset of ['straight', 'wavy', 'curly', 'buzz']) {
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
});
