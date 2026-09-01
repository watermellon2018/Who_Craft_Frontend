jest.mock('../../api/http', () => ({
  __esModule: true,
  getAuthGeneration: jest.fn(() => 0),
  default: {get: jest.fn(), put: jest.fn()},
}));

import {waitFor} from '@testing-library/react';

import api, {getAuthGeneration} from '../../api/http';
import {
  editorPayload,
  getEditorSaveState,
  hydrateEditorDrafts,
  keepLocalEditorDrafts,
  loadSettledEditorDrafts,
  persistAIProposal,
  recoveredAIProposal,
  restoreEditorScene,
  retryEditorSave,
  saveEditorScene,
  savedEditorSceneRevision,
  subscribeEditorDrafts,
} from './editorDrafts';
import type {EditorDraftEntry, EditorDraftPayload} from './editorDrafts';
import type {StoryboardScene, StoryboardShot} from './model';
import {createInitialKeyframes} from './model';
import {readTemporaryDraft, writeTemporaryDraft} from './temporaryDraft';
import {createCanvas, createCanvasObject} from './canvasModel';

const putMock = api.put as jest.MockedFunction<typeof api.put>;
const getMock = api.get as jest.MockedFunction<typeof api.get>;
const generationMock = getAuthGeneration as jest.MockedFunction<typeof getAuthGeneration>;
let projectCounter = 800;
let uuidCounter = 0;

beforeAll(() => {
  Object.defineProperty(window, 'crypto', {configurable: true, value: {
    getRandomValues: (bytes: Uint8Array) => {
      uuidCounter += 1;
      bytes.fill(uuidCounter);
      return bytes;
    },
  }});
});

function shot(title = 'Первый кадр'): StoryboardShot {
  return {
    characterIds: [], description: 'Описание', id: 'shot-17', keyframes: createInitialKeyframes('shot-17'),
    order: 1, referenceIds: [], sceneId: '17', title, transitions: [],
  };
}

function scene(shots: StoryboardShot[] = []): StoryboardScene {
  return {entities: [], id: '17', locationIds: [], order: 1, shots, status: 'empty', text: 'Сценарий', title: 'Сцена 1'};
}

function initialize(projectId: string, remote?: EditorDraftEntry, userId = 7): StoryboardScene {
  return hydrateEditorDrafts(projectId, [scene()], {
    authGeneration: getAuthGeneration(), data: {userId, canEdit: true, drafts: remote ? [remote] : []},
  })[0];
}

function deferredResponse() {
  let resolve: (response: {data: EditorDraftEntry}) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<{data: EditorDraftEntry}>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

function requestPayload(index: number): {expectedRevision: number; mutationId: string; payload: EditorDraftPayload} {
  return putMock.mock.calls[index][1] as {expectedRevision: number; mutationId: string; payload: EditorDraftPayload};
}

beforeEach(() => {
  jest.clearAllMocks();
  generationMock.mockReturnValue(0);
  window.localStorage.clear();
  projectCounter += 1;
});

test('saves and restores a single-image canvas with pinned library links and no signed media URLs', async () => {
  const projectId = String(projectCounter);
  const initial = initialize(projectId);
  const staging = shot();
  const canvas = createCanvas();
  canvas.objects = [createCanvasObject('person', 'Hero', 4, {id: 'hero', type: 'character', title: 'Hero', assetId: 'asset'})];
  canvas.objects[0].motion = {type: 'path', start: 0, end: 3, facing: 'right', points: [{x: 10, y: 20}, {x: 75, y: 20}]};
  canvas.markers = [{id: 'note', text: 'Reaction', x: 20, y: 30}];
  staging.keyframes[0].canvas = canvas;
  staging.keyframes[0].imageUrl = 'https://example.com/signed-frame.png';
  const pending = deferredResponse(); putMock.mockReturnValueOnce(pending.promise);
  saveEditorScene(projectId, {...initial, shots: [staging], editorStage: 'editor'});
  const payload = requestPayload(0).payload;
  expect(payload.shots[0].keyframes[0].canvas).toEqual(canvas);
  expect(JSON.stringify(payload)).not.toContain('signed-frame');
  pending.resolve({data: {sceneId: 17, revision: 1, payload}});
  await savedEditorSceneRevision(projectId, initial);
  const restored = restoreEditorScene(projectId, scene());
  expect(restored.shots[0].keyframes).toHaveLength(1);
  expect(restored.shots[0].keyframes[0].canvas).toEqual(canvas);
});

test('waits for a pending draft acknowledgement before launching or reconciling server generation', async () => {
  const projectId = String(projectCounter);
  const pending = deferredResponse();
  putMock.mockReturnValueOnce(pending.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('Local edit')]});
  const revision = savedEditorSceneRevision(projectId, initial);
  const loaded = loadSettledEditorDrafts(projectId);
  expect(getMock).not.toHaveBeenCalled();
  getMock.mockResolvedValueOnce({data: {userId: 7, canEdit: true, drafts: []}});
  pending.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(0).payload}});
  await expect(revision).resolves.toBe(1);
  await loaded;
  expect(getMock).toHaveBeenCalledTimes(1);
});

