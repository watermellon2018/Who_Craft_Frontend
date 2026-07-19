import * as THREE from 'three';

export const RECONSTRUCTED_HEAD_GLB_URL = '/models/reconstructed-head.glb';

// The Hunyuan output is normalized to a 30 cm tall, Y-up, +Z-facing bust.
// Everything below this plane is the generated shoulder plinth rather than the
// character's neck, so those triangles must not enter Character Studio.
export const RECONSTRUCTED_HEAD_CUT_Y = 0.045;
const RECONSTRUCTED_NECK_BAND_MAX_Y = RECONSTRUCTED_HEAD_CUT_Y + 0.03;
const RECONSTRUCTED_EYE_RADIUS_TO_FACE_WIDTH = 0.08;
const RECONSTRUCTED_EYE_RADIUS_TO_FACE_HEIGHT = 0.075;
const RECONSTRUCTED_EYE_HORIZONTAL_OFFSET = 0.235;
const RECONSTRUCTED_EYE_SOCKET_SEATING = 0.9;
const RECONSTRUCTED_IRIS_RADIUS_RATIO = 0.43;
const RECONSTRUCTED_PUPIL_RADIUS_RATIO = 0.18;
const RECONSTRUCTED_HIGHLIGHT_RADIUS_RATIO = 0.065;

export interface PreparedReconstructedEyes {
  basePositions: [THREE.Vector3, THREE.Vector3];
  canonicalPositions: [THREE.Vector3, THREE.Vector3];
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  irisMaterial: THREE.MeshStandardMaterial;
  materials: THREE.Material[];
  meshes: THREE.Mesh[];
  radius: number;
  roots: [THREE.Group, THREE.Group];
  span: number;
}

export interface PreparedReconstructedFaceSurface {
  baseCanonicalPositions: Float32Array;
  faceVertexIndices: Uint32Array;
  faceWeights: Float32Array;
  localFromCanonical: THREE.Matrix4;
  mesh: THREE.Mesh;
}

export interface PreparedReconstructedHairSurface {
  baseCanonicalPositions: Float32Array;
  localFromCanonical: THREE.Matrix4;
  mesh: THREE.Mesh;
}

