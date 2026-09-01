import {createInitialKeyframes} from './model';
import {normalizeCanvas} from './canvasModel';
import type {CameraIntent, GenerationReference, StoryboardKeyframe, StoryboardShot} from './model';

export interface TemporaryStoryboardDraft {
  version: 1;
  projectId: string;
  userId: number;
  updatedAt: string;
  scenes: Record<string, StoryboardShot[]>;
}

const MAX_DRAFT_LENGTH = 8_000_000;
const azimuths = ['front', 'front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right'];
const elevations = ['low', 'eye-level', 'high', 'top'];
const distances = ['wide', 'medium', 'near'];
const framings = ['extreme-wide', 'wide', 'full', 'medium', 'medium-close', 'close', 'extreme-close', 'ots', 'pov'];
const referenceTypes = ['character', 'location', 'object', 'clothing', 'other', 'previous-keyframe', 'previous-shot'];
const movements = ['Static', 'Dolly In', 'Dolly Out', 'Pan', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down', 'Orbit Left', 'Orbit Right', 'Truck Left', 'Truck Right', 'Crane Up', 'Crane Down', 'Follow', 'Custom'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 1000
    && value.every((entry) => typeof entry === 'string');
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

// Private signed media URLs expire and may contain credentials. The temporary
// text draft never stores them, binary data URLs, or browser-only blob URLs.
function persistentImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[?#]/.test(value)) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function normalizeCamera(value: unknown): CameraIntent | null {
  if (!record(value)
    || !oneOf(value.azimuth, azimuths)
    || !oneOf(value.distance, distances)
    || !oneOf(value.elevation, elevations)
    || !oneOf(value.framing, framings)) return null;
  const composition = Array.isArray(value.composition)
    ? value.composition.filter((subject) => record(subject)
      && typeof subject.subjectId === 'string'
      && ['height', 'width', 'x', 'y'].every((key) => finiteNumber(subject[key])))
      .map((subject) => ({
        height: subject.height as number,
        subjectId: subject.subjectId as string,
        width: subject.width as number,
        x: subject.x as number,
        y: subject.y as number,
      }))
    : undefined;
  const ots = record(value.ots) && oneOf(value.ots.shoulder, ['left', 'right'] as const)
    ? {
      shoulder: value.ots.shoulder,
      ...(typeof value.ots.foregroundSubjectId === 'string' ? {foregroundSubjectId: value.ots.foregroundSubjectId} : {}),
      ...(typeof value.ots.targetId === 'string' ? {targetId: value.ots.targetId} : {}),
    }
    : undefined;
  return {
    azimuth: value.azimuth as CameraIntent['azimuth'],
    distance: value.distance as CameraIntent['distance'],
    elevation: value.elevation as CameraIntent['elevation'],
    framing: value.framing as CameraIntent['framing'],
    ...(finiteNumber(value.lens) ? {lens: value.lens} : {}),
    ...(typeof value.targetId === 'string' ? {targetId: value.targetId} : {}),
    ...(composition ? {composition} : {}),
    ...(ots ? {ots} : {}),
  };
}

function normalizeReference(value: unknown): GenerationReference | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.title !== 'string'
    || !oneOf(value.type, referenceTypes)) return null;
  const imageUrl = persistentImageUrl(value.imageUrl);
  if (!imageUrl) return null;
  return {
    id: value.id,
    imageUrl,
    title: value.title,
    type: value.type as GenerationReference['type'],
    ...(typeof value.primary === 'boolean' ? {primary: value.primary} : {}),
    ...(typeof value.sourceKeyframeId === 'string' ? {sourceKeyframeId: value.sourceKeyframeId} : {}),
    ...(typeof value.sourceShotId === 'string' ? {sourceShotId: value.sourceShotId} : {}),
  };
}

function normalizeKeyframe(value: unknown, shotId: string): StoryboardKeyframe | null {
  if (!record(value) || typeof value.id !== 'string' || !finiteNumber(value.position)
    || !oneOf(value.type, ['start', 'intermediate', 'end'] as const)) return null;
  const cameraIntent = normalizeCamera(value.cameraIntent);
  if (!cameraIntent) return null;
  const imageUrl = persistentImageUrl(value.imageUrl);
  const canvas = value.canvas === undefined ? undefined : normalizeCanvas(value.canvas);
  if (canvas === null) return null;
  return {
    cameraIntent,
    ...(canvas ? {canvas} : {}),
    generationReferences: Array.isArray(value.generationReferences)
      ? value.generationReferences.map(normalizeReference).filter((entry): entry is GenerationReference => Boolean(entry))
      : [],
    generationStatus: value.generationStatus === 'failed' ? 'failed' : imageUrl ? 'ready' : 'idle',
    id: value.id,
    ...(imageUrl ? {imageUrl} : {}),
    position: value.position,
    shotId,
    type: value.type,
  };
}

