import {safeImageUrl} from '../../utils/safeUrl';
import type {ScriptBlock} from '../../page/script/types';

export type StoryboardSceneStatus = 'empty' | 'draft' | 'completed';

export type StoryboardKeyframeType = 'start' | 'intermediate' | 'end';

export type CameraAzimuth =
  | 'front'
  | 'front-left'
  | 'left'
  | 'back-left'
  | 'back'
  | 'back-right'
  | 'right'
  | 'front-right';

export type CameraElevation = 'low' | 'eye-level' | 'high' | 'top';

export type CameraDistance = 'wide' | 'medium' | 'near';

export type CameraFraming =
  | 'extreme-wide'
  | 'wide'
  | 'full'
  | 'medium'
  | 'medium-close'
  | 'close'
  | 'extreme-close'
  | 'ots'
  | 'pov';

export type CameraMovementType =
  | 'Static'
  | 'Dolly In'
  | 'Dolly Out'
  | 'Pan'
  | 'Pan Left'
  | 'Pan Right'
  | 'Tilt Up'
  | 'Tilt Down'
  | 'Orbit Left'
  | 'Orbit Right'
  | 'Truck Left'
  | 'Truck Right'
  | 'Crane Up'
  | 'Crane Down'
  | 'Follow'
  | 'Custom';

export type GenerationReferenceType =
  | 'character'
  | 'location'
  | 'object'
  | 'clothing'
  | 'other'
  | 'previous-keyframe'
  | 'previous-shot';

export type KeyframeGenerationStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'failed';

export interface CompositionSubject {
  height: number;
  subjectId: string;
  width: number;
  x: number;
  y: number;
}

export interface CameraIntent {
  azimuth: CameraAzimuth;
  composition?: CompositionSubject[];
  distance: CameraDistance;
  elevation: CameraElevation;
  framing: CameraFraming;
  lens?: number;
  ots?: {
    foregroundSubjectId?: string;
    shoulder: 'left' | 'right';
    targetId?: string;
  };
  targetId?: string;
}

export interface GenerationReference {
  id: string;
  imageUrl: string;
  primary?: boolean;
  sourceKeyframeId?: string;
  sourceShotId?: string;
  title: string;
  type: GenerationReferenceType;
}

export interface StoryboardKeyframe {
  cameraIntent: CameraIntent;
  generationReferences?: GenerationReference[];
  generationStatus: KeyframeGenerationStatus;
  id: string;
  imageUrl?: string;
  position: number;
  shotId: string;
  type: StoryboardKeyframeType;
}

export interface KeyframeTransition {
  fromKeyframeId: string;
  id: string;
  movementOverride?: CameraMovementType;
  toKeyframeId: string;
}

export interface StoryboardSourceDocument {
  contentHash: string;
  sceneId: number;
  sceneVersion: number;
  segments: {id: string; text: string}[];
  truncated: boolean;
}

export interface StoryboardShotSource {
  document: StoryboardSourceDocument;
  segmentIds: string[];
  origin?: 'ai' | 'manual';
  /** Unicode code-point offsets into the exact joined source document. */
  ranges?: {start: number; end: number}[];
}

export interface StoryboardShot {
  characterIds: string[];
  description: string;
  duration?: number;
  id: string;
  keyframes: StoryboardKeyframe[];
  locationId?: string;
  order: number;
  referenceIds: string[];
  sceneId: string;
  source?: StoryboardShotSource;
  title: string;
  transitions: KeyframeTransition[];
}

export type StoryboardEntityType =
  | 'character'
  | 'location'
  | 'object'
  | 'clothing'
  | 'other';

export interface StoryboardSceneEntity {
  id: string;
  imageUrl?: string;
  title: string;
  type: StoryboardEntityType;
}

