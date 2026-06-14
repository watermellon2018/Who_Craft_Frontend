import * as THREE from 'three';
import {buildInitialZoneParams, ZONE_INDEX} from '../zones';
import {CharacterRig, ZoneParams} from './rig';
import {DRAG_BINDINGS} from './dragBindings';
import {resolveDirectPart, resolveSelectableZone} from './zoneSelection';
import {applyAutofitSuggestions, collapseSideOverrides, mergeSavedParams} from './paramMerge';
import {browGeometry, noseGeometry, taperedLimbGeometry} from './geometry';

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

  it('excludes the iris/pupil from the selection outline', () => {
    rig.setHighlight(null, 'eyes');
    const {selected} = rig.highlightedMeshes();
    // The eye whites/lids are outlined, but the color-bearing iris and pupil
    // are not — a contour around them would obscure the picked eye color.
    expect(selected.length).toBeGreaterThan(0);
    const irisOrPupil = selected.filter((m) => {
      const kind = (m.userData as {matKind?: string}).matKind;
      return kind === 'iris' || kind === 'pupil';
    });
    expect(irisOrPupil).toHaveLength(0);
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

  it('outlines the selected zone subtree and nothing else', () => {
    rig.setHighlight(null, 'eyes');
    const {selected, hovered} = rig.highlightedMeshes();
    const zonesOf = (meshes: THREE.Mesh[]) =>
      new Set(meshes.map((m) => (m.userData as {zoneId?: string}).zoneId));
    const selectedZones = zonesOf(selected);
    expect(selectedZones.has('eyes')).toBe(true);
    expect(selectedZones.has('torso')).toBe(false);
    // Nothing hovered → hover set empty.
    expect(hovered).toHaveLength(0);
  });

  it('puts a mesh in selected OR hovered, never both (selection wins)', () => {
    // Hover and select the same zone.
    rig.setHighlight('eyes', 'eyes');
    const {selected, hovered} = rig.highlightedMeshes();
    expect(selected.length).toBeGreaterThan(0);
    expect(hovered).toHaveLength(0);
    // A different hovered zone gets its own outline alongside the selection.
    rig.setHighlight('torso', 'eyes');
    const both = rig.highlightedMeshes();
    expect(both.selected.length).toBeGreaterThan(0);
    expect(both.hovered.length).toBeGreaterThan(0);
    const overlap = both.selected.filter((m) => both.hovered.includes(m));
    expect(overlap).toHaveLength(0);
  });

  it('drops invisible meshes from the outline sets', () => {
    rig.setHighlight(null, 'skin_details');
    // skin_details decorations default to hidden — none should be outlined.
    const {selected} = rig.highlightedMeshes();
    selected.forEach((m) => expect(m.visible).toBe(true));
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

  it('builds a distinct, finite silhouette for every hairstyle', () => {
    const styles = ['default', 'long', 'bob', 'ponytail', 'bun', 'afro'];
    for (const hairStyle of styles) {
      rig.applyParams(withParams({hair: {hairStyle, hairLength: 0.7, hairVolume: 0.4}}));
      const hair = rig.nodeByName('hairGroup') as THREE.Group;
      expect(hair.children.length).toBeGreaterThan(0);
      hair.children.forEach((child) => {
        const pos = (child as THREE.Mesh).geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          expect(Number.isFinite(pos.getX(i))).toBe(true);
          expect(Number.isFinite(pos.getY(i))).toBe(true);
          expect(Number.isFinite(pos.getZ(i))).toBe(true);
        }
        // Every hair mesh is registered on the hair zone so highlight/dispose
        // keep working uniformly with the rest of the rig.
        expect((child as THREE.Mesh).userData.zoneId).toBe('hair');
      });
    }
  });

  it('builds no hair meshes for the bald (none) style', () => {
    rig.applyParams(withParams({hair: {hairStyle: 'none', hairLength: 0.9, hairVolume: 1}}));
    const hair = rig.nodeByName('hairGroup') as THREE.Group;
    expect(hair.children.length).toBe(0);
  });

  it('degrades an unknown hairstyle to the default silhouette', () => {
    rig.applyParams(withParams({hair: {hairStyle: 'default', hairLength: 0.7}}));
    const defaultCount = (rig.nodeByName('hairGroup') as THREE.Group).children.length;
    // A value no builder knows (e.g. an older save, or a typo) must not throw
    // or vanish — it falls back to the default style.
    rig.applyParams(withParams({hair: {hairStyle: 'totally-unknown', hairLength: 0.7}}));
    const hair = rig.nodeByName('hairGroup') as THREE.Group;
    expect(hair.children.length).toBe(defaultCount);
    expect(hair.children.length).toBeGreaterThan(0);
  });

  it('applies hair color to a non-default style', () => {
    rig.applyParams(withParams({hair: {hairStyle: 'ponytail', hairColor: '#ff0000'}}));
    const hair = rig.nodeByName('hairGroup') as THREE.Group;
    expect(hair.children.length).toBeGreaterThan(0);
    hair.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(mat.color.getHexString()).toBe('ff0000');
    });
  });

  it('rebuilds hair only when a hair input changes', () => {
    rig.applyParams(withParams({hair: {hairStyle: 'bob', hairLength: 0.5}}));
    const before = [...(rig.nodeByName('hairGroup') as THREE.Group).children];
    // Re-applying identical hair params must NOT rebuild (same mesh instances).
    rig.applyParams(withParams({hair: {hairStyle: 'bob', hairLength: 0.5}}));
    const after = [...(rig.nodeByName('hairGroup') as THREE.Group).children];
    expect(after).toEqual(before);
    // Changing the style rebuilds (fresh instances).
    rig.applyParams(withParams({hair: {hairStyle: 'bun', hairLength: 0.5}}));
    const rebuilt = (rig.nodeByName('hairGroup') as THREE.Group).children;
    expect(rebuilt).not.toEqual(before);
  });
});

