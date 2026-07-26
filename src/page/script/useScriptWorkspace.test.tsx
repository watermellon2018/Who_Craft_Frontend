import {act, renderHook, waitFor} from '@testing-library/react';

import {scriptApi} from './api';
import type {Scene, ScriptWorkspaceResponse} from './types';
import {useScriptWorkspace} from './useScriptWorkspace';

jest.mock('./api', () => ({
  scriptApi: {
    createScene: jest.fn(),
    deleteScene: jest.fn(),
    getCharacters: jest.fn(),
    getWorkspace: jest.fn(),
    updateScene: jest.fn(),
  },
}));

jest.mock('../../modules/character-studio/api/characterApi', () => ({
  characterApi: {update: jest.fn()},
}));

const getWorkspaceMock = scriptApi.getWorkspace as jest.MockedFunction<typeof scriptApi.getWorkspace>;
const getCharactersMock = scriptApi.getCharacters as jest.MockedFunction<typeof scriptApi.getCharacters>;
const updateSceneMock = scriptApi.updateScene as jest.MockedFunction<typeof scriptApi.updateScene>;
const createSceneMock = scriptApi.createScene as jest.MockedFunction<typeof scriptApi.createScene>;

const scene: Scene = {
  id: 1,
  title: 'Исходная сцена',
  description: '',
  scriptText: '',
  scriptBlocks: [],
  status: 'draft',
  order: 1,
  act: 1,
  durationSeconds: 60,
  mood: 'calm',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-07-20T00:00:00Z',
};

const workspace: ScriptWorkspaceResponse = {
  project: {id: 7, title: 'Тестовый фильм', permissions: {canEdit: true}},
  stats: {
    sceneCount: 1,
    totalDurationSeconds: 60,
    acts: [{act: 1, sceneCount: 1, durationSeconds: 60}],
  },
  scenes: [scene],
};

beforeEach(() => {
  jest.clearAllMocks();
  getWorkspaceMock.mockResolvedValue(workspace);
  getCharactersMock.mockResolvedValue([]);
});

describe('useScriptWorkspace scene persistence', () => {
  it('coalesces parallel saves and persists edits made during the first patch', async () => {
    let resolveFirstPatch: (saved: Scene) => void = () => undefined;
    const firstPatch = new Promise<Scene>((resolve) => {
      resolveFirstPatch = resolve;
    });
    updateSceneMock
      .mockImplementationOnce(() => firstPatch)
      .mockImplementationOnce(async (_projectId, nextScene) => ({...nextScene, version: 3}));

    const {result} = renderHook(() => useScriptWorkspace('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.updateScene(1, {title: 'Первая правка'}));

    let firstSave: Promise<boolean> = Promise.resolve(false);
    let parallelSave: Promise<boolean> = Promise.resolve(false);
    act(() => {
      firstSave = result.current.saveSelectedScene();
      parallelSave = result.current.saveSelectedScene();
    });
    await waitFor(() => expect(updateSceneMock).toHaveBeenCalledTimes(1));

    act(() => result.current.updateScene(1, {title: 'Последняя правка'}));
    const firstSentScene = updateSceneMock.mock.calls[0][1];

    await act(async () => {
      resolveFirstPatch({...firstSentScene, version: 2});
      await expect(Promise.all([firstSave, parallelSave])).resolves.toEqual([true, true]);
    });

    expect(updateSceneMock).toHaveBeenCalledTimes(2);
    expect(updateSceneMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      title: 'Последняя правка',
      version: 2,
    }));
    expect(result.current.dirtySceneIds).toEqual([]);
  });

  it('does not create a scene when saving the selected dirty scene fails', async () => {
    updateSceneMock.mockRejectedValueOnce(new Error('network unavailable'));
    const {result} = renderHook(() => useScriptWorkspace('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.updateScene(1, {notes: 'Несохранённая заметка'}));
    await act(async () => {
      await result.current.addScene();
    });

    expect(updateSceneMock).toHaveBeenCalledTimes(1);
    expect(createSceneMock).not.toHaveBeenCalled();
    expect(result.current.saveError).toContain('не удалось сохранить');
  });
});
