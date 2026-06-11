import {buildInitialZoneParams, ZONE_INDEX} from '../zones';
import type {ZoneParams} from './rig';

// Merge parameters loaded from the backend over the registry defaults.
// Defensive by design: the payload crossed the network and may come from an
// older client / future registry, so every leaf is type-checked against the
// parameter definition and numbers are clamped to the declared range.
// Unknown zones/params are dropped — the editor can't render them anyway.
export function mergeSavedParams(saved: unknown): ZoneParams {
  const out = buildInitialZoneParams();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;

  for (const [zoneId, zoneValues] of Object.entries(saved as Record<string, unknown>)) {
    const zone = ZONE_INDEX[zoneId];
    if (!zone?.parameters || !zoneValues || typeof zoneValues !== 'object' || Array.isArray(zoneValues)) {
      continue;
    }
    for (const param of zone.parameters) {
      const value = (zoneValues as Record<string, unknown>)[param.id];
      if (value === undefined) continue;
      if (typeof param.defaultValue === 'number') {
        if (typeof value === 'number' && Number.isFinite(value)) {
          const min = param.min ?? -1;
          const max = param.max ?? 1;
          out[zoneId][param.id] = Math.max(min, Math.min(max, value));
        }
      } else if (typeof param.defaultValue === 'boolean') {
        if (typeof value === 'boolean') out[zoneId][param.id] = value;
      } else if (typeof value === 'string') {
        // Presets keep only known options; free-form strings (colors) pass.
        if (!param.options || param.options.some((opt) => opt.value === value)) {
          out[zoneId][param.id] = value;
        }
      }
    }
  }
  return out;
}