// Mean center + radius of a limb mesh's boundary ring (the extreme-y ring in
// LOCAL mesh space: y=0 for the top, y=−baseLength for the bottom), expressed
// in the shared joint's local frame so segment rotation cancels out. Two
// segments meet seamlessly iff their facing rings share a center and radius.
const ringCenterInJoint = (mesh: THREE.Mesh, joint: THREE.Object3D, pickTop: boolean) => {
  const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  mesh.updateMatrixWorld(true);
  joint.updateMatrixWorld(true);
  const toJoint = new THREE.Matrix4().copy(joint.matrixWorld).invert().multiply(mesh.matrixWorld);
  let ly = pickTop ? -Infinity : Infinity;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (pickTop ? y > ly : y < ly) ly = y;
  }
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  let n = 0;
  let r = 0;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - ly) < 1e-5) {
      r += Math.hypot(p.getX(i), p.getZ(i));
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(toJoint);
      center.add(v);
      n += 1;
    }
  }
  return {center: center.multiplyScalar(1 / n), r: r / n};
};

describe('limb continuity (single-skin joints)', () => {
  it('open ends drop the rounded dome; domed ends keep it', () => {
    const len = 0.27;
    const yRange = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < p.count; i++) {
        mn = Math.min(mn, p.getY(i));
        mx = Math.max(mx, p.getY(i));
      }
      return {mn, mx};
    };
    const domed = yRange(taperedLimbGeometry(0.058, 0.047, len, 18, {top: true, bottom: true}));
    const open = yRange(taperedLimbGeometry(0.058, 0.047, len, 18, {top: false, bottom: false}));
    // Domed ends bulge a hemisphere past each boundary; open ends are flush.
    expect(domed.mx).toBeGreaterThan(0.001);
    expect(domed.mn).toBeLessThan(-len - 0.001);
    expect(open.mx).toBeCloseTo(0, 3);
    expect(open.mn).toBeCloseTo(-len, 3);
  });

  it('defaults to domed on both ends (unchanged for existing callers)', () => {
    const g = taperedLimbGeometry(0.05, 0.04, 0.2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    let mx = -Infinity;
    for (let i = 0; i < p.count; i++) mx = Math.max(mx, p.getY(i));
    expect(mx).toBeGreaterThan(0.001); // top hemisphere present
  });

  it('elbow rings coincide: upper-arm bottom meets forearm top with no gap/step', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    rig.root.updateMatrixWorld(true);
    const elbow = rig.nodeByName('upperArmLEnd') as THREE.Object3D;
    const upper = ringCenterInJoint(rig.nodeByName('upperArmLMesh') as THREE.Mesh, elbow, false);
    const fore = ringCenterInJoint(rig.nodeByName('forearmLMesh') as THREE.Mesh, elbow, true);
    expect(upper.center.distanceTo(fore.center)).toBeLessThan(1e-3);
    expect(upper.r).toBeCloseTo(fore.r, 3);
    rig.dispose();
  });

  it('knee rings coincide: thigh bottom meets calf top with no gap/step', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    rig.root.updateMatrixWorld(true);
    const knee = rig.nodeByName('thighLEnd') as THREE.Object3D;
    const thigh = ringCenterInJoint(rig.nodeByName('thighLMesh') as THREE.Mesh, knee, false);
    const calf = ringCenterInJoint(rig.nodeByName('calfLMesh') as THREE.Mesh, knee, true);
    expect(thigh.center.distanceTo(calf.center)).toBeLessThan(1e-3);
    expect(thigh.r).toBeCloseTo(calf.r, 3);
    rig.dispose();
  });

  it('length sliders keep the elbow rings coincident (no gap opens)', () => {
    const rig = new CharacterRig();
    const params = buildInitialZoneParams();
    params.upper_arm = {...params.upper_arm, length: 0.8};
    params.forearm = {...params.forearm, length: -0.5};
    rig.applyParams(params);
    rig.root.updateMatrixWorld(true);
    const elbow = rig.nodeByName('upperArmLEnd') as THREE.Object3D;
    const upper = ringCenterInJoint(rig.nodeByName('upperArmLMesh') as THREE.Mesh, elbow, false);
    const fore = ringCenterInJoint(rig.nodeByName('forearmLMesh') as THREE.Mesh, elbow, true);
    expect(upper.center.distanceTo(fore.center)).toBeLessThan(1e-3);
    rig.dispose();
  });

  it('limb meshes stay finite (no NaN from the open-ring build)', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    const limbNodes = ['upperArmLMesh', 'forearmLMesh', 'thighLMesh', 'calfLMesh', 'handMeshL', 'footMeshL'];
    for (const node of limbNodes) {
      const p = (rig.nodeByName(node) as THREE.Mesh).geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        expect(Number.isFinite(p.getX(i))).toBe(true);
        expect(Number.isFinite(p.getY(i))).toBe(true);
        expect(Number.isFinite(p.getZ(i))).toBe(true);
      }
    }
    rig.dispose();
  });

  it('wrist rings coincide: forearm open bottom meets the hand top', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    rig.root.updateMatrixWorld(true);
    const wrist = rig.nodeByName('forearmLEnd') as THREE.Object3D;
    const fore = ringCenterInJoint(rig.nodeByName('forearmLMesh') as THREE.Mesh, wrist, false);
    const hand = ringCenterInJoint(rig.nodeByName('handMeshL') as THREE.Mesh, wrist, true);
    expect(fore.center.distanceTo(hand.center)).toBeLessThan(1e-3);
    expect(fore.r).toBeCloseTo(hand.r, 3); // same radius → no wrist step
    rig.dispose();
  });

  it('ankle rings coincide: calf open bottom meets the foot top', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    rig.root.updateMatrixWorld(true);
    const ankle = rig.nodeByName('calfLEnd') as THREE.Object3D;
    const calf = ringCenterInJoint(rig.nodeByName('calfLMesh') as THREE.Mesh, ankle, false);
    const foot = ringCenterInJoint(rig.nodeByName('footMeshL') as THREE.Mesh, ankle, true);
    expect(calf.center.distanceTo(foot.center)).toBeLessThan(1e-3);
    expect(calf.r).toBeCloseTo(foot.r, 3);
    rig.dispose();
  });

  it('the figure still stands on the floor after the foot reshape', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.root);
    expect(box.min.y).toBeGreaterThan(-0.03);
    expect(box.min.y).toBeLessThan(0.03);
    rig.dispose();
  });

  it('hand and foot are double-sided (open wrist/ankle never reads as a hole)', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    for (const node of ['handMeshL', 'footMeshL', 'handMeshR', 'footMeshR']) {
      const mat = (rig.nodeByName(node) as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(mat.side).toBe(THREE.DoubleSide);
    }
    rig.dispose();
  });
});

