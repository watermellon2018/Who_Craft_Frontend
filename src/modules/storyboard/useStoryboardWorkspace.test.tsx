import {act, renderHook, waitFor} from '@testing-library/react';

import {MOCK_STORYBOARD_SCENES} from './mockData';
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
