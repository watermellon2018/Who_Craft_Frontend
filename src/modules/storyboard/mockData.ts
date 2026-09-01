import {createInitialKeyframes} from './model';
import type {
  CameraIntent,
  GenerationReference,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardShot,
} from './model';

const MOCK_IMAGES = {
  anna: 'mock://storyboard/anna',
  apartment: 'mock://storyboard/apartment',
  envelope: 'mock://storyboard/envelope',
  kitchen: 'mock://storyboard/kitchen',
  shot01End: 'mock://storyboard/shot-01-end',
  shot02End: 'mock://storyboard/shot-02-end',
  shot02Start: 'mock://storyboard/shot-02-start',
  street: 'mock://storyboard/street',
} as const;

const SCENE_03_ID = 'scene-03';
const ANNA_ID = 'character-anna';
const KITCHEN_ID = 'location-kitchen';
const ENVELOPE_ID = 'object-envelope';
const STREET_ID = 'location-street';

const ANNA_REFERENCE: GenerationReference = {
  id: 'reference-anna',
  imageUrl: MOCK_IMAGES.anna,
  title: 'Anna',
  type: 'character',
};

const KITCHEN_REFERENCE: GenerationReference = {
  id: 'reference-kitchen',
  imageUrl: MOCK_IMAGES.kitchen,
  title: 'Kitchen',
  type: 'location',
};

const ENVELOPE_REFERENCE: GenerationReference = {
  id: 'reference-envelope',
  imageUrl: MOCK_IMAGES.envelope,
  title: 'Envelope',
  type: 'object',
};

const DEFAULT_SHOT_CAMERA: Partial<CameraIntent> = {
  targetId: ANNA_ID,
};

function createShot(
  order: number,
  title: string,
  description: string,
  presets: {end?: Partial<CameraIntent>; start?: Partial<CameraIntent>} = {},
): StoryboardShot {
  const id = `scene-03-shot-${String(order).padStart(2, '0')}`;
  const keyframes = createInitialKeyframes(id, {
    ...(presets.end ? {end: {...DEFAULT_SHOT_CAMERA, ...presets.end}} : {}),
    start: {...DEFAULT_SHOT_CAMERA, ...presets.start},
  });

  return {
    characterIds: order === 3 ? [] : [ANNA_ID],
    description,
    duration: 4,
    id,
    keyframes,
    locationId: KITCHEN_ID,
    order,
    referenceIds: [ENVELOPE_ID],
    sceneId: SCENE_03_ID,
    title,
    transitions: keyframes[1] ? [{
        fromKeyframeId: keyframes[0].id,
        id: `${id}-start-to-end`,
        toKeyframeId: keyframes[1].id,
      }] : [],
  };
}

function withGeneratedImage(
  keyframe: StoryboardKeyframe,
  imageUrl: string,
  generationReferences: GenerationReference[] = [],
): StoryboardKeyframe {
  return {
    ...keyframe,
    generationReferences,
    generationStatus: 'ready',
    imageUrl,
  };
}

const shot01 = createShot(
  1,
  'Wide shot',
  'Anna enters the kitchen.',
  {
    end: {azimuth: 'front-left', distance: 'medium', framing: 'full'},
    start: {distance: 'wide', framing: 'wide', lens: 35},
  },
);

shot01.keyframes = [
  withGeneratedImage(
    shot01.keyframes[0],
    MOCK_IMAGES.kitchen,
    [ANNA_REFERENCE, KITCHEN_REFERENCE],
  ),
  withGeneratedImage(
    shot01.keyframes[1],
    MOCK_IMAGES.shot01End,
    [ANNA_REFERENCE, KITCHEN_REFERENCE],
  ),
];

const shot02 = createShot(
  2,
  'Medium shot',
  'Anna notices the envelope.',
  {
    end: {
      azimuth: 'front-left',
      distance: 'near',
      elevation: 'eye-level',
      framing: 'medium-close',
      lens: 50,
      targetId: ANNA_ID,
    },
    start: {
      azimuth: 'front-left',
      distance: 'medium',
      elevation: 'eye-level',
      framing: 'medium',
      lens: 50,
      targetId: ANNA_ID,
    },
  },
);

const shot01EndReference: GenerationReference = {
  id: 'continuity-shot-01-end',
  imageUrl: MOCK_IMAGES.shot01End,
  primary: true,
  sourceKeyframeId: shot01.keyframes[1].id,
  sourceShotId: shot01.id,
  title: 'Shot 01 · End',
  type: 'previous-shot',
};

