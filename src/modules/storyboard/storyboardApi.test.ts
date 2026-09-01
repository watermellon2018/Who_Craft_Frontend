jest.mock('../../api/http', () => ({
  __esModule: true,
  backendAssetUrl: (value: string) => value,
  getAuthGeneration: () => 0,
  default: {get: jest.fn(), post: jest.fn(), put: jest.fn()},
}));

jest.mock('../../page/script/api', () => ({
  scriptApi: {getWorkspace: jest.fn()},
}));

import api from '../../api/http';
import {scriptApi} from '../../page/script/api';
import {storyboardApi} from './storyboardApi';

const getMock = api.get as jest.MockedFunction<typeof api.get>;
const postMock = api.post as jest.MockedFunction<typeof api.post>;
const getWorkspaceMock = scriptApi.getWorkspace as jest.MockedFunction<
  typeof scriptApi.getWorkspace
>;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  getMock.mockReset();
  getMock.mockImplementation(async (url) => ({data: url.endsWith('/editor-drafts/')
    ? {userId: 7, canEdit: true, drafts: []} : []}));
});

test('loads the current project screenplay instead of the demo apartment scenes', async () => {
  getWorkspaceMock.mockResolvedValue({
    project: {id: 61, permissions: {canEdit: true}, title: 'Анчоус тим'},
    scenes: [{
      act: 1,
      characters: [{
        id: 'angry-dog',
        imageUrl: '/media/angry-dog.png',
        name: 'Энгри Дог',
        role: 'main',
        roleLabel: 'Главная роль',
      }],
      description: 'Энгри Дог встречает Анчоуса.',
      durationSeconds: 20,
      id: 17,
      mood: 'tense',
      notes: '',
      order: 1,
      sceneType: 'setup',
      scriptBlocks: [
        {id: 'heading', text: 'EXT. ПРИЧАЛ — ДЕНЬ', type: 'scene_heading'},
        {id: 'action', text: 'Энгри Дог замечает Анчоуса.', type: 'action'},
        {id: 'character', text: 'ЭНГРИ ДОГ', type: 'character'},
        {id: 'dialogue', text: 'Анчоус, это ты?', type: 'dialogue'},
      ],
      scriptText: 'Энгри Дог замечает Анчоуса.',
      status: 'draft',
      title: 'Встреча Энгри Дога и Анчоуса',
      updatedAt: '2026-08-29T00:00:00Z',
      version: 1,
    }],
    stats: {acts: [], sceneCount: 1, totalDurationSeconds: 20},
  });
  getMock.mockResolvedValueOnce({
    data: [{
      id: 17,
      number: 1,
      progress: 0,
      readyShotsCount: 0,
      shotsCount: 0,
      status: 'empty',
      title: 'Встреча Энгри Дога и Анчоуса',
    }],
  });

  const scenes = await storyboardApi.loadScenes('61');

  expect(getWorkspaceMock).toHaveBeenCalledWith('61');
  expect(getMock).toHaveBeenCalledWith('api/projects/61/storyboard/scenes/');
  expect(scenes).toHaveLength(1);
  expect(scenes[0]).toMatchObject({
    heading: 'EXT. ПРИЧАЛ — ДЕНЬ',
    id: '17',
    scriptBlocks: [
      {id: 'heading', text: 'EXT. ПРИЧАЛ — ДЕНЬ', type: 'scene_heading'},
      {id: 'action', text: 'Энгри Дог замечает Анчоуса.', type: 'action'},
      {id: 'character', text: 'ЭНГРИ ДОГ', type: 'character'},
      {id: 'dialogue', text: 'Анчоус, это ты?', type: 'dialogue'},
    ],
    text: expect.stringContaining('Энгри Дог замечает Анчоуса.'),
    title: 'Встреча Энгри Дога и Анчоуса',
  });
  expect(scenes[0].title).not.toContain('Apartment');
  expect(scenes[0].canEdit).toBe(true);
});

test('requests an AI shot proposal for the current project and scene', async () => {
  postMock.mockResolvedValue({data: {shots: []}});

  await expect(storyboardApi.suggestShotList('61', '17', {
    maxShots: 12,
    model: 'gemini/gemini-2.5-flash',
  }, 7)).resolves.toEqual({shots: []});

  expect(postMock).toHaveBeenCalledWith(
    'api/projects/61/storyboard/scenes/17/suggest-shots/',
    {maxShots: 12, model: 'gemini/gemini-2.5-flash'},
    {expectedAuthGeneration: 7},
  );
});

test('requests one manual shot field without sending a model or source text', async () => {
  postMock.mockResolvedValue({data: {field: 'title', value: 'Анна входит'}});

  await expect(storyboardApi.suggestShotMetadata('61', '17', {
    field: 'title',
    language: 'ru',
    range: {start: 4, end: 19},
    sceneVersion: 8,
  }, 7)).resolves.toEqual({field: 'title', value: 'Анна входит'});

  expect(postMock).toHaveBeenCalledWith(
    'api/projects/61/storyboard/scenes/17/suggest-shot-metadata/',
    {field: 'title', language: 'ru', range: {start: 4, end: 19}, sceneVersion: 8},
    {expectedAuthGeneration: 7},
  );
});

test('loads model availability and cost estimates for the selected scene', async () => {
  const options = {
    context: {characters: ['Энгри Дог'], locations: ['Причал'], sceneTitle: 'Причал'},
    defaultModel: 'gemini/gemini-2.5-flash',
    maxShots: 16,
    models: [{
      available: true,
      estimatedCostUsd: '0.001162',
      estimatedInputTokens: 100,
      estimatedOutputTokens: 2880,
      id: 'gemini/gemini-2.5-flash',
      label: 'Gemini 2.5 Flash · Google Gemini',
      provider: 'Google Gemini',
      unavailableReason: null,
    }],
  };
  getMock.mockResolvedValue({data: options});

  await expect(storyboardApi.loadShotListOptions('61', '17')).resolves.toEqual(options);

  expect(getMock).toHaveBeenCalledWith(
    'api/projects/61/storyboard/scenes/17/suggest-shots/',
  );
});

test('uses the requested interface language for the cost estimate request', async () => {
  getMock.mockResolvedValue({data: {models: []}});
  await storyboardApi.loadShotListOptions('61', '17', 'ru');
  expect(getMock).toHaveBeenCalledWith('api/projects/61/storyboard/scenes/17/suggest-shots/', {params: {language: 'ru'}});
});
