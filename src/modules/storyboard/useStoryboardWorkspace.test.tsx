import {act, renderHook, waitFor} from '@testing-library/react';
import {randomFillSync} from 'crypto';

import api, {getAuthGeneration} from '../../api/http';
import {editorPayload, hydrateEditorDrafts} from './editorDrafts';
import type {EditorDraftEntry, EditorDraftPayload} from './editorDrafts';
import {MOCK_STORYBOARD_SCENES} from './mockData';
import type {StoryboardScene} from './model';
import {storyboardMockService} from './storyboardService';
import {createMockShotList, useStoryboardWorkspace} from './useStoryboardWorkspace';
import {createCanvas, createCanvasObject} from './canvasModel';

const originalCrypto = window.crypto;
beforeAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: randomFillSync}}));
afterAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: originalCrypto}));

function present<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('Expected loaded storyboard test value');
  return value;
}

test('creates unique shot ids when several shots are created in the same clock tick', () => {
  const scene = MOCK_STORYBOARD_SCENES.find(({id}) => id === 'scene-03');
  expect(scene).toBeDefined();
  if (!scene) return;

  const now = jest.spyOn(Date, 'now').mockReturnValue(12345);
  const shots = createMockShotList(scene);
  now.mockRestore();

  expect(new Set(shots.map(({id}) => id)).size).toBe(shots.length);
  expect(new Set(shots.flatMap(({keyframes}) => keyframes.map(({id}) => id))).size)
    .toBe(shots.length);
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
  expect(result.current.selectedShot?.keyframes.map(({type}) => type)).toEqual(['start']);
  expect(result.current.selectedKeyframe?.type).toBe('start');
  unmount();
});