const shot02StartReference: GenerationReference = {
  id: 'continuity-shot-02-start',
  imageUrl: MOCK_IMAGES.shot02Start,
  primary: true,
  sourceKeyframeId: shot02.keyframes[0].id,
  sourceShotId: shot02.id,
  title: 'Shot 02 · Start',
  type: 'previous-keyframe',
};

shot02.keyframes = [
  withGeneratedImage(
    shot02.keyframes[0],
    MOCK_IMAGES.shot02Start,
    [ANNA_REFERENCE, KITCHEN_REFERENCE, ENVELOPE_REFERENCE, shot01EndReference],
  ),
  withGeneratedImage(
    shot02.keyframes[1],
    MOCK_IMAGES.shot02End,
    [ANNA_REFERENCE, KITCHEN_REFERENCE, ENVELOPE_REFERENCE, shot02StartReference],
  ),
];

const scene03Shots: StoryboardShot[] = [
  shot01,
  shot02,
  createShot(
    3,
    'Close-up',
    'Envelope lying on the table.',
    {
      end: {distance: 'near', framing: 'extreme-close', targetId: ENVELOPE_ID},
      start: {distance: 'near', framing: 'close', targetId: ENVELOPE_ID},
    },
  ),
  createShot(
    4,
    'Medium close-up',
    'Anna picks up the envelope.',
    {
      end: {distance: 'near', framing: 'medium-close'},
      start: {azimuth: 'front-right', framing: 'medium-close'},
    },
  ),
  createShot(
    5,
    'Close-up',
    'Anna reacts to what she sees.',
    {
      end: {distance: 'near', framing: 'extreme-close', lens: 85},
      start: {distance: 'near', framing: 'close', lens: 85},
    },
  ),
];

const scene01Keyframes = createInitialKeyframes('scene-01-shot-01', {
  end: {distance: 'near', framing: 'medium-close'},
  start: {distance: 'wide', framing: 'wide'},
}).map((keyframe) => withGeneratedImage(keyframe, MOCK_IMAGES.apartment));

const scene01Shot: StoryboardShot = {
  characterIds: [],
  description: 'Morning light fills the apartment.',
  duration: 3,
  id: 'scene-01-shot-01',
  keyframes: scene01Keyframes,
  locationId: 'location-apartment',
  order: 1,
  referenceIds: [],
  sceneId: 'scene-01',
  title: 'Establishing shot',
  transitions: [
    {
      fromKeyframeId: scene01Keyframes[0].id,
      id: 'scene-01-shot-01-start-to-end',
      toKeyframeId: scene01Keyframes[1].id,
    },
  ],
};

export const MOCK_STORYBOARD_SCENES: StoryboardScene[] = [
  {
    entities: [{
      id: 'location-apartment',
      imageUrl: MOCK_IMAGES.apartment,
      title: 'Apartment',
      type: 'location',
    }],
    heading: 'INT. APARTMENT — MORNING',
    id: 'scene-01',
    locationIds: ['location-apartment'],
    order: 1,
    shots: [scene01Shot],
    status: 'completed',
    subtitle: 'Apartment · Morning',
    text: 'The first scene has already been prepared.',
    title: 'Apartment · Morning',
  },
  {
    entities: [
      {
        id: ANNA_ID,
        imageUrl: MOCK_IMAGES.anna,
        title: 'Anna',
        type: 'character',
      },
      {
        id: STREET_ID,
        imageUrl: MOCK_IMAGES.street,
        title: 'Street',
        type: 'location',
      },
    ],
    heading: 'EXT. STREET — DAY',
    id: 'scene-02',
    locationIds: [STREET_ID],
    order: 2,
    shots: [],
    status: 'empty',
    subtitle: 'Not storyboarded',
    text: 'Anna crosses a busy street in the afternoon.',
    title: 'Street · Day',
  },
  {
    entities: [
      {
        id: ANNA_ID,
        imageUrl: MOCK_IMAGES.anna,
        title: 'Anna',
        type: 'character',
      },
      {
        id: KITCHEN_ID,
        imageUrl: MOCK_IMAGES.kitchen,
        title: 'Kitchen',
        type: 'location',
      },
      {
        id: ENVELOPE_ID,
        imageUrl: MOCK_IMAGES.envelope,
        title: 'Envelope',
        type: 'object',
      },
    ],
    heading: 'INT. KITCHEN — NIGHT',
    id: SCENE_03_ID,
    locationIds: [KITCHEN_ID],
    order: 3,
    shots: scene03Shots,
    status: 'draft',
    subtitle: 'Kitchen · Night',
    text: 'Anna enters the kitchen. She notices an envelope lying on the table. She approaches it, picks it up and looks surprised.',
    title: 'Kitchen · Night',
  },
];
