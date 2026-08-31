import {MOCK_STORYBOARD_SCENES} from './mockData';
import {
  createInitialKeyframes,
  detectCameraMovement,
  isShotReady,
  listContinuityReferences,
  normalizeStoryboardImageUrl,
  sortKeyframes,
  suggestContinuityReferences,
} from './model';
import type {
  CameraIntent,
  StoryboardKeyframe,
  StoryboardShot,
} from './model';

const BASE_CAMERA_INTENT: CameraIntent = {
  azimuth: 'front',
  distance: 'medium',
  elevation: 'eye-level',
  framing: 'medium',
  lens: 50,
  targetId: 'anna',
};

function intent(overrides: Partial<CameraIntent> = {}): CameraIntent {
  return {...BASE_CAMERA_INTENT, ...overrides};
}

test('detects static, dolly and pan camera movement', () => {
  expect(detectCameraMovement(intent(), intent())).toBe('Static');
  expect(
    detectCameraMovement(intent({distance: 'wide'}), intent({distance: 'near'})),
  ).toBe('Dolly In');
  expect(
    detectCameraMovement(intent({distance: 'near'}), intent({distance: 'wide'})),
  ).toBe('Dolly Out');
  expect(
    detectCameraMovement(intent({targetId: 'anna'}), intent({targetId: 'envelope'})),
  ).toBe('Pan');
});

test('detects directional orbit and crane movement', () => {
  expect(
    detectCameraMovement(intent({azimuth: 'front'}), intent({azimuth: 'right'})),
  ).toBe('Orbit Right');
  expect(
    detectCameraMovement(intent({azimuth: 'front'}), intent({azimuth: 'left'})),
  ).toBe('Orbit Left');
  expect(
    detectCameraMovement(intent({elevation: 'low'}), intent({elevation: 'high'})),
  ).toBe('Crane Up');
  expect(
    detectCameraMovement(intent({elevation: 'top'}), intent({elevation: 'eye-level'})),
  ).toBe('Crane Down');
});

test('sorts keyframes by position without mutating the input', () => {
  const [start, end] = createInitialKeyframes('shot-01');
  const intermediate: StoryboardKeyframe = {
    ...start,
    id: 'shot-01-intermediate',
    position: 0.45,
    type: 'intermediate',
  };
  const input = [end, intermediate, start];

  expect(sortKeyframes(input).map(({id}) => id)).toEqual([
    start.id,
    intermediate.id,
    end.id,
  ]);
  expect(input.map(({id}) => id)).toEqual([
    end.id,
    intermediate.id,
    start.id,
  ]);
});

test('creates required start and end keyframes from camera presets', () => {
  const keyframes = createInitialKeyframes('shot-02', {
    end: {distance: 'near', framing: 'medium-close'},
    start: {azimuth: 'front-left', targetId: 'anna'},
  });

  expect(keyframes).toHaveLength(2);
  expect(keyframes[0]).toMatchObject({
    cameraIntent: {azimuth: 'front-left', targetId: 'anna'},
    id: 'shot-02-start',
    position: 0,
    type: 'start',
  });
  expect(keyframes[1]).toMatchObject({
    cameraIntent: {distance: 'near', framing: 'medium-close'},
    id: 'shot-02-end',
    position: 1,
    type: 'end',
  });
});

test('suggests the previous shot end for a new shot start', () => {
  const scene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-03');
  const previousShot = scene?.shots[0];
  const currentShot = scene?.shots[1];

  expect(scene).toBeDefined();
  expect(previousShot).toBeDefined();
  expect(currentShot).toBeDefined();
  if (!previousShot || !currentShot) return;

  expect(
    suggestContinuityReferences(currentShot.keyframes[0], currentShot, previousShot),
  ).toEqual([
    expect.objectContaining({
      sourceKeyframeId: previousShot.keyframes[1].id,
      title: 'Shot 01 · End',
      type: 'previous-shot',
    }),
  ]);
});

test('suggests the closest earlier keyframe for intermediate and end frames', () => {
  const [start, end] = createInitialKeyframes('shot-current');
  const startWithImage = {...start, imageUrl: '/start.jpg'};
  const intermediate: StoryboardKeyframe = {
    ...start,
    id: 'shot-current-intermediate',
    imageUrl: '/intermediate.jpg',
    position: 0.6,
    type: 'intermediate',
  };
  const shot: StoryboardShot = {
    characterIds: [],
    description: '',
    id: 'shot-current',
    keyframes: [end, intermediate, startWithImage],
    order: 2,
    referenceIds: [],
    sceneId: 'scene-01',
    title: 'Current shot',
    transitions: [],
  };

  expect(suggestContinuityReferences(end, shot)).toEqual([
    expect.objectContaining({
      sourceKeyframeId: intermediate.id,
      title: 'Shot 02 · Intermediate',
      type: 'previous-keyframe',
    }),
  ]);
});

test('provides the specified Shot 02 camera settings and continuity references', () => {
  const scene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-03');
  const shot02 = scene?.shots.find(({order}) => order === 2);

  expect(scene?.shots).toHaveLength(5);
  expect(shot02?.keyframes[0].cameraIntent).toMatchObject({
    azimuth: 'front-left',
    distance: 'medium',
    elevation: 'eye-level',
    framing: 'medium',
    lens: 50,
    targetId: 'character-anna',
  });
  expect(shot02?.keyframes[1].cameraIntent).toMatchObject({
    azimuth: 'front-left',
    distance: 'near',
    elevation: 'eye-level',
    framing: 'medium-close',
    lens: 50,
    targetId: 'character-anna',
  });
  expect(shot02?.keyframes[0].generationReferences).toEqual(
    expect.arrayContaining([
      expect.objectContaining({title: 'Shot 01 · End', type: 'previous-shot'}),
    ]),
  );
  expect(shot02?.keyframes[1].generationReferences).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Shot 02 · Start',
        type: 'previous-keyframe',
      }),
    ]),
  );
});

test('lists earlier generated keyframes while keeping the immediate predecessor primary', () => {
  const scene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-03');
  const shot02 = scene?.shots[1];
  const shot03 = scene?.shots[2];

  expect(scene).toBeDefined();
  expect(shot02).toBeDefined();
  expect(shot03).toBeDefined();
  if (!scene || !shot02 || !shot03) return;

  const references = listContinuityReferences(shot03.keyframes[0], shot03, scene.shots);
  expect(references).toEqual(expect.arrayContaining([
    expect.objectContaining({title: 'Shot 02 · End'}),
    expect.objectContaining({title: 'Shot 02 · Start'}),
    expect.objectContaining({title: 'Shot 01 · End'}),
    expect.objectContaining({title: 'Shot 01 · Start'}),
  ]));
  expect(suggestContinuityReferences(shot03.keyframes[0], shot03, shot02)).toEqual([
    expect.objectContaining({primary: true, title: 'Shot 02 · End'}),
  ]);
});

test('requires generated Start and End images before a shot is ready', () => {
  const completedScene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-01');
  const draftScene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-03');

  expect(completedScene?.shots[0] && isShotReady(completedScene.shots[0])).toBe(true);
  expect(draftScene?.shots[2] && isShotReady(draftScene.shots[2])).toBe(false);
  expect(normalizeStoryboardImageUrl('javascript:alert(1)')).toBeNull();
  expect(normalizeStoryboardImageUrl('mock://storyboard/frame')).toBe('mock://storyboard/frame');
});
