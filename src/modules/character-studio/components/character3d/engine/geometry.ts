import * as THREE from 'three';

// Loft (swept cross-section) geometry builders for the parametric humanoid.
//
// The v1 rig assembled the body from scaled spheres/capsules, which read as
// "balls". v1.5 sweeps elliptical cross-sections along the spine and limb
// axes instead: one continuous surface per body part, with shared boundary
// rings between adjacent parts so the silhouette has no seams.

export interface LoftRing {
  // Center height of the ring in the part's local space.
  y: number;
  // Half-width along X (left-right).
  rx: number;
  // Half-depth along +Z (front) and −Z (back). Splitting front/back lets
  // parameters like chestDepth and backWidth act on one side only; the two
  // halves meet at the ring's sides (z = 0), so the surface stays smooth.
  rzFront: number;
  rzBack: number;
}

/**
 * Sweep the ring stack (ordered bottom → top) into a closed-ish tube.
 * Caps close the first/last ring with a small rounded "dip" fan.
 */
export function buildLoft(
  rings: LoftRing[],
  radialSegments = 28,
  caps: {top?: boolean; bottom?: boolean} = {},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];

  rings.forEach((ring) => {
    ringStart.push(positions.length / 3);
    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const rz = cos >= 0 ? ring.rzFront : ring.rzBack;
      positions.push(ring.rx * sin, ring.y, rz * cos);
    }
  });

  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = ringStart[r] + i;
      const b = ringStart[r] + ((i + 1) % radialSegments);
      const c = ringStart[r + 1] + i;
      const d = ringStart[r + 1] + ((i + 1) % radialSegments);
      indices.push(a, b, d, a, d, c);
    }
  }

  if (caps.bottom) {
    const first = rings[0];
    const dip = Math.min(first.rx, first.rzFront) * 0.35;
    const center = positions.length / 3;
    positions.push(0, first.y - dip, 0);
    for (let i = 0; i < radialSegments; i++) {
      const a = ringStart[0] + i;
      const b = ringStart[0] + ((i + 1) % radialSegments);
      indices.push(center, b, a);
    }
  }
  if (caps.top) {
    const last = rings[rings.length - 1];
    const dip = Math.min(last.rx, last.rzFront) * 0.35;
    const center = positions.length / 3;
    positions.push(0, last.y + dip, 0);
    const start = ringStart[ringStart.length - 1];
    for (let i = 0; i < radialSegments; i++) {
      const a = start + i;
      const b = start + ((i + 1) % radialSegments);
      indices.push(center, a, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Limb segment: a tapered tube with rounded ends, built in JOINT space —
 * the upper sphere is centered at the origin (the joint), the lower one at
 * y = −length. Matching the lower radius of one segment with the upper
 * radius of the next makes elbows/knees read as one smooth limb.
 */
export function taperedLimbGeometry(
  rTop: number,
  rBottom: number,
  length: number,
  radialSegments = 18,
): THREE.BufferGeometry {
  const hemisphereSteps = [0.92, 0.71, 0.38];
  const rings: LoftRing[] = [];
  const circle = (y: number, r: number): LoftRing => ({y, rx: r, rzFront: r, rzBack: r});

  // Bottom hemisphere (below the lower joint), ascending y order.
  for (const s of hemisphereSteps) {
    rings.push(circle(-length - rBottom * s, rBottom * Math.sqrt(1 - s * s)));
  }
  rings.push(circle(-length, rBottom));
  rings.push(circle(0, rTop));
  // Top hemisphere (above the upper joint).
  for (const s of [...hemisphereSteps].reverse()) {
    rings.push(circle(rTop * s, rTop * Math.sqrt(1 - s * s)));
  }

  return buildLoft(rings, radialSegments, {top: true, bottom: true});
}
