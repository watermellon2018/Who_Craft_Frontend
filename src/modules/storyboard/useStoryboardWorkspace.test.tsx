import {act, renderHook, waitFor} from '@testing-library/react';

import api, {getAuthGeneration} from '../../api/http';
import {hydrateEditorDrafts} from './editorDrafts';
import type {EditorDraftEntry, EditorDraftPayload} from './editorDrafts';
import {MOCK_STORYBOARD_SCENES} from './mockData';
import type {StoryboardScene} from './model';
import {storyboardMockService} from './storyboardService';
import {createMockShotList, useStoryboardWorkspace} from './useStoryboardWorkspace';

test('creates unique shot ids when several shots are created in the same clock tick', () => {
  const scene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-03');
  expect(scene).toBeDefined();
  if (!scene) return;

  const now = jest.spyOn(Date, 'now').mockReturnValue(12345);
  const shots = createMockShotList(scene);
  now.mockRestore();

  expect(new Set(shots.map(({id}) => id)).size).toBe(shots.length);
  expect(new Set(shots.flatMap(({keyframes}) => keyframes.map(({id}) => id))).size)
    .toBe(shots.length * 2);
});

test('keeps shot mutations in the editor and removes stale generation references on duplicate', async () => {
  const {result, unmount} = renderHook(() => useStoryboardWorkspace(
    '42',
    storyboardMockService.loadScenes,
  ));

  await waitFor(() => expect(result.current.scenes).toHaveLength(3));

  act(() => result.current.selectScene('scene-03'));
  act(() => result.current.enterEditor());
  expect(result.current.mode).toBe('editor');

  const sourceShotId = result.current.selectedShotId;
  expect(sourceShotId).toBeTruthy();
  if (!sourceShotId) return;

  act(() => result.current.duplicateShot(sourceShotId));

  expect(result.current.mode).toBe('editor');
  const shots = result.current.selectedScene?.shots ?? [];
  expect(new Set(shots.map(({id}) => id)).size).toBe(shots.length);
  const duplicate = shots[1];
  expect(new Set(duplicate.keyframes.map(({id}) => id)).size).toBe(duplicate.keyframes.length);
  expect(duplicate.keyframes.every(({generationReferences}) => !generationReferences)).toBe(true);

  act(() => result.current.addShot({description: 'Added in editor', title: 'New shot'}));
  expect(result.current.mode).toBe('editor');
  unmount();
});

test('repairs a legacy shot without keyframes before entering the editor', async () => {
  const {result, unmount} = renderHook(() => useStoryboardWorkspace(
    '42',
    storyboardMockService.loadScenes,
  ));

  await waitFor(() => expect(result.current.scenes).toHaveLength(3));

  act(() => result.current.selectScene('scene-02'));
  const scene = result.current.selectedScene;
  expect(scene).toBeDefined();
  if (!scene) return;

  act(() => result.current.setShotList([{
    characterIds: [],
    description: 'Legacy shot without keyframes',
    id: 'legacy-shot',
    keyframes: [],
    order: 1,
    referenceIds: [],
    sceneId: scene.id,
    title: 'Legacy shot',
    transitions: [],
  }]));
  act(() => result.current.enterEditor());

  expect(result.current.mode).toBe('editor');
  expect(result.current.selectedShot?.keyframes.map(({type}) => type)).toEqual(['start', 'end']);
  expect(result.current.selectedKeyframe?.type).toBe('start');
  unmount();
});

test('tags loaded scenes with their authorized project and ignores a late response for a previous project', async () => {
  let resolvePrevious: (scenes: StoryboardScene[]) => void = () => undefined;
  const previousRequest = new Promise<StoryboardScene[]>((resolve) => {
    resolvePrevious = resolve;
  });
  const loadScenes = jest.fn((projectId: string) => projectId === '43'
    ? previousRequest : storyboardMockService.loadScenes(projectId));
  const {result, rerender} = renderHook(({projectId}) => useStoryboardWorkspace(projectId, loadScenes), {
    initialProps: {projectId: '42'},
  });
  await waitFor(() => expect(result.current.loadedProjectId).toBe('42'));
  rerender({projectId: '43'});
  expect(result.current.loadedProjectId).toBeNull();
  expect(result.current.scenes).toEqual([]);
  rerender({projectId: '44'});
  await waitFor(() => expect(result.current.loadedProjectId).toBe('44'));
  await act(async () => resolvePrevious([]));
  expect(result.current.loadedProjectId).toBe('44');
  expect(result.current.scenes).toHaveLength(3);
});

