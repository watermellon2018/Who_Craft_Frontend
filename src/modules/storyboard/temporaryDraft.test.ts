import {createInitialKeyframes} from './model';
import type {StoryboardShot} from './model';
import {
  normalizeTemporaryShots,
  readTemporaryDraft,
  temporaryDraftKey,
  writeTemporaryDraft,
} from './temporaryDraft';

const shot: StoryboardShot = {
  characterIds: ['character-1'],
  description: 'Полный текст описания.\nВторая строка. '.repeat(120),
  id: 'shot-1',
  keyframes: createInitialKeyframes('shot-1'),
  order: 1,
  referenceIds: [],
  sceneId: 'scene-1',
  title: 'Первый кадр',
  transitions: [],
};

beforeEach(() => localStorage.clear());

test('stores full text and a source snapshot separately for every user and project', () => {
  const source = {
    document: {
      sceneId: 1,
      sceneVersion: 2,
      contentHash: 'hash-1',
      segments: [{id: 'block-1', text: 'Исходный текст.\nБез изменений.'}],
      truncated: false,
    },
    segmentIds: ['block-1'],
  };
  const shots = normalizeTemporaryShots([{...shot, source}], 'scene-1');
  if (!shots) throw new Error('Valid shots should normalize');
  writeTemporaryDraft({
    version: 1,
    projectId: 'project-1',
    userId: 9,
    updatedAt: '2026-08-31T00:00:00.000Z',
    scenes: {'scene-1': shots},
  });
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0]).toEqual(expect.objectContaining({
    description: shot.description,
    source,
  }));
  expect(readTemporaryDraft(10, 'project-1')).toBeNull();
  expect(readTemporaryDraft(9, 'project-2')).toBeNull();
});

test('normalizes transient generation state and excludes signed URLs, binary data and unknown fields', () => {
  const result = normalizeTemporaryShots([{
    ...shot,
    authToken: 'must-not-persist',
    keyframes: shot.keyframes.map((keyframe, index) => ({
      ...keyframe,
      generationStatus: 'loading',
      imageUrl: index === 0 ? 'https://example.com/image?token=secret' : 'data:image/png;base64,secret',
      authToken: 'must-not-persist',
      generationReferences: [{
        id: 'reference-1',
        title: 'Private image',
        type: 'character',
        imageUrl: 'https://example.com/private?signature=secret',
      }],
    })),
  }], 'scene-1');
  if (!result) throw new Error('Valid shots should normalize');
  expect(result[0].keyframes).toEqual(expect.arrayContaining([
    expect.objectContaining({generationStatus: 'idle', generationReferences: []}),
  ]));
  expect(JSON.stringify(result)).not.toMatch(/secret|authToken|base64/);
  expect(result[0]).not.toHaveProperty('source');
});

test('rejects malformed nested cache data and repairs legacy missing boundary keyframes', () => {
  expect(normalizeTemporaryShots([{...shot, keyframes: [{id: 'broken'}]}], 'scene-1')).toBeNull();
  expect(normalizeTemporaryShots([shot, shot], 'scene-1')).toBeNull();
  expect(normalizeTemporaryShots([{...shot, keyframes: []}], 'scene-1')?.[0].keyframes).toHaveLength(2);
  localStorage.setItem(temporaryDraftKey(9, 'project-1'), JSON.stringify({
    version: 1,
    projectId: 'project-1',
    userId: 10,
    updatedAt: 'today',
    scenes: {'scene-1': [shot]},
  }));
  expect(() => readTemporaryDraft(9, 'project-1')).toThrow('Invalid temporary storyboard draft');
  localStorage.setItem(temporaryDraftKey(9, 'project-1'), '{invalid JSON');
  expect(() => readTemporaryDraft(9, 'project-1')).toThrow('Invalid temporary storyboard draft');
});
