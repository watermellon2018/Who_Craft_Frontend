import {act, renderHook, waitFor} from '@testing-library/react';

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