export interface PreparedReconstructedHead {
  bounds: THREE.Box3;
  eyes: PreparedReconstructedEyes;
  faceBounds: THREE.Box3;
  faceSurfaces: PreparedReconstructedFaceSurface[];
  hairBounds: THREE.Box3;
  hairGroup: THREE.Group;
  hairMaterial: THREE.MeshStandardMaterial;
  hairMeshes: THREE.Mesh[];
  hairSurfaces: PreparedReconstructedHairSurface[];
  meshes: THREE.Mesh[];
  neckBounds: THREE.Box3;
  root: THREE.Object3D;
  skinMeshes: THREE.Mesh[];
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

const reconstructedFaceWeight = (x: number, y: number, z: number): number => {
  if (!isFacePoint(x, y, z)) return 0;
  const faceVertical = (y - 0.175) / 0.082;
  const faceHalfWidth = Math.max(
    0.027,
    0.068 * Math.sqrt(Math.max(0, 1 - faceVertical * faceVertical)),
  );
  const horizontalFade = Math.max(0, Math.min(1, (faceHalfWidth - Math.abs(x)) / 0.012));
  const lowerFade = Math.max(0, Math.min(1, (y - 0.088) / 0.018));
  const upperFade = Math.max(0, Math.min(1, (0.263 - y) / 0.022));
  const depthFade = Math.max(0, Math.min(1, (z - 0.012) / 0.025));
  return horizontalFade * lowerFade * upperFade * depthFade;
};

const isNeckPoint = (x: number, y: number, z: number): boolean =>
  y < 0.115
  && Math.abs(x) < 0.067
  && z > -0.075
  && z < 0.065;

const isSkinPoint = (x: number, y: number, z: number): boolean => {
  const jawProgress = THREE.MathUtils.clamp((y - 0.072) / 0.095, 0, 1);
  const jawHalfWidth = 0.07 + 0.025 * Math.sin(jawProgress * Math.PI * 0.5);
  const lowerFace =
    y >= 0.072
    && y <= 0.19
    && Math.abs(x) <= jawHalfWidth
    && z > -0.13;
  const ear =
    y >= 0.13
    && y <= 0.22
    && Math.abs(x) >= 0.072
    && Math.abs(x) <= 0.092
    && z > 0.012;
  return isFacePoint(x, y, z) || lowerFace || ear || isNeckPoint(x, y, z);
};

const sourceIndices = (geometry: THREE.BufferGeometry): ArrayLike<number> => {
  const index = geometry.getIndex();
  return index ? index.array : Array.from({length: geometry.getAttribute('position').count}, (_, i) => i);
};

const attributeComponent = (
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number,
  component: number,
): number => {
  if (component === 0) return attribute.getX(index);
  if (component === 1) return attribute.getY(index);
  if (component === 2) return attribute.getZ(index);
  if (component === 3) return attribute.getW(index);
  return 0;
};

/** Copy only the vertices used by one semantic region instead of duplicating an 800k-vertex head. */
const extractGeometry = (
  source: THREE.BufferGeometry,
  triangleIndices: number[],
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  const sourceVertices: number[] = [];
  const compactIndices = new Uint32Array(triangleIndices.length);
  const sourceVertexCount = source.getAttribute('position').count;
  const remappedVertices = new Int32Array(sourceVertexCount);
  remappedVertices.fill(-1);

  for (let index = 0; index < triangleIndices.length; index++) {
    const sourceVertex = triangleIndices[index];
    let compactVertex = remappedVertices[sourceVertex];
    if (compactVertex < 0) {
      compactVertex = sourceVertices.length;
      remappedVertices[sourceVertex] = compactVertex;
      sourceVertices.push(sourceVertex);
    }
    compactIndices[index] = compactVertex;
  }

  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new Float32Array(sourceVertices.length * attribute.itemSize);
    for (let vertex = 0; vertex < sourceVertices.length; vertex++) {
      for (let component = 0; component < attribute.itemSize; component++) {
        values[vertex * attribute.itemSize + component] = attributeComponent(
          attribute,
          sourceVertices[vertex],
          component,
        );
      }
    }
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized),
    );
  }
  geometry.setIndex(new THREE.BufferAttribute(compactIndices, 1));
  if (!geometry.getAttribute('normal') && geometry.getAttribute('position')) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
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
  return depths.length ? percentile(depths, 0.8) : fallback;
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
  const radius = Math.max(
    0.003,
    Math.min(
      faceSize.x * RECONSTRUCTED_EYE_RADIUS_TO_FACE_WIDTH,
      faceSize.y * RECONSTRUCTED_EYE_RADIUS_TO_FACE_HEIGHT,
    ),
  );
  const offsetX = faceSize.x * RECONSTRUCTED_EYE_HORIZONTAL_OFFSET;
  const centerY = estimateEyeLineY(meshes, faceBounds, faceCenter.x, offsetX, radius);
  const fallbackZ = faceBounds.max.z - radius * 0.5;

  const scleraMaterial = new THREE.MeshStandardMaterial({
    color: '#f2eee7',
    metalness: 0,
    roughness: 0.24,
  });
  const irisMaterial = new THREE.MeshStandardMaterial({
    color: '#3a6ca8',
    metalness: 0.02,
    roughness: 0.18,
  });
  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: '#100d0c',
    metalness: 0,
    roughness: 0.08,
  });
  const highlightMaterial = new THREE.MeshStandardMaterial({
    color: '#fffdf7',
    emissive: '#ffffff',
    emissiveIntensity: 0.65,
    metalness: 0,
    roughness: 0.06,
  });
  highlightMaterial.toneMapped = false;
  scleraMaterial.envMapIntensity = 0.62;
  irisMaterial.envMapIntensity = 0.72;
  pupilMaterial.envMapIntensity = 0.38;
  highlightMaterial.envMapIntensity = 0.2;

  const scleraGeometry = new THREE.SphereGeometry(radius, 24, 16);
  const irisGeometry = new THREE.SphereGeometry(
    radius * RECONSTRUCTED_IRIS_RADIUS_RATIO,
    20,
    14,
  );
  const pupilGeometry = new THREE.SphereGeometry(
    radius * RECONSTRUCTED_PUPIL_RADIUS_RATIO,
    16,
    10,
  );
  const highlightGeometry = new THREE.SphereGeometry(
    radius * RECONSTRUCTED_HIGHLIGHT_RADIUS_RATIO,
    12,
    8,
  );
  const geometries = [
    scleraGeometry,
    irisGeometry,
    pupilGeometry,
    highlightGeometry,
  ];
  const materials = [
    scleraMaterial,
    irisMaterial,
    pupilMaterial,
    highlightMaterial,
  ];
  const group = new THREE.Group();
  group.name = 'reconstructed_eyes';
  group.userData.zoneId = 'eyes';
  const roots: THREE.Group[] = [];
  const basePositions: THREE.Vector3[] = [];
  const canonicalPositions: THREE.Vector3[] = [];
  const eyeMeshes: THREE.Mesh[] = [];

  for (const side of [-1, 1] as const) {
    const centerX = faceCenter.x + side * offsetX;
    const surfaceZ = frontSurfaceDepth(meshes, centerX, centerY, radius, fallbackZ);
    const worldPosition = new THREE.Vector3(
      centerX,
      centerY,
      surfaceZ - radius * RECONSTRUCTED_EYE_SOCKET_SEATING,
    );
    const localPosition = root.worldToLocal(worldPosition.clone());
    const eyeRoot = new THREE.Group();
    eyeRoot.name = side < 0 ? 'reconstructed_eye_left' : 'reconstructed_eye_right';
    eyeRoot.position.copy(localPosition);
    eyeRoot.userData.zoneId = 'eyes';

    const sclera = new THREE.Mesh(scleraGeometry, scleraMaterial);
    sclera.name = `${eyeRoot.name}_sclera`;
    sclera.scale.set(1.18, 0.7, 0.86);
    sclera.castShadow = true;
    sclera.receiveShadow = true;
    sclera.userData.zoneId = 'eyes';

    const iris = new THREE.Mesh(irisGeometry, irisMaterial);
    iris.name = `${eyeRoot.name}_iris`;
    iris.position.z = radius * 0.81;
    iris.scale.z = 0.18;
    iris.castShadow = true;
    iris.userData.zoneId = 'eyes';

    const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    pupil.name = `${eyeRoot.name}_pupil`;
    pupil.position.z = radius * 0.86;
    pupil.scale.z = 0.14;
    pupil.castShadow = true;
    pupil.userData.zoneId = 'eyes';

    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.name = eyeRoot.name + '_highlight';
    highlight.position.set(-radius * 0.11, radius * 0.13, radius * 0.9);
    highlight.scale.set(1, 0.78, 0.12);
    highlight.userData.zoneId = 'eyes';

    eyeRoot.add(sclera, iris, pupil, highlight);
    group.add(eyeRoot);
    roots.push(eyeRoot);
    basePositions.push(localPosition.clone());
    canonicalPositions.push(worldPosition);
    eyeMeshes.push(sclera, iris, pupil, highlight);
  }

  root.add(group);
  return {
    basePositions: basePositions as [THREE.Vector3, THREE.Vector3],
    canonicalPositions: canonicalPositions as [THREE.Vector3, THREE.Vector3],
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
 * Remove the generated plinth and turn Hunyuan's fused surface into two real
 * runtime assets. Skin keeps the source-node transform; hair is compacted into
 * a dedicated root-local group so it can be selected and deformed independently.
 */
export const prepareReconstructedHead = (
  root: THREE.Object3D,
  separateHairRoot?: THREE.Object3D | null,
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

  const importedGeometries = new Set<THREE.BufferGeometry>();
  const importedMaterials = new Set<THREE.Material>();
  const meshes: THREE.Mesh[] = [];
  const skinMeshes: THREE.Mesh[] = [];
  const hairMeshes: THREE.Mesh[] = [];
  const faceSurfaces: PreparedReconstructedFaceSurface[] = [];
  const hairSurfaces: PreparedReconstructedHairSurface[] = [];
  const centroid = new THREE.Vector3();
  const point = new THREE.Vector3();
  const visibleBounds = new THREE.Box3();
  const faceBounds = new THREE.Box3();
  const hairBounds = new THREE.Box3();
  const neckBounds = new THREE.Box3();
  const hairGroup = new THREE.Group();
  hairGroup.name = 'reconstructed_hair';
  hairGroup.userData.zoneId = 'hair';

  root.updateMatrixWorld(true);
  const rootWorldInverse = root.matrixWorld.clone().invert();
  const sourceMeshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) sourceMeshes.push(mesh);
  });
  const semanticSkinOnly =
    !!separateHairRoot
    && sourceMeshes.length > 0
    && sourceMeshes.every((mesh) => mesh.name.startsWith('reconstructed_skin_'));

  for (let meshIndex = 0; meshIndex < sourceMeshes.length; meshIndex++) {
    const mesh = sourceMeshes[meshIndex];
    const sourceGeometry = mesh.geometry;
    const sourcePosition = sourceGeometry.getAttribute('position') as
      | THREE.BufferAttribute
      | undefined;
    if (!sourcePosition) continue;

    importedGeometries.add(sourceGeometry);
    const oldMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    oldMaterials.forEach((material) => importedMaterials.add(material));

    const indices = sourceIndices(sourceGeometry);
    const skinIndices: number[] = [];
    const hairIndices: number[] = [];
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const a = indices[offset];
      const b = indices[offset + 1];
      const c = indices[offset + 2];
      centroid
        .set(
          (sourcePosition.getX(a) + sourcePosition.getX(b) + sourcePosition.getX(c)) / 3,
          (sourcePosition.getY(a) + sourcePosition.getY(b) + sourcePosition.getY(c)) / 3,
          (sourcePosition.getZ(a) + sourcePosition.getZ(b) + sourcePosition.getZ(c)) / 3,
        )
        .applyMatrix4(mesh.matrixWorld);
      if (centroid.y < RECONSTRUCTED_HEAD_CUT_Y) continue;

      const skinPoint = semanticSkinOnly || isSkinPoint(centroid.x, centroid.y, centroid.z);
      if (!skinPoint && separateHairRoot) continue;
      const target = skinPoint
        ? skinIndices
        : hairIndices;
      const isLowerNeck =
        target === skinIndices
        && centroid.y <= RECONSTRUCTED_NECK_BAND_MAX_Y
        && isNeckPoint(centroid.x, centroid.y, centroid.z);
      pushTriangle(target, a, b, c);
      for (const vertex of [a, b, c]) {
        point
          .set(
            sourcePosition.getX(vertex),
            sourcePosition.getY(vertex),
            sourcePosition.getZ(vertex),
          )
          .applyMatrix4(mesh.matrixWorld);
        visibleBounds.expandByPoint(point);
        if (target === hairIndices) hairBounds.expandByPoint(point);
        if (isLowerNeck) neckBounds.expandByPoint(point);
        if (isFacePoint(centroid.x, centroid.y, centroid.z)) faceBounds.expandByPoint(point);
      }
    }

    if (skinIndices.length) {
      const skinGeometry = extractGeometry(sourceGeometry, skinIndices);
      mesh.geometry = skinGeometry;
      mesh.material = skinMaterial;
      mesh.name = `${mesh.name || `reconstructed_surface_${meshIndex}`}_skin`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.zoneId = 'face';
      mesh.visible = true;
      meshes.push(mesh);
      skinMeshes.push(mesh);

      const canonicalFromLocal = mesh.matrixWorld.clone();
      const localFromCanonical = canonicalFromLocal.clone().invert();
      const position = skinGeometry.getAttribute('position') as THREE.BufferAttribute;
      const baseCanonicalPositions: number[] = [];
      const faceVertexIndices: number[] = [];
      const faceWeights: number[] = [];
      for (let vertex = 0; vertex < position.count; vertex++) {
        point
          .set(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
          .applyMatrix4(canonicalFromLocal);
        const weight = reconstructedFaceWeight(point.x, point.y, point.z);
        if (weight <= 0) continue;
        faceVertexIndices.push(vertex);
        faceWeights.push(weight);
        baseCanonicalPositions.push(point.x, point.y, point.z);
      }
      faceSurfaces.push({
        baseCanonicalPositions: new Float32Array(baseCanonicalPositions),
        faceVertexIndices: new Uint32Array(faceVertexIndices),
        faceWeights: new Float32Array(faceWeights),
        localFromCanonical,
        mesh,
      });
    } else {
      mesh.geometry = new THREE.BufferGeometry();
      mesh.material = skinMaterial;
      mesh.visible = false;
      meshes.push(mesh);
    }

    if (hairIndices.length) {
      const hairGeometry = extractGeometry(sourceGeometry, hairIndices);
      const sourceToRoot = rootWorldInverse.clone().multiply(mesh.matrixWorld);
      hairGeometry.applyMatrix4(sourceToRoot);
      const hairMesh = new THREE.Mesh(hairGeometry, hairMaterial);
      hairMesh.name = `${mesh.name || `reconstructed_surface_${meshIndex}`}_hair`;
      hairMesh.castShadow = true;
      hairMesh.receiveShadow = true;
      hairMesh.userData.zoneId = 'hair';
      hairGroup.add(hairMesh);
      meshes.push(hairMesh);
      hairMeshes.push(hairMesh);

      const position = hairGeometry.getAttribute('position') as THREE.BufferAttribute;
      const baseCanonicalPositions = new Float32Array(position.count * 3);
      for (let vertex = 0; vertex < position.count; vertex++) {
        const offset = vertex * 3;
        baseCanonicalPositions[offset] = position.getX(vertex);
        baseCanonicalPositions[offset + 1] = position.getY(vertex);
        baseCanonicalPositions[offset + 2] = position.getZ(vertex);
      }
      hairSurfaces.push({
        baseCanonicalPositions,
        localFromCanonical: new THREE.Matrix4(),
        mesh: hairMesh,
      });
    }
  }

  if (separateHairRoot) {
    separateHairRoot.updateMatrixWorld(true);
    const separateHairMeshes: THREE.Mesh[] = [];
    separateHairRoot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) separateHairMeshes.push(mesh);
    });
    for (let meshIndex = 0; meshIndex < separateHairMeshes.length; meshIndex++) {
      const sourceMesh = separateHairMeshes[meshIndex];
      const sourceGeometry = sourceMesh.geometry;
      const sourcePosition = sourceGeometry.getAttribute('position') as
        | THREE.BufferAttribute
        | undefined;
      if (!sourcePosition) continue;

      importedGeometries.add(sourceGeometry);
      const oldMaterials = Array.isArray(sourceMesh.material)
        ? sourceMesh.material
        : [sourceMesh.material];
      oldMaterials.forEach((material) => importedMaterials.add(material));
      const hairGeometry = extractGeometry(
        sourceGeometry,
        Array.from(sourceIndices(sourceGeometry)),
      );
      const sourceToRoot = rootWorldInverse.clone().multiply(sourceMesh.matrixWorld);
      hairGeometry.applyMatrix4(sourceToRoot);
      const hairMesh = new THREE.Mesh(hairGeometry, hairMaterial);
      hairMesh.name = `generated_hair_asset_${meshIndex}`;
      hairMesh.castShadow = true;
      hairMesh.receiveShadow = true;
      hairMesh.userData.zoneId = 'hair';
      hairGroup.add(hairMesh);
      meshes.push(hairMesh);
      hairMeshes.push(hairMesh);

      const position = hairGeometry.getAttribute('position') as THREE.BufferAttribute;
      const baseCanonicalPositions = new Float32Array(position.count * 3);
      for (let vertex = 0; vertex < position.count; vertex++) {
        const offset = vertex * 3;
        point.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
        hairBounds.expandByPoint(point);
        visibleBounds.expandByPoint(point);
        baseCanonicalPositions[offset] = point.x;
        baseCanonicalPositions[offset + 1] = point.y;
        baseCanonicalPositions[offset + 2] = point.z;
      }
      hairSurfaces.push({
        baseCanonicalPositions,
        localFromCanonical: new THREE.Matrix4(),
        mesh: hairMesh,
      });
    }
  }

  importedGeometries.forEach((geometry) => geometry.dispose());
  importedMaterials.forEach((material) => material.dispose());
  if (!skinMeshes.length && !hairMeshes.length) {
    skinMaterial.dispose();
    hairMaterial.dispose();
    throw new Error('Reconstructed head GLB contained no mesh');
  }

  root.name = 'reconstructed_head';
  root.userData.zoneId = 'face';
  root.add(hairGroup);
  const bounds = visibleBounds;
  if (bounds.isEmpty()) {
    skinMaterial.dispose();
    hairMaterial.dispose();
    throw new Error('Reconstructed head GLB has empty bounds');
  }

  const eyeFaceBounds = faceBounds.isEmpty() ? bounds : faceBounds;
  let measuredNeckBounds = neckBounds;
  if (measuredNeckBounds.isEmpty()) {
    const headSize = bounds.getSize(new THREE.Vector3());
    const faceSize = eyeFaceBounds.getSize(new THREE.Vector3());
    const faceCenter = eyeFaceBounds.getCenter(new THREE.Vector3());
    const halfWidth = Math.max(faceSize.x * 0.28, headSize.x * 0.16, 0.005);
    const halfDepth = Math.max(faceSize.z * 0.3, headSize.z * 0.16, 0.005);
    const centerZ = faceCenter.z - faceSize.z * 0.18;
    const neckHeight = Math.max(headSize.y * 0.08, 0.005);
    measuredNeckBounds = new THREE.Box3(
      new THREE.Vector3(faceCenter.x - halfWidth, bounds.min.y, centerZ - halfDepth),
      new THREE.Vector3(faceCenter.x + halfWidth, bounds.min.y + neckHeight, centerZ + halfDepth),
    );
  }
  const facialEyeSurfaces = skinMeshes.filter(
    (mesh) => !mesh.name.includes('_backing_'),
  );
  const eyes = buildReconstructedEyes(
    root,
    eyeFaceBounds,
    facialEyeSurfaces.length ? facialEyeSurfaces : skinMeshes,
  );

  return {
    bounds,
    eyes,
    faceBounds: eyeFaceBounds.clone(),
    faceSurfaces,
    hairBounds,
    hairGroup,
    hairMaterial,
    hairMeshes,
    hairSurfaces,
    meshes,
    neckBounds: measuredNeckBounds,
    root,
    skinMeshes,
    skinMaterial,
  };
};

export const disposeReconstructedHead = (head: PreparedReconstructedHead): void => {
  head.meshes.forEach((mesh) => mesh.geometry.dispose());
  head.eyes.geometries.forEach((geometry) => geometry.dispose());
  head.eyes.materials.forEach((material) => material.dispose());
  head.skinMaterial.dispose();
  head.hairMaterial.dispose();
};
