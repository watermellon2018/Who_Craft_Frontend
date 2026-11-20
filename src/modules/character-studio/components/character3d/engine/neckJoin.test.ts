import * as THREE from 'three';
import {MorphRig} from './morphRig';
import {neckContour, upperBoundary} from './neckJoin';
import type {ZoneParams} from './rig';

function tube(radius: number, heights: number[], segments = 32): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  heights.forEach((y, ring) => {
    for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      positions.push(radius * Math.cos(angle), y, radius * Math.sin(angle));
      normals.push(Math.cos(angle), 0, Math.sin(angle));
      if (ring) {
        const a = (ring - 1) * segments + i;
        const b = (ring - 1) * segments + (i + 1) % segments;
        indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

const neckBounds = new THREE.Box3(
  new THREE.Vector3(-0.06, 0.045, -0.05), new THREE.Vector3(0.06, 0.075, 0.06),
);

describe('neck surface join', () => {
  it('finds the ordered upper boundary without changing body vertex or morph arrays', () => {
    const geometry = tube(0.04, [0, 0.045, 0.055]);
    const position = geometry.getAttribute('position');
    const boundary = upperBoundary(geometry, 0.05);
    expect(boundary).toHaveLength(32);
    expect(new Set(boundary)).toEqual(new Set(Array.from({length: 32}, (_, i) => i + 64)));
    expect(geometry.getAttribute('position')).toBe(position);
    expect(boundary.every((id, i) => {
      const step = Math.abs(id - boundary[(i + 1) % 32]);
      return step === 1 || step === 31;
    })).toBe(true);
  });

  it('does not mistake a filtered open edge for a one-vertex boundary loop', () => {
    expect(upperBoundary(tube(0.04, [0, 0.055]), 0.05, 0.025)).toEqual([]);
  });

  it('samples the outer throat instead of its inner backing or detached side fragments', () => {
    const root = new THREE.Group();
    const outer = new THREE.Mesh(tube(0.04, [0.045, 0.075]));
    const backing = new THREE.Mesh(tube(0.025, [0.045, 0.075]));
    const fragment = new THREE.Mesh(tube(0.008, [0.045, 0.075]));
    fragment.position.x = 0.08;
    root.add(outer, backing, fragment);
    // The result is canonical to the head even when its parent is transformed.
    root.position.set(1, 2, 3);
    root.scale.setScalar(2);
    const section = neckContour([outer, backing, fragment], root, neckBounds);
    if (!section) throw new Error('Expected a complete neck contour');
    expect(section.points).toHaveLength(64);
    section.points.forEach((point, i) => {
      expect(Math.hypot(point.x, point.z)).toBeGreaterThan(0.039);
      expect(Math.hypot(point.x, point.z)).toBeLessThan(0.0401);
      expect(point.y).toBeCloseTo(0.05, 6);
      expect(section.normals[i].length()).toBeCloseTo(1, 6);
      expect(section.normals[i].dot(point.clone().setY(0).normalize())).toBeGreaterThan(0.99);
    });
  });

  it('rejects a partial throat so a missing contour cannot produce NaN or an open bridge', () => {
    const geometry = tube(0.04, [0.045, 0.075]);
    if (!geometry.index) throw new Error('Expected an indexed test tube');
    geometry.setIndex(Array.from(geometry.index.array).slice(0, 48));
    const mesh = new THREE.Mesh(geometry);
    const root = new THREE.Group();
    root.add(mesh);
    expect(neckContour([mesh], root, neckBounds)).toBeNull();
  });

  it('keeps the join on the actual body edge through morphs, head scaling and resets', () => {
    const geometry = tube(0.065, [0, 0.5, 1, 1.4, 1.42, 1.46, 1.55, 1.7]);
    const position = geometry.getAttribute('position');
    const delta = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      delta[i * 3] = position.getX(i) * 0.3;
      delta[i * 3 + 2] = position.getZ(i) * 0.3;
    }
    geometry.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
    geometry.morphTargetsRelative = true;
    const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    body.morphTargetDictionary = {beta00: 0};
    body.morphTargetInfluences = [0];
    const rig = MorphRig.fromMesh(body);
    const head = new THREE.Group();
    const headMesh = new THREE.Mesh(tube(0.04, [0.046, 0.075, 0.14, 0.2, 0.28]));
    headMesh.name = 'reconstructed_skin_test';
    head.add(headMesh);
    rig.attachReconstructedHead(head, new THREE.Group());
    const boundary = upperBoundary(geometry, 1.35);
    const seam = rig.nodeByName('neck_seam') as THREE.Mesh;
    const seamPosition = seam.geometry.getAttribute('position');
    expect(seamPosition.count).toBe(boundary.length * 5);
    const params: ZoneParams = {body_fit: {beta00: 0.3}, head_neck: {headSize: 0.7}};
    const checkBoundary = (): void => {
      const point = new THREE.Vector3();
      boundary.forEach((vertex, i) => {
        body.getVertexPosition(vertex, point);
        expect(point.distanceTo(new THREE.Vector3().fromBufferAttribute(seamPosition, i)))
          .toBeLessThan(1e-6);
      });
      const normal = seam.geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) {
        expect(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i))).toBe(true);
      }
    };
    rig.applyParams(params);
    checkBoundary();
    const fitted = Array.from(seamPosition.array);
    rig.applyParams({body_fit: {beta00: -0.5}, head_neck: {headSize: -0.5}});
    checkBoundary();
    expect(Array.from(seamPosition.array)).not.toEqual(fitted);
    rig.applyParams(params);
    expect(Array.from(seamPosition.array)).toEqual(fitted);
    expect(geometry.getAttribute('position')).toBe(position);
    expect(geometry.morphAttributes.position[0].array).toBe(delta);
    rig.dispose();
  });
});