test('adds an optional end as an independent copy of the selected composition without copying generated media', async () => {
  const {result} = renderHook(() => useStoryboardWorkspace('42', storyboardMockService.loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  const source = present(result.current.selectedScene).shots[0];
  const canvas = createCanvas();
  const object = createCanvasObject('person', 'Анчоус', 4,
    {id: 'character-1', type: 'character', title: 'Анчоус', versionId: 'version-1'});
  object.motion = {...object.motion, type: 'path', points: [{x: 40, y: 40}, {x: 75, y: 40}]};
  canvas.objects = [object];
  canvas.markers = [{id: 'comment-1', x: 20, y: 20, text: 'Смотреть вправо'}];
  const start = {...source.keyframes[0], canvas, imageUrl: '/media/start.png', imageOutdated: true};
  act(() => result.current.setShotList([{...source, keyframes: [start], transitions: []}]));
  act(() => result.current.enterEditor());
  expect(present(result.current.selectedShot).keyframes).toHaveLength(1);

  act(() => result.current.addEnd());
  const end = present(result.current.selectedKeyframe);
  expect(end).toMatchObject({type: 'end', position: 1, generationStatus: 'idle', canvas, cameraIntent: start.cameraIntent});
  expect(end.imageUrl).toBeUndefined();
  expect(end.imageOutdated).toBeUndefined();
  expect(end.generationReferences).toBeUndefined();
  expect(end.canvas).not.toBe(start.canvas);
  expect(present(end.canvas).objects[0]).not.toBe(start.canvas.objects[0]);
  expect(present(end.canvas).objects[0].motion.points[0]).not.toBe(start.canvas.objects[0].motion.points[0]);
  expect(present(end.canvas).objects[0].entity).not.toBe(start.canvas.objects[0].entity);
  expect(present(end.canvas).markers[0]).not.toBe(start.canvas.markers[0]);
  expect(end.cameraIntent).not.toBe(start.cameraIntent);
  expect(present(result.current.selectedShot).transitions).toEqual([
    expect.objectContaining({fromKeyframeId: start.id, toKeyframeId: end.id}),
  ]);
  act(() => result.current.addEnd());
  expect(present(result.current.selectedShot).keyframes).toHaveLength(2);
});

test('protects the primary state while deleting optional end and intermediate states and rebuilding transitions', async () => {
  const {result} = renderHook(() => useStoryboardWorkspace('42', storyboardMockService.loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  act(() => result.current.enterEditor());
  const start = present(result.current.selectedKeyframe);
  const original = present(result.current.selectedShot);
  act(() => result.current.deleteKeyframe(start.id));
  expect(present(result.current.selectedShot).keyframes).toEqual(original.keyframes);
  expect(result.current.selectedKeyframe?.id).toBe(start.id);

  act(() => result.current.addIntermediate());
  const intermediate = present(result.current.selectedKeyframe);
  const end = present(present(result.current.selectedShot).keyframes.find(({type}) => type === 'end'));
  expect(intermediate.type).toBe('intermediate');
  act(() => result.current.deleteKeyframe(end.id));
  expect(present(result.current.selectedShot).keyframes.map(({type}) => type)).toEqual(['start', 'intermediate']);
  expect(present(result.current.selectedShot).transitions).toEqual([
    expect.objectContaining({fromKeyframeId: start.id, toKeyframeId: intermediate.id}),
  ]);
  act(() => result.current.deleteKeyframe(intermediate.id));
  expect(present(result.current.selectedShot).keyframes).toEqual([start]);
  expect(present(result.current.selectedShot).transitions).toEqual([]);
  expect(result.current.selectedKeyframe?.id).toBe(start.id);
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

test('read-only state actions keep the existing keyframe selection as well as the scene data', async () => {
  const loadScenes = async (projectId: string) => (await storyboardMockService.loadScenes(projectId)).map((scene) => ({
    ...scene, canEdit: false, shots: scene.shots.map((shot) => ({...shot,
      keyframes: shot.keyframes.filter(({type}) => type === 'start'), transitions: []})),
  }));
  const {result} = renderHook(() => useStoryboardWorkspace('42', loadScenes));
  await waitFor(() => expect(result.current.scenes).toHaveLength(3));
  act(() => result.current.selectScene('scene-03'));
  const original = present(result.current.selectedScene).shots;
  act(() => result.current.enterEditor());
  const selectedId = result.current.selectedKeyframeId;
  expect(result.current.selectedKeyframe?.type).toBe('start');
  act(() => result.current.addEnd());
  expect(present(result.current.selectedScene).shots).toEqual(original);
  expect(result.current.selectedKeyframeId).toBe(selectedId);
  act(() => result.current.addIntermediate());
  expect(present(result.current.selectedScene).shots).toEqual(original);
  expect(result.current.selectedKeyframeId).toBe(selectedId);
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

test('saves a scene reset after an older in-flight edit and reopens the screenplay after remount', async () => {
  const previousCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');
  let uuidCounter = 30;
  Object.defineProperty(window, 'crypto', {configurable: true, value: {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(++uuidCounter),
  }});
  const original = {...MOCK_STORYBOARD_SCENES[2], id: '118',
    shots: MOCK_STORYBOARD_SCENES[2].shots.map((shot) => ({...shot, sceneId: '118'}))};
  const other = {...MOCK_STORYBOARD_SCENES[0], id: '119'};
  let saved: EditorDraftEntry = {sceneId: 118, revision: 1, payload: editorPayload(original)};
  let acknowledge: (response: {data: EditorDraftEntry}) => void = () => undefined;
  const request = new Promise<{data: EditorDraftEntry}>((resolve) => { acknowledge = resolve; });
  const put = jest.spyOn(api, 'put').mockReturnValueOnce(request).mockImplementationOnce(async (_path, data) => {
    const sent = data as {expectedRevision: number; payload: EditorDraftPayload};
    saved = {sceneId: 118, revision: sent.expectedRevision + 1, payload: sent.payload};
    return {data: saved};
  });
  const loadScenes = async (projectId: string) => hydrateEditorDrafts(projectId, [original, other], {
    authGeneration: getAuthGeneration(), data: {userId: 7, canEdit: true, drafts: [saved]},
  });
  try {
    const first = renderHook(() => useStoryboardWorkspace('522', loadScenes, true));
    await waitFor(() => expect(first.result.current.scenes).toHaveLength(2));
    act(() => first.result.current.selectScene('118'));
    const originalOther = first.result.current.scenes[1];
    act(() => first.result.current.updateShot(original.shots[0].id, {title: 'Правка перед сбросом'}));
    expect(put).toHaveBeenCalledTimes(1);
    act(() => first.result.current.resetScene('118'));
    expect(first.result.current.mode).toBe('overview');
    expect(first.result.current.selectedScene?.shots).toEqual([]);
    expect(first.result.current.selectedScene?.text).toBe(original.text);
    expect(first.result.current.selectedShotId).toBeNull();
    expect(first.result.current.selectedKeyframeId).toBeNull();
    expect(first.result.current.scenes[1]).toEqual(originalOther);
    const sent = put.mock.calls[0][1] as {payload: EditorDraftPayload};
    await act(async () => acknowledge({data: {sceneId: 118, revision: 2, payload: sent.payload}}));
    await waitFor(() => expect(first.result.current.autosaveState).toBe('saved'));
    expect(saved.payload).toEqual({schemaVersion: 1, stage: 'builder', shots: []});
    expect(first.result.current.mode).toBe('overview');
    first.unmount();

    const restored = renderHook(() => useStoryboardWorkspace('522', loadScenes, true));
    await waitFor(() => expect(restored.result.current.scenes).toHaveLength(2));
    act(() => restored.result.current.selectScene('118'));
    expect(restored.result.current.mode).toBe('overview');
    expect(restored.result.current.selectedScene?.shots).toEqual([]);
    expect(put).toHaveBeenCalledTimes(2);
    restored.unmount();
  } finally {
    put.mockRestore();
    if (previousCrypto) Object.defineProperty(window, 'crypto', previousCrypto);
    else Reflect.deleteProperty(window, 'crypto');
  }
});

test('choosing a server reset after a conflict opens the screenplay even when the saved stage is still builder', async () => {
  const previousCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');
  Object.defineProperty(window, 'crypto', {configurable: true, value: {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(61),
  }});
  const original = {...MOCK_STORYBOARD_SCENES[2], id: '120',
    shots: MOCK_STORYBOARD_SCENES[2].shots.map((shot) => ({...shot, sceneId: '120'}))};
  const put = jest.spyOn(api, 'put').mockRejectedValue({response: {status: 409}});
  const get = jest.spyOn(api, 'get').mockResolvedValue({data: {userId: 7, canEdit: true,
    drafts: [{sceneId: 120, revision: 2, payload: {schemaVersion: 1, stage: 'builder', shots: []}}],
  }});
  const loadScenes = async (projectId: string) => hydrateEditorDrafts(projectId, [original], {
    authGeneration: getAuthGeneration(), data: {userId: 7, canEdit: true,
      drafts: [{sceneId: 120, revision: 1, payload: editorPayload(original)}]},
  });
  try {
    const {result, unmount} = renderHook(() => useStoryboardWorkspace('523', loadScenes, true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));
    act(() => result.current.selectScene('120'));
    act(() => result.current.updateShot(original.shots[0].id, {title: 'Конфликтующая правка'}));
    await waitFor(() => expect(result.current.autosaveState).toBe('conflict'));
    expect(result.current.mode).toBe('builder');
    await act(async () => result.current.reloadSavedDraft());
    expect(result.current.mode).toBe('overview');
    expect(result.current.selectedScene?.shots).toEqual([]);
    unmount();
  } finally {
    put.mockRestore();
    get.mockRestore();
    if (previousCrypto) Object.defineProperty(window, 'crypto', previousCrypto);
    else Reflect.deleteProperty(window, 'crypto');
  }
});

test('adopts a server-completed generation in the selected scene without resaving or losing the selection', async () => {
  const original = {...MOCK_STORYBOARD_SCENES[1], id: '121', shots: []};
  let saved: EditorDraftEntry = {sceneId: 121, revision: 1, payload: editorPayload(original)};
  const get = jest.spyOn(api, 'get').mockImplementation(async () => ({data: {
    userId: 7, canEdit: true, drafts: [saved],
  }}));
  const put = jest.spyOn(api, 'put');
  const loadScenes = async (projectId: string) => hydrateEditorDrafts(projectId, [original], {
    authGeneration: getAuthGeneration(), data: {userId: 7, canEdit: true, drafts: [saved]},
  });
  try {
    const first = renderHook(() => useStoryboardWorkspace('524', loadScenes, true));
    await waitFor(() => expect(first.result.current.scenes).toHaveLength(1));
    act(() => first.result.current.selectScene('121'));
    expect(first.result.current.mode).toBe('overview');
    saved = {sceneId: 121, revision: 2,
      payload: editorPayload({...original, editorStage: 'builder', shots: createMockShotList(original)})};
    await act(async () => first.result.current.refreshDrafts());
    expect(first.result.current.selectedSceneId).toBe('121');
    expect(first.result.current.mode).toBe('builder');
    expect(first.result.current.selectedScene?.shots).toHaveLength(5);
    expect(first.result.current.autosaveState).toBe('saved');
    expect(put).not.toHaveBeenCalled();
    first.unmount();

    const second = renderHook(() => useStoryboardWorkspace('524', loadScenes, true));
    await waitFor(() => expect(second.result.current.scenes[0]?.shots).toHaveLength(5));
    act(() => second.result.current.selectScene('121'));
    expect(second.result.current.mode).toBe('builder');
    expect(put).not.toHaveBeenCalled();
    second.unmount();
  } finally {
    get.mockRestore();
    put.mockRestore();
  }
});
