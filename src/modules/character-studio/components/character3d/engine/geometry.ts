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
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];

  // V runs along the swept axis, proportional to height so micro-detail keeps
  // an even density on tall vs short parts; U wraps around the ring. The
  // shared skin maps repeat over this, so the absolute scale is set there.
  const yMin = rings[0].y;
  const ySpan = Math.max(1e-6, rings[rings.length - 1].y - yMin);

  rings.forEach((ring) => {
    ringStart.push(positions.length / 3);
    const vCoord = (ring.y - yMin) / ySpan;
    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const rz = cos >= 0 ? ring.rzFront : ring.rzBack;
      positions.push(ring.rx * sin, ring.y, rz * cos);
      uvs.push(i / radialSegments, vCoord);
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
    uvs.push(0.5, 0);
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
    uvs.push(0.5, 1);
    const start = ringStart[ringStart.length - 1];
    for (let i = 0; i < radialSegments; i++) {
      const a = start + i;
      const b = start + ((i + 1) % radialSegments);
      indices.push(center, a, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Generic vertical loft from a [y, rx, rz, zCenter] profile with optional
// rounded fan caps. Shared by the nose/hand/foot builders: one continuous
// surface that can lean forward (zCenter) and carries UVs for the skin maps.
function profileLoft(
  profile: Array<[number, number, number, number]>,
  radialSegments: number,
  caps: {top?: boolean; bottom?: boolean} = {top: true, bottom: true},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];
  const yTop = profile[0][0];
  const ySpan = Math.max(1e-6, yTop - profile[profile.length - 1][0]);

  profile.forEach(([y, rx, rz, zc]) => {
    ringStart.push(positions.length / 3);
    const vCoord = (yTop - y) / ySpan;
    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      positions.push(rx * Math.sin(theta), y, zc + rz * Math.cos(theta));
      uvs.push(i / radialSegments, vCoord);
    }
  });
  for (let r = 0; r < profile.length - 1; r++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = ringStart[r] + i;
      const b = ringStart[r] + ((i + 1) % radialSegments);
      const c = ringStart[r + 1] + i;
      const d = ringStart[r + 1] + ((i + 1) % radialSegments);
      indices.push(a, b, d, a, d, c);
    }
  }
  const fan = (ringIdx: number, y: number, zc: number, front: boolean) => {
    const center = positions.length / 3;
    positions.push(0, y, zc);
    uvs.push(0.5, front ? 0 : 1);
    const start = ringStart[ringIdx];
    for (let i = 0; i < radialSegments; i++) {
      const a = start + i;
      const b = start + ((i + 1) % radialSegments);
      if (front) indices.push(center, a, b);
      else indices.push(center, b, a);
    }
  };
  if (caps.top !== false) fan(0, yTop + 0.004, profile[0][3], true);
  if (caps.bottom !== false) {
    const last = profile[profile.length - 1];
    fan(profile.length - 1, last[0] - 0.004, last[3], false);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Hand: a lofted mitten that begins at the wrist with a ring matching the
 * forearm's open lower ring (radius `wristR`, `radial` segments), narrows
 * slightly at the wrist, swells into the palm and rounds off — so the forearm
 * flows into the hand with a gentle wrist taper instead of a domed stub + a
 * stuck-on capsule. Built in the wrist node's local space (y descends from 0).
 */
export function handGeometry(wristR = 0.035, radial = 18): THREE.BufferGeometry {
  // [y, rx, rz, zCenter]. The first ring is CIRCULAR (rz = rx = wristR) so it
  // matches the forearm's round open ring exactly; the hand then flattens in Z
  // over the next rings (a hand is wider than it is thick) without a step.
  const profile: Array<[number, number, number, number]> = [
    [0.0, wristR, wristR, 0], // wrist ring — matches the forearm open ring exactly
    [-0.014, wristR * 0.95, wristR * 0.72, 0], // wrist pinch, starting to flatten
    [-0.045, wristR * 1.16, wristR * 0.66, 0.004], // palm/knuckles, widest
    [-0.085, wristR * 1.02, wristR * 0.56, 0.006], // fingers
    [-0.11, wristR * 0.66, wristR * 0.42, 0.006], // finger tips, rounded
  ];
  // Wrist ring stays open so the forearm continues into it seamlessly; the
  // finger end is capped.
  return profileLoft(profile, radial, {top: false, bottom: true});
}

/**
 * Foot: a lofted form that starts at an ankle ring matching the calf's open
 * lower ring (radius `ankleR`, `radial` segments), rounds through the
 * heel/instep and extends forward to a rounded toe. Replaces the box-foot +
 * dome stub so the ankle flows into the foot. Built in the ankle node's local
 * space: y descends from the ankle, the form sweeps forward in +Z. Returns a
 * geometry whose bounding stays compatible with the old foot footprint.
 */
export function footGeometry(ankleR = 0.044, radial = 18): THREE.BufferGeometry {
  // [y, rx(half-width), rz(half-depth), zCenter(forward)]. The instep sweeps
  // forward and down, flattening into a longer, lower toe block. The sole
  // reaches ≈ −0.11 below the ankle so the figure keeps standing on the floor
  // (same drop the old box gave; the pelvis-height offset is unchanged).
  const profile: Array<[number, number, number, number]> = [
    [0.0, ankleR, ankleR, 0], // ankle ring — matches the calf open ring
    [-0.052, ankleR * 1.04, ankleR * 1.2, 0.012], // instep, leaning forward
    [-0.095, ankleR * 0.98, ankleR * 1.8, 0.055], // mid-foot, longer
    [-0.118, ankleR * 0.88, ankleR * 2.0, 0.1], // toes, lowest + furthest
  ];
  return profileLoft(profile, radial, {top: false, bottom: true});
}

/**
 * Eyebrow: a slender arched ridge that tapers to points at both ends, swept
 * along a shallow curve — replaces the flat box that read as a sticker. Built
 * in the brow node's local space, centered at the origin and lying along X so
 * the existing transform (position/rotation.z for angle/scale.y for
 * thickness) keeps working. `side` (−1 left / +1 right) lets the arch peak
 * sit toward the outer end. Flattened in Z so it hugs the brow ridge.
 */
export function browGeometry(side: number): THREE.BufferGeometry {
  const halfLen = 0.022;
  const rings = 14;
  const radial = 8;
  const baseR = 0.0052; // mid thickness
  const flatZ = 0.5; // squash depth so the brow is wider than it is deep
  // Arch: peak slightly toward the outer third (cosmetic eyebrow shape).
  const peakX = 0.35 * side;
  const positions: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];

  for (let s = 0; s <= rings; s++) {
    const t = s / rings; // 0..1 along the brow
    const x = -halfLen + 2 * halfLen * t;
    // Arch height: a gentle hump, lifted near the peak, lower at the ends.
    const u = (x / halfLen - peakX) / (1 + Math.abs(peakX));
    const arch = 0.006 * (1 - u * u);
    // Taper: full thickness in the middle, pointed at both ends.
    const taper = Math.sin(Math.PI * t);
    const r = baseR * (0.18 + 0.82 * taper);
    ringStart.push(positions.length / 3);
    for (let i = 0; i < radial; i++) {
      const theta = (i / radial) * Math.PI * 2;
      const cy = Math.sin(theta) * r;
      const cz = Math.cos(theta) * r * flatZ;
      positions.push(x, arch + cy, cz);
    }
  }
  for (let s = 0; s < rings; s++) {
    for (let i = 0; i < radial; i++) {
      const a = ringStart[s] + i;
      const b = ringStart[s] + ((i + 1) % radial);
      const c = ringStart[s + 1] + i;
      const d = ringStart[s + 1] + ((i + 1) % radial);
      indices.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Organic nose, lofted from the brow ridge down to the nostril base in the
 * nose group's local space (origin near the bridge top, +Z = forward off the
 * face). A box-bridge + sphere-tip reads as stuck-on; this sweeps one smooth
 * surface: a narrow ridge that widens into the tip/wings and leans forward,
 * so it blends into the face. Parameters:
 *   • bridgeHeight — how far the ridge stands off the face (and its narrowness)
 *   • tip          — how much the tip protrudes and drops
 * Width/length stay on the group scale, so noseWidth/noseLength keep working.
 */
export function noseGeometry(bridgeHeight = 0, tip = 0): THREE.BufferGeometry {
  const ridge = 0.004 + 0.01 * Math.max(0, bridgeHeight); // forward stand-off
  const tipZ = 0.012 + 0.008 * tip;
  const tipDrop = 0.006 * tip;
  // y descends from the bridge top to under the nostrils; each ring carries a
  // forward z-center so the whole nose leans off the face, widening downward.
  // [y, halfWidth, halfDepth(front), zCenter]
  const profile: Array<[number, number, number, number]> = [
    [0.022, 0.004, 0.004, ridge * 0.4],
    [0.012, 0.005, 0.005, ridge * 0.7],
    [0.0, 0.006, 0.006, ridge],
    [-0.01, 0.0075, 0.0075, ridge + tipZ * 0.5],
    [-0.018 - tipDrop, 0.0105, 0.0095, ridge + tipZ], // tip / wings
    [-0.026 - tipDrop, 0.012, 0.006, ridge + tipZ * 0.55], // nostril base
    [-0.03 - tipDrop, 0.008, 0.004, ridge + tipZ * 0.25],
  ];
  const radialSegments = 18;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];
  const yTop = profile[0][0];
  const ySpan = Math.max(1e-6, yTop - profile[profile.length - 1][0]);

  profile.forEach(([y, rx, rz, zc]) => {
    ringStart.push(positions.length / 3);
    const vCoord = (yTop - y) / ySpan;
    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      positions.push(rx * sin, y, zc + rz * cos);
      uvs.push(i / radialSegments, vCoord);
    }
  });
  for (let r = 0; r < profile.length - 1; r++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = ringStart[r] + i;
      const b = ringStart[r] + ((i + 1) % radialSegments);
      const c = ringStart[r + 1] + i;
      const d = ringStart[r + 1] + ((i + 1) % radialSegments);
      indices.push(a, b, d, a, d, c);
    }
  }
  // Close the top ring (where the nose meets the brow ridge) and the bottom
  // (under the nostrils) with small fans so the surface reads solid.
  const fanCap = (ringIdx: number, y: number, zc: number, front: boolean) => {
    const center = positions.length / 3;
    positions.push(0, y, zc);
    uvs.push(0.5, front ? 0 : 1);
    const start = ringStart[ringIdx];
    for (let i = 0; i < radialSegments; i++) {
      const a = start + i;
      const b = start + ((i + 1) % radialSegments);
      if (front) indices.push(center, a, b);
      else indices.push(center, b, a);
    }
  };
  fanCap(0, yTop + 0.002, profile[0][3], true);
  const last = profile[profile.length - 1];
  fanCap(profile.length - 1, last[0] - 0.002, last[3], false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Limb segment: a tapered tube built in JOINT space — the upper ring is at
 * the origin (the joint), the lower one at y = −length. Matching the lower
 * radius of one segment with the upper radius of the next makes elbows/knees
 * read as one smooth limb.
 *
 * `caps` controls how each end is finished, exactly like buildLoft:
 *   • domed end  → a rounded hemisphere closes the limb (wrist, ankle, the
 *     top tucked into the shoulder/hip);
 *   • open end   → the boundary ring is left flush with NO hemisphere and NO
 *     cap fan, so where two segments meet at a joint there is a single shared
 *     profile instead of two stacked domes (the old "sausage" bulge). The
 *     next segment's matching ring continues the surface.
 *
 * Defaults keep both ends domed (the original capsule behaviour), so callers
 * that don't opt in are unchanged.
 */
export function taperedLimbGeometry(
  rTop: number,
  rBottom: number,
  length: number,
  radialSegments = 18,
  caps: {top?: boolean; bottom?: boolean} = {top: true, bottom: true},
): THREE.BufferGeometry {
  const domeTop = caps.top !== false;
  const domeBottom = caps.bottom !== false;
  const hemisphereSteps = [0.92, 0.71, 0.38];
  const rings: LoftRing[] = [];
  const circle = (y: number, r: number): LoftRing => ({y, rx: r, rzFront: r, rzBack: r});

  // Bottom hemisphere (below the lower joint), ascending y order — only when
  // this end is domed; an open end starts flush at the boundary ring.
  if (domeBottom) {
    for (const s of hemisphereSteps) {
      rings.push(circle(-length - rBottom * s, rBottom * Math.sqrt(1 - s * s)));
    }
  }
  rings.push(circle(-length, rBottom));
  rings.push(circle(0, rTop));
  // Top hemisphere (above the upper joint), only when this end is domed.
  if (domeTop) {
    for (const s of [...hemisphereSteps].reverse()) {
      rings.push(circle(rTop * s, rTop * Math.sqrt(1 - s * s)));
    }
  }

  // The cap fan closes a domed end; an open end leaves the boundary ring bare
  // so the adjoining segment's identical ring continues the surface seamlessly.
  return buildLoft(rings, radialSegments, {top: domeTop, bottom: domeBottom});
}
