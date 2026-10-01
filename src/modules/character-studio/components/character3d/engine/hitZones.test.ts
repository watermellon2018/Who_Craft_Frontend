import * as THREE from 'three';
import {bodyHitZone, faceHitZone, restPointForHit} from './hitZones';
import {MorphRig} from './morphRig';

function testBody() {
  const geometry = new THREE.BufferGeometry();
  // Indexed, independently raycastable patches in the rest anatomy.
  const points = [[0, 0, 0], [0, 2, 0], [0, 1.4, .1], [.15, .7, .1], [.4, 1.5, .1]];
  const positions = points.flatMap(([x, y, z]) => [x - .015, y - .015, z, x + .015, y - .015, z, x, y + .015, z]);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(Array.from({length: positions.length / 3}, (_, i) => i));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(positions.map((_, i) => i % 3 === 1 ? .12 : 0), 3)];
  geometry.morphTargetsRelative = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.morphTargetDictionary = {beta00: 0};
  return MorphRig.fromMesh(mesh);
}

test('rest classification stays on torso and thigh through morphs and world transforms, including clothing', () => {
  const rig = testBody();
  rig.applyParams({body_fit: {beta00: 1}, thigh: {thighLength: .8}});
  rig.root.position.set(2, .3, -.2);
  rig.root.rotation.y = .4;
  rig.root.updateMatrixWorld(true);
  const body = rig.nodeByName('smpl_body') as THREE.Mesh;
  const raycastPatch = (mesh: THREE.Mesh, triangle: number) => {
    const index = mesh.geometry.index!;
    const a = mesh.getVertexPosition(index.getX(triangle * 3), new THREE.Vector3());
    const b = mesh.getVertexPosition(index.getX(triangle * 3 + 1), new THREE.Vector3());
    const c = mesh.getVertexPosition(index.getX(triangle * 3 + 2), new THREE.Vector3());
    const center = a.add(b).add(c).divideScalar(3).applyMatrix4(mesh.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(mesh.matrixWorld);
    const ray = new THREE.Raycaster(center.clone().addScaledVector(direction, -1), direction);
    return ray.intersectObject(mesh)[0];
  };
  expect(rig.resolveHit(raycastPatch(body, 2))?.zoneId).toBe('torso');
  expect(rig.resolveHit(raycastPatch(body, 3))?.zoneId).toBe('thigh');
  expect(rig.resolveHit(raycastPatch(body, 4))?.zoneId).toBe('upper_arm');
  const top = rig.nodeByName('clothing_top') as THREE.Mesh;
  const hit = raycastPatch(top, 0);
  expect(rig.resolveHit(hit)?.zoneId).toBe('torso');
  expect(rig.resolveHit(hit, 'clothing_top')?.zoneId).toBe('clothing_top');
  expect(rig.supportsAsymmetricEditing).toBe(false);
  rig.dispose();
});

test('barycentric recovery uses current deformed triangle and rest vertex remap', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([5, 0, 0, 7, 0, 0, 5, 2, 0], 3));
  geometry.setIndex([0, 1, 2]);
  const mesh = new THREE.Mesh(geometry);
  mesh.position.x = 10;
  mesh.updateMatrixWorld();
  const rest = new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]);
  const point = restPointForHit({object: mesh, point: new THREE.Vector3(15.5, .5, 0), faceIndex: 0}, mesh, rest, new Int32Array([0, 2, 1]));
  expect(point?.toArray()).toEqual([.25, .25, 0]);
});

test('anatomical rest zones include paired extremities and detailed facial regions', () => {
  expect(bodyHitZone(new THREE.Vector3(-.7, 1.4, 0), 0, 1.7)).toEqual({zoneId: 'forearm', side: 'L'});
  expect(bodyHitZone(new THREE.Vector3(.82, 1.4, 0), 0, 1.7).zoneId).toBe('hand');
  const eyes = [new THREE.Vector3(-.032, .16, .08), new THREE.Vector3(.032, .16, .08)] as const;
  const bounds = new THREE.Box3(new THREE.Vector3(-.08, .07, 0), new THREE.Vector3(.08, .255, .1));
  for (const [point, expected] of [
    [[0, .137, .1], 'nose'], [[.032, .16, .08], 'eyes'], [[.033, .182, .08], 'brows'],
    [[0, .106, .08], 'mouth'], [[.02, .086, .06], 'jaw_chin'], [[.078, .15, .02], 'ears'],
  ] as const) {
    expect(faceHitZone(new THREE.Vector3(...point), ...eyes, bounds).zoneId).toBe(expected);
  }
});

test('measured v2 landmarks distinguish the low mouth and chin from the neck', () => {
  const eyes = [new THREE.Vector3(-.032, .16, .08), new THREE.Vector3(.032, .16, .08)] as const;
  const bounds = new THREE.Box3(new THREE.Vector3(-.074, .056, .045), new THREE.Vector3(.074, .255, .127));
  const anchors = {chinY: .0607, mouthY: .096, noseY: .1275};
  for (const [point, expected] of [
    [[0, .096, .104], 'mouth'], [[.035, .10, .09], 'mouth'],
    [[0, .0745, .10], 'jaw_chin'], [[0, .1275, .127], 'nose'],
    [[0, .075, .04], 'head_neck'],
  ] as const) expect(faceHitZone(new THREE.Vector3(...point), ...eyes, bounds, anchors).zoneId).toBe(expected);
});
