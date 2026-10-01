import * as THREE from 'three';

export interface RigHit {
  object: THREE.Object3D;
  point: THREE.Vector3;
  faceIndex?: number | null;
}

export interface AnatomicalHit {
  zoneId: string;
  side: 'L' | 'R' | null;
}

/** Recover the rest point from the hit triangle, even after morphing/posing. */
export function restPointForHit(
  hit: RigHit,
  mesh: THREE.Mesh,
  restPositions: Float32Array,
  vertexMap?: Int32Array,
): THREE.Vector3 | null {
  if (hit.faceIndex == null || hit.faceIndex < 0) return null;
  const index = mesh.geometry.index;
  const first = hit.faceIndex * 3;
  const position = mesh.geometry.getAttribute('position');
  if (first + 2 >= (index?.count ?? position.count)) return null;
  const vertices = [0, 1, 2].map((offset) => index ? index.getX(first + offset) : first + offset);
  const live = vertices.map((vertex) => mesh.getVertexPosition(vertex, new THREE.Vector3()));
  const localPoint = mesh.worldToLocal(hit.point.clone());
  const weights = THREE.Triangle.getBarycoord(localPoint, live[0], live[1], live[2], new THREE.Vector3());
  if (!weights) return null;
  const rest = new THREE.Vector3();
  for (let corner = 0; corner < 3; corner++) {
    const vertex = vertexMap ? vertexMap[vertices[corner]] : vertices[corner];
    if (vertex < 0 || vertex * 3 + 2 >= restPositions.length) return null;
    rest.addScaledVector(new THREE.Vector3().fromArray(restPositions, vertex * 3), weights.getComponent(corner));
  }
  return rest;
}

export function bodyHitZone(point: THREE.Vector3, minY: number, maxY: number): AnatomicalHit {
  const height = Math.max(maxY - minY, 1e-6);
  const y = (point.y - minY) / height;
  const x = Math.abs(point.x) / height;
  let zoneId: string;
  // Membership uses the imported T-pose, never screen/world height. Arms
  // therefore remain arms when lowered beside the waist or bent by posing.
  if (x > 0.13 && y > 0.57) {
    zoneId = x > 0.44 ? 'hand' : x > 0.29 ? 'forearm' : 'upper_arm';
  } else if (y > 0.85) zoneId = 'head_neck';
  else if (y > 0.79) zoneId = 'shoulders';
  else if (y > 0.62) zoneId = 'torso';
  else if (y > 0.55) zoneId = 'waist';
  else if (y > 0.45) zoneId = 'hips';
  else if (y > 0.25) zoneId = 'thigh';
  else if (y > 0.045) zoneId = 'calf';
  else zoneId = 'foot';
  return {zoneId, side: Math.abs(point.x) < height * 0.005 ? null : point.x < 0 ? 'L' : 'R'};
}

export function faceHitZone(
  point: THREE.Vector3,
  leftEye: THREE.Vector3,
  rightEye: THREE.Vector3,
  faceBounds: THREE.Box3,
  anchors?: {chinY: number; mouthY: number; noseY: number},
): AnatomicalHit {
  const centerX = (leftEye.x + rightEye.x) / 2;
  const eyeY = (leftEye.y + rightEye.y) / 2;
  const span = Math.max(Math.abs(rightEye.x - leftEye.x), 0.02);
  const x = Math.abs(point.x - centerX) / span;
  const y = (point.y - eyeY) / span;
  const eyeX = Math.min(Math.abs(point.x - leftEye.x), Math.abs(point.x - rightEye.x)) / span;
  let zoneId = 'face_shape';
  if (anchors && (point.y < anchors.chinY || (point.y < anchors.mouthY && point.z < 0.065))) zoneId = 'head_neck';
  else if (!anchors && point.y < faceBounds.min.y + (eyeY - faceBounds.min.y) * 0.12) zoneId = 'head_neck';
  else if (x > 1.05 && y > -0.8 && y < 0.55) zoneId = 'ears';
  else if (y > 0.22 && y < 0.55 && eyeX < 0.35) zoneId = 'brows';
  else if (Math.abs(y) < 0.25 && eyeX < 0.34) zoneId = 'eyes';
  else if (anchors && point.y < (anchors.noseY + anchors.mouthY) / 2) {
    zoneId = point.y > anchors.mouthY - 0.014 && x < 0.65 ? 'mouth' : 'jaw_chin';
  }
  else if (x < 0.28 && y < 0.16 && y > -0.7) zoneId = 'nose';
  else if (x < 0.62 && y <= -0.65 && y > -1.04) zoneId = 'mouth';
  else if (y <= -1.04) zoneId = 'jaw_chin';
  return {zoneId, side: x < 0.06 ? null : point.x < centerX ? 'L' : 'R'};
}
