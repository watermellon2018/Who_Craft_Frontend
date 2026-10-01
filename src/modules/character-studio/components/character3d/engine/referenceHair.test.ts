import * as THREE from 'three';
import {buildReferenceHeadband} from './referenceHair';

const center = new THREE.Vector3(0, .202, -.015);

function layeredHair() {
  const values: number[] = [];
  const add = (angle: number, forward: number, radius: number) => {
    const point = new THREE.Vector3(Math.sin(angle), Math.cos(angle), forward).normalize().multiplyScalar(radius).add(center);
    values.push(...point.toArray());
  };
  // Many near-identical inner-layer samples dominate six-nearest averaging.
  // Sparse outer locks are shifted between the eventual band's grid points.
  for (let row = 0; row <= 80; row++) {
    const angle = -1.6 + row * .04;
    for (let column = 0; column <= 6; column++) {
      const forward = .38 + .48 * Math.max(0, Math.cos(angle)) + (column / 6 - .5) * .14;
      for (let duplicate = 0; duplicate < 12; duplicate++) add(angle, forward + duplicate * .00001, .1);
      add(angle + .01, forward + .005, row === 40 ? .115 : .108);
    }
    // A distant forward tuft must not float the band above unrelated hair.
    add(angle, 1.15, .2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
  return new THREE.Mesh(geometry);
}

const radii = (mesh: THREE.Mesh) => {
  const positions = mesh.geometry.getAttribute('position');
  return Array.from({length: positions.count}, (_, index) => new THREE.Vector3().fromBufferAttribute(positions, index).distanceTo(center));
};

test('v2 band clears sparse outer locks instead of averaging the dense inner crown', () => {
  const hair = layeredHair();
  const legacy = buildReferenceHeadband([hair]);
  const refined = buildReferenceHeadband([hair], true);
  expect(Math.max(...radii(legacy))).toBeLessThan(.103);
  expect(Math.min(...radii(refined))).toBeGreaterThan(.1091);
  expect(Math.max(...radii(refined))).toBeLessThan(.1163);
  // The central lock must retain its full clearance AFTER both smoothing passes.
  for (const radius of radii(refined).slice(40 * 7, 41 * 7)) expect(radius).toBeGreaterThan(.1161);
  expect(Array.from(refined.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
});

test('band triangle interiors preserve clearance over a concentric outer layer', () => {
  const refined = buildReferenceHeadband([layeredHair()], true);
  const positions = refined.geometry.getAttribute('position');
  const indices = refined.geometry.index as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let index = 0; index < indices.count; index += 3) {
    a.fromBufferAttribute(positions, indices.getX(index));
    b.fromBufferAttribute(positions, indices.getX(index + 1));
    c.fromBufferAttribute(positions, indices.getX(index + 2));
    const midpoint = a.add(b).add(c).divideScalar(3);
    expect(midpoint.distanceTo(center)).toBeGreaterThan(.109);
  }
});

test('v1 remains opt-in stable and empty input keeps a finite fallback', () => {
  const hair = layeredHair();
  const legacy = buildReferenceHeadband([hair]);
  const explicitLegacy = buildReferenceHeadband([hair], false);
  expect(Array.from(legacy.geometry.getAttribute('position').array)).toEqual(Array.from(explicitLegacy.geometry.getAttribute('position').array));
  const fallback = buildReferenceHeadband([], true);
  expect(Math.min(...radii(fallback))).toBeCloseTo(.0972, 6);
  expect(Math.max(...radii(fallback))).toBeCloseTo(.0972, 6);
});
