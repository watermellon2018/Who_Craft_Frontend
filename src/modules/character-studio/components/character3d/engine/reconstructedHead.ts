import * as THREE from 'three';

export const RECONSTRUCTED_HEAD_GLB_URL = '/models/reconstructed-head.glb';

// The Hunyuan output is normalized to a 30 cm tall, Y-up, +Z-facing bust.
// Everything below this plane is the generated shoulder plinth rather than the
// character's neck, so those triangles must not enter Character Studio.
export const RECONSTRUCTED_HEAD_CUT_Y = 0.045;

export interface PreparedReconstructedEyes {
  basePositions: [THREE.Vector3, THREE.Vector3];
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  irisMaterial: THREE.MeshStandardMaterial;
  materials: THREE.Material[];
  meshes: THREE.Mesh[];
  radius: number;
  roots: [THREE.Group, THREE.Group];
  span: number;
}

export interface PreparedReconstructedHead {
  bounds: THREE.Box3;
  eyes: PreparedReconstructedEyes;
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
const isFacePoint = (x: number, y: number, z: number): boolean => {
  const faceVertical = (y - 0.175) / 0.082;
  const faceHalfWidth = 0.068 * Math.sqrt(Math.max(0, 1 - faceVertical * faceVertical));
  return (
    y >= 0.093
    && y <= 0.255
    && Math.abs(x) <= Math.max(0.027, faceHalfWidth)
    && z > 0.012
  );
};

const isSkinPoint = (x: number, y: number, z: number): boolean => {
  const ear =
    y >= 0.13
    && y <= 0.22
    && Math.abs(x) >= 0.072
    && Math.abs(x) <= 0.092
    && z > 0.012;
  const neck = y < 0.125 && Math.abs(x) < 0.064;
  return isFacePoint(x, y, z) || ear || neck;
};

const sourceIndices = (geometry: THREE.BufferGeometry): ArrayLike<number> => {
  const index = geometry.getIndex();
  return index ? index.array : Array.from({length: geometry.getAttribute('position').count}, (_, i) => i);
};

const percentile = (values: number[], fraction: number): number => {
  values.sort((a, b) => a - b);
  return values[Math.floor((values.length - 1) * fraction)];
};

const frontSurfaceDepth = (
  meshes: THREE.Mesh[],
  centerX: number,
  centerY: number,
  radius: number,
  fallback: number,
): number => {
  const depths: number[] = [];
  const point = new THREE.Vector3();
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let vertex = 0; vertex < position.count; vertex++) {
      point
        .set(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
        .applyMatrix4(mesh.matrixWorld);
      const dx = (point.x - centerX) / Math.max(radius * 1.25, 1e-6);
      const dy = (point.y - centerY) / Math.max(radius * 0.82, 1e-6);
      if (dx * dx + dy * dy <= 1 && isFacePoint(point.x, point.y, point.z)) {
        depths.push(point.z);
      }
    }
  }
  return depths.length ? percentile(depths, 0.65) : fallback;
};

const estimateEyeLineY = (
  meshes: THREE.Mesh[],
  faceBounds: THREE.Box3,
  centerX: number,
  offsetX: number,
  radius: number,
): number => {
  const faceHeight = faceBounds.max.y - faceBounds.min.y;
  const minY = faceBounds.min.y + faceHeight * 0.05;
  const maxY = faceBounds.min.y + faceHeight * 0.52;
  const binCount = 32;
  const binHeight = Math.max((maxY - minY) / binCount, 1e-6);
  const depths: [number[][], number[][]] = [
    Array.from({length: binCount}, () => []),
    Array.from({length: binCount}, () => []),
  ];
  const point = new THREE.Vector3();

  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let vertex = 0; vertex < position.count; vertex++) {
      point
        .set(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
        .applyMatrix4(mesh.matrixWorld);
      if (point.y < minY || point.y >= maxY || !isFacePoint(point.x, point.y, point.z)) {
        continue;
      }
      const bin = Math.min(binCount - 1, Math.floor((point.y - minY) / binHeight));
      if (Math.abs(point.x - (centerX - offsetX)) <= radius * 1.25) {
        depths[0][bin].push(point.z);
      }
      if (Math.abs(point.x - (centerX + offsetX)) <= radius * 1.25) {
        depths[1][bin].push(point.z);
      }
    }
  }

  const scores: Array<{bin: number; depth: number}> = [];
  for (let bin = 0; bin < binCount; bin++) {
    const sides = depths
      .map((sideDepths) => sideDepths[bin])
      .filter((values) => values.length >= 3)
      .map((values) => percentile(values, 0.65));
    if (sides.length) {
      scores.push({
        bin,
        depth: sides.reduce((sum, depth) => sum + depth, 0) / sides.length,
      });
    }
  }
  if (!scores.length) return faceBounds.min.y + faceHeight * 0.37;

  const depthsOnly = scores.map(({depth}) => depth);
  const minDepth = Math.min(...depthsOnly);
  const maxDepth = Math.max(...depthsOnly);
  const recessedThreshold = minDepth + (maxDepth - minDepth) * 0.22;
  const recessedBins = scores
    .filter(({depth}) => depth <= recessedThreshold)
    .map(({bin}) => bin);
  const eyeBin = Math.max(...recessedBins);
  return Math.min(maxY, minY + (eyeBin + 0.5) * binHeight + radius * 0.15);
};