export interface StoryboardScene {
  canEdit?: boolean;
  draftRevision?: number;
  /** Local session ownership only; never sent in the saved payload. */
  draftAuthGeneration?: number;
  editorStage?: 'selection' | 'builder' | 'editor';
  entities: StoryboardSceneEntity[];
  heading?: string;
  id: string;
  locationIds: string[];
  order: number;
  readyShotsCount?: number;
  scriptBlocks?: ScriptBlock[];
  shots: StoryboardShot[];
  shotsCount?: number;
  status: StoryboardSceneStatus;
  subtitle?: string;
  text: string;
  title: string;
  version?: number;
}

export interface StoryboardShotListModelOption {
  available: boolean;
  estimatedCostUsd: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  id: string;
  label: string;
  provider: string;
  unavailableReason: 'credentialMissing' | 'dependencyMissing' | 'unsupportedProvider' | null;
}

export interface StoryboardShotListOptions {
  context: {
    characters: string[];
    locations: string[];
    sceneTitle: string;
  };
  defaultModel: string;
  maxShots: number;
  models: StoryboardShotListModelOption[];
}

export interface StoryboardShotListConfiguration {
  language?: 'ru' | 'en';
  maxShots: number;
  model: string;
}

export interface InitialCameraPresets {
  end?: Partial<CameraIntent>;
  start?: Partial<CameraIntent>;
}

const DEFAULT_CAMERA_INTENT: CameraIntent = {
  azimuth: 'front',
  distance: 'medium',
  elevation: 'eye-level',
  framing: 'medium',
  lens: 50,
};

const AZIMUTH_ORDER: CameraAzimuth[] = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
];

const DISTANCE_ORDER: CameraDistance[] = ['wide', 'medium', 'near'];
const ELEVATION_ORDER: CameraElevation[] = ['low', 'eye-level', 'high', 'top'];

const KEYFRAME_TYPE_ORDER: Record<StoryboardKeyframeType, number> = {
  start: 0,
  intermediate: 1,
  end: 2,
};

function cameraIntent(overrides?: Partial<CameraIntent>): CameraIntent {
  const composition = overrides?.composition?.map((subject) => ({...subject}));

  return {
    ...DEFAULT_CAMERA_INTENT,
    ...overrides,
    ...(composition ? {composition} : {}),
  };
}

function formatShotNumber(order: number): string {
  return String(order).padStart(2, '0');
}

function formatKeyframeType(type: StoryboardKeyframeType): string {
  if (type === 'start') return 'Start';
  if (type === 'end') return 'End';
  return 'Intermediate';
}

function referenceFromKeyframe(
  keyframe: StoryboardKeyframe,
  shot: StoryboardShot,
  type: 'previous-keyframe' | 'previous-shot',
  primary = false,
): GenerationReference | null {
  if (!keyframe.imageUrl) return null;

  return {
    id: `continuity-${shot.id}-${keyframe.id}`,
    imageUrl: keyframe.imageUrl,
    primary,
    sourceKeyframeId: keyframe.id,
    sourceShotId: shot.id,
    title: `Shot ${formatShotNumber(shot.order)} · ${formatKeyframeType(keyframe.type)}`,
    type,
  };
}

export function detectCameraMovement(
  from: CameraIntent,
  to: CameraIntent,
): CameraMovementType {
  const sameAzimuth = from.azimuth === to.azimuth;
  const sameDistance = from.distance === to.distance;
  const sameElevation = from.elevation === to.elevation;
  const sameTarget = from.targetId === to.targetId;

  if (sameAzimuth && sameDistance && sameElevation && sameTarget) {
    return 'Static';
  }

  if (sameAzimuth && sameDistance && sameElevation && !sameTarget) {
    return 'Pan';
  }

  if (!sameDistance) {
    return DISTANCE_ORDER.indexOf(to.distance) > DISTANCE_ORDER.indexOf(from.distance)
      ? 'Dolly In'
      : 'Dolly Out';
  }

  if (!sameElevation) {
    return ELEVATION_ORDER.indexOf(to.elevation) > ELEVATION_ORDER.indexOf(from.elevation)
      ? 'Crane Up'
      : 'Crane Down';
  }

  if (!sameAzimuth && sameTarget) {
    const fromIndex = AZIMUTH_ORDER.indexOf(from.azimuth);
    const toIndex = AZIMUTH_ORDER.indexOf(to.azimuth);
    const clockwiseSteps = (toIndex - fromIndex + AZIMUTH_ORDER.length)
      % AZIMUTH_ORDER.length;

    return clockwiseSteps <= AZIMUTH_ORDER.length / 2
      ? 'Orbit Right'
      : 'Orbit Left';
  }

  return 'Pan';
}