test('a server generation refresh preserves local edits written while the refresh was in flight', async () => {
  const projectId = String(projectCounter);
  const initial = initialize(projectId, {sceneId: 17, revision: 1, payload: editorPayload(scene([shot()]))});
  let finishGet!: (response: {data: {userId: number; canEdit: boolean; drafts: EditorDraftEntry[]}}) => void;
  getMock.mockReturnValueOnce(new Promise((resolve) => { finishGet = resolve; }));
  const loaded = loadSettledEditorDrafts(projectId);
  await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
  const localWrite = deferredResponse();
  putMock.mockReturnValueOnce(localWrite.promise);
  saveEditorScene(projectId, {...initial, shots: [shot('Newer local edit')]});
  const remote = {sceneId: 17, revision: 2, payload: editorPayload(scene([shot('Server result')]))};
  finishGet({data: {userId: 7, canEdit: true, drafts: [remote]}});
  getMock.mockResolvedValueOnce({data: {userId: 7, canEdit: true, drafts: [remote]}});
  localWrite.reject({response: {status: 409}});
  hydrateEditorDrafts(projectId, [initial], await loaded);
  expect(restoreEditorScene(projectId, initial).shots[0].title).toBe('Newer local edit');
  expect(getEditorSaveState(projectId)).toBe('conflict');
});

test('retries a stale generation refresh if a newer local save was acknowledged during its request', async () => {
  const projectId = String(projectCounter);
  const old = {sceneId: 17, revision: 1, payload: editorPayload(scene([shot('Before')]))};
  const initial = initialize(projectId, old);
  let finishGet!: (response: {data: {userId: number; canEdit: boolean; drafts: EditorDraftEntry[]}}) => void;
  getMock.mockReturnValueOnce(new Promise((resolve) => { finishGet = resolve; }));
  const loaded = loadSettledEditorDrafts(projectId);
  await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
  const latest = {sceneId: 17, revision: 2, payload: editorPayload(scene([shot('After')]))};
  putMock.mockResolvedValueOnce({data: latest});
  saveEditorScene(projectId, {...initial, shots: [shot('After')]});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  getMock.mockResolvedValueOnce({data: {userId: 7, canEdit: true, drafts: [latest]}});
  finishGet({data: {userId: 7, canEdit: true, drafts: [old]}});
  hydrateEditorDrafts(projectId, [initial], await loaded);
  expect(getMock).toHaveBeenCalledTimes(2);
  expect(restoreEditorScene(projectId, initial).shots[0].title).toBe('After');
  expect(restoreEditorScene(projectId, initial).draftRevision).toBe(2);
});

