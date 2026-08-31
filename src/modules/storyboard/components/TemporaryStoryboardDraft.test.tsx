import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import React, {StrictMode, useState} from 'react';

import {AUTH_EXPIRED_EVENT} from '../../../api/http';
import * as profileApi from '../../profile/api/profileApi';
import type {ProfileMeResponse} from '../../profile/api/profileApi';
import {createInitialKeyframes} from '../model';
import type {StoryboardScene, StoryboardShot} from '../model';
import {readTemporaryDraft, temporaryDraftKey, writeTemporaryDraft} from '../temporaryDraft';
import TemporaryStoryboardDraft from './TemporaryStoryboardDraft';

const shot: StoryboardShot = {
  characterIds: [],
  description: 'Подробное описание сохранённого кадра.',
  id: 'shot-1',
  keyframes: createInitialKeyframes('shot-1'),
  order: 1,
  referenceIds: [],
  sceneId: 'scene-1',
  title: 'Кадр Qwen',
  transitions: [],
};
const scene: StoryboardScene = {
  entities: [],
  id: 'scene-1',
  locationIds: [],
  order: 1,
  shots: [],
  status: 'empty',
  text: 'Сценарий.',
  title: 'Сцена 1',
};
const profile = {user: {id: 9}} as ProfileMeResponse;

function saveDraft(title = 'Кадр Qwen', userId = 9, projectId = 'project-1') {
  writeTemporaryDraft({
    version: 1,
    projectId,
    userId,
    updatedAt: '2026-08-31T00:00:00.000Z',
    scenes: {'scene-1': [{...shot, title}]},
  });
}

function DraftHarness({initialShots = []}: {initialShots?: StoryboardShot[]}) {
  const [scenes, setScenes] = useState([{...scene, shots: initialShots}]);
  return (
    <>
      <TemporaryStoryboardDraft
        enabled
        loadError={null}
        loading={false}
        onRestore={(sceneId, shots) => setScenes((current) => current.map((entry) => (
          entry.id === sceneId ? {...entry, shots} : entry
        )))}
        projectId="project-1"
        scenes={scenes}
      />
      <div data-testid="current-shot">{scenes[0].shots[0]?.title ?? 'empty'}</div>
      <button onClick={() => setScenes((current) => current.map((entry) => ({
        ...entry,
        shots: entry.shots.map((entryShot) => ({...entryShot, title: 'Изменённый кадр'})),
      })))}>edit shot</button>
      <button onClick={() => setScenes((current) => current.map((entry) => ({...entry, shots: []})))}>
        delete shot
      </button>
      <button onClick={() => setScenes((current) => current.map((entry) => ({...entry, title: 'Переименована'})))}>
        unrelated update
      </button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(profileApi, 'fetchProfileMe').mockResolvedValue(profile);
});

afterEach(() => jest.restoreAllMocks());

test('restores the saved result after authorized scene loading in StrictMode without an AI request', async () => {
  saveDraft();
  render(<StrictMode><DraftHarness /></StrictMode>);
  expect(await screen.findByText('Кадр Qwen')).toBeInTheDocument();
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1']).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', {name: 'edit shot'}));
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Изменённый кадр'));
  fireEvent.click(screen.getByRole('button', {name: 'delete shot'}));
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1']).toEqual([]));
});

test('preserves local edits when an older nonempty server list reloads and restores them only on request', async () => {
  const initialShots = [{...shot, title: 'Серверная версия A'}];
  const first = render(<DraftHarness initialShots={initialShots} />);
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Серверная версия A'));
  fireEvent.click(screen.getByRole('button', {name: 'edit shot'}));
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Изменённый кадр'));
  first.unmount();

  render(<DraftHarness initialShots={initialShots} />);
  const restore = await screen.findByRole('button', {name: 'Восстановить временный черновик'});
  expect(screen.getByTestId('current-shot')).toHaveTextContent('Серверная версия A');
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Изменённый кадр');
  fireEvent.click(restore);
  await waitFor(() => expect(screen.getByTestId('current-shot')).toHaveTextContent('Изменённый кадр'));
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Изменённый кадр');
});

