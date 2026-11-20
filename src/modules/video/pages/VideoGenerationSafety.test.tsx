import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import {AUTH_EXPIRED_EVENT, getAuthGeneration} from '../../../api/http';
import {createVideoJob, fetchVideoOptions, fetchVideoWorkspace} from '../api';
import {makeVideoJob, makeVideoOptions, makeVideoShot, makeVideoWorkspace} from '../testFixtures';
import type {VideoOptions, VideoWorkspace} from '../types';
import VideoGenerationPage from './VideoGenerationPage';

jest.mock('../api', () => ({
  createVideoJob: jest.fn(), fetchVideoOptions: jest.fn(), fetchVideoWorkspace: jest.fn(),
  saveVideoMotion: jest.fn(), selectVideoVersion: jest.fn(),
}));
jest.mock('../../../api/http', () => ({
  __esModule: true, default: {}, getAuthGeneration: jest.fn(() => 1), AUTH_EXPIRED_EVENT: 'auth-expired',
}));
jest.mock('../../profile/components/DashboardHeader', () => function MockDashboardHeader() {
  return <header>Craft</header>;
});

const fetchWorkspace = fetchVideoWorkspace as jest.MockedFunction<typeof fetchVideoWorkspace>;
const fetchOptions = fetchVideoOptions as jest.MockedFunction<typeof fetchVideoOptions>;
const createJob = createVideoJob as jest.MockedFunction<typeof createVideoJob>;
let authGeneration = 100;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {resolve = accept; reject = fail;});
  return {promise, resolve, reject};
}

async function advance(ms = 300) {
  await act(async () => {jest.advanceTimersByTime(ms);});
}

