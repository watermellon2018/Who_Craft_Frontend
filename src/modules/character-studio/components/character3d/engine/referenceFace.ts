import * as THREE from 'three';
import type {PreparedReconstructedEyes} from './reconstructedHead';

export interface ReferenceFace {
  eyeCenters: [[number, number, number], [number, number, number]];
  eyeWidth: number;
  eyeHeight: number;
  irisDiameter: number;
}

export interface ReferenceEyeBoundary {
  eye: number;
  points: THREE.Vector3[];
  normals: THREE.Vector3[];
  colors: THREE.Color[];
}

const PROFILE = 'stylized_reference_v1';
const SEGMENTS = 64;
const LID_OUTER_SCALE = 1.85;

/** These measured controls belong to an opt-in asset, never to every character. */
export function readReferenceFace(meshes: THREE.Mesh[]): ReferenceFace | null {
  for (const mesh of meshes) {
    const data = mesh.userData.sourceProfile === PROFILE ? mesh.userData : mesh.geometry.userData;
    const face = data.referenceFace as ReferenceFace | undefined;
    if (data.sourceProfile !== PROFILE || !face) continue;
    if (!Array.isArray(face.eyeCenters) || face.eyeCenters.length !== 2
      || !face.eyeCenters.every((point) => Array.isArray(point) && point.length === 3
        && point.every((value) => typeof value === 'number' && Number.isFinite(value)))) continue;
    if (![face.eyeWidth, face.eyeHeight, face.irisDiameter].every((value) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 0.06)) continue;
    return face;
  }
  return null;
}

/** Remove the embedded rough eye/lash surface under the new fitted lid patch. */
export function cutReferenceEyeOpenings(
  geometry: THREE.BufferGeometry, transform: THREE.Matrix4, face: ReferenceFace,
): ReferenceEyeBoundary[] {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index?.count ?? position.count;
  const kept: number[] = [];
  const center = new THREE.Vector3();
  const point = new THREE.Vector3();
  const edges = new Map<string, {a: number; b: number; removed: boolean; boundary: boolean}>();
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map((j) => index ? index.getX(i + j) : i + j);
    center.set(0, 0, 0);
    triangle.forEach((vertex) => center.add(point.fromBufferAttribute(position, vertex)));
    center.multiplyScalar(1 / 3).applyMatrix4(transform);
    const inEye = face.eyeCenters.some(([x, y, z]) => {
      const dx = (center.x - x) / (face.eyeWidth * 0.87);
      const dy = (center.y - y - 0.0065) / 0.023;
      return center.z > z - 0.015 && dx * dx + dy * dy < 1;
    });
    for (let j = 0; j < 3; j++) {
      const a = triangle[j];
      const b = triangle[(j + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const existing = edges.get(key);
      if (existing) existing.boundary = existing.removed !== inEye;
      else edges.set(key, {a, b, removed: inEye, boundary: false});
    }
    if (!inEye) kept.push(...triangle);
  }
  geometry.setIndex(kept);
  const adjacency = new Map<number, number[]>();
  edges.forEach(({a, b, boundary}) => {
    if (!boundary) return;
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  });
  const visited = new Set<number>();
  const boundaries: ReferenceEyeBoundary[] = [];
  const normal = geometry.getAttribute('normal');
  const color = geometry.getAttribute('color');
  const normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
  for (const start of Array.from(adjacency.keys())) {
    if (visited.has(start)) continue;
    const loop: number[] = [];
    let previous = -1;
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      loop.push(current);
      const next = adjacency.get(current)?.find((candidate) => candidate !== previous);
      if (next === undefined) break;
      previous = current;
      current = next;
    }
    if (current !== start || loop.length < 12) continue;
    let points = loop.map((vertex) => new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(transform));
    const area = points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p.x * next.y - next.x * p.y;
    }, 0);
    if (area < 0) {loop.reverse(); points = points.reverse();}
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const eye = Math.abs(centerX - face.eyeCenters[0][0]) < Math.abs(centerX - face.eyeCenters[1][0]) ? 0 : 1;
    boundaries.push({eye, points,
      normals: loop.map((vertex) => normal ? new THREE.Vector3().fromBufferAttribute(normal, vertex)
        .applyMatrix3(normalTransform).normalize() : new THREE.Vector3(0, 0, 1)),
      colors: loop.map((vertex) => color ? new THREE.Color(color.getX(vertex), color.getY(vertex), color.getZ(vertex))
        : new THREE.Color(1, 1, 1))});
  }
  return boundaries;
}

