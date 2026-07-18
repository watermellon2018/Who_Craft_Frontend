import * as THREE from 'three';

export const RECONSTRUCTED_HEAD_GLB_URL = '/models/reconstructed-head.glb';

// The Hunyuan output is normalized to a 30 cm tall, Y-up, +Z-facing bust.
// Everything below this plane is the generated shoulder plinth rather than the
// character's neck, so those triangles must not enter Character Studio.
export const RECONSTRUCTED_HEAD_CUT_Y = 0.045;

export interface PreparedReconstructedHead {
  bounds: THREE.Box3;
  hairMaterial: THREE.MeshStandardMaterial;
  meshes: THREE.Mesh[];
  root: THREE.Object3D;
  skinMaterial: THREE.MeshStandardMaterial;
}

const pushTriangle = (target: number[], a: number, b: number, c: number): void => {
  target.push(a, b, c);
};

/**
 * Coarse semantic split for the current fused reconstruction. Hunyuan returns a
 * single watertight surface with no face/hair material labels; the normalized
 * asset contract lets us recover editable skin and hair regions geometrically.
 */
const isSkinPoint = (x: number, y: number, z: number): boolean => {
  const faceVertical = (y - 0.175) / 0.082;
  const faceHalfWidth = 0.068 * Math.sqrt(Math.max(0, 1 - faceVertical * faceVertical));
  const face =
    y >= 0.093
    && y <= 0.255
    && Math.abs(x) <= Math.max(0.027, faceHalfWidth)
    && z > 0.012;
  const ear =
    y >= 0.13
    && y <= 0.22
    && Math.abs(x) >= 0.072
    && Math.abs(x) <= 0.092
    && z > 0.012;
  const neck = y < 0.125 && Math.abs(x) < 0.064;
  return face || ear || neck;
};

const sourceIndices = (geometry: THREE.BufferGeometry): ArrayLike<number> => {
  const index = geometry.getIndex();
  return index ? index.array : Array.from({length: geometry.getAttribute('position').count}, (_, i) => i);
};

/** Hide the original SMPL head while retaining the shared vertex/morph arrays. */
export const keepGeometryBelowY = (
  geometry: THREE.BufferGeometry,
  cutY: number,
): number => {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const indices = sourceIndices(geometry);
  const kept: number[] = [];

  for (let offset = 0; offset + 2 < indices.length; offset += 3) {
    const a = indices[offset];
    const b = indices[offset + 1];
    const c = indices[offset + 2];
    const centroidY = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    if (centroidY < cutY) pushTriangle(kept, a, b, c);
  }

  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(kept), 1));
  geometry.computeBoundingSphere();
  return kept.length / 3;
};

/**
 * Remove the generated plinth, split the fused mesh into skin/hair material
 * groups, and tag it for the existing Character Studio selection system.
 */
export const prepareReconstructedHead = (
  root: THREE.Object3D,
): PreparedReconstructedHead => {
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dac0a3'),
    metalness: 0.02,
    roughness: 0.7,
  });
  const hairMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c7753d'),
    metalness: 0.02,
    roughness: 0.82,
  });
  skinMaterial.envMapIntensity = 0.5;
  hairMaterial.envMapIntensity = 0.35;

  const importedMaterials = new Set<THREE.Material>();
  const meshes: THREE.Mesh[] = [];
  const centroid = new THREE.Vector3();
  const point = new THREE.Vector3();
  const visibleBounds = new THREE.Box3();
  root.updateMatrixWorld(true);

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!position) return;

    const oldMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    oldMaterials.forEach((material) => importedMaterials.add(material));

    const indices = sourceIndices(geometry);
    const skinIndices: number[] = [];
    const hairIndices: number[] = [];
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const a = indices[offset];
      const b = indices[offset + 1];
      const c = indices[offset + 2];
      centroid
        .set(
          (position.getX(a) + position.getX(b) + position.getX(c)) / 3,
          (position.getY(a) + position.getY(b) + position.getY(c)) / 3,
          (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3,
        )
        .applyMatrix4(mesh.matrixWorld);
      if (centroid.y < RECONSTRUCTED_HEAD_CUT_Y) continue;
      pushTriangle(isSkinPoint(centroid.x, centroid.y, centroid.z) ? skinIndices : hairIndices, a, b, c);
    }

    const combined = new Uint32Array(skinIndices.length + hairIndices.length);
    combined.set(skinIndices);
    combined.set(hairIndices, skinIndices.length);
    for (let offset = 0; offset < combined.length; offset++) {
      const vertex = combined[offset];
      point
        .set(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
        .applyMatrix4(mesh.matrixWorld);
      visibleBounds.expandByPoint(point);
    }
    geometry.setIndex(new THREE.BufferAttribute(combined, 1));
    geometry.clearGroups();
    if (skinIndices.length) geometry.addGroup(0, skinIndices.length, 0);
    if (hairIndices.length) geometry.addGroup(skinIndices.length, hairIndices.length, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    mesh.material = [skinMaterial, hairMaterial];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.zoneId = 'face';
    meshes.push(mesh);
  });

  importedMaterials.forEach((material) => material.dispose());
  if (!meshes.length) {
    skinMaterial.dispose();
    hairMaterial.dispose();
    throw new Error('Reconstructed head GLB contained no mesh');
  }

  root.name = 'reconstructed_head';
  root.userData.zoneId = 'face';
  const bounds = visibleBounds;
  if (bounds.isEmpty()) {
    skinMaterial.dispose();
    hairMaterial.dispose();
    throw new Error('Reconstructed head GLB has empty bounds');
  }

  return {bounds, hairMaterial, meshes, root, skinMaterial};
};

export const disposeReconstructedHead = (head: PreparedReconstructedHead): void => {
  head.meshes.forEach((mesh) => mesh.geometry.dispose());
  head.skinMaterial.dispose();
  head.hairMaterial.dispose();
};
