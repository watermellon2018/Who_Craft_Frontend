import * as THREE from 'three';
import {MorphRig} from './morphRig';
import {disposeReconstructedHead, prepareReconstructedHead} from './reconstructedHead';

const profile = {
  sourceProfile: 'stylized_reference_v1',
  colorMode: 'relative_linear',
};
const referenceFace = {
  eyeCenters: [[-0.032, 0.16, 0.0807], [0.032, 0.16, 0.0807]],
  eyeWidth: 0.03,
  eyeHeight: 0.0135,
  irisDiameter: 0.0154,
};

function addWhiteColors(geometry: THREE.BufferGeometry): void {
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(
    new Uint8Array(geometry.getAttribute('position').count * 3).fill(255), 3, true,
  ));
}

function tube(radius: number, heights: number[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 32;
  heights.forEach((y, ring) => {
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      positions.push(radius * Math.cos(angle), y, radius * Math.sin(angle));
      if (ring) {
        const a = (ring - 1) * segments + segment;
        const b = (ring - 1) * segments + (segment + 1) % segments;
        indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBody(): THREE.Mesh {
  const geometry = tube(0.065, [0, 0.5, 1, 1.4, 1.42, 1.46, 1.55, 1.7]);
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(
    new Float32Array(geometry.getAttribute('position').count * 3), 3,
  )];
  geometry.morphTargetsRelative = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.morphTargetDictionary = {beta00: 0};
  mesh.morphTargetInfluences = [0];
  return mesh;
}

function makeReferenceHead(): THREE.Group {
  const root = new THREE.Group();
  const face = new THREE.PlaneGeometry(0.13, 0.154, 26, 31);
  face.translate(0, 0.173, 0.09);
  const neck = tube(0.035, [0.046, 0.075]);
  [face, neck].forEach((geometry, index) => {
    addWhiteColors(geometry);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = `reconstructed_skin_reference_${index}`;
    mesh.userData = {...profile, referenceFace};
    root.add(mesh);
  });
  return root;
}

function makeHair(): THREE.Group {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  geometry.scale(0.077, 0.099, 0.07);
  geometry.translate(0, 0.201, -0.02);
  addWhiteColors(geometry);
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.userData = {...profile};
  root.add(mesh);
  return root;
}

function makeColoredTriangles(optIn: boolean): THREE.Group {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.02, 0.01, 0.04, 0.02, 0.01, 0.04, 0, 0.02, 0.05,
    -0.02, 0.11, 0.09, 0.02, 0.11, 0.09, 0, 0.14, 0.1,
  ], 3));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute([
    0, 0, 0, 255, 0, 0, 0, 255, 0,
    128, 64, 255, 255, 128, 64, 64, 255, 128,
  ], 3, true));
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = 'reconstructed_skin_color_fixture';
  if (optIn) mesh.userData = {...profile};
  const root = new THREE.Group();
  root.add(mesh);
  return root;
}

function liveBounds(mesh: THREE.Mesh): THREE.Box3 {
  mesh.updateWorldMatrix(true, false);
  return new THREE.Box3().setFromObject(mesh, true);
}

function firstVisiblePart(head: THREE.Object3D, eye: THREE.Object3D, x: number, y = 0): string {
  head.updateWorldMatrix(true, true);
  const pupil = eye.getObjectByName(`${eye.name}_pupil`) as THREE.Mesh;
  const sclera = eye.getObjectByName(`${eye.name}_sclera`) as THREE.Mesh;
  const eyeScale = liveBounds(sclera).getSize(new THREE.Vector3()).x / referenceFace.eyeWidth;
  const direction = new THREE.Vector3(0, 0, -1).transformDirection(head.matrixWorld);
  const horizontal = new THREE.Vector3(1, 0, 0).transformDirection(head.matrixWorld);
  const vertical = new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld);
  const origin = liveBounds(pupil).getCenter(new THREE.Vector3())
    .addScaledVector(horizontal, x * eyeScale).addScaledVector(vertical, y * eyeScale)
    .addScaledVector(direction, -0.2);
  return new THREE.Raycaster(origin, direction).intersectObject(head, true)[0]?.object.name ?? '';
}

function meshPositions(root: THREE.Object3D): number[] {
  const positions: number[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) positions.push(...Array.from(mesh.geometry.getAttribute('position').array));
  });
  return positions;
}

function boundaryVertices(geometry: THREE.BufferGeometry): number[] {
  const index = geometry.index;
  if (!index) throw new Error('Expected an indexed synthetic surface');
  const edges = new Map<string, {vertices: number[]; count: number}>();
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    for (let edge = 0; edge < 3; edge++) {
      const a = index.getX(triangle + edge);
      const b = index.getX(triangle + (edge + 1) % 3);
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const entry = edges.get(key) ?? {vertices: [a, b], count: 0};
      entry.count++;
      edges.set(key, entry);
    }
  }
  return Array.from(new Set(Array.from(edges.values())
    .filter((edge) => edge.count === 1).flatMap((edge) => edge.vertices)));
}