test('serializes saves, coalesces newer edits and finishes after the page unsubscribes', async () => {
  const projectId = String(projectCounter);
  const first = deferredResponse();
  const last = deferredResponse();
  putMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
  const initial = initialize(projectId);
  const unsubscribe = subscribeEditorDrafts(projectId, jest.fn());
  saveEditorScene(projectId, {...initial, shots: [shot('A')]});
  saveEditorScene(projectId, {...initial, shots: [shot('B')]});
  saveEditorScene(projectId, {...initial, shots: [shot('C')]});
  unsubscribe();
  expect(putMock).toHaveBeenCalledTimes(1);
  expect(getEditorSaveState(projectId)).not.toBe('saved');

  first.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(0).payload}});
  await waitFor(() => expect(putMock).toHaveBeenCalledTimes(2));
  expect(requestPayload(1).expectedRevision).toBe(1);
  expect(requestPayload(1).payload.shots[0].title).toBe('C');
  last.resolve({data: {sceneId: 17, revision: 2, payload: requestPayload(1).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  expect(restoreEditorScene(projectId, initial).shots[0].title).toBe('C');
  expect(Object.keys(window.localStorage).some((key) => key.includes(`:${projectId}`))).toBe(false);
});

test('keeps the same mutation on an uncertain network retry before saving later edits', async () => {
  const projectId = String(projectCounter);
  const retry = deferredResponse();
  const latest = deferredResponse();
  putMock.mockRejectedValueOnce(new Error('Offline')).mockReturnValueOnce(retry.promise).mockReturnValueOnce(latest.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('A')]});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('error'));
  saveEditorScene(projectId, {...initial, shots: [shot('B')]});
  expect(putMock).toHaveBeenCalledTimes(1);
  retryEditorSave(projectId);
  expect(requestPayload(1)).toEqual(requestPayload(0));
  retry.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(1).payload}});
  await waitFor(() => expect(putMock).toHaveBeenCalledTimes(3));
  expect(requestPayload(2).payload.shots[0].title).toBe('B');
  latest.resolve({data: {sceneId: 17, revision: 2, payload: requestPayload(2).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
});

test('restores pending work on navigation and never sends the next revision under a different account', async () => {
  const projectId = String(projectCounter);
  const response = deferredResponse();
  putMock.mockReturnValueOnce(response.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, editorStage: 'selection', shots: [shot('Разметка')]});
  saveEditorScene(projectId, {...initial, editorStage: 'selection', shots: [shot('Правка')]});
  expect(initialize(projectId).shots[0].title).toBe('Правка');
  expect(initialize(projectId).editorStage).toBe('selection');
  generationMock.mockReturnValue(1);
  response.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(0).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('error'));
  expect(initialize(projectId, undefined, 9).shots).toEqual([]);
  expect(putMock).toHaveBeenCalledTimes(1);
  expect(Object.keys(window.localStorage).some((key) => key.includes(`:7:${projectId}`))).toBe(true);
  saveEditorScene(projectId, {...initial, shots: [shot('После смены сессии')]});
  expect(restoreEditorScene(projectId, scene()).shots).toEqual([]);
  expect(persistAIProposal(projectId, initial, [shot('Поздний результат ИИ')])).toBe(false);
  expect(window.localStorage.getItem(`wcraft:storyboard-outbox:v1:7:${projectId}`)).toContain('Поздний результат ИИ');
  expect(putMock).toHaveBeenCalledTimes(1);
});

test('preserves conflicting edits without blindly retrying or overwriting them with server data', async () => {
  const projectId = String(projectCounter);
  putMock.mockRejectedValueOnce({response: {status: 409}});
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('Мой кадр')]});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('conflict'));
  retryEditorSave(projectId);
  const restored = initialize(projectId, {sceneId: 17, revision: 4, payload: editorPayload({shots: [shot('Другой кадр')]})});
  expect(restored.shots[0].title).toBe('Мой кадр');
  expect(putMock).toHaveBeenCalledTimes(1);
  const event = new Event('beforeunload', {cancelable: true});
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

test('moves only authorized legacy scenes to the server and removes each old copy after its acknowledgement', async () => {
  const projectId = String(projectCounter);
  const response = deferredResponse();
  putMock.mockReturnValueOnce(response.promise);
  writeTemporaryDraft({version: 1, projectId, userId: 7, updatedAt: '2026-08-31', scenes: {'17': [shot('Qwen')], '99': [shot('Другая сцена')]}});
  expect(initialize(projectId).shots[0].title).toBe('Qwen');
  expect(readTemporaryDraft(7, projectId)?.scenes['17']).toHaveLength(1);
  response.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(0).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  expect(readTemporaryDraft(7, projectId)?.scenes['17']).toBeUndefined();
  expect(readTemporaryDraft(7, projectId)?.scenes['99']).toHaveLength(1);
});

test('server draft takes precedence over an old temporary copy including a saved deletion', () => {
  const projectId = String(projectCounter);
  writeTemporaryDraft({version: 1, projectId, userId: 7, updatedAt: '2026-08-31', scenes: {'17': [shot('Старый кадр')]}});
  const loaded = initialize(projectId, {sceneId: 17, revision: 2, payload: {schemaVersion: 1, stage: 'selection', shots: []}});
  expect(loaded.shots).toEqual([]);
  expect(loaded.editorStage).toBe('selection');
  expect(readTemporaryDraft(7, projectId)).toBeNull();
  expect(putMock).not.toHaveBeenCalled();
});

