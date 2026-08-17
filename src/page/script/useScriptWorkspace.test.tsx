import {act, renderHook, waitFor} from '@testing-library/react';

import {scriptApi} from './api';
import type {Scene, ScriptWorkspaceResponse} from './types';
import {SCRIPT_AUTO_SAVE_DELAY_MS, useScriptWorkspace} from './useScriptWorkspace';

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
const deleteSceneMock = scriptApi.deleteScene as jest.MockedFunction<typeof scriptApi.deleteScene>;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
};

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
  deleteSceneMock.mockResolvedValue();
});

describe('useScriptWorkspace scene persistence', () => {
  it('opens in screenplay mode and autosaves a changed scene after a short pause', async () => {
    updateSceneMock.mockImplementation(async (_projectId, nextScene) => ({
      ...nextScene,
      version: nextScene.version + 1,
    }));
    const {result} = renderHook(() => useScriptWorkspace('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mode).toBe('screenplay');
    act(() => result.current.updateScene(1, {title: 'Автосохранённая сцена'}));

    await waitFor(
      () => expect(updateSceneMock).toHaveBeenCalledTimes(1),
      {timeout: SCRIPT_AUTO_SAVE_DELAY_MS + 1500},
    );
    await waitFor(() => expect(result.current.dirtySceneIds).toEqual([]));
    expect(updateSceneMock.mock.calls[0][1].title).toBe('Автосохранённая сцена');
  });

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

  it('waits for an active autosave before deleting the same scene', async () => {
    const saveRequest = deferred<Scene>();
    updateSceneMock.mockReturnValueOnce(saveRequest.promise);
    const {result} = renderHook(() => useScriptWorkspace('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.updateScene(1, {notes: 'Удалить после сохранения'}));
    await waitFor(
      () => expect(updateSceneMock).toHaveBeenCalledTimes(1),
      {timeout: SCRIPT_AUTO_SAVE_DELAY_MS + 1500},
    );

    let removePromise: Promise<void> = Promise.resolve();
    act(() => {
      removePromise = result.current.removeScene(1);
    });
    expect(deleteSceneMock).not.toHaveBeenCalled();

    await act(async () => {
      saveRequest.resolve({...scene, notes: 'Удалить после сохранения', version: 2});
      await removePromise;
    });

    expect(deleteSceneMock).toHaveBeenCalledWith('7', 1);
    expect(result.current.scenes).toEqual([]);
  });
});
describe('useScriptWorkspace route ownership', () => {
  it('keeps project B after the deferred project A response resolves', async () => {
    const workspaceARequest = deferred<ScriptWorkspaceResponse>();
    const charactersARequest = deferred<Awaited<ReturnType<typeof scriptApi.getCharacters>>>();
    const workspaceBRequest = deferred<ScriptWorkspaceResponse>();
    const charactersBRequest = deferred<Awaited<ReturnType<typeof scriptApi.getCharacters>>>();
    const workspaceB: ScriptWorkspaceResponse = {
      ...workspace,
      project: {id: 8, title: 'Проект B', permissions: {canEdit: true}},
      scenes: [{...scene, id: 2, title: 'Сцена B'}],
    };

    getWorkspaceMock.mockImplementation((requestedProjectId) => (
      requestedProjectId === '7' ? workspaceARequest.promise : workspaceBRequest.promise
    ));
    getCharactersMock.mockImplementation((requestedProjectId) => (
      requestedProjectId === '7' ? charactersARequest.promise : charactersBRequest.promise
    ));

    const {result, rerender} = renderHook(
      ({currentProjectId}) => useScriptWorkspace(currentProjectId),
      {initialProps: {currentProjectId: '7'}},
    );
    await waitFor(() => expect(getWorkspaceMock).toHaveBeenCalledWith('7'));

    rerender({currentProjectId: '8'});

    expect(result.current.loading).toBe(true);
    expect(result.current.project).toBeNull();
    expect(result.current.scenes).toEqual([]);
    expect(result.current.canEdit).toBe(false);

    await act(async () => {
      workspaceBRequest.resolve(workspaceB);
      charactersBRequest.resolve([]);
      await Promise.all([workspaceBRequest.promise, charactersBRequest.promise]);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.project?.id).toBe(8);
    expect(result.current.scenes).toEqual([expect.objectContaining({id: 2, title: 'Сцена B'})]);

    await act(async () => {
      workspaceARequest.resolve(workspace);
      charactersARequest.resolve([]);
      await Promise.all([workspaceARequest.promise, charactersARequest.promise]);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.project?.id).toBe(8);
    expect(result.current.scenes).toEqual([expect.objectContaining({id: 2, title: 'Сцена B'})]);
  });
});