test('keeps both conflicting versions until explicitly replacing the saved copy with the latest current edits', async () => {
  saveDraft('Локальная версия B');
  render(<DraftHarness initialShots={[{...shot, title: 'Свежий результат Qwen'}]} />);
  await screen.findByRole('button', {name: 'Оставить текущие кадры'});
  expect(screen.getByTestId('current-shot')).toHaveTextContent('Свежий результат Qwen');
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Локальная версия B');
  fireEvent.click(screen.getByRole('button', {name: 'edit shot'}));
  expect(screen.getByTestId('current-shot')).toHaveTextContent('Изменённый кадр');
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Локальная версия B');
  fireEvent.click(screen.getByRole('button', {name: 'Оставить текущие кадры'}));
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Изменённый кадр'));
});

test('preserves a saved deletion when the server still returns the former shots', async () => {
  writeTemporaryDraft({version: 1, projectId: 'project-1', userId: 9, updatedAt: 'today', scenes: {'scene-1': []}});
  render(<DraftHarness initialShots={[shot]} />);
  const restore = await screen.findByRole('button', {name: 'Восстановить временный черновик'});
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1']).toEqual([]);
  fireEvent.click(restore);
  await waitFor(() => expect(screen.getByTestId('current-shot')).toHaveTextContent('empty'));
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1']).toEqual([]);
});

test('clearing the temporary copy preserves the visible result and suspends saving until shots change', async () => {
  render(<DraftHarness initialShots={[shot]} />);
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')).not.toBeNull());
  fireEvent.click(screen.getByRole('button', {name: /Удалить временную копию|storyboard.temporaryDraft.remove/}));
  expect(readTemporaryDraft(9, 'project-1')).toBeNull();
  expect(screen.getByTestId('current-shot')).toHaveTextContent('Кадр Qwen');
  fireEvent.click(screen.getByRole('button', {name: 'unrelated update'}));
  expect(readTemporaryDraft(9, 'project-1')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'edit shot'}));
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Изменённый кадр'));
});

test('does not read or overwrite saved output during loading, failed access or disabled mock mode', async () => {
  saveDraft();
  const onRestore = jest.fn();
  const props = {enabled: true, loading: true, loadError: null, onRestore, projectId: 'project-1', scenes: [scene]};
  const {rerender} = render(<TemporaryStoryboardDraft {...props} />);
  expect(profileApi.fetchProfileMe).not.toHaveBeenCalled();
  rerender(<TemporaryStoryboardDraft {...props} loading={false} loadError="forbidden" />);
  expect(profileApi.fetchProfileMe).not.toHaveBeenCalled();
  rerender(<TemporaryStoryboardDraft {...props} enabled={false} loading={false} />);
  expect(profileApi.fetchProfileMe).not.toHaveBeenCalled();
  expect(onRestore).not.toHaveBeenCalled();
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Кадр Qwen');
});

test('ignores a late profile response after project change and never restores another user copy', async () => {
  saveDraft();
  let resolveFirst!: (value: ProfileMeResponse) => void;
  jest.mocked(profileApi.fetchProfileMe)
    .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({user: {id: 10}} as ProfileMeResponse);
  const onRestore = jest.fn();
  const props = {enabled: true, loading: false, loadError: null, onRestore, projectId: 'project-1', scenes: [scene]};
  const {rerender} = render(<TemporaryStoryboardDraft {...props} />);
  rerender(<TemporaryStoryboardDraft {...props} projectId="project-2" />);
  await act(async () => resolveFirst(profile));
  expect(onRestore).not.toHaveBeenCalled();
  expect(localStorage.getItem(temporaryDraftKey(10, 'project-2'))).toBeNull();
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Кадр Qwen');
});

