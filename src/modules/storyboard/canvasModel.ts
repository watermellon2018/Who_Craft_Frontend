import type {CameraMovementType, StoryboardEntityType, StoryboardKeyframe, StoryboardSceneEntity} from './model';

export type CanvasPrimitive = 'person' | 'animal' | 'prop' | 'rectangle' | 'ellipse' | 'line';
export interface CanvasPoint {x: number; y: number}
export interface CanvasEntityLink {
  id: string;
  type: StoryboardEntityType;
  title: string;
  versionId?: string;
  assetId?: string;
}
export interface CanvasObjectMotion {
  type: 'static' | 'path';
  points: CanvasPoint[];
  start: number;
  end: number;
  facing: string;
}
export interface CanvasObject extends CanvasPoint {
  id: string;
  kind: CanvasPrimitive;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  hidden: boolean;
  locked: boolean;
  title: string;
  description: string;
  pose: 'front' | 'profile' | 'back' | 'sitting';
  entity?: CanvasEntityLink;
  motion: CanvasObjectMotion;
  comment: string;
}
export interface CanvasMarker extends CanvasPoint {id: string; text: string}
export interface StoryboardCanvasDocument {
  version: 1;
  aspectRatio: '16:9' | '9:16' | '1:1';
  objects: CanvasObject[];
  cameraMotion: {
    type: CameraMovementType | 'Zoom In' | 'Zoom Out';
    targetId?: string;
    intensity: 'low' | 'medium' | 'high';
    points: CanvasPoint[];
    start: number;
    end: number;
  };
  lighting: {
    preset: 'daylight' | 'studio' | 'night' | 'custom';
    direction: 'front' | 'left' | 'right' | 'top-left' | 'top-right' | 'back' | 'top';
    softness: 'soft' | 'hard';
    temperature: 'warm' | 'neutral' | 'cool';
    contrast: 'low' | 'medium' | 'high';
    notes: string;
  };
  notes: string;
  markers: CanvasMarker[];
}

export const CANVAS_OBJECT_LIMIT = 80;
export const CANVAS_MARKER_LIMIT = 30;
export const CANVAS_PRIMITIVES: CanvasPrimitive[] = ['person', 'animal', 'prop', 'rectangle', 'ellipse', 'line'];

export function canvasId(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `canvas-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function createCanvasObject(kind: CanvasPrimitive, title: string, duration = 4,
  entity?: CanvasEntityLink, point: CanvasPoint = {x: 40, y: 25}): CanvasObject {
  return {
    ...point, id: canvasId(), kind, title, description: '', width: kind === 'person' ? 14 : 24,
    height: kind === 'person' ? 55 : kind === 'line' ? 2 : 25,
    rotation: 0, flipX: false, hidden: false, locked: false, pose: 'front', entity,
    motion: {type: 'static', points: [], start: 0, end: duration, facing: ''}, comment: '',
  };
}

export function cloneCanvas(document: StoryboardCanvasDocument): StoryboardCanvasDocument {
  return {
    ...document,
    objects: document.objects.map((object) => ({...object, entity: object.entity ? {...object.entity} : undefined,
      motion: {...object.motion, points: object.motion.points.map((point) => ({...point}))}})),
    cameraMotion: {...document.cameraMotion, points: (document.cameraMotion.points ?? []).map((point) => ({...point}))}, lighting: {...document.lighting},
    markers: document.markers.map((marker) => ({...marker})),
  };
}

export function createCanvas(keyframe?: {canvas?: StoryboardCanvasDocument; cameraIntent: Pick<StoryboardKeyframe['cameraIntent'], 'composition'>}, entities: StoryboardSceneEntity[] = [], duration = 4): StoryboardCanvasDocument {
  if (keyframe?.canvas) return cloneCanvas(keyframe.canvas);
  return {
    version: 1, aspectRatio: '16:9',
    objects: (keyframe?.cameraIntent.composition ?? []).map((subject, index) => {
      const entity = entities.find(({id}) => id === subject.subjectId);
      return {...createCanvasObject(entity?.type === 'character' ? 'person' : 'prop', entity?.title ?? `#${index + 1}`, duration,
        entity ? {id: entity.id, type: entity.type, title: entity.title} : undefined),
      id: `composition-${subject.subjectId}-${index}`, x: subject.x, y: subject.y, width: subject.width, height: subject.height};
    }),
    cameraMotion: {type: 'Static', intensity: 'low', points: [], start: 0, end: duration},
    lighting: {preset: 'daylight', direction: 'top-left', softness: 'soft', temperature: 'neutral', contrast: 'low', notes: ''},
    notes: '', markers: [],
  };
}

export function entityLink(entity: StoryboardSceneEntity): CanvasEntityLink {
  return {id: entity.id, type: entity.type, title: entity.title, versionId: entity.versionId, assetId: entity.assetId};
}

