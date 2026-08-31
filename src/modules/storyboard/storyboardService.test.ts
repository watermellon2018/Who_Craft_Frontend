import type {StoryboardShotProposal} from '../../api/generated/contracts';
import type {StoryboardScene} from './model';
import {storyboardApi} from './storyboardApi';
import {storyboardService} from './storyboardService';

jest.mock('./storyboardApi', () => ({storyboardApi: {
  loadScenes: jest.fn(), loadShotListOptions: jest.fn(), suggestShotList: jest.fn(),
}}));

const suggest = storyboardApi.suggestShotList as jest.MockedFunction<typeof storyboardApi.suggestShotList>;

test('carries the authoritative source snapshot and shared segment IDs into local shots', async () => {
  const scene: StoryboardScene = {
    entities: [], id: '1', locationIds: [], order: 1, shots: [], status: 'empty',
    text: 'Edited while waiting for the model.', title: 'Meeting', version: 5,
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
    }, segmentIds: ['a'],
  });
  expect(shots[1].source?.document).toBe(shots[0].source?.document);
  expect(shots[1].source?.segmentIds).toEqual(['a']);
  expect(shots[1].source?.segmentIds).not.toBe(shots[0].source?.segmentIds);
  expect(suggest).toHaveBeenCalledTimes(1);
});