describe('skin micro-detail maps', () => {
  const skinMeshes = (rig: CharacterRig): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.matKind === 'skin') out.push(m);
    });
    return out;
  };

  it('attaches one shared normal+roughness map across every skin mesh', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    const normals = new Set<THREE.Texture>();
    const roughs = new Set<THREE.Texture>();
    const skins = skinMeshes(rig);
    expect(skins.length).toBeGreaterThan(0);
    skins.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.normalMap).toBeTruthy();
      expect(mat.roughnessMap).toBeTruthy();
      normals.add(mat.normalMap as THREE.Texture);
      roughs.add(mat.roughnessMap as THREE.Texture);
      // The map only samples if the geometry carries UVs.
      expect(mesh.geometry.getAttribute('uv')).toBeTruthy();
    });
    // Generated once, shared — not one texture per mesh.
    expect(normals.size).toBe(1);
    expect(roughs.size).toBe(1);
    rig.dispose();
  });

  it('leaves non-skin materials (hair/eyes/lips) without skin maps', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.matKind && m.userData.matKind !== 'skin') {
        expect((m.material as THREE.MeshStandardMaterial).normalMap).toBeFalsy();
      }
    });
    rig.dispose();
  });

  it('keeps the normal map subtle (a hint, not a relief)', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    const mat = skinMeshes(rig)[0].material as THREE.MeshStandardMaterial;
    expect(mat.normalScale.x).toBeLessThanOrEqual(0.5);
    const data = (mat.normalMap as THREE.DataTexture).image.data as Uint8Array;
    let blueDominant = 0;
    const texels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 2] >= data[i] && data[i + 2] >= data[i + 1]) blueDominant += 1;
    }
    // Almost every texel points mostly "up" (+Z) — a gentle perturbation.
    expect(blueDominant / texels).toBeGreaterThan(0.9);
    rig.dispose();
  });

  it('keeps skin color working on top of the map', () => {
    const rig = new CharacterRig();
    const params = buildInitialZoneParams();
    params.skin_color = {...params.skin_color, skinTone: '#cc8844'};
    rig.applyParams(params);
    skinMeshes(rig).forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.color.getHexString()).toBe('cc8844');
      expect(mat.normalMap).toBeTruthy();
    });
    rig.dispose();
  });
});