function normalizeSource(value: unknown) {
  if (!record(value) || !record(value.document) || !stringList(value.segmentIds)) return undefined;
  const document = value.document;
  if (!finiteNumber(document.sceneId) || !finiteNumber(document.sceneVersion)
    || typeof document.contentHash !== 'string' || typeof document.truncated !== 'boolean'
    || !Array.isArray(document.segments) || document.segments.length > 10000
    || !document.segments.every((segment) => record(segment)
      && typeof segment.id === 'string' && typeof segment.text === 'string')) return undefined;
  const segments = document.segments.map((segment) => ({id: String(segment.id), text: String(segment.text)}));
  const segmentIds = new Set(segments.map(({id}) => id));
  if (!value.segmentIds.every((id) => segmentIds.has(id))) return undefined;
  return {
    document: {
      sceneId: document.sceneId,
      sceneVersion: document.sceneVersion,
      contentHash: document.contentHash,
      segments,
      truncated: document.truncated,
    },
    segmentIds: [...value.segmentIds],
  };
}

export function normalizeTemporaryShots(value: unknown, sceneId: string): StoryboardShot[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const shots: StoryboardShot[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!record(entry) || typeof entry.id !== 'string' || ids.has(entry.id)
      || typeof entry.title !== 'string' || typeof entry.description !== 'string'
      || !stringList(entry.characterIds) || !stringList(entry.referenceIds)
      || !Array.isArray(entry.keyframes) || entry.keyframes.length > 1000
      || !Array.isArray(entry.transitions)) return null;
    ids.add(entry.id);
    const keyframes = entry.keyframes.map((keyframe) => normalizeKeyframe(keyframe, entry.id as string));
    if (keyframes.some((keyframe) => keyframe === null)) return null;
    const normalizedKeyframes = keyframes.filter((keyframe): keyframe is StoryboardKeyframe => Boolean(keyframe));
    if (new Set(normalizedKeyframes.map(({id}) => id)).size !== normalizedKeyframes.length) return null;
    const defaults = createInitialKeyframes(entry.id);
    for (const type of ['start'] as const) {
      if (!normalizedKeyframes.some((keyframe) => keyframe.type === type)) {
        const boundary = defaults.find((keyframe) => keyframe.type === type);
        if (boundary) {
          if (normalizedKeyframes.some((keyframe) => keyframe.id === boundary.id)) return null;
          normalizedKeyframes.push(boundary);
        }
      }
    }
    const keyframeIds = new Set(normalizedKeyframes.map(({id}) => id));
    const transitions = entry.transitions.filter((transition) => record(transition)
      && typeof transition.id === 'string' && typeof transition.fromKeyframeId === 'string'
      && typeof transition.toKeyframeId === 'string'
      && keyframeIds.has(transition.fromKeyframeId) && keyframeIds.has(transition.toKeyframeId))
      .map((transition) => ({
        id: String(transition.id),
        fromKeyframeId: String(transition.fromKeyframeId),
        toKeyframeId: String(transition.toKeyframeId),
        ...(oneOf(transition.movementOverride, movements)
          ? {movementOverride: transition.movementOverride as NonNullable<StoryboardShot['transitions'][number]['movementOverride']>} : {}),
      }));
    const source = normalizeSource(entry.source);
    shots.push({
      characterIds: [...entry.characterIds],
      description: entry.description,
      ...(finiteNumber(entry.duration) && entry.duration >= 0 ? {duration: entry.duration} : {}),
      id: entry.id,
      keyframes: normalizedKeyframes,
      ...(typeof entry.locationId === 'string' ? {locationId: entry.locationId} : {}),
      order: shots.length + 1,
      referenceIds: [...entry.referenceIds],
      sceneId,
      ...(source ? {source} : {}),
      title: entry.title,
      transitions,
    });
  }
  return shots;
}

export function temporaryDraftKey(userId: number, projectId: string): string {
  return `wcraft:temporary-storyboard:v1:${userId}:${encodeURIComponent(projectId)}`;
}

export function readTemporaryDraft(userId: number, projectId: string): TemporaryStoryboardDraft | null {
  const raw = window.localStorage.getItem(temporaryDraftKey(userId, projectId));
  if (raw === null) return null;
  if (raw.length > MAX_DRAFT_LENGTH) throw new Error('Invalid temporary storyboard draft');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Invalid temporary storyboard draft');
  }
  if (!record(value) || value.version !== 1 || value.userId !== userId
    || value.projectId !== projectId || typeof value.updatedAt !== 'string'
    || !record(value.scenes)) throw new Error('Invalid temporary storyboard draft');
  const scenes: Record<string, StoryboardShot[]> = {};
  for (const [sceneId, shots] of Object.entries(value.scenes)) {
    const normalized = normalizeTemporaryShots(shots, sceneId);
    if (!normalized || ['__proto__', 'constructor', 'prototype'].includes(sceneId)) {
      throw new Error('Invalid temporary storyboard draft');
    }
    scenes[sceneId] = normalized;
  }
  return {version: 1, projectId, userId, updatedAt: value.updatedAt, scenes};
}

export function writeTemporaryDraft(draft: TemporaryStoryboardDraft): void {
  const raw = JSON.stringify(draft);
  if (raw.length > MAX_DRAFT_LENGTH) throw new Error('Temporary storyboard draft is too large');
  window.localStorage.setItem(temporaryDraftKey(draft.userId, draft.projectId), raw);
}

export function removeTemporaryDraft(userId: number, projectId: string): void {
  window.localStorage.removeItem(temporaryDraftKey(userId, projectId));
}