/** Local surface samples let the outer lid and brow follow this actual face. */
function surfaceSampler(meshes: THREE.Mesh[]): (x: number, y: number) => {z: number; color: THREE.Color} {
  const cell = 0.003;
  const bins = new Map<string, {x: number; y: number; z: number; color: THREE.Color}[]>();
  const point = new THREE.Vector3();
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position');
    const color = mesh.geometry.getAttribute('color');
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      if (point.z < 0.05 || point.y < 0.12 || point.y > 0.21 || Math.abs(point.x) > 0.075) continue;
      const key = `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}`;
      const entries = bins.get(key) ?? [];
      entries.push({x: point.x, y: point.y, z: point.z, color: color
        ? new THREE.Color().setRGB(color.getX(i), color.getY(i), color.getZ(i)) : new THREE.Color(1, 1, 1)});
      bins.set(key, entries);
    }
  }
  return (x, y) => {
    const candidates: {distance: number; z: number; color: THREE.Color}[] = [];
    const bx = Math.floor(x / cell);
    const by = Math.floor(y / cell);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (const sample of bins.get(`${bx + dx}:${by + dy}`) ?? []) {
          candidates.push({distance: (sample.x - x) ** 2 + (sample.y - y) ** 2,
            z: sample.z, color: sample.color});
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const nearest = candidates.slice(0, 12);
    let sum = 0;
    let z = 0;
    const color = new THREE.Color(0, 0, 0);
    nearest.forEach((sample) => {
      const weight = 1 / (sample.distance + 1e-7);
      sum += weight;
      z += sample.z * weight;
      color.r += sample.color.r * weight;
      color.g += sample.color.g * weight;
      color.b += sample.color.b * weight;
    });
    return sum ? {z: z / sum, color: color.multiplyScalar(1 / sum)}
      : {z: 0.09, color: new THREE.Color(1, 1, 1)};
  };
}