/** Validate recovery data before it can enter the SVG editor or be sent back. */
export function normalizeCanvas(value: unknown): StoryboardCanvasDocument | null {
  const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
  const text = (v: unknown, max = 2000): v is string => typeof v === 'string' && Array.from(v).length <= max;
  const number = (v: unknown, min = 0, max = 100): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const choice = (v: unknown, choices: readonly string[]) => typeof v === 'string' && choices.includes(v);
  const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every((key) => allowed.includes(key));
  const point = (v: unknown) => record(v) && keys(v, ['x', 'y']) && number(v.x) && number(v.y);
  if (!record(value) || !keys(value, ['version', 'aspectRatio', 'objects', 'cameraMotion', 'lighting', 'notes', 'markers'])
    || value.version !== 1 || !choice(value.aspectRatio, ['16:9', '9:16', '1:1'])
    || !text(value.notes) || !Array.isArray(value.objects) || value.objects.length > CANVAS_OBJECT_LIMIT
    || !Array.isArray(value.markers) || value.markers.length > CANVAS_MARKER_LIMIT) return null;
  const motion = value.cameraMotion;
  if (!record(motion) || !keys(motion, ['type', 'targetId', 'intensity', 'points', 'start', 'end'])
    || !choice(motion.type, ['Static', 'Dolly In', 'Dolly Out', 'Zoom In', 'Zoom Out', 'Pan', 'Pan Left', 'Pan Right',
      'Tilt Up', 'Tilt Down', 'Orbit Left', 'Orbit Right', 'Truck Left', 'Truck Right', 'Crane Up', 'Crane Down', 'Follow', 'Custom'])
    || !choice(motion.intensity, ['low', 'medium', 'high']) || !number(motion.start, 0, 3600)
    || !number(motion.end, motion.start as number, 3600) || (motion.targetId !== undefined && !text(motion.targetId, 255))
    || (motion.points !== undefined && (!Array.isArray(motion.points) || motion.points.length > 8 || !motion.points.every(point)))) return null;
  const light = value.lighting;
  if (!record(light) || !keys(light, ['preset', 'direction', 'softness', 'temperature', 'contrast', 'notes'])
    || !choice(light.preset, ['daylight', 'studio', 'night', 'custom'])
    || !choice(light.direction, ['front', 'left', 'right', 'top-left', 'top-right', 'back', 'top'])
    || !choice(light.softness, ['soft', 'hard']) || !choice(light.temperature, ['warm', 'neutral', 'cool'])
    || !choice(light.contrast, ['low', 'medium', 'high']) || !text(light.notes)) return null;
  const ids = new Set<string>();
  for (const object of value.objects) {
    if (!record(object) || !keys(object, ['id', 'kind', 'x', 'y', 'width', 'height', 'rotation', 'flipX', 'hidden', 'locked',
      'title', 'description', 'pose', 'entity', 'motion', 'comment'])
      || !text(object.id, 255) || !object.id || ids.has(object.id) || !choice(object.kind, CANVAS_PRIMITIVES)
      || !number(object.x) || !number(object.y) || !number(object.width, 0.1) || !number(object.height, 0.1)
      || !number(object.rotation, -360, 360) || typeof object.flipX !== 'boolean' || typeof object.hidden !== 'boolean'
      || typeof object.locked !== 'boolean' || !text(object.title, 255) || !text(object.description) || !text(object.comment)
      || !choice(object.pose, ['front', 'profile', 'back', 'sitting'])) return null;
    ids.add(object.id);
    const path = object.motion;
    if (!record(path) || !keys(path, ['type', 'points', 'start', 'end', 'facing'])
      || !choice(path.type, ['static', 'path']) || !Array.isArray(path.points) || path.points.length > 8
      || !path.points.every(point) || !number(path.start, 0, 3600) || !number(path.end, path.start as number, 3600)
      || !text(path.facing)) return null;
    const entity = object.entity;
    if (entity !== undefined && (!record(entity) || !keys(entity, ['id', 'type', 'title', 'versionId', 'assetId'])
      || !text(entity.id, 255) || !entity.id || !text(entity.title, 255)
      || !choice(entity.type, ['character', 'location', 'object', 'clothing', 'other'])
      || (entity.versionId !== undefined && !text(entity.versionId, 255))
      || (entity.assetId !== undefined && !text(entity.assetId, 255)))) return null;
  }
  const markerIds = new Set<string>();
  for (const marker of value.markers) {
    if (!record(marker) || !keys(marker, ['id', 'x', 'y', 'text']) || !text(marker.id, 255) || !marker.id
      || markerIds.has(marker.id) || !number(marker.x) || !number(marker.y) || !text(marker.text)) return null;
    markerIds.add(marker.id);
  }
  return cloneCanvas({...value, cameraMotion: {...motion, points: motion.points ?? []}} as unknown as StoryboardCanvasDocument);
}
