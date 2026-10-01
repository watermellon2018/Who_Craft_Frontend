import * as THREE from 'three';

export interface NeckContour {
  points: THREE.Vector3[];
  normals: THREE.Vector3[];
}

/** Ordered, closed edge of a cropped body, retaining its original vertex ids. */
export function upperBoundary(
  geometry: THREE.BufferGeometry, minimumY: number, maximumAbsX = Infinity,
): number[] {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  if (!index) return [];
  const edges = new Map<string, {a: number; b: number; count: number}>();
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j];
      const b = triangle[(j + 1) % 3];
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, {a, b, count: 1});
    }
  }
  const neighbors = new Map<number, number[]>();
  for (const {a, b, count} of Array.from(edges.values())) {
    if (count !== 1 || position.getY(a) < minimumY || position.getY(b) < minimumY) continue;
    if (Math.abs(position.getX(a)) > maximumAbsX || Math.abs(position.getX(b)) > maximumAbsX) continue;
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  }
  const visited = new Set<number>();
  let result: number[] = [];
  for (const start of Array.from(neighbors.keys())) {
    if (visited.has(start)) continue;
    const loop: number[] = [];
    let previous = -1;
    let vertex = start;
    while (!visited.has(vertex)) {
      visited.add(vertex);
      loop.push(vertex);
      const next = neighbors.get(vertex);
      if (next?.length !== 2) break;
      const following = next[0] === previous ? next[1] : next[0];
      previous = vertex;
      vertex = following;
    }
    if (vertex === start && loop.length >= 3 && loop.length > result.length) result = loop;
  }
  let area = 0;
  result.forEach((vertex, i) => {
    const next = result[(i + 1) % result.length];
    area += position.getX(vertex) * position.getZ(next) - position.getX(next) * position.getZ(vertex);
  });
  return area < 0 ? result.reverse() : result;
}

/** Sample the central throat surface, excluding detached strips outside it. */
export function neckContour(
  meshes: THREE.Mesh[], root: THREE.Object3D, bounds: THREE.Box3, samples = 64,
): NeckContour | null {
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const height = bounds.max.y - bounds.min.y;
  const y = bounds.min.y + Math.min(height * 0.25, 0.005);
  const segments: {points: THREE.Vector3[]; normals: THREE.Vector3[]}[] = [];
  const sectionBounds = new THREE.Box3();
  const inThroat = (point: THREE.Vector3): boolean =>
    Math.abs(point.x) < 0.055 && point.z > -0.052 && point.z < 0.055;
  for (const mesh of meshes) {
    const transform = inverseRoot.clone().multiply(mesh.matrixWorld);
    const normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
    const position = mesh.geometry.getAttribute('position');
    if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
    const normal = mesh.geometry.getAttribute('normal');
    const index = mesh.geometry.index;
    const count = index?.count ?? position.count;
    const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const normals = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < count; i += 3) {
      for (let j = 0; j < 3; j++) {
        vertices[j].fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(transform);
        normals[j].fromBufferAttribute(normal, index ? index.getX(i + j) : i + j)
          .applyNormalMatrix(normalTransform);
      }
      if (vertices.every((point) => point.y < y) || vertices.every((point) => point.y > y)) continue;
      const hits: THREE.Vector3[] = [];
      const hitNormals: THREE.Vector3[] = [];
      for (let j = 0; j < 3; j++) {
        const a = vertices[j];
        const b = vertices[(j + 1) % 3];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const t = (y - a.y) / (b.y - a.y);
          hits.push(a.clone().lerp(b, t));
          hitNormals.push(normals[j].clone().lerp(normals[(j + 1) % 3], t).normalize());
        }
      }
      if (hits.length === 2) {
        segments.push({points: hits, normals: hitNormals});
        hits.filter(inThroat).forEach((point) => sectionBounds.expandByPoint(point));
      }
    }
  }
  if (sectionBounds.isEmpty()) return null;
  const center = sectionBounds.getCenter(new THREE.Vector3());
  const contour: THREE.Vector3[] = [];
  const contourNormals: THREE.Vector3[] = [];
  for (let i = 0; i < samples; i++) {
    const angle = i * Math.PI * 2 / samples;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    let radius = 0;
    const normal = new THREE.Vector3();
    for (const {points: [a, b], normals: [na, nb]} of segments) {
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const determinant = dx * ez - dz * ex;
      if (Math.abs(determinant) < 1e-10) continue;
      const ax = a.x - center.x;
      const az = a.z - center.z;
      const distance = (ax * ez - az * ex) / determinant;
      const progress = (ax * dz - az * dx) / determinant;
      const x = center.x + distance * dx;
      const z = center.z + distance * dz;
      // The normalized Hunyuan bust can contain an inner backing and detached
      // side strips. Follow the outer throat inside its anatomical region,
      // rather than the backing alone or the outermost hair/shoulder fragment.
      if (distance > 0 && progress >= 0 && progress <= 1
        && Math.abs(x) < 0.055 && z > -0.052 && z < 0.055) {
        if (distance > radius) {
          radius = distance;
          normal.copy(na).lerp(nb, progress).normalize();
        }
      }
    }
    if (!radius) return null;
    contour.push(new THREE.Vector3(center.x + dx * radius, y, center.z + dz * radius));
    contourNormals.push(normal);
  }
  return {points: contour, normals: contourNormals};
}