function radialGeometry(
  rings: number,
  sample: (radius: number, angle: number) => {point: THREE.Vector3; color?: THREE.Color},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const {point, color} = sample(ring / (rings - 1), i * Math.PI * 2 / SEGMENTS);
      positions.push(point.x, point.y, point.z);
      colors.push(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1);
      if (ring) {
        const a = (ring - 1) * SEGMENTS + i;
        const b = ring * SEGMENTS + i;
        const c = (ring - 1) * SEGMENTS + (i + 1) % SEGMENTS;
        const d = ring * SEGMENTS + (i + 1) % SEGMENTS;
        indices.push(a, b, c, c, b, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildReferenceEyes(
  root: THREE.Object3D, meshes: THREE.Mesh[], face: ReferenceFace,
  skinMaterial: THREE.MeshStandardMaterial,
  boundaries: ReferenceEyeBoundary[] = [],
): PreparedReconstructedEyes {
  root.updateMatrixWorld(true);
  const surface = surfaceSampler(meshes);
  const group = new THREE.Group();
  group.name = 'reconstructed_eyes';
  group.userData.zoneId = 'eyes';
  const irisMaterial = new THREE.MeshStandardMaterial({color: '#5a98bc', vertexColors: true, roughness: 0.55});
  const scleraMaterial = new THREE.MeshStandardMaterial({color: '#fff5e7', vertexColors: true, roughness: 0.7});
  const pupilMaterial = new THREE.MeshStandardMaterial({color: '#152733', roughness: 0.6});
  const lashMaterial = new THREE.MeshStandardMaterial({color: '#372b29', roughness: 0.9});
  const browMaterial = new THREE.MeshStandardMaterial({color: '#7b573a', roughness: 0.92});
  const highlightMaterial = new THREE.MeshBasicMaterial({color: '#fffaf1'});
  const materials = [irisMaterial, scleraMaterial, pupilMaterial, lashMaterial, browMaterial, highlightMaterial];
  const geometries: THREE.BufferGeometry[] = [];
  const eyeMeshes: THREE.Mesh[] = [];
  const roots: THREE.Group[] = [];
  const basePositions: THREE.Vector3[] = [];
  const canonicalPositions: THREE.Vector3[] = [];
  const halfWidth = face.eyeWidth / 2;
  const upperHeight = face.eyeHeight * 0.56;
  const lowerHeight = face.eyeHeight * 0.44;
  const domeDepth = 0.0026;

  for (let eye = 0; eye < 2; eye++) {
    const [cx, cy, cz] = face.eyeCenters[eye];
    const side = eye === 0 ? -1 : 1;
    const leftDepth = surface(cx - halfWidth, cy).z;
    const rightDepth = surface(cx + halfWidth, cy).z;
    const depthSlope = THREE.MathUtils.clamp((rightDepth - leftDepth) / face.eyeWidth, -0.65, 0.65);
    const origin = new THREE.Vector3(cx, cy, Math.max(cz + 0.0065,
      (leftDepth + rightDepth) / 2 + 0.0005));
    const eyeRoot = new THREE.Group();
    eyeRoot.name = eye === 0 ? 'reconstructed_eye_left' : 'reconstructed_eye_right';
    eyeRoot.userData.zoneId = 'eyes';
    eyeRoot.position.copy(root.worldToLocal(origin.clone()));
    roots.push(eyeRoot);
    basePositions.push(eyeRoot.position.clone());
    canonicalPositions.push(origin.clone());
    const rimPoint = (angle: number): THREE.Vector3 => {
      const s = Math.sin(angle);
      const x = halfWidth * Math.cos(angle);
      return new THREE.Vector3(x,
        s * Math.abs(s) * (s >= 0 ? upperHeight : lowerHeight), depthSlope * x);
    };
    const domeZ = (x: number, y: number): number => {
      const q = Math.min(1, (x / halfWidth) ** 2 + Math.abs(y) / (y >= 0 ? upperHeight : lowerHeight));
      return domeDepth * (1 - q * q) + depthSlope * x;
    };
    const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${eyeRoot.name}_${name}`;
      mesh.userData.zoneId = 'eyes';
      eyeRoot.add(mesh);
      geometries.push(geometry);
      eyeMeshes.push(mesh);
      return mesh;
    };
    add('sclera', radialGeometry(10, (radius, angle) => {
      const point = rimPoint(angle).multiplyScalar(radius);
      point.z = domeZ(point.x, point.y);
      return {point, color: new THREE.Color().setScalar(1 - 0.07 * radius ** 4)};
    }), scleraMaterial);
    const boundary = boundaries.filter((candidate) => {
      if (candidate.eye !== eye) return false;
      const bounds = new THREE.Box3().setFromPoints(candidate.points);
      if (bounds.min.x > cx - halfWidth * 0.8 || bounds.max.x < cx + halfWidth * 0.8
        || bounds.min.y > cy - lowerHeight * 0.8 || bounds.max.y < cy + upperHeight * 0.8) return false;
      let inside = false;
      for (let i = 0, j = candidate.points.length - 1; i < candidate.points.length; j = i++) {
        const a = candidate.points[i];
        const b = candidate.points[j];
        if ((a.y > cy) !== (b.y > cy) && cx < (b.x - a.x) * (cy - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    })
      .sort((a, b) => b.points.length - a.points.length)[0];
    const makeLids = (): THREE.BufferGeometry => {
      if (!boundary) return radialGeometry(24, (t, angle) => {
      const inner = rimPoint(angle);
      const outerX = halfWidth * LID_OUTER_SCALE * Math.cos(angle);
      const outerY = (Math.sin(angle) >= 0 ? 0.034 : 0.025) * Math.sin(angle);
      const point = inner.lerp(new THREE.Vector3(outerX, outerY, 0), t);
      const sample = surface(cx + outerX, cy + outerY);
      const blend = t * t * (3 - 2 * t);
      point.z = depthSlope * point.x * (1 - blend) + (sample.z - origin.z) * blend + 0.00055;
      return {point, color: sample.color};
      });
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const count = boundary.points.length;
      const rings = 18;
      const smoothed = boundary.points.map((_, i) => {
        const point = new THREE.Vector3();
        for (let j = -6; j <= 6; j++) point.add(boundary.points[(i + j + count) % count]);
        return point.multiplyScalar(1 / 13).sub(origin);
      });
      const distances = [0];
      for (let i = 1; i <= count; i++) {
        distances.push(distances[i - 1] + smoothed[i % count].distanceTo(smoothed[i - 1]));
      }
      const first = smoothed[0];
      const startAngle = Math.atan2(first.y / (first.y >= 0 ? upperHeight : lowerHeight), first.x / halfWidth);
      for (let ring = 0; ring < rings; ring++) {
        const t = ring / (rings - 1);
        for (let i = 0; i < count; i++) {
          const outer = boundary.points[i].clone().sub(origin);
          const angle = startAngle + distances[i] / distances[count] * Math.PI * 2;
          const inner = rimPoint(angle);
          const point = inner.clone().lerp(smoothed[i], t);
          const blend = t * t * (3 - 2 * t);
          point.z = inner.z * (1 - blend) + smoothed[i].z * blend;
          point.addScaledVector(outer.sub(smoothed[i]), t ** 10);
          positions.push(point.x, point.y, point.z);
          const color = boundary.colors[i];
          colors.push(color.r, color.g, color.b);
          if (ring) {
            const a = (ring - 1) * count + i;
            const b = ring * count + i;
            const c = (ring - 1) * count + (i + 1) % count;
            const d = ring * count + (i + 1) % count;
            indices.push(a, b, c, c, b, d);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const normals = geometry.getAttribute('normal');
      // Stylized eyelids use a smooth normal field. Dense source triangles have
      // embossed eyelashes; copying that high-frequency relief made the patch
      // look corrugated and cast an artificial dark ring around each eye.
      for (let ring = 0; ring < rings - 1; ring++) {
        const t = ring / (rings - 1);
        for (let i = 0; i < count; i++) {
          const outerNormal = new THREE.Vector3();
          for (let j = -6; j <= 6; j++) outerNormal.add(boundary.normals[(i + j + count) % count]);
          const normal = new THREE.Vector3(-depthSlope, 0.02, 1).normalize()
            .lerp(outerNormal.normalize(), t ** 3).normalize();
          normals.setXYZ(ring * count + i, normal.x, normal.y, normal.z);
        }
      }
      for (let i = 0; i < count; i++) {
        const normal = boundary.normals[i];
        normals.setXYZ((rings - 1) * count + i, normal.x, normal.y, normal.z);
      }
      return geometry;
    };
    const lids = add('lids', makeLids(), skinMaterial);

    const irisRadius = face.irisDiameter / 2;
    add('iris', radialGeometry(12, (radius, angle) => {
      const x = irisRadius * radius * Math.cos(angle);
      let y = irisRadius * radius * Math.sin(angle);
      const aperture = Math.max(0, 1 - (x / halfWidth) ** 2);
      y = THREE.MathUtils.clamp(y, -lowerHeight * aperture, upperHeight * aperture);
      const brightness = radius > 0.88 ? 0.35 : 0.73 + 0.20 * Math.sin(radius * Math.PI)
        + 0.055 * Math.sin(angle * 34 + radius * 12);
      return {point: new THREE.Vector3(x, y, domeZ(x, y) + 0.00012),
        color: new THREE.Color(brightness, brightness, Math.min(1, brightness * 1.06))};
    }), irisMaterial);
    const pupilRadius = irisRadius * 0.40;
    add('pupil', radialGeometry(5, (radius, angle) => {
      const x = pupilRadius * radius * Math.cos(angle);
      const y = pupilRadius * radius * Math.sin(angle);
      return {point: new THREE.Vector3(x, y, domeZ(x, y) + 0.00024)};
    }), pupilMaterial);
    const highlight = add('highlight', new THREE.CircleGeometry(irisRadius * 0.16, 20), highlightMaterial);
    highlight.position.set(-irisRadius * 0.30, irisRadius * 0.32,
      domeZ(-irisRadius * 0.30, irisRadius * 0.32) + 0.0004);
    highlight.rotation.y = -Math.atan(depthSlope);

    for (const upper of [true, false]) {
      const path: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const angle = (upper ? 0 : Math.PI) + i / 40 * Math.PI;
        const point = rimPoint(angle);
        point.z += 0.0006;
        path.push(point);
      }
      add(upper ? 'upper_lash' : 'lower_lash', new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(path), 48, upper ? 0.00048 : 0.00016, 5, false,
      ), lashMaterial);
    }

    const browPositions: number[] = [];
    const browIndices: number[] = [];
    const lidProbe = new THREE.Mesh(lids.geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
    const probe = new THREE.Raycaster();
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const x = side * (Math.abs(cx) - halfWidth * 1.06 + t * halfWidth * 2.24);
      const y = cy + face.eyeHeight * 1.12 + 0.0038 * Math.sin(t * Math.PI) - 0.0012 * t;
      const thickness = (0.0012 + 0.0016 * Math.sin(t * Math.PI)) * (1 - t * 0.87);
      for (const edge of [-1, 1]) {
        const by = y + edge * thickness;
        const sample = surface(x, by);
        probe.set(new THREE.Vector3(x - cx, by - cy, 1), new THREE.Vector3(0, 0, -1));
        const lidDepth = probe.intersectObject(lidProbe, false)[0]?.point.z;
        browPositions.push(x - cx, by - cy, (lidDepth ?? sample.z - origin.z) + 0.00035);
      }
      if (i) {
        const a = (i - 1) * 2;
        const triangle = [a, a + 2, a + 1, a + 1, a + 2, a + 3];
        browIndices.push(...(side > 0 ? triangle : triangle.reverse()));
      }
    }
    lidProbe.material.dispose();
    const brow = new THREE.BufferGeometry();
    brow.setAttribute('position', new THREE.Float32BufferAttribute(browPositions, 3));
    brow.setIndex(browIndices);
    brow.computeVertexNormals();
    const browMesh = add('brow', brow, browMaterial);
    // Keep skin in the head frame; optical parts retain their local transforms.
    // Both are registered in the same canonical face deformation field below.
    for (const mesh of [lids, browMesh]) {
      eyeRoot.remove(mesh);
      mesh.geometry.translate(origin.x, origin.y, origin.z);
      mesh.geometry.applyMatrix4(root.matrixWorld.clone().invert());
      root.add(mesh);
    }
    group.add(eyeRoot);
  }
  root.add(group);
  return {basePositions: basePositions as [THREE.Vector3, THREE.Vector3],
    canonicalPositions: canonicalPositions as [THREE.Vector3, THREE.Vector3],
    geometries, group, irisMaterial, materials, meshes: eyeMeshes, radius: halfWidth,
    roots: roots as [THREE.Group, THREE.Group], span: Math.abs(face.eyeCenters[1][0] - face.eyeCenters[0][0]),
    surfaceFitted: true, browMaterial, faceMeshes: eyeMeshes};
}