describe('face features (nose & brows)', () => {
  const allFinite = (g: THREE.BufferGeometry): boolean => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) {
        return false;
      }
    }
    return true;
  };

  it('nose is a lofted surface that leans off the face and carries UVs', () => {
    const flat = noseGeometry(0, 0);
    const tall = noseGeometry(1, 1);
    expect(allFinite(flat)).toBe(true);
    expect(allFinite(tall)).toBe(true);
    expect(flat.getAttribute('uv')).toBeTruthy(); // so the skin maps sample it
    const frontZ = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      let mx = -Infinity;
      for (let i = 0; i < p.count; i++) mx = Math.max(mx, p.getZ(i));
      return mx;
    };
    expect(frontZ(flat)).toBeGreaterThan(0); // protrudes forward
    expect(frontZ(tall)).toBeGreaterThan(frontZ(flat)); // bridge/tip push it out
  });

  it('brow is wider than it is deep and actually arches (not a flat box)', () => {
    const g = browGeometry(-1);
    expect(allFinite(g)).toBe(true);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    let xMax = 0;
    let zMax = 0;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < p.count; i++) {
      xMax = Math.max(xMax, Math.abs(p.getX(i)));
      zMax = Math.max(zMax, Math.abs(p.getZ(i)));
      yMin = Math.min(yMin, p.getY(i));
      yMax = Math.max(yMax, p.getY(i));
    }
    expect(xMax).toBeGreaterThan(zMax); // brow-shaped, not a round tube
    expect(yMax - yMin).toBeGreaterThan(0.003);
  });

  it('wires nose and brows to the right zones (click-select/highlight intact)', () => {
    const rig = new CharacterRig();
    rig.applyParams(buildInitialZoneParams());
    const nose = rig.nodeByName('noseMesh') as THREE.Mesh;
    expect(nose.userData.zoneId).toBe('nose');
    expect(nose.userData.matKind).toBe('skin');
    for (const side of ['L', 'R'] as const) {
      const brow = rig.nodeByName(`brow${side}`) as THREE.Mesh;
      expect(brow.userData.zoneId).toBe('brows');
      expect(brow.userData.matKind).toBe('brow');
    }
    rig.dispose();
  });

  it('rebuilds the nose only when bridgeHeight/tip change (keyed, not per frame)', () => {
    const rig = new CharacterRig();
    const base = buildInitialZoneParams();
    rig.applyParams(base);
    const g1 = (rig.nodeByName('noseMesh') as THREE.Mesh).geometry;
    rig.applyParams(base); // identical inputs → no rebuild
    expect((rig.nodeByName('noseMesh') as THREE.Mesh).geometry).toBe(g1);
    rig.applyParams({...base, nose: {...base.nose, bridgeHeight: 0.8, noseTip: 0.6}});
    expect((rig.nodeByName('noseMesh') as THREE.Mesh).geometry).not.toBe(g1);
    rig.dispose();
  });

  it('nose width/length still drive the group scale', () => {
    const rig = new CharacterRig();
    const params = buildInitialZoneParams();
    params.nose = {...params.nose, noseWidth: 1, noseLength: 1};
    rig.applyParams(params);
    const nose = rig.nodeByName('nose') as THREE.Object3D;
    expect(nose.scale.x).toBeGreaterThan(1);
    expect(nose.scale.y).toBeGreaterThan(1);
    rig.dispose();
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

describe('resolveDirectPart', () => {
  it('maps each body sub-mesh hit to its concrete level-2 part', () => {
    expect(resolveDirectPart('torso')).toBe('torso');
    expect(resolveDirectPart('shoulders')).toBe('shoulders');
    expect(resolveDirectPart('hips')).toBe('hips');
    expect(resolveDirectPart('waist')).toBe('waist');
    expect(resolveDirectPart('head_neck')).toBe('head_neck');
    // Limbs collapse to their group; their sub-parts share one highlight.
    expect(resolveDirectPart('upper_arm')).toBe('arms');
    expect(resolveDirectPart('forearm')).toBe('arms');
    expect(resolveDirectPart('hand')).toBe('arms');
    expect(resolveDirectPart('thigh')).toBe('legs');
    expect(resolveDirectPart('calf')).toBe('legs');
    expect(resolveDirectPart('foot')).toBe('legs');
  });

  it('maps any facial hit to the whole face zone, and hair to hair', () => {
    expect(resolveDirectPart('eyes')).toBe('face');
    expect(resolveDirectPart('nose')).toBe('face');
    expect(resolveDirectPart('face_shape')).toBe('face');
    expect(resolveDirectPart('hair')).toBe('hair');
  });

  it('returns null for non-hoverable decorations and unknown hits', () => {
    expect(resolveDirectPart('skin_details')).toBeNull();
    expect(resolveDirectPart(null)).toBeNull();
  });
});

describe('resolveSelectableZone', () => {
  it('selects the concrete part under the cursor when nothing is selected', () => {
    // Hover and first click agree on the exact part — never the whole body.
    expect(resolveSelectableZone('torso', null, [])).toBe('torso');
    expect(resolveSelectableZone('shoulders', null, [])).toBe('shoulders');
    expect(resolveSelectableZone('eyes', null, [])).toBe('face');
    expect(resolveSelectableZone('upper_arm', null, [])).toBe('arms');
    expect(resolveSelectableZone('calf', null, [])).toBe('legs');
    expect(resolveSelectableZone('hand', null, [])).toBe('arms');
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

describe('applyAutofitSuggestions', () => {
  it('merges suggested values per zone over existing params', () => {
    const params = buildInitialZoneParams();
    const next = applyAutofitSuggestions(params, {
      skin_color: {skinTone: '#caa98a'},
      eyes: {eyeColor: '#5a4632', eyeDistance: 0.3},
    });
    expect(next.skin_color.skinTone).toBe('#caa98a');
    expect(next.eyes.eyeColor).toBe('#5a4632');
    expect(next.eyes.eyeDistance).toBe(0.3);
    // Untouched zones keep their existing values.
    expect(next.nose.noseWidth).toBe(params.nose.noseWidth);
  });

  it('clears stale per-side overrides for suggested params so they take effect', () => {
    const params = buildInitialZoneParams();
    // User edited the left eye asymmetrically before running autofit.
    params.eyes = {...params.eyes, eyeDistance: 0, eyeDistance__L: 0.9, eyeSize__R: -0.4};
    const next = applyAutofitSuggestions(params, {eyes: {eyeDistance: 0.5}});
    // The suggested shared value wins and the override on the same param is gone.
    expect(next.eyes.eyeDistance).toBe(0.5);
    expect(next.eyes.eyeDistance__L).toBeUndefined();
    expect(next.eyes.eyeDistance__R).toBeUndefined();
    // Overrides for params NOT in the suggestion are left alone.
    expect(next.eyes.eyeSize__R).toBe(-0.4);
  });

  it('does not mutate the input object', () => {
    const params = buildInitialZoneParams();
    const snapshot = JSON.stringify(params);
    applyAutofitSuggestions(params, {skin_color: {skinTone: '#fff'}});
    expect(JSON.stringify(params)).toBe(snapshot);
  });
});