test('stores exact Unicode source ranges and camera references without any media URLs', () => {
  const sourceShot = shot();
  sourceShot.source = {
    document: {contentHash: 'a'.repeat(64), sceneId: 17, sceneVersion: 1, segments: [{id: 's1', text: 'Я😀 тут'}], truncated: false},
    origin: 'manual', ranges: [{start: 1, end: 2}], segmentIds: ['s1'],
  };
  sourceShot.keyframes[0].imageUrl = 'https://example.com/private?token=secret';
  sourceShot.keyframes[0].generationReferences = [{id: 'ref', title: 'Предыдущий', type: 'previous-shot', imageUrl: 'data:image/png;base64,abc', sourceKeyframeId: 'previous'}];
  const payload = editorPayload({shots: [sourceShot]});
  expect(JSON.stringify(payload)).not.toMatch(/imageUrl|secret|base64/);
  const loaded = initialize(String(projectCounter), {sceneId: 17, revision: 1, payload});
  expect(loaded.shots[0].source).toEqual(sourceShot.source);
  expect(loaded.shots[0].keyframes[0].generationReferences?.[0].sourceKeyframeId).toBe('previous');
});

test('retains a paid AI result separately when the original scene was edited while it was generating', () => {
  const projectId = String(projectCounter);
  const pending = deferredResponse();
  putMock.mockReturnValueOnce(pending.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('Ручной кадр')]});
  expect(persistAIProposal(projectId, initial, [shot('ИИ кадр')])).toBe(false);
  expect(restoreEditorScene(projectId, initial).shots[0].title).toBe('Ручной кадр');
  expect(recoveredAIProposal(projectId, initial)?.[0].title).toBe('ИИ кадр');
});

test('an explicit reset discards an old recovered AI proposal and saves an empty draft', async () => {
  const projectId = String(projectCounter);
  const saved = {sceneId: 17, revision: 1, payload: editorPayload({shots: [shot('Текущий кадр')]})};
  const initial = initialize(projectId, saved);
  const staleScene = {...initial, shots: []};
  expect(persistAIProposal(projectId, staleScene, [shot('Другой вариант ИИ')])).toBe(false);
  expect(recoveredAIProposal(projectId, initial)).not.toBeNull();
  const response = deferredResponse();
  putMock.mockReturnValueOnce(response.promise);
  saveEditorScene(projectId, {...initial, editorStage: 'builder', shots: []}, {discardAIProposal: true});
  expect(recoveredAIProposal(projectId, initial)).toBeNull();
  expect(requestPayload(0).payload).toEqual({schemaVersion: 1, stage: 'builder', shots: []});
  response.resolve({data: {sceneId: 17, revision: 2, payload: requestPayload(0).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  expect(restoreEditorScene(projectId, initial).shots).toEqual([]);
  expect(restoreEditorScene(projectId, initial).text).toBe(initial.text);
});

test('an AI request from before reset cannot recreate shots after navigating away and back', async () => {
  const projectId = String(projectCounter);
  const first = deferredResponse();
  const reset = deferredResponse();
  putMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(reset.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('Ручной кадр')]});
  saveEditorScene(projectId, {...initial, editorStage: 'builder', shots: []}, {discardAIProposal: true});
  expect(persistAIProposal(projectId, initial, [shot('Старый ответ ИИ')])).toBe(false);
  expect(restoreEditorScene(projectId, initial).shots).toEqual([]);
  expect(recoveredAIProposal(projectId, initial)?.[0].title).toBe('Старый ответ ИИ');
  first.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(0).payload}});
  await waitFor(() => expect(putMock).toHaveBeenCalledTimes(2));
  const remote = {sceneId: 17, revision: 2, payload: requestPayload(1).payload};
  reset.resolve({data: remote});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  const reopened = initialize(projectId, remote);
  expect(reopened.draftResetVersion).toBe(1);
  expect(persistAIProposal(projectId, initial, [shot('Ещё один старый ответ')])).toBe(false);
  putMock.mockReturnValueOnce(new Promise(() => undefined));
  expect(persistAIProposal(projectId, reopened, [shot('Новая генерация')])).toBe(true);
});