/**
 * Build actual eye volumes for the normalized reconstructed face. Placement is
 * derived from the measured frontal face bounds and the local surface depth;
 * reference-landmark eye size/distance/tilt are applied later by MorphRig.
 */
const buildReconstructedEyes = (
  root: THREE.Object3D,
  faceBounds: THREE.Box3,
  meshes: THREE.Mesh[],
): PreparedReconstructedEyes => {
  const faceSize = faceBounds.getSize(new THREE.Vector3());
  const faceCenter = faceBounds.getCenter(new THREE.Vector3());
  const radius = Math.max(0.003, Math.min(faceSize.x * 0.095, faceSize.y * 0.09));
  const offsetX = faceSize.x * 0.24;
  const centerY = estimateEyeLineY(meshes, faceBounds, faceCenter.x, offsetX, radius);
  const fallbackZ = faceBounds.max.z - radius * 0.5;

  const scleraMaterial = new THREE.MeshStandardMaterial({
    color: '#eeeae2',
    metalness: 0,
    roughness: 0.28,
  });
  const irisMaterial = new THREE.MeshStandardMaterial({
    color: '#3a6ca8',
    metalness: 0.02,
    roughness: 0.22,
  });
  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: '#100d0c',
    metalness: 0,
    roughness: 0.12,
  });
  scleraMaterial.envMapIntensity = 0.62;
  irisMaterial.envMapIntensity = 0.68;
  pupilMaterial.envMapIntensity = 0.45;

  const scleraGeometry = new THREE.SphereGeometry(radius, 24, 16);
  const irisGeometry = new THREE.SphereGeometry(radius * 0.46, 20, 14);
  const pupilGeometry = new THREE.SphereGeometry(radius * 0.19, 16, 10);
  const geometries = [scleraGeometry, irisGeometry, pupilGeometry];
  const materials = [scleraMaterial, irisMaterial, pupilMaterial];
  const group = new THREE.Group();
  group.name = 'reconstructed_eyes';
  group.userData.zoneId = 'eyes';
  const roots: THREE.Group[] = [];
  const basePositions: THREE.Vector3[] = [];
  const eyeMeshes: THREE.Mesh[] = [];

  for (const side of [-1, 1] as const) {
    const centerX = faceCenter.x + side * offsetX;
    const surfaceZ = frontSurfaceDepth(meshes, centerX, centerY, radius, fallbackZ);
    const worldPosition = new THREE.Vector3(centerX, centerY, surfaceZ - radius * 0.38);
    const localPosition = root.worldToLocal(worldPosition.clone());
    const eyeRoot = new THREE.Group();
    eyeRoot.name = side < 0 ? 'reconstructed_eye_left' : 'reconstructed_eye_right';
    eyeRoot.position.copy(localPosition);
    eyeRoot.userData.zoneId = 'eyes';

    const sclera = new THREE.Mesh(scleraGeometry, scleraMaterial);
    sclera.name = `${eyeRoot.name}_sclera`;
    sclera.scale.set(1.24, 0.72, 0.9);
    sclera.castShadow = true;
    sclera.receiveShadow = true;
    sclera.userData.zoneId = 'eyes';

    const iris = new THREE.Mesh(irisGeometry, irisMaterial);
    iris.name = `${eyeRoot.name}_iris`;
    iris.position.z = radius * 0.78;
    iris.scale.z = 0.28;
    iris.castShadow = true;
    iris.userData.zoneId = 'eyes';

    const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    pupil.name = `${eyeRoot.name}_pupil`;
    pupil.position.z = radius * 0.89;
    pupil.scale.z = 0.24;
    pupil.castShadow = true;
    pupil.userData.zoneId = 'eyes';

    eyeRoot.add(sclera, iris, pupil);
    group.add(eyeRoot);
    roots.push(eyeRoot);
    basePositions.push(localPosition.clone());
    eyeMeshes.push(sclera, iris, pupil);
  }

  root.add(group);
  return {
    basePositions: basePositions as [THREE.Vector3, THREE.Vector3],
    geometries,
    group,
    irisMaterial,
    materials,
    meshes: eyeMeshes,
    radius,
    roots: roots as [THREE.Group, THREE.Group],
    span: Math.abs(basePositions[1].x - basePositions[0].x),
  };
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
  const faceBounds = new THREE.Box3();
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
      const isFace = isFacePoint(centroid.x, centroid.y, centroid.z);
      pushTriangle(isSkinPoint(centroid.x, centroid.y, centroid.z) ? skinIndices : hairIndices, a, b, c);
      if (isFace) {
        for (const vertex of [a, b, c]) {
          point
            .set(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
            .applyMatrix4(mesh.matrixWorld);
          faceBounds.expandByPoint(point);
        }
      }
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

  const eyeFaceBounds = faceBounds.isEmpty() ? bounds : faceBounds;
  const eyes = buildReconstructedEyes(root, eyeFaceBounds, meshes);

  return {bounds, eyes, hairMaterial, meshes, root, skinMaterial};
};

export const disposeReconstructedHead = (head: PreparedReconstructedHead): void => {
  head.meshes.forEach((mesh) => mesh.geometry.dispose());
  head.eyes.geometries.forEach((geometry) => geometry.dispose());
  head.eyes.materials.forEach((material) => material.dispose());
  head.skinMaterial.dispose();
  head.hairMaterial.dispose();
};
