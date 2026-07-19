import * as THREE from 'three';
import {buildInitialZoneParams} from '../zones';
import {MorphRig} from './morphRig';
import {
  disposeReconstructedHead,
  keepGeometryBelowY,
  prepareReconstructedHead,
} from './reconstructedHead';

const makeReconstructedHead = (): THREE.Group => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      // Generated shoulder plinth: must be removed.
      -0.1, 0.02, 0, 0.1, 0.02, 0, 0, 0.03, 0.05,
      // Front-face triangle: skin.
      -0.02, 0.14, 0.08, 0.02, 0.14, 0.08, 0, 0.18, 0.09,
      // Crown triangle: hair.
      -0.04, 0.27, 0, 0.04, 0.27, 0, 0, 0.29, -0.02,
    ], 3),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
  return root;
};

const makeEyeSocketHead = (eyeY: number): THREE.Group => {
  const points: number[] = [];
  const addTriangle = (x: number, y: number, z: number): void => {
    points.push(
      x - 0.001, y - 0.0008, z,
      x + 0.001, y - 0.0008, z,
      x, y + 0.0008, z,
    );
  };

  addTriangle(-0.059, 0.175, 0.09);
  addTriangle(0.059, 0.175, 0.09);
  addTriangle(0, 0.1, 0.09);
  addTriangle(0, 0.24, 0.09);
  for (let y = 0.105; y <= 0.18; y += 0.003) {
    const socketDepth = 0.118 - 0.028 * Math.exp(-(((y - eyeY) / 0.008) ** 2));
    addTriangle(-0.029, y, socketDepth);
    addTriangle(0.029, y, socketDepth);
  }
  addTriangle(0, 0.28, -0.01);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
  return root;
};

const makeBody = (): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      -0.1, 0, 0, 0.1, 0, 0, 0, 0.2, 0.05,
      -0.08, 1.58, 0, 0.08, 1.58, 0, 0, 1.7, 0.05,
    ], 3),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute(new Float32Array(18), 3),
  ];
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.morphTargetInfluences = [0];
  mesh.morphTargetDictionary = {beta00: 0};
  return mesh;
};

describe('reconstructed head integration', () => {
  it('crops the generated plinth and creates editable skin/hair groups', () => {
    const prepared = prepareReconstructedHead(makeReconstructedHead());
    const mesh = prepared.meshes[0];

    expect(mesh.geometry.getIndex()?.count).toBe(6);
    expect(mesh.geometry.groups).toEqual([
      {start: 0, count: 3, materialIndex: 0},
      {start: 3, count: 3, materialIndex: 1},
    ]);
    expect(prepared.bounds.min.y).toBeCloseTo(0.14, 6);
    expect(prepared.bounds.max.y).toBeCloseTo(0.29, 6);
    expect(prepared.root.userData.zoneId).toBe('face');
    expect(prepared.eyes.group.name).toBe('reconstructed_eyes');
    expect(prepared.eyes.roots).toHaveLength(2);
    expect(prepared.eyes.meshes).toHaveLength(6);
    prepared.eyes.roots.forEach((eye) => {
      expect(eye.children.map((child) => child.name)).toEqual([
        `${eye.name}_sclera`,
        `${eye.name}_iris`,
        `${eye.name}_pupil`,
      ]);
      expect(eye.userData.zoneId).toBe('eyes');
    });
    expect(prepared.eyes.basePositions[0].x).toBeLessThan(prepared.eyes.basePositions[1].x);
    expect(prepared.eyes.basePositions[0].y).toBeCloseTo(prepared.eyes.basePositions[1].y, 6);

    disposeReconstructedHead(prepared);
  });

  it('seats the eyes on the recessed eye line measured from the reconstructed face', () => {
    const lowerSocket = prepareReconstructedHead(makeEyeSocketHead(0.125));
    const higherSocket = prepareReconstructedHead(makeEyeSocketHead(0.155));

    expect(higherSocket.eyes.basePositions[0].y).toBeGreaterThan(
      lowerSocket.eyes.basePositions[0].y + 0.02,
    );
    expect(lowerSocket.eyes.basePositions[0].y).toBeCloseTo(
      lowerSocket.eyes.basePositions[1].y,
      6,
    );

    disposeReconstructedHead(lowerSocket);
    disposeReconstructedHead(higherSocket);
  });

  it('keeps body triangles below the neck cut and hides triangles above it', () => {
    const geometry = makeBody().geometry;
    const keptTriangles = keepGeometryBelowY(geometry, 1.45);

    expect(keptTriangles).toBe(1);
    expect(Array.from(geometry.getIndex()?.array ?? [])).toEqual([0, 1, 2]);
    geometry.dispose();
  });

  it('attaches the new head at the crown and routes head editing to it', () => {
    const rig = MorphRig.fromMesh(makeBody(), {
      browL: [-0.03, 1.65, 0.07],
      browR: [0.03, 1.65, 0.07],
      eyeL: [-0.03, 1.62, 0.08],
      eyeR: [0.03, 1.62, 0.08],
      mouth: [0, 1.55, 0.08],
      eyeR_size: 0.02,
    });
    rig.attachReconstructedHead(makeReconstructedHead());

    const head = rig.nodeByName('reconstructed_head') as THREE.Object3D;
    const headBounds = new THREE.Box3().setFromObject(head);
    expect(headBounds.max.y).toBeCloseTo(1.7, 5);
    expect((rig.nodeByName('smpl_hair_anchor') as THREE.Object3D).visible).toBe(false);
    expect(rig.root.getObjectByName('smpl_face_overlay')?.visible).toBe(false);
    expect((rig.nodeByName('body') as THREE.Mesh).geometry.getIndex()?.count).toBe(3);
    const reconstructedEyes = rig.nodeByName('reconstructed_eyes') as THREE.Group;
    expect(reconstructedEyes.children).toHaveLength(2);
    const eyeBounds = rig.zoneBounds('eyes') as THREE.Box3;
    expect(eyeBounds.max.y).toBeLessThan(headBounds.max.y);
    expect(eyeBounds.getSize(new THREE.Vector3()).x).toBeLessThan(headBounds.getSize(new THREE.Vector3()).x);

    const leftEye = reconstructedEyes.children[0] as THREE.Group;
    const rightEye = reconstructedEyes.children[1] as THREE.Group;
    const initialLeftX = leftEye.position.x;
    const initialRightX = rightEye.position.x;
    const params = buildInitialZoneParams();
    params.hair = {...params.hair, hairColor: '#d08045'};
    params.eyes = {
      ...params.eyes,
      eyeColor: '#244a2a',
      eyeDistance: 1,
      eyeSize: 1,
      eyeTilt: 1,
    };
    rig.applyParams(params);
    const headMesh = head.children[0] as THREE.Mesh;
    const materials = headMesh.material as THREE.MeshStandardMaterial[];
    expect(materials).toHaveLength(2);
    expect(materials[1].color.getHexString()).toBe('d08045');
    const iris = reconstructedEyes.getObjectByName('reconstructed_eye_left_iris') as THREE.Mesh;
    expect((iris.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('244a2a');
    expect(leftEye.position.x).toBeLessThan(initialLeftX);
    expect(rightEye.position.x).toBeGreaterThan(initialRightX);
    expect(leftEye.scale.x).toBeGreaterThan(1);
    expect(leftEye.rotation.z).toBeGreaterThan(0);
    expect(rightEye.rotation.z).toBeLessThan(0);
    rig.setHighlight(null, 'eyes');
    expect(rig.highlightedMeshes().selected).toHaveLength(6);

    rig.dispose();
  });
});
