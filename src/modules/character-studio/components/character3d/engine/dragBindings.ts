// Direct-manipulation bindings: which parameters a mouse drag on the model
// edits, per zone. `x` reacts to horizontal drag, `y` to vertical (up =
// positive). Values are added to the parameter captured at drag start and
// clamped to the range in the shared zone registry.
//
// Only zones listed here are draggable; the rest are click-to-select only.

import {findZone} from '../zones';
import type {Rig, ZoneParams} from './rig';

export interface DragBinding {
  x?: string;
  y?: string;
  // Parameter delta for a drag across the full viewport height. Default 2.2
  // means "half a screen of drag sweeps a whole slider" — fast but precise
  // enough with the slider available for fine-tuning.
  sensitivity?: number;
}

export const DRAG_BINDINGS: Record<string, DragBinding> = {
  // Body
  shoulders: {x: 'shouldersWidth', y: 'shouldersHeight'},
  torso: {x: 'chestWidth', y: 'chestDepth'},
  waist: {x: 'waistWidth', y: 'torsoCurve'},
  hips: {x: 'hipsWidth', y: 'hipsShape'},
  head_neck: {x: 'neckThickness', y: 'neckLength'},
  upper_arm: {x: 'volume', y: 'length'},
  forearm: {x: 'thickness', y: 'length'},
  hand: {x: 'size', y: 'fingerLength'},
  thigh: {x: 'thighVolume', y: 'thighLength'},
  calf: {x: 'calfVolume', y: 'calfLength'},
  foot: {x: 'footSize'},
  // Face
  face_shape: {x: 'cheekbones'},
  eyes: {x: 'eyeDistance', y: 'eyeTilt'},
  brows: {x: 'browAngle', y: 'browHeight'},
  nose: {x: 'noseWidth', y: 'noseLength'},
  mouth: {x: 'mouthWidth', y: 'cornerLift'},
  jaw_chin: {x: 'jawWidth', y: 'chinLength'},
  ears: {x: 'earAngle', y: 'earSize'},
  // Hair
  hair: {x: 'hairVolume', y: 'hairLength'},
};

export function dragBindingFor(zoneId: string | null, rig?: Pick<Rig, 'supportsParameter'> | null): DragBinding | null {
  if (!zoneId) return null;
  const binding = DRAG_BINDINGS[zoneId];
  if (!binding) return null;
  const supported = (id?: string) => id && (!rig?.supportsParameter || rig.supportsParameter(zoneId, id)) ? id : undefined;
  const x = supported(binding.x);
  const y = supported(binding.y);
  return x || y ? {...binding, x, y} : null;
}

export function clampParameter(zoneId: string, paramId: string, value: number): number {
  const parameter = findZone(zoneId)?.parameters?.find((param) => param.id === paramId);
  const fallback = typeof parameter?.defaultValue === 'number' ? parameter.defaultValue : 0;
  return Math.max(parameter?.min ?? -1, Math.min(parameter?.max ?? 1, Number.isFinite(value) ? value : fallback));
}

export function dragStartValue(params: ZoneParams, zoneId: string, paramId?: string, side?: 'L' | 'R' | null): number | null {
  if (!paramId) return null;
  const zone = params[zoneId] ?? {};
  const fallback = findZone(zoneId)?.parameters?.find((param) => param.id === paramId)?.defaultValue;
  const value = (side ? zone[`${paramId}__${side}`] : undefined) ?? zone[paramId] ?? fallback;
  return typeof value === 'number' ? clampParameter(zoneId, paramId, value) : null;
}
