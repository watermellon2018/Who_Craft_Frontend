import {buildInitialZoneParams, ZONE_INDEX} from '../zones';
import type {ZoneParams} from './rig';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

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
      if (typeof param.defaultValue === 'number') {
        const min = param.min ?? -1;
        const max = param.max ?? 1;
        if (typeof value === 'number' && Number.isFinite(value)) {
          out[zoneId][param.id] = Math.max(min, Math.min(max, value));
        }
        // Per-side overrides (`id__L` / `id__R`) written by asymmetric
        // editing survive the roundtrip alongside the shared value.
        for (const side of ['L', 'R'] as const) {
          const sideValue = (zoneValues as Record<string, unknown>)[`${param.id}__${side}`];
          if (typeof sideValue === 'number' && Number.isFinite(sideValue)) {
            out[zoneId][`${param.id}__${side}`] = Math.max(min, Math.min(max, sideValue));
          }
        }
      } else if (value === undefined) {
        continue;
      } else if (typeof param.defaultValue === 'boolean') {
        if (typeof value === 'boolean') out[zoneId][param.id] = value;
      } else if (typeof value === 'string') {
        // Presets keep only known options. Swatches also accept a measured
        // autofit color outside the small UI palette, but only as a safe
        // six-digit hex value.
        const isMeasuredSwatch = param.ui === 'swatch' && HEX_COLOR.test(value);
        if (isMeasuredSwatch || !param.options || param.options.some((opt) => opt.value === value)) {
          out[zoneId][param.id] = value;
        }
      }
    }
  }
  return out;
}

// Merge backend autofit suggestions over the current params. Suggestions are
// shared (both-sides) values, so any stale per-side override (`id__L`/`id__R`)
// for a suggested param is dropped — otherwise the rig's per-side resolver
// keeps preferring the override and the suggestion renders on neither side.
export function applyAutofitSuggestions(
  params: ZoneParams,
  suggested: Record<string, Record<string, number | string | boolean>>,
): ZoneParams {
  const next = {...params};
  for (const [zoneId, values] of Object.entries(suggested)) {
    const zone = {...(next[zoneId] ?? {}), ...values};
    for (const paramId of Object.keys(values)) {
      delete zone[`${paramId}__L`];
      delete zone[`${paramId}__R`];
    }
    next[zoneId] = zone;
  }
  return next;
}

// Fold `id__L` / `id__R` overrides of a zone back into the shared value when
// the user re-enables «Применять симметрично»: both sides adopt the side the
// user was just editing, and the overrides are removed.
export function collapseSideOverrides(
  params: ZoneParams,
  zoneId: string,
  keepSide: 'L' | 'R',
): ZoneParams {
  const zone = params[zoneId];
  if (!zone) return params;
  const out = {...zone};
  let touched = false;
  for (const key of Object.keys(zone)) {
    const match = /^(.+)__([LR])$/.exec(key);
    if (!match) continue;
    touched = true;
    const baseId = match[1];
    const keep = zone[`${baseId}__${keepSide}`];
    if (typeof keep === 'number') out[baseId] = keep;
    delete out[`${baseId}__L`];
    delete out[`${baseId}__R`];
  }
  return touched ? {...params, [zoneId]: out} : params;
}
