import * as THREE from 'three';

/** An alternate shirt index, with details attached to the live garment surface. */
export interface ReferencePolo {
  readonly index: THREE.BufferAttribute;
  /** Original T-shirt triangle for each alternate triangle (picking/provenance). */
  readonly sourceTriangleIndices: Uint32Array;
  readonly group: THREE.Group;
  readonly meshes: THREE.Mesh[];
  /** Call after the garment positions/normals and neckline have been updated. */
  update(): void;
  /** Owns only detail geometries/materials; never disposes the garment material. */
  dispose(): void;
}

interface Attachment {
  vertices: [number, number, number];
  weights: [number, number, number];
}

interface DetailSurface {
  mesh: THREE.Mesh;
  position: THREE.BufferAttribute;
}

const COLLAR_SEGMENTS = 64;
const PLACKET_SEGMENTS = 18;
const FRONT_GAP_ANGLE = 0.64;
const TWO_PI = Math.PI * 2;

function surface(rows: number, columns: number, material: THREE.Material, name: string): DetailSurface {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(rows * columns * 3), 3);
  geometry.setAttribute('position', position);
  const index: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.userData.zoneId = 'clothing_top';
  mesh.userData.matKind = 'clothing';
  return {mesh, position};
}

function finish(detail: DetailSurface): void {
  detail.position.needsUpdate = true;
  detail.mesh.geometry.computeVertexNormals();
  detail.mesh.geometry.computeBoundingBox();
  detail.mesh.geometry.computeBoundingSphere();
}