export function sortKeyframes(
  keyframes: readonly StoryboardKeyframe[],
): StoryboardKeyframe[] {
  return [...keyframes].sort((first, second) => {
    const positionDifference = first.position - second.position;
    if (positionDifference !== 0) return positionDifference;

    const typeDifference = KEYFRAME_TYPE_ORDER[first.type]
      - KEYFRAME_TYPE_ORDER[second.type];
    if (typeDifference !== 0) return typeDifference;

    return first.id.localeCompare(second.id);
  });
}

export function isShotReady(shot: StoryboardShot): boolean {
  const start = shot.keyframes.find(({type}) => type === 'start');
  const end = shot.keyframes.find(({type}) => type === 'end');
  return Boolean(
    normalizeStoryboardImageUrl(start?.imageUrl)
    && normalizeStoryboardImageUrl(end?.imageUrl)
    && start?.cameraIntent
    && end?.cameraIntent,
  );
}

export function normalizeStoryboardImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl === 'string' && imageUrl.startsWith('mock://')) return imageUrl;
  return safeImageUrl(imageUrl);
}

export function createInitialKeyframes(
  shotId: string,
  presets: InitialCameraPresets = {},
): StoryboardKeyframe[] {
  return [
    {
      cameraIntent: cameraIntent(presets.start),
      generationStatus: 'idle',
      id: `${shotId}-start`,
      position: 0,
      shotId,
      type: 'start',
    },
    {
      cameraIntent: cameraIntent(presets.end ?? presets.start),
      generationStatus: 'idle',
      id: `${shotId}-end`,
      position: 1,
      shotId,
      type: 'end',
    },
  ];
}

export function suggestContinuityReferences(
  keyframe: StoryboardKeyframe,
  currentShot: StoryboardShot,
  previousShot?: StoryboardShot,
): GenerationReference[] {
  if (keyframe.type === 'start') {
    if (!previousShot) return [];

    const previousEnd = sortKeyframes(previousShot.keyframes)
      .find((candidate) => candidate.type === 'end');
    const reference = previousEnd
      ? referenceFromKeyframe(previousEnd, previousShot, 'previous-shot', true)
      : null;

    return reference ? [reference] : [];
  }

  const previousKeyframe = sortKeyframes(currentShot.keyframes)
    .filter((candidate) => candidate.position < keyframe.position)
    .reverse()
    .find((candidate) => candidate.imageUrl);
  const reference = previousKeyframe
    ? referenceFromKeyframe(previousKeyframe, currentShot, 'previous-keyframe', true)
    : null;

  return reference ? [reference] : [];
}

export function listContinuityReferences(
  keyframe: StoryboardKeyframe,
  currentShot: StoryboardShot,
  sceneShots: readonly StoryboardShot[],
): GenerationReference[] {
  const references: GenerationReference[] = [];

  if (keyframe.type !== 'start') {
    sortKeyframes(currentShot.keyframes)
      .filter((candidate) => candidate.position < keyframe.position)
      .reverse()
      .forEach((candidate) => {
        const reference = referenceFromKeyframe(candidate, currentShot, 'previous-keyframe');
        if (reference) references.push(reference);
      });
  }

  [...sceneShots]
    .filter(({order}) => order < currentShot.order)
    .sort((first, second) => second.order - first.order)
    .forEach((shot) => {
      sortKeyframes(shot.keyframes).reverse().forEach((candidate) => {
        const reference = referenceFromKeyframe(candidate, shot, 'previous-shot');
        if (reference) references.push(reference);
      });
    });

  return references;
}
