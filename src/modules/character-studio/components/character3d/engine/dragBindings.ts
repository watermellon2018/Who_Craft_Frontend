// Direct-manipulation bindings: which parameters a mouse drag on the model
// edits, per zone. `x` reacts to horizontal drag, `y` to vertical (up =
// positive). Values are added to the parameter captured at drag start and
// clamped to the parameter range ([-1, 1] everywhere today).
//
// Only zones listed here are draggable; the rest are click-to-select only.

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

export function dragBindingFor(zoneId: string | null): DragBinding | null {
  if (!zoneId) return null;
  return DRAG_BINDINGS[zoneId] ?? null;
}