test('replays an interrupted outbox mutation after a fresh authorized load without spending AI tokens', async () => {
  const projectId = String(projectCounter);
  const response = deferredResponse();
  putMock.mockRejectedValueOnce(new Error('Connection lost')).mockReturnValueOnce(response.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, editorStage: 'selection', shots: [shot('Сохранить разметку')]});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('error'));
  const original = requestPayload(0);
  generationMock.mockReturnValue(2);
  const restored = initialize(projectId);
  expect(restored.editorStage).toBe('selection');
  expect(restored.shots[0].title).toBe('Сохранить разметку');
  expect(requestPayload(1).mutationId).toBe(original.mutationId);
  expect(requestPayload(1).payload).toEqual(original.payload);
  response.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(1).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
});

test('only an explicit conflict choice sends the local version against the newly fetched revision', async () => {
  const projectId = String(projectCounter);
  const response = deferredResponse();
  putMock.mockRejectedValueOnce({response: {status: 409}}).mockReturnValueOnce(response.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('Мой вариант')]});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('conflict'));
  getMock.mockResolvedValue({data: {
    userId: 7, canEdit: true,
    drafts: [{sceneId: 17, revision: 8, payload: editorPayload({shots: [shot('Сохранённый вариант')]})}],
  }});
  await keepLocalEditorDrafts(projectId);
  expect(requestPayload(1).expectedRevision).toBe(8);
  expect(requestPayload(1).mutationId).not.toBe(requestPayload(0).mutationId);
  expect(requestPayload(1).payload.shots[0].title).toBe('Мой вариант');
  response.resolve({data: {sceneId: 17, revision: 9, payload: requestPayload(1).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
});

test('preserves a source with more than 10000 segments and 1000 selected IDs without truncating the saved contract', () => {
  const sourceShot = shot();
  const segments = Array.from({length: 10001}, (_, index) => ({id: `s${index}`, text: 'Я'}));
  sourceShot.source = {
    document: {contentHash: 'b'.repeat(64), sceneId: 17, sceneVersion: 1, segments, truncated: false},
    origin: 'ai', segmentIds: segments.slice(0, 1001).map(({id}) => id),
  };
  const loaded = initialize(String(projectCounter), {sceneId: 17, revision: 1, payload: editorPayload({shots: [sourceShot]})});
  expect(loaded.shots[0].source?.document.segments).toHaveLength(10001);
  expect(loaded.shots[0].source?.segmentIds).toHaveLength(1001);
  const invalid = editorPayload({shots: [{...sourceShot, source: {...sourceShot.source, segmentIds: ['missing']}}]});
  expect(() => initialize(`${projectCounter}-invalid`, {sceneId: 17, revision: 1, payload: invalid}))
    .toThrow('Invalid saved storyboard draft');
});

test('recovers a draft from its independent backup after another tab clears the shared outbox entry', async () => {
  const projectId = String(projectCounter);
  const response = deferredResponse();
  putMock.mockRejectedValueOnce(new Error('Offline')).mockReturnValueOnce(response.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('Правка во вкладке')]});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('error'));
  const key = `wcraft:storyboard-outbox:v1:7:${projectId}`;
  expect(Object.keys(window.localStorage).some((item) => item.startsWith(`${key}:recovery:`))).toBe(true);
  window.localStorage.removeItem(key);
  generationMock.mockReturnValue(3);
  expect(initialize(projectId).shots[0].title).toBe('Правка во вкладке');
  expect(requestPayload(1).mutationId).toBe(requestPayload(0).mutationId);
  response.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(1).payload}});
  await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  expect(Object.keys(window.localStorage).some((item) => item.startsWith(key))).toBe(false);
});

