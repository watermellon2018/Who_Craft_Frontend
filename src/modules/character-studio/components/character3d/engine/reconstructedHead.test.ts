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
    const skinMesh = prepared.skinMeshes[0];
    const hairMesh = prepared.hairMeshes[0];

    expect(prepared.skinMeshes).toHaveLength(1);
    expect(prepared.hairMeshes).toHaveLength(1);
    expect(skinMesh.geometry.getIndex()?.count).toBe(3);
    expect(hairMesh.geometry.getIndex()?.count).toBe(3);
    expect(skinMesh.material).toBe(prepared.skinMaterial);
    expect(hairMesh.material).toBe(prepared.hairMaterial);
    expect(prepared.hairGroup.children).toEqual([hairMesh]);
    expect(skinMesh.userData.zoneId).toBe('face');
    expect(hairMesh.userData.zoneId).toBe('hair');
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
    expect(prepared.faceSurfaces).toHaveLength(1);
    expect(Array.from(prepared.faceSurfaces[0].faceVertexIndices)).toEqual([0, 1, 2]);
    expect(Array.from(prepared.faceSurfaces[0].faceWeights).every((weight) => weight > 0)).toBe(true);
    expect(prepared.hairSurfaces).toHaveLength(1);
    expect(prepared.hairSurfaces[0].baseCanonicalPositions).toHaveLength(9);
    expect(prepared.neckBounds.isEmpty()).toBe(false);
    expect(prepared.neckBounds.min.y).toBeCloseTo(prepared.bounds.min.y, 6);

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
    const longLegs = buildInitialZoneParams();
    longLegs.calf = {...longLegs.calf, calfLength: 1};
    longLegs.thigh = {...longLegs.thigh, thighLength: 1};
    rig.applyParams(longLegs);
    rig.attachReconstructedHead(makeReconstructedHead());

    const head = rig.nodeByName('reconstructed_head') as THREE.Object3D;
    const shiftedHeadY = head.position.y;
    rig.applyParams(buildInitialZoneParams());
    const initialHeadY = head.position.y;
    expect(shiftedHeadY).toBeGreaterThan(initialHeadY + 0.1);
    rig.applyParams(longLegs);
    expect(head.position.y).toBeGreaterThan(initialHeadY + 0.1);
    rig.applyParams(buildInitialZoneParams());
    expect(head.position.y).toBeCloseTo(initialHeadY, 7);

    const headBounds = new THREE.Box3().setFromObject(head);
    expect(headBounds.max.y).toBeCloseTo(1.7, 5);
    const seam = rig.nodeByName('neck_seam') as THREE.Mesh;
    const seamBounds = new THREE.Box3().setFromObject(seam);
    const bodyMesh = rig.nodeByName('body') as THREE.Mesh;
    const initialSeamPositions = Float32Array.from(
      (seam.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array,
    );
    expect(seam?.isMesh).toBe(true);
    expect(seam.userData.zoneId).toBe('head_neck');
    expect(seam.material).toBe(bodyMesh.material);
    expect(seamBounds.min.y).toBeLessThan(headBounds.min.y);
    expect(seamBounds.max.y).toBeGreaterThan(headBounds.min.y);
    expect((rig.nodeByName('smpl_hair_anchor') as THREE.Object3D).visible).toBe(false);
    expect(rig.root.getObjectByName('smpl_face_overlay')?.visible).toBe(false);
    expect(bodyMesh.geometry.getIndex()?.count).toBe(3);
    const reconstructedEyes = rig.nodeByName('reconstructed_eyes') as THREE.Group;
    expect(reconstructedEyes.children).toHaveLength(2);
    const eyeBounds = rig.zoneBounds('eyes') as THREE.Box3;
    expect(eyeBounds.max.y).toBeLessThan(headBounds.max.y);
    expect(eyeBounds.getSize(new THREE.Vector3()).x).toBeLessThan(headBounds.getSize(new THREE.Vector3()).x);

    const leftEye = reconstructedEyes.children[0] as THREE.Group;
    const rightEye = reconstructedEyes.children[1] as THREE.Group;
    const initialLeftX = leftEye.position.x;
    const initialRightX = rightEye.position.x;
    const headMesh = head.children[0] as THREE.Mesh;
    const hairGroup = rig.nodeByName('reconstructed_hair') as THREE.Group;
    const hairMesh = hairGroup.children[0] as THREE.Mesh;
    const headPositions = headMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const hairPositions = hairMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const initialFaceDepth = headPositions.getZ(1);
    const initialHairDepth = hairPositions.getZ(1);
    const initialHairX = hairPositions.getX(0);
    const initialHairY = hairPositions.getY(0);
    const params = buildInitialZoneParams();
    rig.applyParams(params);
    params.face_shape = {...params.face_shape, faceDepth: 1};
    params.hair = {...params.hair, hairColor: '#d08045'};
    params.eyes = {
      ...params.eyes,
      eyeColor: '#244a2a',
      eyeDistance: 1,
      eyeSize: 1,
      eyeTilt: 1,
    };
    rig.applyParams(params);
    expect((hairMesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('d08045');
    expect(headPositions.getZ(1)).toBeGreaterThan(initialFaceDepth);
    expect(hairPositions.getZ(1)).toBeCloseTo(initialHairDepth, 7);
    params.face_shape = {...params.face_shape, faceDepth: 0};
    rig.applyParams(params);
    expect(headPositions.getZ(1)).toBeCloseTo(initialFaceDepth, 7);
    expect(hairPositions.getZ(1)).toBeCloseTo(initialHairDepth, 7);

    params.hair = {...params.hair, hairLength: 1, hairVolume: 1};
    rig.applyParams(params);
    expect(hairPositions.getY(0)).toBeLessThan(initialHairY);
    expect(hairPositions.getX(0)).toBeLessThan(initialHairX);
    expect(headPositions.getZ(1)).toBeCloseTo(initialFaceDepth, 7);
    params.hair = {...params.hair, hairLength: 0.5, hairVolume: 0};
    rig.applyParams(params);
    expect(hairPositions.getX(0)).toBeCloseTo(initialHairX, 7);
    expect(hairPositions.getY(0)).toBeCloseTo(initialHairY, 7);

    const initialHairBounds = new THREE.Box3().setFromBufferAttribute(hairPositions);
    const initialHairCenter = initialHairBounds.getCenter(new THREE.Vector3());
    const initialHairRadius = Math.hypot(
      initialHairX - initialHairCenter.x,
      initialHairDepth - initialHairCenter.z,
    );
    params.hair = {...params.hair, hairStyle: 'bun', hairVolume: -1};
    rig.applyParams(params);
    const compactHairRadius = Math.hypot(
      hairPositions.getX(0) - initialHairCenter.x,
      hairPositions.getZ(0) - initialHairCenter.z,
    );
    expect(compactHairRadius).toBeGreaterThanOrEqual(initialHairRadius * 0.97);
    params.hair = {...params.hair, hairStyle: 'default', hairVolume: 0};
    rig.applyParams(params);
    params.hair = {...params.hair, hairStyle: 'afro'};
    rig.applyParams(params);
    expect(hairPositions.getX(0)).toBeLessThan(initialHairX);
    params.hair = {...params.hair, hairStyle: 'none'};
    rig.applyParams(params);
    expect(hairGroup.visible).toBe(false);
    params.hair = {...params.hair, hairStyle: 'default'};
    rig.applyParams(params);
    expect(hairGroup.visible).toBe(true);
    expect(hairPositions.getX(0)).toBeCloseTo(initialHairX, 7);
    const iris = reconstructedEyes.getObjectByName('reconstructed_eye_left_iris') as THREE.Mesh;
    expect((iris.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('244a2a');
    expect(leftEye.position.x).toBeLessThan(initialLeftX);
    expect(rightEye.position.x).toBeGreaterThan(initialRightX);
    expect(leftEye.scale.x).toBeGreaterThan(1);
    expect(leftEye.rotation.z).toBeGreaterThan(0);
    expect(rightEye.rotation.z).toBeLessThan(0);
    rig.setHighlight(null, 'hair');
    expect(rig.highlightedMeshes().selected).toEqual([hairMesh]);
    rig.setHighlight(null, 'face');
    expect(rig.highlightedMeshes().selected).toEqual([headMesh]);
    rig.setHighlight(null, 'head_neck');
    expect(rig.highlightedMeshes().selected).toEqual([headMesh, seam]);
    rig.setHighlight(null, 'eyes');
    expect(rig.highlightedMeshes().selected).toHaveLength(6);
    expect(Array.from(
      (seam.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array,
    )).toEqual(Array.from(initialSeamPositions));

    const seamDispose = jest.spyOn(seam.geometry, 'dispose');
    rig.dispose();
    expect(seamDispose).toHaveBeenCalledTimes(1);
  });
});