test('retains original source links through editing, reordering and duplicating a local shot', async () => {
  const {result} = renderHook(() => useStoryboardWorkspace('42', storyboardMockService.loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  const original = result.current.selectedScene?.shots[0];
  if (!original) throw new Error('Expected scene shot');
  const source = {
    document: {sceneId: 3, sceneVersion: 2, contentHash: 'source', truncated: false,
      segments: [{id: 'fragment', text: 'Точный исходный текст.\n'}]},
    segmentIds: ['fragment'],
  };
  act(() => result.current.setShotList([{...original, source}]));
  act(() => result.current.updateShot(original.id, {description: 'Уточнённое описание'}));
  act(() => result.current.duplicateShot(original.id));
  const copy = result.current.selectedScene?.shots[1];
  if (!copy) throw new Error('Expected duplicate');
  act(() => result.current.moveShot(copy.id, 0));
  expect(result.current.selectedScene?.shots[0].source).toEqual(source);
  expect(copy.source?.segmentIds).not.toBe(result.current.selectedScene?.shots[1].source?.segmentIds);
  expect(copy.description).toBe('Уточнённое описание');
});

test('resumes the saved stage and keeps manual shot additions in text selection until completion', async () => {
  const loadScenes = async (projectId: string) => {
    const scenes = await storyboardMockService.loadScenes(projectId);
    return scenes.map((scene) => scene.id === 'scene-03' ? {...scene, editorStage: 'selection' as const} : scene);
  };
  const {result} = renderHook(() => useStoryboardWorkspace('42', loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  expect(result.current.mode).toBe('selection');
  act(() => result.current.addShot({title: 'Отмеченный кадр', description: 'Часть сценария'}));
  expect(result.current.mode).toBe('selection');
  act(() => result.current.setMode('builder'));
  act(() => result.current.selectScene('scene-02'));
  act(() => result.current.selectScene('scene-03'));
  expect(result.current.mode).toBe('builder');
  expect(result.current.selectedScene?.shots.some(({title}) => title === 'Отмеченный кадр')).toBe(true);
});

test('does not mutate a read-only project scene', async () => {
  const loadScenes = async (projectId: string) => (await storyboardMockService.loadScenes(projectId))
    .map((scene) => ({...scene, canEdit: false}));
  const {result} = renderHook(() => useStoryboardWorkspace('42', loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  const original = result.current.selectedScene?.shots;
  act(() => result.current.addShot({title: 'Не записывать', description: 'Нет доступа'}));
  expect(result.current.selectedScene?.shots).toEqual(original);
});

test('a late save acknowledgement does not reopen manual selection after the user has returned to overview', async () => {
  const previousCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');
  Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: (bytes: Uint8Array) => bytes.fill(1)}});
  let acknowledge: (response: {data: EditorDraftEntry}) => void = () => undefined;
  const request = new Promise<{data: EditorDraftEntry}>((resolve) => { acknowledge = resolve; });
  const put = jest.spyOn(api, 'put').mockReturnValueOnce(request);
  const loadScenes = async (projectId: string) => hydrateEditorDrafts(projectId, [{
    ...MOCK_STORYBOARD_SCENES[0], id: '117', shots: [],
  }], {authGeneration: getAuthGeneration(), data: {userId: 7, canEdit: true, drafts: []}});
  try {
    const {result, unmount} = renderHook(() => useStoryboardWorkspace('521', loadScenes, true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));
    act(() => result.current.selectScene('117'));
    act(() => result.current.setMode('selection'));
    expect(put).toHaveBeenCalledTimes(1);
    act(() => result.current.setMode('overview'));
    const sent = put.mock.calls[0][1] as {payload: EditorDraftPayload};
    await act(async () => acknowledge({data: {sceneId: 117, revision: 1, payload: sent.payload}}));
    expect(result.current.autosaveState).toBe('saved');
    expect(result.current.mode).toBe('overview');
    unmount();
  } finally {
    put.mockRestore();
    if (previousCrypto) Object.defineProperty(window, 'crypto', previousCrypto);
    else Reflect.deleteProperty(window, 'crypto');
  }
});

test('duplicates a maximum-length Unicode title without exceeding the server limit', async () => {
  const {result} = renderHook(() => useStoryboardWorkspace('42', storyboardMockService.loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  const original = result.current.selectedScene?.shots[0];
  if (!original) throw new Error('Expected shot');
  act(() => result.current.updateShot(original.id, {title: '😀'.repeat(255)}));
  act(() => result.current.duplicateShot(original.id, 'Копия'));
  const title = result.current.selectedScene?.shots[1].title ?? '';
  expect(Array.from(title)).toHaveLength(255);
  expect(title.endsWith(' · Копия')).toBe(true);
  expect(title).not.toContain('\uFFFD');
});

test('deleting the last shot persists selection instead of resuming an empty camera editor', async () => {
  const {result} = renderHook(() => useStoryboardWorkspace('42', storyboardMockService.loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  const shot = result.current.selectedScene?.shots[0];
  if (!shot) throw new Error('Expected shot');
  act(() => result.current.setShotList([shot]));
  act(() => result.current.enterEditor());
  expect(result.current.mode).toBe('editor');
  act(() => result.current.deleteShot(shot.id));
  expect(result.current.mode).toBe('selection');
  expect(result.current.selectedScene?.editorStage).toBe('selection');
  act(() => result.current.selectScene('scene-02'));
  act(() => result.current.selectScene('scene-03'));
  expect(result.current.mode).toBe('selection');
});
