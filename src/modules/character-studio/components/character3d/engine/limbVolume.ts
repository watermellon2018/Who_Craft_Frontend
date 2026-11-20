import type {ZoneParams} from './rig';

const SEGMENTS = 12;
const VOLUME_SCALE = 0.3;
const LIMBS = [
  {zone: 'thigh', parameter: 'thighVolume', axis: 1, start: .25, end: .5},
  {zone: 'calf', parameter: 'calfVolume', axis: 1, start: .04, end: .25},
  {zone: 'upper_arm', parameter: 'volume', axis: 0, start: .11, end: .29},
  {zone: 'forearm', parameter: 'thickness', axis: 0, start: .29, end: .44},
] as const;

/** Add radial volume to the live fitted limbs, with no displacement at joints. */
export function limbVolumeOffsets(rest: Float32Array, live: Float32Array, minY: number, maxY: number, params: ZoneParams): Float32Array | null {
  const height = Math.max(maxY - minY, 1e-6);
  let offsets: Float32Array | null = null;
  for (const limb of LIMBS) {
    const raw = params[limb.zone]?.[limb.parameter];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 0) continue;
    const amount = Math.max(-1, Math.min(1, raw)) * VOLUME_SCALE;
    if (!offsets) offsets = new Float32Array(rest.length);
    for (const side of [-1, 1]) {
      const transverse = limb.axis === 0 ? [1, 2] : [0, 2];
      const bins = Array.from({length: SEGMENTS}, () => ({min: [Infinity, Infinity], max: [-Infinity, -Infinity]}));
      const members: Array<{offset: number; progress: number; bin: number}> = [];
      for (let offset = 0; offset < rest.length; offset += 3) {
        if (Math.sign(rest[offset]) !== side) continue;
        const fractionY = (rest[offset + 1] - minY) / height;
        if (limb.axis === 0 && (fractionY < .57 || fractionY > .9)) continue;
        const coordinate = limb.axis === 0 ? Math.abs(rest[offset]) / height : fractionY;
        const progress = (coordinate - limb.start) / (limb.end - limb.start);
        if (progress <= 0 || progress >= 1) continue;
        const bin = Math.min(SEGMENTS - 1, Math.floor(progress * SEGMENTS));
        members.push({offset, progress, bin});
        transverse.forEach((axis, i) => {
          bins[bin].min[i] = Math.min(bins[bin].min[i], live[offset + axis]);
          bins[bin].max[i] = Math.max(bins[bin].max[i], live[offset + axis]);
        });
      }
      // Interpolate measured cross-section centers to avoid ring boundaries.
      const center = (bin: number, component: number, fallback: number) => {
        const data = bins[Math.max(0, Math.min(SEGMENTS - 1, bin))];
        return Number.isFinite(data.min[component]) ? (data.min[component] + data.max[component]) / 2 : fallback;
      };
      for (const member of members) {
        const {offset, progress, bin} = member;
        const sample = progress * SEGMENTS - .5;
        const low = Math.floor(sample);
        const mix = sample - low;
        // Squared sine has zero derivative at both ends: elbows, wrists,
        // knees and ankles retain their original positions and tangent.
        const weight = Math.sin(progress * Math.PI) ** 2;
        transverse.forEach((axis, component) => {
          const fallback = center(bin, component, live[offset + axis]);
          const lowCenter = center(low, component, fallback);
          const highCenter = center(low + 1, component, fallback);
          const axisCenter = lowCenter + (highCenter - lowCenter) * mix;
          offsets![offset + axis] += (live[offset + axis] - axisCenter) * amount * weight;
        });
      }
    }
  }
  return offsets;
}