/** Closed boundary loops, including sleeve cuffs, from the selected T-shirt cut. */
function boundaryLoops(index: THREE.BufferAttribute, count: number): number[][] {
  const edges = new Map<string, {a: number; b: number; count: number}>();
  for (let i = 0; i < count; i += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const a = index.getX(i + corner);
      const b = index.getX(i + (corner + 1) % 3);
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, {a, b, count: 1});
    }
  }
  const neighbors = new Map<number, number[]>();
  for (const {a, b, count: uses} of Array.from(edges.values())) {
    if (uses !== 1) continue;
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  }
  const loops: number[][] = [];
  const visited = new Set<number>();
  for (const start of Array.from(neighbors.keys())) {
    if (visited.has(start)) continue;
    const loop: number[] = [];
    let vertex = start;
    let previous = -1;
    while (!visited.has(vertex)) {
      visited.add(vertex);
      loop.push(vertex);
      const next = neighbors.get(vertex);
      if (next?.length !== 2) break;
      const following = next[0] === previous ? next[1] : next[0];
      previous = vertex;
      vertex = following;
    }
    if (vertex === start && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/**
 * Build once from resting garment positions and its full index, before switching
 * styles. All lengths derive from the supplied neck boundary. The alternate
 * index removes the front V instead of covering the existing round bib. Vertex
 * IDs remain unchanged, so the body's localToBodyVid picking map remains valid.
 */
export function createReferencePolo(
  geometry: THREE.BufferGeometry,
  neckline: readonly number[],
  tshirtIndexCount: number,
  fabric: THREE.MeshStandardMaterial,
): ReferencePolo | null {
  const position = geometry.getAttribute('position');
  const sourceIndex = geometry.index;
  if (!position || !sourceIndex || neckline.length < 6 || tshirtIndexCount < 3) return null;
  if (neckline.some((vertex) => vertex < 0 || vertex >= position.count)) return null;
  const count = Math.min(sourceIndex.count, Math.floor(tshirtIndexCount / 3) * 3);
  const neckBounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const vertex of neckline) neckBounds.expandByPoint(point.fromBufferAttribute(position, vertex));
  const center = neckBounds.getCenter(new THREE.Vector3());
  const neckWidth = neckBounds.max.x - neckBounds.min.x;
  if (!Number.isFinite(neckWidth) || neckWidth < 1e-5) return null;
  // The garment cut sits on the shoulders, so its boundary is wider than the
  // anatomical neck. Keep the button opening modest relative to that boundary.
  const depth = neckWidth * 0.55;
  const halfOpening = neckWidth * 0.34;
  const tipY = center.y - depth;
  const frontTriangles: number[] = [];
  const kept: number[] = [];
  const sources: number[] = [];
  for (let i = 0; i < count; i += 3) {
    const a = sourceIndex.getX(i);
    const b = sourceIndex.getX(i + 1);
    const c = sourceIndex.getX(i + 2);
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const isFront = z > center.z;
    if (isFront && y > tipY - depth && Math.abs(x - center.x) < neckWidth) frontTriangles.push(i);
    const openingWidth = halfOpening * Math.max(0, (y - tipY) / depth);
    if (isFront && y > tipY && Math.abs(x - center.x) < openingWidth) continue;
    kept.push(a, b, c);
    sources.push(i / 3);
  }
  // A coarse/degenerate fixture with no cut cannot represent a polo opening.
  if (!kept.length || kept.length === count || !frontTriangles.length) return null;

  // Find a barycentric attachment in the original front surface once. Updates
  // only read three live vertices; no dense raycasting on the interactive path.
  const attach = (x: number, y: number): Attachment => {
    let best: Attachment | undefined;
    let bestScore = Infinity;
    for (const offset of frontTriangles) {
      const vertices: [number, number, number] = [
        sourceIndex.getX(offset), sourceIndex.getX(offset + 1), sourceIndex.getX(offset + 2),
      ];
      const [a, b, c] = vertices;
      const ax = position.getX(a); const ay = position.getY(a);
      const bx = position.getX(b); const by = position.getY(b);
      const cx = position.getX(c); const cy = position.getY(c);
      const determinant = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(determinant) < 1e-12) continue;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / determinant;
      const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / determinant;
      const weights: [number, number, number] = [Math.max(0, u), Math.max(0, v), Math.max(0, 1 - u - v)];
      const sum = weights[0] + weights[1] + weights[2];
      weights[0] /= sum; weights[1] /= sum; weights[2] /= sum;
      const px = ax * weights[0] + bx * weights[1] + cx * weights[2];
      const py = ay * weights[0] + by * weights[1] + cy * weights[2];
      const pz = vertices.reduce((value, vertex, corner) => value + position.getZ(vertex) * weights[corner], 0);
      const score = (px - x) ** 2 + (py - y) ** 2 - pz * 1e-10;
      if (score < bestScore) { bestScore = score; best = {vertices, weights}; }
    }
    if (best) return best;
    const vertex = sourceIndex.getX(frontTriangles[0]);
    return {vertices: [vertex, vertex, vertex], weights: [1, 0, 0]};
  };

  // The turned-down collar must lie on the chest/shoulders. A radial ring alone
  // goes through a convex chest. Find a surface attachment once in 3D, including
  // the back of the shirt, then reuse its weights for every body edit.
  const triangle = new THREE.Triangle();
  const nearest = new THREE.Vector3();
  const barycentric = new THREE.Vector3();
  const attachNearest = (target: THREE.Vector3): Attachment => {
    let bestDistance = Infinity;
    let best: Attachment = {vertices: [neckline[0], neckline[0], neckline[0]], weights: [1, 0, 0]};
    for (let offset = 0; offset < count; offset += 3) {
      const a = sourceIndex.getX(offset);
      const b = sourceIndex.getX(offset + 1);
      const c = sourceIndex.getX(offset + 2);
      if (Math.max(position.getY(a), position.getY(b), position.getY(c)) < tipY - depth) continue;
      triangle.a.fromBufferAttribute(position, a);
      triangle.b.fromBufferAttribute(position, b);
      triangle.c.fromBufferAttribute(position, c);
      triangle.closestPointToPoint(target, nearest);
      const distance = nearest.distanceToSquared(target);
      if (distance >= bestDistance) continue;
      triangle.getBarycoord(nearest, barycentric);
      if (!Number.isFinite(barycentric.x + barycentric.y + barycentric.z)) continue;
      if (Math.min(barycentric.x, barycentric.y, barycentric.z) < -1e-6) continue;
      bestDistance = distance;
      best = {vertices: [a, b, c], weights: [barycentric.x, barycentric.y, barycentric.z]};
    }
    return best;
  };

  const trim = new THREE.MeshStandardMaterial({color: '#ece8df', roughness: 0.85, side: THREE.DoubleSide});
  const buttonMaterial = new THREE.MeshStandardMaterial({roughness: 0.56, side: THREE.DoubleSide});
  const group = new THREE.Group();
  group.name = 'reference_polo';
  group.userData.zoneId = 'clothing_top';
  const collar = surface(COLLAR_SEGMENTS + 1, 4, fabric, 'polo_folded_collar');
  const collarTrim = surface(COLLAR_SEGMENTS + 1, 2, trim, 'polo_collar_trim');
  const details: DetailSurface[] = [collar, collarTrim];
  const neckOrder = neckline.map((vertex) => ({
    vertex,
    angle: (Math.atan2(position.getX(vertex) - center.x, position.getZ(vertex) - center.z) + TWO_PI) % TWO_PI,
  })).sort((a, b) => a.angle - b.angle);
  const collarAttachments = Array.from({length: COLLAR_SEGMENTS + 1}, (_, segment) => {
    const angle = FRONT_GAP_ANGLE + segment / COLLAR_SEGMENTS * (TWO_PI - 2 * FRONT_GAP_ANGLE);
    let next = neckOrder.findIndex((entry) => entry.angle >= angle);
    if (next < 0) next = 0;
    const previous = (next + neckOrder.length - 1) % neckOrder.length;
    const lower = neckOrder[previous].angle;
    const span = (neckOrder[next].angle - lower + TWO_PI) % TWO_PI;
    const weight = span > 1e-8 ? ((angle - lower + TWO_PI) % TWO_PI) / span : 0;
    const a = neckOrder[previous].vertex;
    const b = neckOrder[next].vertex;
    const target = new THREE.Vector3().fromBufferAttribute(position, a)
      .lerp(new THREE.Vector3().fromBufferAttribute(position, b), weight);
    target.x += Math.sin(angle) * neckWidth * 0.22;
    target.z += Math.cos(angle) * neckWidth * 0.22;
    target.y -= neckWidth * (0.13 + Math.max(0, Math.cos(angle)) * 0.20);
    return {a, b, weight, angle, outer: attachNearest(target)};
  });

  // Join the actual cut edge to a smooth inner V. The old centroid mask leaves
  // small teeth; a sewn facing bridges them instead of leaving jagged skin gaps.
  const alternateIndex = new THREE.BufferAttribute(Uint32Array.from(kept), 1);
  const edgeKey = (a: number, b: number): string => `${Math.min(a, b)}:${Math.max(a, b)}`;
  const originalEdges = new Set<string>();
  for (const loop of boundaryLoops(sourceIndex, count)) {
    loop.forEach((vertex, i) => originalEdges.add(edgeKey(vertex, loop[(i + 1) % loop.length])));
  }
  const cutNeighbors = new Map<number, number[]>();
  for (const loop of boundaryLoops(alternateIndex, alternateIndex.count)) {
    loop.forEach((a, i) => {
      const b = loop[(i + 1) % loop.length];
      if (originalEdges.has(edgeKey(a, b))) return;
      cutNeighbors.set(a, [...(cutNeighbors.get(a) ?? []), b]);
      cutNeighbors.set(b, [...(cutNeighbors.get(b) ?? []), a]);
    });
  }
  const facing: {detail: DetailSurface; attachments: Attachment[]}[] = [];
  const visitedCut = new Set<number>();
  const starts = Array.from(cutNeighbors.keys()).sort((a, b) =>
    (cutNeighbors.get(a)?.length ?? 0) - (cutNeighbors.get(b)?.length ?? 0),
  );
  for (const start of starts) {
    if (visitedCut.has(start)) continue;
    const chain: number[] = [];
    let vertex: number | undefined = start;
    while (vertex !== undefined && !visitedCut.has(vertex)) {
      visitedCut.add(vertex);
      chain.push(vertex);
      vertex = cutNeighbors.get(vertex)?.find((next) => !visitedCut.has(next));
    }
    if (chain.length < 2) continue;
    const detail = surface(chain.length, 2, fabric, `polo_opening_facing_${facing.length}`);
    const attachments: Attachment[] = [];
    for (const source of chain) {
      const y = Math.max(position.getY(source), tipY + neckWidth * 0.055);
      const side = Math.sign(position.getX(source) - center.x) || 1;
      const opening = Math.max(0, halfOpening * (y - tipY) / depth - neckWidth * 0.025);
      attachments.push(attach(center.x + side * opening, y));
      attachments.push(attach(position.getX(source) + side * neckWidth * 0.035, position.getY(source)));
    }
    facing.push({detail, attachments});
    details.push(detail);
  }

  const plackets = [-1, 1].map((side) => {
    const detail = surface(PLACKET_SEGMENTS + 1, 2, fabric, `polo_placket_${side < 0 ? 'left' : 'right'}`);
    details.push(detail);
    const attachments: Attachment[] = [];
    for (let row = 0; row <= PLACKET_SEGMENTS; row++) {
      const t = row / PLACKET_SEGMENTS;
      // Continue the button band below the opening. Its width is independent of
      // the opening depth, so shortening the V cannot create a broad triangle.
      const y = tipY + depth * 0.10 - depth * 0.90 * t;
      const x = center.x + side * neckWidth * 0.006;
      for (let column = 0; column < 2; column++) attachments.push(attach(x + side * column * neckWidth * 0.065, y));
    }
    return {detail, attachments};
  });
  const attachedDetails = [...facing, ...plackets];

  const neighborIds = new Map<number, Set<number>>();
  for (let i = 0; i < count; i += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const vertex = sourceIndex.getX(i + corner);
      const neighbors = neighborIds.get(vertex) ?? new Set<number>();
      neighbors.add(sourceIndex.getX(i + (corner + 1) % 3));
      neighbors.add(sourceIndex.getX(i + (corner + 2) % 3));
      neighborIds.set(vertex, neighbors);
    }
  }
  const neckSet = new Set(neckline);
  const cuffs = boundaryLoops(sourceIndex, count).filter((loop) => {
    const x = loop.reduce((sum, vertex) => sum + position.getX(vertex), 0) / loop.length;
    return Math.abs(x - center.x) > neckWidth && !loop.some((vertex) => neckSet.has(vertex));
  }).map((loop, index) => {
    const boundary = new Set(loop);
    const inner = loop.map((vertex) => Array.from(neighborIds.get(vertex) ?? [])
      .filter((neighbor) => !boundary.has(neighbor)));
    const detail = surface(loop.length + 1, 2, fabric, `polo_cuff_${index}`);
    details.push(detail);
    return {detail, loop, inner};
  });

  const buttons = [0.18, 0.37, 0.56].map((distance, index) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), buttonMaterial);
    mesh.name = `polo_button_${index}`;
    mesh.userData.zoneId = 'clothing_top';
    mesh.userData.matKind = 'clothing';
    mesh.castShadow = true;
    return {mesh, attachment: attach(center.x + neckWidth * 0.055, tipY - depth * distance)};
  });
  const meshes = [...details.map((detail) => detail.mesh), ...buttons.map(({mesh}) => mesh)];
  group.add(...meshes);

  // Reused scratch; the amount of work is bounded by the small accessory meshes.
  const liveCenter = new THREE.Vector3();
  const base = new THREE.Vector3();
  const other = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const frontAxis = new THREE.Vector3(0, 0, 1);
  const collarBase = new THREE.Vector3();
  const collarOuter = new THREE.Vector3();
  const outerSamples = new Float32Array((COLLAR_SEGMENTS + 1) * 3);
  const smoothSamples = new Float32Array(outerSamples.length);
  const liveBounds = new THREE.Box3();
  const read = (attachment: Attachment): void => {
    const livePosition = geometry.getAttribute('position');
    const liveNormal = geometry.getAttribute('normal');
    base.set(0, 0, 0); normal.set(0, 0, 0);
    for (let corner = 0; corner < 3; corner++) {
      const vertex = attachment.vertices[corner];
      const weight = attachment.weights[corner];
      base.addScaledVector(other.fromBufferAttribute(livePosition, vertex), weight);
      if (liveNormal) normal.addScaledVector(other.fromBufferAttribute(liveNormal, vertex), weight);
    }
    if (normal.lengthSq() < 1e-10) normal.set(0, 0, 1);
    else normal.normalize();
  };
  let disposed = false;
  const update = (): void => {
    if (disposed) return;
    const livePosition = geometry.getAttribute('position');
    const liveNormal = geometry.getAttribute('normal');
    liveBounds.makeEmpty();
    for (const vertex of neckline) liveBounds.expandByPoint(point.fromBufferAttribute(livePosition, vertex));
    liveBounds.getCenter(liveCenter);
    const width = Math.max(1e-6, liveBounds.max.x - liveBounds.min.x);
    const offset = width * 0.012;
    for (let row = 0; row <= COLLAR_SEGMENTS; row++) {
      read(collarAttachments[row].outer);
      base.addScaledVector(normal, offset * 2.5).toArray(outerSamples, row * 3);
    }
    // Body triangle density must not imprint a zig-zag into the white piping.
    // Smooth this tiny sampled curve, with open ends held at the collar tips.
    for (let pass = 0; pass < 5; pass++) {
      smoothSamples.set(outerSamples);
      for (let row = 1; row < COLLAR_SEGMENTS; row++) {
        for (let axis = 0; axis < 3; axis++) {
          const i = row * 3 + axis;
          smoothSamples[i] = outerSamples[i] * 0.5 + (outerSamples[i - 3] + outerSamples[i + 3]) * 0.25;
        }
      }
      outerSamples.set(smoothSamples);
    }
    for (let row = 0; row <= COLLAR_SEGMENTS; row++) {
      const attachment = collarAttachments[row];
      base.fromBufferAttribute(livePosition, attachment.a)
        .lerp(other.fromBufferAttribute(livePosition, attachment.b), attachment.weight);
      collarBase.copy(base);
      collarOuter.fromArray(outerSamples, row * 3);
      direction.set(base.x - liveCenter.x, 0, base.z - liveCenter.z).normalize();
      for (let column = 0; column < 4; column++) {
        // The source shirt stops on the shoulders, outside the throat. An
        // inward stand covers that annular gap before folding onto the chest.
        point.copy(collarBase).addScaledVector(direction, -width * (column === 0 ? 0.15 : 0.10));
        point.y += width * (column === 0 ? 0.055 : 0.095);
        if (column === 2) {
          point.lerp(collarOuter, 0.50);
          point.y += offset;
        }
        if (column === 3) point.copy(collarOuter);
        collar.position.setXYZ(row * 4 + column, point.x, point.y, point.z);
      }
      // Light piping follows the actual folded edge, not a disconnected ring.
      base.fromBufferAttribute(collar.position, row * 4 + 3);
      other.fromBufferAttribute(collar.position, row * 4 + 2);
      const pipingFraction = Math.min(0.25, width * 0.014 / Math.max(1e-6, base.distanceTo(other)));
      for (let column = 0; column < 2; column++) {
        point.copy(base).lerp(other, column * pipingFraction);
        point.y += offset * 0.35;
        point.addScaledVector(direction, offset * 0.35);
        collarTrim.position.setXYZ(row * 2 + column, point.x, point.y, point.z);
      }
    }
    for (const {detail, attachments} of attachedDetails) {
      attachments.forEach((attachment, index) => {
        read(attachment);
        base.addScaledVector(normal, offset);
        detail.position.setXYZ(index, base.x, base.y, base.z);
      });
    }
    for (const {detail, loop, inner} of cuffs) {
      for (let row = 0; row <= loop.length; row++) {
        const source = row % loop.length;
        const vertex = loop[source];
        base.fromBufferAttribute(livePosition, vertex);
        if (liveNormal) normal.fromBufferAttribute(liveNormal, vertex).normalize();
        else normal.set(0, 0, 1);
        direction.set(0, 0, 0);
        for (const neighbor of inner[source]) direction.add(other.fromBufferAttribute(livePosition, neighbor));
        if (inner[source].length) direction.divideScalar(inner[source].length).sub(base).normalize();
        else direction.set(-Math.sign(base.x - liveCenter.x), 0, 0);
        for (let column = 0; column < 2; column++) {
          point.copy(base).addScaledVector(direction, column * width * 0.13).addScaledVector(normal, offset);
          detail.position.setXYZ(row * 2 + column, point.x, point.y, point.z);
        }
      }
    }
    buttonMaterial.color.copy(fabric.color).multiplyScalar(0.67);
    for (const {mesh, attachment} of buttons) {
      read(attachment);
      mesh.position.copy(base).addScaledVector(normal, offset * 2);
      mesh.quaternion.setFromUnitVectors(frontAxis, normal);
      mesh.scale.set(width * 0.030, width * 0.037, width * 0.010);
    }
    details.forEach(finish);
  };
  update();
  return {
    index: alternateIndex,
    sourceTriangleIndices: Uint32Array.from(sources),
    group,
    meshes,
    update,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      meshes.forEach((mesh) => mesh.geometry.dispose());
      trim.dispose();
      buttonMaterial.dispose();
      group.removeFromParent();
    },
  };
}
