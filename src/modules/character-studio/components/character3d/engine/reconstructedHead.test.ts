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

    disposeReconstructedHead(prepared);
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
    expect(rig.zoneBounds('eyes')?.max.y).toBeCloseTo(1.7, 5);

    const params = buildInitialZoneParams();
    params.hair = {...params.hair, hairColor: '#d08045'};
    rig.applyParams(params);
    const headMesh = head.children[0] as THREE.Mesh;
    const materials = headMesh.material as THREE.MeshStandardMaterial[];
    expect(materials[1].color.getHexString()).toBe('d08045');

    rig.dispose();
  });
});
