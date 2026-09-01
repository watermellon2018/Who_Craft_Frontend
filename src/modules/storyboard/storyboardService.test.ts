import type {StoryboardShotProposal} from '../../api/generated/contracts';
import type {StoryboardScene} from './model';
import {storyboardApi} from './storyboardApi';
import {storyboardService} from './storyboardService';
import {MOCK_STORYBOARD_SCENES} from './mockData';

jest.mock('./storyboardApi', () => ({storyboardApi: {
  loadScenes: jest.fn(), loadShotListOptions: jest.fn(), suggestShotList: jest.fn(),
  suggestShotMetadata: jest.fn(),
}}));

const suggest = storyboardApi.suggestShotList as jest.MockedFunction<typeof storyboardApi.suggestShotList>;
const suggestMetadata = storyboardApi.suggestShotMetadata as jest.MockedFunction<
  typeof storyboardApi.suggestShotMetadata
>;

test('carries the authoritative source snapshot and shared segment IDs into local shots', async () => {
  const scene: StoryboardScene = {
    entities: [], id: '1', locationIds: [], order: 1, shots: [], status: 'empty',
    text: 'Edited while waiting for the model.', title: 'Meeting', version: 5,
    draftAuthGeneration: 7,
  };
  const item: StoryboardShotProposal['shots'][number] = {
    title: 'Встреча', description: 'Описание '.repeat(200),
    source_segment_ids: ['a'], suggested_assets: [], suggested_characters: [],
    suggested_framing: 'wide', suggested_location: null,
  };
  suggest.mockResolvedValue({
    source: {
      scene_id: 1, scene_version: 4, content_hash: 'authoritative-hash', truncated: false,
      segments: [{id: 'a', text: 'Исходный сценарий.\n'}],
    },
    shots: [item, {...item, title: 'Реакция'}],
  });
  const shots = await storyboardService.suggestShotList(scene, '7', {maxShots: 12, model: 'qwen'});
  expect(shots[0].description).toBe(item.description);
  expect(shots[0].source).toEqual({
    document: {
      sceneId: 1, sceneVersion: 4, contentHash: 'authoritative-hash', truncated: false,
      segments: [{id: 'a', text: 'Исходный сценарий.\n'}],
    }, segmentIds: ['a'], origin: 'ai',
  });
  expect(shots[1].source?.document).toBe(shots[0].source?.document);
  expect(shots[1].source?.segmentIds).toEqual(['a']);
  expect(shots[1].source?.segmentIds).not.toBe(shots[0].source?.segmentIds);
  expect(shots.every(({keyframes}) => keyframes.length === 1 && keyframes[0].type === 'start')).toBe(true);
  expect(suggest).toHaveBeenCalledTimes(1);
  expect(suggest).toHaveBeenCalledWith('7', scene.id, {maxShots: 12, model: 'qwen'}, 7);
});

test('does not silently return mock artwork through the obsolete real-service generation method', async () => {
  const shot = MOCK_STORYBOARD_SCENES[0].shots[0];
  await expect(storyboardService.generateFrame({shot, keyframe: shot.keyframes[0], references: []}))
    .rejects.toThrow('Use the durable editor-frame-jobs endpoint.');
});

test('uses the current scene version and auth generation for manual field suggestions', async () => {
  const scene: StoryboardScene = {
    draftAuthGeneration: 9,
    entities: [], id: '17', locationIds: [], order: 1, shots: [], status: 'empty',
    text: 'Анна входит.', title: 'Кухня', version: 4,
  };
  suggestMetadata.mockResolvedValue({field: 'title', value: 'Анна входит'});

  await expect(storyboardService.suggestShotMetadata(
    scene, '61', 'title', {start: 0, end: 11},
  )).resolves.toBe('Анна входит');

  expect(suggestMetadata).toHaveBeenCalledWith('61', '17', {
    field: 'title',
    language: expect.stringMatching(/^(ru|en)$/u),
    range: {start: 0, end: 11},
    sceneVersion: 4,
  }, 9);
});
