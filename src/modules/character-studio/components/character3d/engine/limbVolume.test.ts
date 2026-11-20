import * as THREE from 'three';
import {limbVolumeOffsets} from './limbVolume';
import {MorphRig} from './morphRig';

function limbMesh(axis: 0 | 1, start: number, end: number) {
  const points: number[] = [0, 0, 0, 0, 2, 0];
  for (const side of [-1, 1]) {
    for (let ring = 0; ring <= 12; ring++) {
      const along = start + (end - start) * ring / 12;
      for (let angle = 0; angle < 8; angle++) {
        const a = angle * Math.PI / 4;
        const radial = .04 * Math.cos(a);
        points.push(axis === 0 ? along * side : side * .13 + radial, axis === 1 ? along : 1.55 + radial, .04 * Math.sin(a));
      }
    }
  }
  const positions = new Float32Array(points);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const indices: number[] = [];
  for (let side = 0; side < 2; side++) for (let ring = 0; ring < 12; ring++) for (let angle = 0; angle < 8; angle++) {
    const a = 2 + side * 104 + ring * 8 + angle;
    const b = 2 + side * 104 + ring * 8 + (angle + 1) % 8;
    indices.push(a, b, a + 8, b, b + 8, a + 8);
  }
  geometry.setIndex(indices);
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(points.length), 3)];
  geometry.morphTargetsRelative = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.morphTargetDictionary = {beta00: 0};
  return {mesh, positions: positions.slice()};
}

test.each([
  ['thigh', 'thighVolume', 'thighLength', 1, .5, 1],
  ['calf', 'calfVolume', 'calfLength', 1, .08, .5],
  ['upper_arm', 'volume', 'length', 0, .22, .58],
  ['forearm', 'thickness', 'length', 0, .58, .88],
] as const)('%s volume increases both cross sections, pins joints, composes with length and resets exactly', (zone, parameter, length, axis, start, end) => {
  const {mesh, positions} = limbMesh(axis, start, end);
  const rig = MorphRig.fromMesh(mesh);
  rig.applyParams({[zone]: {[length]: .8}});
  const baseline = (mesh.geometry.getAttribute('position').array as Float32Array).slice();
  rig.applyParams({[zone]: {[length]: .8, [parameter]: 1}});
  const enlarged = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let side = 0; side < 2; side++) {
    const middle = 2 + side * 104 + 6 * 8;
    const transverse = axis === 0 ? 1 : 0;
    const span = (vertex: number) => enlarged.getComponent(vertex, transverse) - enlarged.getComponent(vertex + 4, transverse);
    expect(span(middle)).toBeGreaterThan(.1); // neutral diameter .08 → .104
    for (const ring of [0, 12]) for (let angle = 0; angle < 8; angle++) {
      const vertex = 2 + side * 104 + ring * 8 + angle;
      for (let component = 0; component < 3; component++) expect(enlarged.getComponent(vertex, component)).toBeCloseTo(baseline[vertex * 3 + component], 6);
    }
  }
  expect(Array.from(enlarged.array).every(Number.isFinite)).toBe(true);
  rig.applyParams({});
  expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(Array.from(positions));
  rig.dispose();
});

test('neutral and invalid values preserve the fitted geometry without allocation', () => {
  const positions = new Float32Array([.1, .7, .1]);
  expect(limbVolumeOffsets(positions, positions, 0, 2, {})).toBeNull();
  expect(limbVolumeOffsets(positions, positions, 0, 2, {thigh: {thighVolume: NaN}})).toBeNull();
});