describe('opt-in reference appearance', () => {
  it('retains normalized glTF vertex colors through cropping and separate hair extraction', () => {
    const head = makeColoredTriangles(true);
    const hair = makeHair();
    const hairSource = (hair.children[0] as THREE.Mesh).geometry.getAttribute('color');
    hairSource.setXYZ(0, 0.2, 0.4, 0.8);
    const expectedHair = [hairSource.getX(0), hairSource.getY(0), hairSource.getZ(0)];
    const prepared = prepareReconstructedHead(head, hair);
    try {
      const colors = prepared.skinMeshes[0].geometry.getAttribute('color');
      expect(colors.count).toBe(3);
      [128, 64, 255, 255, 128, 64, 64, 255, 128].forEach((byte, component) => {
        expect(colors.array[component]).toBeCloseTo(byte / 255, 7);
      });
      const extractedHair = prepared.hairMeshes[0].geometry.getAttribute('color');
      expectedHair.forEach((value, component) => {
        expect(extractedHair.array[component]).toBeCloseTo(value, 7);
      });
      expect(prepared.skinMaterial.vertexColors).toBe(true);
      expect(prepared.hairMaterial.vertexColors).toBe(true);
    } finally {
      disposeReconstructedHead(prepared);
    }
  });

  it('does not apply reference shading, fitted eyes or accessories to unmarked legacy assets', () => {
    const head = makeColoredTriangles(false);
    const hair = makeHair();
    const prepared = prepareReconstructedHead(head, hair);
    try {
      expect(prepared.skinMaterial.vertexColors).toBe(false);
      expect(prepared.hairMaterial.vertexColors).toBe(false);
      expect(prepared.eyes.surfaceFitted).not.toBe(true);
      expect(prepared.root.getObjectByName('reference_blue_headband')).toBeUndefined();
    } finally {
      disposeReconstructedHead(prepared);
    }
  });

  it('keeps the iris and pupil in front of the sclera and fitted skin in both eyes', () => {
    const prepared = prepareReconstructedHead(makeReferenceHead(), makeHair());
    try {
      expect(prepared.eyes.surfaceFitted).toBe(true);
      prepared.eyes.roots.forEach((eye) => {
        expect(firstVisiblePart(prepared.root, eye, 0.001)).toBe(`${eye.name}_pupil`);
        expect(firstVisiblePart(prepared.root, eye, 0.005)).toBe(`${eye.name}_iris`);
        expect(firstVisiblePart(prepared.root, eye, 0.011)).toBe(`${eye.name}_sclera`);
      });
    } finally {
      disposeReconstructedHead(prepared);
    }
  });

  it('enlarges fitted eyes in the face plane without protruding into a sphere', () => {
    const rig = MorphRig.fromMesh(makeBody());
    rig.attachReconstructedHead(makeReferenceHead(), makeHair());
    try {
      rig.applyParams({});
      const head = rig.nodeByName('reconstructed_head') as THREE.Group;
      const eye = head.getObjectByName('reconstructed_eye_left') as THREE.Group;
      const sclera = eye.getObjectByName(`${eye.name}_sclera`) as THREE.Mesh;
      const baselineZ = eye.position.z;
      const before = liveBounds(sclera);
      rig.applyParams({eyes: {eyeSize: 1}});
      const after = liveBounds(sclera);
      expect(after.getSize(new THREE.Vector3()).x).toBeGreaterThan(before.getSize(new THREE.Vector3()).x);
      expect(after.min.z).toBeCloseTo(before.min.z, 7);
      expect(after.max.z).toBeCloseTo(before.max.z, 7);
      expect(eye.position.z).toBeCloseTo(baselineZ, 7);
      expect(firstVisiblePart(head, eye, 0.001)).toBe(`${eye.name}_pupil`);
      expect(firstVisiblePart(head, eye, 0.005)).toBe(`${eye.name}_iris`);
    } finally {
      rig.dispose();
    }
  });

  it('keeps eye controls finite, visible and reversible across their editing range', () => {
    const rig = MorphRig.fromMesh(makeBody());
    rig.attachReconstructedHead(makeReferenceHead(), makeHair());
    try {
      rig.applyParams({});
      const head = rig.nodeByName('reconstructed_head') as THREE.Group;
      const eyes = (rig.nodeByName('reconstructed_eyes') as THREE.Group).children;
      const initialPositions = meshPositions(head);
      const initialTransforms = eyes.map((eye) => ({
        position: eye.position.clone(), scale: eye.scale.clone(), rotation: eye.quaternion.clone(),
      }));
      for (const value of [-1, 1, -0.5, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        rig.applyParams({eyes: {eyeSize: value, eyeDistance: value, eyeTilt: value}});
        expect(meshPositions(head).every(Number.isFinite)).toBe(true);
        eyes.forEach((eye) => {
          expect([...eye.position.toArray(), ...eye.scale.toArray(), ...eye.quaternion.toArray()]
            .every(Number.isFinite)).toBe(true);
          expect({value, visible: firstVisiblePart(head, eye, 0.001)})
            .toEqual({value, visible: `${eye.name}_pupil`});
        });
      }
      rig.applyParams({});
      expect(meshPositions(head)).toEqual(initialPositions);
      eyes.forEach((eye, index) => {
        expect(eye.position.distanceTo(initialTransforms[index].position)).toBeLessThan(1e-8);
        expect(eye.scale.distanceTo(initialTransforms[index].scale)).toBeLessThan(1e-8);
        expect(eye.quaternion.angleTo(initialTransforms[index].rotation)).toBeLessThan(1e-8);
      });
    } finally {
      rig.dispose();
    }
  });

  it('moves the optical eye with the fitted lids at both face-depth extremes and resets exactly', () => {
    const rig = MorphRig.fromMesh(makeBody());
    rig.attachReconstructedHead(makeReferenceHead(), makeHair());
    try {
      rig.applyParams({});
      const head = rig.nodeByName('reconstructed_head') as THREE.Group;
      const initialPositions = meshPositions(head);
      const point = new THREE.Vector3();
      const eyes = (rig.nodeByName('reconstructed_eyes') as THREE.Group).children;
      const samples = eyes.map((eye) => {
        const pupil = eye.getObjectByName(`${eye.name}_pupil`) as THREE.Mesh;
        const lids = head.getObjectByName(`${eye.name}_lids`) as THREE.Mesh;
        const center = liveBounds(pupil).getCenter(new THREE.Vector3());
        const positions = lids.geometry.getAttribute('position');
        const innerLidVertex = boundaryVertices(lids.geometry).sort((a, b) => {
          const distance = (vertex: number): number => {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(lids.matrixWorld);
            return Math.hypot(point.x - center.x, point.y - center.y);
          };
          return distance(a) - distance(b);
        })[0];
        const lidDepth = point.fromBufferAttribute(positions, innerLidVertex)
          .applyMatrix4(lids.matrixWorld).z;
        const optics = ['sclera', 'iris', 'pupil'].map((part) => {
          const mesh = eye.getObjectByName(`${eye.name}_${part}`) as THREE.Mesh;
          return {mesh, depth: liveBounds(mesh).getCenter(new THREE.Vector3()).z};
        });
        expect(firstVisiblePart(head, eye, 0.001)).toBe(`${eye.name}_pupil`);
        return {eye, lids, innerLidVertex, lidDepth, optics};
      });
      for (const faceDepth of [-1, 1]) {
        rig.applyParams({face_shape: {faceDepth}});
        head.updateWorldMatrix(true, true);
        samples.forEach(({eye, lids, innerLidVertex, lidDepth, optics}) => {
          const movedLidDepth = point.fromBufferAttribute(lids.geometry.getAttribute('position'), innerLidVertex)
            .applyMatrix4(lids.matrixWorld).z;
          const lidDisplacement = movedLidDepth - lidDepth;
          expect(lidDisplacement * faceDepth).toBeGreaterThan(0.005);
          optics.forEach(({mesh, depth}) => {
            const movedDepth = liveBounds(mesh).getCenter(new THREE.Vector3()).z;
            expect(movedDepth - depth).toBeCloseTo(lidDisplacement, 6);
          });
          expect(firstVisiblePart(head, eye, 0.001)).toBe(`${eye.name}_pupil`);
          expect(firstVisiblePart(head, eye, 0.005)).toBe(`${eye.name}_iris`);
        });
      }
      rig.applyParams({});
      expect(meshPositions(head)).toEqual(initialPositions);
    } finally {
      rig.dispose();
    }
  });

  it('keeps the fitted lid boundary welded to the face during combined eye and face edits', () => {
    const rig = MorphRig.fromMesh(makeBody());
    rig.attachReconstructedHead(makeReferenceHead(), makeHair());
    try {
      rig.applyParams({});
      const head = rig.nodeByName('reconstructed_head') as THREE.Group;
      const face = head.getObjectByName('reconstructed_skin_reference_0_skin') as THREE.Mesh;
      const facePositions = face.geometry.getAttribute('position');
      const pairs: {lid: THREE.Mesh; lidVertex: number; faceVertex: number}[] = [];
      head.updateWorldMatrix(true, true);
      const facePoint = new THREE.Vector3();
      const lidPoint = new THREE.Vector3();
      for (const side of ['left', 'right']) {
        const lid = head.getObjectByName(`reconstructed_eye_${side}_lids`) as THREE.Mesh;
        const positions = lid.geometry.getAttribute('position');
        for (const lidVertex of boundaryVertices(lid.geometry)) {
          lidPoint.fromBufferAttribute(positions, lidVertex).applyMatrix4(lid.matrixWorld);
          for (let faceVertex = 0; faceVertex < facePositions.count; faceVertex++) {
            facePoint.fromBufferAttribute(facePositions, faceVertex).applyMatrix4(face.matrixWorld);
            if (facePoint.distanceTo(lidPoint) < 1e-7) {
              pairs.push({lid, lidVertex, faceVertex});
              break;
            }
          }
        }
      }
      // The outer rings must share a substantial boundary with the source mesh.
      expect(pairs.length).toBeGreaterThan(24);
      for (const value of [-1, 1, 0]) {
        rig.applyParams({
          eyes: {eyeSize: value, eyeDistance: value, eyeTilt: value},
          face_shape: {faceDepth: value, cheekbones: value},
          jaw_chin: {jawWidth: value},
        });
        head.updateWorldMatrix(true, true);
        pairs.forEach(({lid, lidVertex, faceVertex}) => {
          lidPoint.fromBufferAttribute(lid.geometry.getAttribute('position'), lidVertex)
            .applyMatrix4(lid.matrixWorld);
          facePoint.fromBufferAttribute(facePositions, faceVertex).applyMatrix4(face.matrixWorld);
          expect(facePoint.distanceTo(lidPoint)).toBeLessThan(1e-7);
        });
      }
    } finally {
      rig.dispose();
    }
  });

  it('supplies white vertex multipliers to the neck seam sharing the colored skin material', () => {
    const rig = MorphRig.fromMesh(makeBody());
    rig.attachReconstructedHead(makeReferenceHead(), makeHair());
    try {
      rig.applyParams({skin_color: {skinTone: '#e1b49a'}});
      const seam = rig.nodeByName('neck_seam') as THREE.Mesh;
      const head = rig.nodeByName('reconstructed_head') as THREE.Group;
      const face = head.getObjectByName('reconstructed_skin_reference_0_skin') as THREE.Mesh;
      const material = seam.material as THREE.MeshStandardMaterial;
      expect(material).toBe(face.material);
      expect(material.vertexColors).toBe(true);
      expect(material.color.getHexString()).toBe('e1b49a');
      const colors = seam.geometry.getAttribute('color');
      expect(colors.count).toBe(seam.geometry.getAttribute('position').count);
      expect(Array.from(colors.array).every((value) => value === 1)).toBe(true);
    } finally {
      rig.dispose();
    }
  });

  it('keeps the blue headband attached through hair and head edits and releases its resources', () => {
    const rig = MorphRig.fromMesh(makeBody());
    rig.attachReconstructedHead(makeReferenceHead(), makeHair());
    rig.applyParams({});
    const head = rig.nodeByName('reconstructed_head') as THREE.Group;
    const band = head.getObjectByName('reference_blue_headband') as THREE.Mesh;
    const material = band.material as THREE.MeshStandardMaterial;
    const disposeGeometry = jest.spyOn(band.geometry, 'dispose');
    const disposeMaterial = jest.spyOn(material, 'dispose');
    try {
      const positions = band.geometry.getAttribute('position');
      const initialPositions = Array.from(positions.array);
      const initialHeadScale = head.scale.x;
      const initialColor = material.color.getHexString();
      rig.applyParams({hair: {hairLength: 1, hairVolume: 1, hairColor: '#30151a'}});
      expect(Array.from(positions.array)).not.toEqual(initialPositions);
      expect(material.color.getHexString()).toBe(initialColor);
      expect(band.parent).toBe(rig.nodeByName('reconstructed_hair'));
      const hairEditPositions = Array.from(positions.array);
      const beforeHeadEdit = new THREE.Box3().setFromObject(band).getSize(new THREE.Vector3());
      rig.applyParams({hair: {hairLength: 1, hairVolume: 1}, head_neck: {headSize: 1}});
      head.updateWorldMatrix(true, true);
      const afterHeadEdit = new THREE.Box3().setFromObject(band).getSize(new THREE.Vector3());
      expect(Array.from(positions.array)).toEqual(hairEditPositions);
      expect(afterHeadEdit.x / beforeHeadEdit.x).toBeCloseTo(head.scale.x / initialHeadScale, 6);
      rig.applyParams({});
      expect(Array.from(positions.array)).toEqual(initialPositions);
      rig.applyParams({hair: {hairStyle: 'none'}});
      expect(band.parent?.visible).toBe(false);
    } finally {
      rig.dispose();
    }
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
  });
});