test('acknowledging snapshot P cannot delete a newer immutable recovery snapshot Q', async () => {
  const projectId = String(projectCounter);
  const first = deferredResponse();
  const second = deferredResponse();
  putMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const initial = initialize(projectId);
  saveEditorScene(projectId, {...initial, shots: [shot('P')]});
  const prefix = `wcraft:storyboard-outbox:v1:7:${projectId}:recovery:`;
  const originalKey = Object.keys(window.localStorage).find((key) => key.startsWith(prefix));
  expect(originalKey).toBeDefined();
  const originalGet = Storage.prototype.getItem;
  let edited = false;
  const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    const value = originalGet.call(this, key);
    if (key === originalKey && !edited) {
      edited = true;
      saveEditorScene(projectId, {...initial, shots: [shot('Q')]});
    }
    return value;
  });
  try {
    first.resolve({data: {sceneId: 17, revision: 1, payload: requestPayload(0).payload}});
    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(2));
    expect(edited).toBe(true);
    const newKey = Object.keys(window.localStorage).find((key) => key.startsWith(prefix));
    expect(newKey).toBeDefined();
    expect(newKey).not.toBe(originalKey);
    expect(requestPayload(1).payload.shots[0].title).toBe('Q');
    second.resolve({data: {sceneId: 17, revision: 2, payload: requestPayload(1).payload}});
    await waitFor(() => expect(getEditorSaveState(projectId)).toBe('saved'));
  } finally {
    read.mockRestore();
  }
});

test.each([false, true])('retires the consumed pre-restart snapshot P after saving Q (unrelated R: %s)', async (withOtherTab) => {
  const projectId = String(projectCounter);
  const mainKey = `wcraft:storyboard-outbox:v1:7:${projectId}`;
  const originalKey = `${mainKey}:recovery:17:original-p`;
  const otherKey = `${mainKey}:recovery:17:other-tab-r`;
  const payloadP = editorPayload({shots: [shot('P')]});
  const entryP = {
    revision: 0, payload: payloadP,
    mutation: {expectedRevision: 0, mutationId: '00000000-0000-4000-8000-000000000001', payload: payloadP},
  };
  const storedP = JSON.stringify({schemaVersion: 1, userId: 7, projectId, entries: {'17': entryP}});
  window.localStorage.setItem(mainKey, storedP);
  window.localStorage.setItem(originalKey, storedP);
  if (withOtherTab) {
    window.localStorage.setItem(otherKey, JSON.stringify({
      schemaVersion: 1, userId: 7, projectId,
      entries: {'17': {revision: 0, payload: editorPayload({shots: [shot('R')]})}},
    }));
  }

  jest.resetModules();
  const firstRuntime = await import('./editorDrafts');
  const firstHttp = await import('../../api/http');
  const firstPut = firstHttp.default.put as jest.MockedFunction<typeof firstHttp.default.put>;
  const pResponse = deferredResponse();
  const qResponse = deferredResponse();
  firstPut.mockReturnValueOnce(pResponse.promise).mockReturnValueOnce(qResponse.promise);
  const restored = firstRuntime.hydrateEditorDrafts(projectId, [scene()], {
    authGeneration: 0, data: {userId: 7, canEdit: true, drafts: []},
  })[0];
  firstRuntime.saveEditorScene(projectId, {...restored, shots: [shot('Q')]});
  pResponse.resolve({data: {sceneId: 17, revision: 1, payload: payloadP}});
  await waitFor(() => expect(firstPut).toHaveBeenCalledTimes(2));
  const sentQ = firstPut.mock.calls[1][1] as {payload: EditorDraftPayload};
  qResponse.resolve({data: {sceneId: 17, revision: 2, payload: sentQ.payload}});
  await waitFor(() => expect(firstRuntime.getEditorSaveState(projectId)).toBe('saved'));
  expect(window.localStorage.getItem(originalKey)).toBeNull();
  if (withOtherTab) {
    // A different tab's R is an actual separate edit, not a consumed copy of P.
    expect(window.localStorage.getItem(otherKey)).toContain('"R"');
    return;
  }

  jest.resetModules();
  const nextRuntime = await import('./editorDrafts');
  const nextHttp = await import('../../api/http');
  const nextPut = nextHttp.default.put as jest.MockedFunction<typeof nextHttp.default.put>;
  const loaded = nextRuntime.hydrateEditorDrafts(projectId, [scene()], {
    authGeneration: 0,
    data: {userId: 7, canEdit: true, drafts: [{sceneId: 17, revision: 2, payload: sentQ.payload}]},
  })[0];
  expect(loaded.shots[0].title).toBe('Q');
  expect(nextRuntime.getEditorSaveState(projectId)).toBe('saved');
  expect(nextPut).not.toHaveBeenCalled();
  expect(Object.keys(window.localStorage).some((key) => key.startsWith(mainKey))).toBe(false);
});