test('handles unavailable storage without discarding current output and stops saving on auth expiry', async () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
  render(<DraftHarness initialShots={[shot]} />);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Не удалось|недоступ|storyboard.temporaryDraft.unavailable/i));
  expect(screen.getByTestId('current-shot')).toHaveTextContent('Кадр Qwen');
  jest.restoreAllMocks();
  act(() => window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT)));
  fireEvent.click(screen.getByRole('button', {name: 'edit shot'}));
  expect(readTemporaryDraft(9, 'project-1')).toBeNull();
});

test('exports the current authorized result even when the profile lookup fails', async () => {
  jest.mocked(profileApi.fetchProfileMe).mockRejectedValueOnce(new Error('Profile unavailable'));
  const createObjectURL = jest.fn().mockReturnValue('blob:temporary-test');
  const revokeObjectURL = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', {configurable: true, value: createObjectURL});
  Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value: revokeObjectURL});
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  render(<DraftHarness initialShots={[shot]} />);
  fireEvent.click(await screen.findByRole('button', {name: 'Скачать черновик'}));
  expect(click).toHaveBeenCalledTimes(1);
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const blob = createObjectURL.mock.calls[0][0] as Blob;
  const content = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
  expect(JSON.parse(content)).toEqual(expect.objectContaining({
    projectId: 'project-1',
    scenes: {'scene-1': [expect.objectContaining({title: 'Кадр Qwen', description: shot.description})]},
  }));
  expect(content).not.toContain('userId');
  expect(readTemporaryDraft(9, 'project-1')).toBeNull();
});

test('ignores a profile response after unmount and stops saving after another tab changes account', async () => {
  let resolveProfile!: (value: ProfileMeResponse) => void;
  jest.mocked(profileApi.fetchProfileMe).mockReturnValueOnce(new Promise((resolve) => { resolveProfile = resolve; }));
  const first = render(<DraftHarness initialShots={[shot]} />);
  first.unmount();
  await act(async () => resolveProfile(profile));
  expect(readTemporaryDraft(9, 'project-1')).toBeNull();

  render(<DraftHarness initialShots={[shot]} />);
  await waitFor(() => expect(readTemporaryDraft(9, 'project-1')).not.toBeNull());
  act(() => window.dispatchEvent(new StorageEvent('storage', {key: 'authToken'})));
  expect(screen.getByRole('status')).toHaveTextContent('Сессия изменилась');
  expect(screen.getByRole('button', {name: 'Скачать черновик'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'edit shot'}));
  expect(readTemporaryDraft(9, 'project-1')?.scenes['scene-1'][0].title).toBe('Кадр Qwen');
});

test('keeps saving paused across load and project changes after an account switch during loading', async () => {
  const onRestore = jest.fn();
  const props = {
    enabled: false,
    loadError: null,
    loading: true,
    onRestore,
    projectId: 'project-1',
    scenes: [{...scene, shots: [shot]}],
  };
  const {rerender} = render(<TemporaryStoryboardDraft {...props} />);
  act(() => window.dispatchEvent(new StorageEvent('storage', {key: 'authRefreshToken'})));
  jest.mocked(profileApi.fetchProfileMe).mockResolvedValue({user: {id: 10}} as ProfileMeResponse);
  rerender(<TemporaryStoryboardDraft {...props} enabled loading={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Сессия изменилась');
  rerender(<TemporaryStoryboardDraft {...props} projectId="project-2" />);
  rerender(<TemporaryStoryboardDraft {...props} projectId="project-2" enabled loading={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Сессия изменилась');
  expect(profileApi.fetchProfileMe).not.toHaveBeenCalled();
  expect(readTemporaryDraft(10, 'project-1')).toBeNull();
  expect(readTemporaryDraft(10, 'project-2')).toBeNull();
  expect(onRestore).not.toHaveBeenCalled();
});