async function renderPage(workspace = makeVideoWorkspace()) {
  fetchWorkspace.mockResolvedValue(workspace);
  await act(async () => {
    render(<MemoryRouter initialEntries={['/project/42/video/generate']}>
      <Routes><Route path="/project/:projectId/video/generate" element={<VideoGenerationPage />} /></Routes>
    </MemoryRouter>);
  });
  await advance();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  (getAuthGeneration as jest.Mock).mockReturnValue(++authGeneration);
  fetchOptions.mockResolvedValue(makeVideoOptions());
  createJob.mockResolvedValue({job: makeVideoJob({status: 'queued', stage: 'queued', videoUrl: null}), idempotentReplay: false});
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('immediately invalidates old preflight when motion changes and ignores a late response', async () => {
  const oldCheck = deferred<VideoOptions>();
  const latestCheck = deferred<VideoOptions>();
  fetchOptions.mockReturnValueOnce(oldCheck.promise).mockReturnValueOnce(latestCheck.promise);
  await renderPage();
  const create = screen.getByRole('button', {name: 'Создать видео'});
  expect(create).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', {name: 'Действие и движение камеры'}), {target: {value: 'Камера отъезжает'}});
  await advance();
  await act(async () => {oldCheck.resolve(makeVideoOptions({preflightToken: 'obsolete'}));});
  expect(create).toBeDisabled();
  await act(async () => {latestCheck.resolve(makeVideoOptions({preflightToken: 'latest'}));});
  expect(create).toBeEnabled();
  await act(async () => {fireEvent.click(create);});
  expect(createJob).toHaveBeenCalledWith('42', 'latest', expect.any(String));
});

it('shows inherited camera settings using existing storyboard labels', async () => {
  const workspace = makeVideoWorkspace();
  workspace.scenes[0].shots[0].inheritedCamera = {
    framing: 'close', azimuth: 'front', elevation: 'eye-level', distance: 'near',
  };
  await renderPage(workspace);
  expect(screen.getByRole('heading', {name: 'Камера из раскадровки'})).toBeInTheDocument();
  expect(screen.getByText('Крупный · Спереди · На уровне глаз · Близко')).toBeInTheDocument();
});

it('reuses the same request identity after an unconfirmed HTTP response', async () => {
  createJob.mockRejectedValueOnce(new Error('Network Error'));
  await renderPage();
  const create = screen.getByRole('button', {name: 'Создать видео'});
  await act(async () => {fireEvent.click(create);});
  expect(screen.getByText(/Не удалось подтвердить запуск/)).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Повторить тот же запрос'})).toBeInTheDocument();
  expect(create).toBeEnabled();
  fetchOptions.mockResolvedValue(makeVideoOptions({preflightToken: 'new-preflight-after-focus'}));
  await act(async () => {window.dispatchEvent(new Event('focus'));});
  await advance();
  await act(async () => {fireEvent.click(create);});
  expect(createJob).toHaveBeenCalledTimes(2);
  expect(createJob.mock.calls[1]).toEqual(createJob.mock.calls[0]);
});

function twoShotWorkspace() {
  const workspace = makeVideoWorkspace();
  workspace.scenes[0].shots.push(makeVideoShot({sourceShotId: 'shot-2', title: 'Второй план', order: 2}));
  return workspace;
}

it('keeps an in-flight creation locked after navigating away and returning before its receipt arrives', async () => {
  const pending = deferred<Awaited<ReturnType<typeof createVideoJob>>>();
  createJob.mockReturnValueOnce(pending.promise);
  await renderPage(twoShotWorkspace());
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Создать видео'}));});
  fireEvent.click(screen.getByRole('button', {name: /План 2 · Второй план/}));
  await advance();
  fetchOptions.mockResolvedValue(makeVideoOptions({preflightToken: 'fresh-token-after-navigation'}));
  fireEvent.click(screen.getByRole('button', {name: /План 1 · Письмо на столе/}));
  await advance();
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeDisabled();
  expect(screen.getByRole('textbox', {name: 'Действие и движение камеры'})).toBeDisabled();
  expect(createJob).toHaveBeenCalledTimes(1);
  await act(async () => {pending.resolve({job: makeVideoJob({status: 'queued', stage: 'queued', videoUrl: null}), idempotentReplay: false});});
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeDisabled();
  expect(screen.getByText('В очереди')).toBeInTheDocument();
  expect(createJob).toHaveBeenCalledTimes(1);
});

it('recovers a lost receipt after unmount and retries the original token and UUID rather than a fresh preflight', async () => {
  const pending = deferred<Awaited<ReturnType<typeof createVideoJob>>>();
  createJob.mockReturnValueOnce(pending.promise);
  await renderPage(twoShotWorkspace());
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Создать видео'}));});
  const originalRequest = createJob.mock.calls[0];
  fireEvent.click(screen.getByRole('button', {name: /План 2 · Второй план/}));
  await advance();
  await act(async () => {pending.reject(new Error('Connection lost after submission'));});
  fetchOptions.mockResolvedValue(makeVideoOptions({preflightToken: 'different-preflight'}));
  fireEvent.click(screen.getByRole('button', {name: /План 1 · Письмо на столе/}));
  await advance();
  expect(screen.getByText(/Не удалось подтвердить запуск/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', {name: 'Действие и движение камеры'})).toBeDisabled();
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Повторить тот же запрос'}));});
  expect(createJob).toHaveBeenCalledTimes(2);
  expect(createJob.mock.calls[1]).toEqual(originalRequest);
});

it('ignores a receipt from the previous login after the same project is opened in a new auth session', async () => {
  const pending = deferred<Awaited<ReturnType<typeof createVideoJob>>>();
  createJob.mockReturnValueOnce(pending.promise);
  await renderPage();
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Создать видео'}));});
  cleanup();
  (getAuthGeneration as jest.Mock).mockReturnValue(++authGeneration);
  await renderPage();
  await act(async () => {pending.resolve({job: makeVideoJob({status: 'queued', stage: 'queued', videoUrl: null}), idempotentReplay: false});});
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeEnabled();
  expect(screen.queryByText('В очереди')).not.toBeInTheDocument();
});

it('preserves an empty scene in the storyboard action and localizes an active-generation conflict', async () => {
  const workspace = makeVideoWorkspace();
  workspace.scenes[0].shots = [];
  await renderPage(workspace);
  expect(screen.getByRole('link', {name: 'Открыть раскадровку'})).toHaveAttribute('href', '/project/42/storyboard?sceneId=11');
  cleanup();
  createJob.mockRejectedValueOnce({response: {status: 409}, code: 'VIDEO_GENERATION_ACTIVE', detail: 'A video is already being generated.'});
  await renderPage();
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Создать видео'}));});
  expect(screen.getByText('Для этого плана уже создаётся видео. Дождитесь результата текущей генерации.')).toBeInTheDocument();
});

it('does not restart playback when polling rotates signed media URLs', async () => {
  const workspace = makeVideoWorkspace();
  workspace.scenes[0].shots = [makeVideoShot({selectedJobId: 'video-job-1', jobs: [makeVideoJob()]
  })];
  await renderPage(workspace);
  const player = screen.getByLabelText('Видео плана «Письмо на столе»');
  const updated = makeVideoWorkspace();
  updated.scenes[0].shots = [makeVideoShot({selectedJobId: 'video-job-1', jobs: [makeVideoJob({videoUrl: '/media/video-1.mp4?signature=new'})]})];
  fetchWorkspace.mockResolvedValue(updated);
  await advance(30000);
  expect(player).toHaveAttribute('src', '/media/video-1.mp4');
  fireEvent.error(player);
  expect(player).toHaveAttribute('src', '/media/video-1.mp4?signature=new');
});

it('keeps prior videos when a status refresh fails and preserves unsaved instructions', async () => {
  const workspace = makeVideoWorkspace();
  workspace.scenes[0].shots = [makeVideoShot({selectedJobId: 'video-job-1', jobs: [makeVideoJob()]})];
  await renderPage(workspace);
  const motion = screen.getByRole('textbox', {name: 'Действие и движение камеры'});
  fireEvent.change(motion, {target: {value: 'Новое движение'}});
  fetchWorkspace.mockRejectedValueOnce(new Error('Offline'));
  await advance(30000);
  expect(screen.getByText(/Не удалось обновить статус/)).toBeInTheDocument();
  expect(screen.getByLabelText('Видео плана «Письмо на столе»')).toHaveAttribute('src', '/media/video-1.mp4');
  expect(motion).toHaveValue('Новое движение');
});

it('removes private workspace data on auth expiry and rejects a late workspace response from the old session', async () => {
  await renderPage();
  const pending = deferred<VideoWorkspace>();
  fetchWorkspace.mockReturnValueOnce(pending.promise);
  await act(async () => {window.dispatchEvent(new Event('focus'));});
  (getAuthGeneration as jest.Mock).mockReturnValue(++authGeneration);
  await act(async () => {window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));});
  await act(async () => {pending.resolve(makeVideoWorkspace());});
  expect(screen.getByText('У вас нет доступа к этому проекту.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', {name: 'Письмо на столе'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Создать видео'})).not.toBeInTheDocument();
});
