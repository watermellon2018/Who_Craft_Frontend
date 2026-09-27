import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import {getAuthGeneration} from '../../../api/http';
import {createVideoJob, fetchVideoOptions, fetchVideoWorkspace, saveVideoMotion, selectVideoVersion} from '../api';
import {makeVideoJob, makeVideoOptions, makeVideoShot, makeVideoWorkspace} from '../testFixtures';
import type {VideoWorkspace} from '../types';
import VideoGenerationPage from './VideoGenerationPage';

jest.mock('../api', () => ({
  createVideoJob: jest.fn(), fetchVideoOptions: jest.fn(), fetchVideoWorkspace: jest.fn(),
  saveVideoMotion: jest.fn(), selectVideoVersion: jest.fn(),
}));
jest.mock('../../../api/http', () => ({
  __esModule: true, default: {}, getAuthGeneration: jest.fn(() => 1), AUTH_EXPIRED_EVENT: 'auth-expired',
}));
jest.mock('../../profile/components/DashboardHeader', () => function MockDashboardHeader() {return <header>Шапка Craft</header>;});

const fetchWorkspace = fetchVideoWorkspace as jest.MockedFunction<typeof fetchVideoWorkspace>;
const fetchOptions = fetchVideoOptions as jest.MockedFunction<typeof fetchVideoOptions>;
const createJob = createVideoJob as jest.MockedFunction<typeof createVideoJob>;
const selectVersion = selectVideoVersion as jest.MockedFunction<typeof selectVideoVersion>;
const saveMotion = saveVideoMotion as jest.MockedFunction<typeof saveVideoMotion>;
let authGeneration = 1;

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Текущий адрес">{location.pathname}{location.search}</output>;
}

async function advance(ms = 300) {
  await act(async () => {jest.advanceTimersByTime(ms);});
}

async function renderPage(workspace = makeVideoWorkspace(), search = '') {
  fetchWorkspace.mockResolvedValue(workspace);
  await act(async () => {
    render(<MemoryRouter initialEntries={[`/project/42/video/generate${search}`]}>
      <Routes><Route path="/project/:projectId/video/generate" element={<VideoGenerationPage />} />
        <Route path="*" element={<p>Другой этап проекта</p>} /></Routes>
      <LocationProbe />
    </MemoryRouter>);
  });
  await advance();
}

function workspaceWithJobs(jobs = [makeVideoJob()], selectedJobId = 'video-job-1'): VideoWorkspace {
  const workspace = makeVideoWorkspace();
  workspace.scenes[0].shots = [makeVideoShot({jobs, selectedJobId})];
  return workspace;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  (getAuthGeneration as jest.Mock).mockReturnValue(++authGeneration);
  fetchOptions.mockResolvedValue(makeVideoOptions());
  createJob.mockResolvedValue({job: makeVideoJob({status: 'queued', stage: 'queued', videoUrl: null, assetId: null, completedAt: null}), idempotentReplay: false});
  selectVersion.mockResolvedValue({videoShotId: 17, videoShotVersion: 2, selectedJobId: 'video-job-2'});
  saveMotion.mockResolvedValue({videoShotId: 17, videoShotVersion: 2, motionPrompt: ''});
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('uses the personal preference with one create action and no source or model selectors', async () => {
  await renderPage();

  expect(screen.getByText('Шапка Craft')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Мой API'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'API Craft'})).not.toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Настройки API в профиле'})).toHaveAttribute('href', '/profile/settings');
  const create = screen.getByRole('button', {name: 'Создать видео'});
  expect(create).toBeEnabled();
  await act(async () => {fireEvent.click(create);});

  expect(createJob).toHaveBeenCalledTimes(1);
  expect(createJob).toHaveBeenCalledWith('42', 'preflight-approved', expect.any(String));
  expect(screen.getByText('Видео поставлено в очередь. Готовая версия появится в истории.')).toBeInTheDocument();
  expect(create).toBeDisabled();
});

it('shows the Craft model catalogue, an incompatible-model reason and the adjusted duration before creation', async () => {
  const options = makeVideoOptions({generationSource: 'platform', canGenerate: false, preflightToken: null,
    blockers: [{code: 'subscription_required', detail: 'Для этой модели нужна подписка Craft.'}]});
  options.models.push({...options.models[0], id: 'legacy-model', label: 'Legacy video', compatible: false,
    unavailableReason: 'Не поддерживает конечный кадр'});
  fetchOptions.mockResolvedValue(options);
  await renderPage(makeVideoWorkspace({generationSource: 'platform'}));

  expect(screen.getByText('Модель создаст 6 с вместо 5 с. Раскадровка останется без изменений.')).toBeInTheDocument();
  expect(screen.getByText('Для этой модели нужна подписка Craft.')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeDisabled();
  fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Модель видео'}));
  await advance(1);
  expect(screen.getByRole('option', {name: 'Veo Fast'})).toBeInTheDocument();
  const unavailable = screen.getByTitle('Не поддерживает конечный кадр');
  expect(unavailable).toHaveTextContent('Legacy video');
  fireEvent.click(unavailable);
  await advance();
  expect(fetchOptions).toHaveBeenCalledTimes(1);
  expect(createJob).not.toHaveBeenCalled();
});

it('allows a ready scene while another scene still needs preparation', async () => {
  const workspace = makeVideoWorkspace();
  workspace.scenes.push({id: 12, title: 'Недописанная сцена', order: 2, ready: false,
    blockers: [{code: 'storyboard_missing', detail: 'Подготовьте раскадровку второй сцены.'}],
    shots: [makeVideoShot({sceneId: 12, sourceShotId: 'shot-2', title: 'Пустой план', ready: false, startFrame: null})]});
  await renderPage(workspace);

  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button', {name: /Сцена 2 · Недописанная сцена/}));
  await advance();
  expect(screen.getByRole('heading', {name: 'Пустой план'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeDisabled();
  expect(screen.getByText('Подготовьте раскадровку второй сцены.')).toBeInTheDocument();
});

it('lets a viewer play existing history without mutation controls', async () => {
  const workspace = workspaceWithJobs();
  workspace.permissions = {canView: true, canEdit: false, canRunGeneration: false};
  await renderPage(workspace);

  expect(screen.getByLabelText('Видео плана «Письмо на столе»')).toHaveAttribute('src', '/media/video-1.mp4');
  expect(screen.getByRole('heading', {name: 'Версии видео'})).toBeInTheDocument();
  expect(screen.getByText('Режим просмотра. Изменять условия и создавать видео могут редакторы проекта.')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Создать видео'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Выбрать для плана'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Сохранить уточнения'})).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', {name: 'Действие и движение камеры'})).toBeDisabled();
});

it('previews another version without selecting it until the explicit action', async () => {
  const newer = makeVideoJob({id: 'video-job-2', videoUrl: '/media/video-2.mp4'});
  const workspace = workspaceWithJobs([newer, makeVideoJob()]);
  await renderPage(workspace);
  expect(screen.getByLabelText('Видео плана «Письмо на столе»')).toHaveAttribute('src', '/media/video-1.mp4');
  fireEvent.click(screen.getByRole('button', {name: /Версия 2/}));

  expect(screen.getByLabelText('Видео плана «Письмо на столе»')).toHaveAttribute('src', '/media/video-2.mp4');
  expect(selectVersion).not.toHaveBeenCalled();
  expect(screen.getByRole('button', {name: /Версия 1/})).toHaveTextContent('Выбрано для плана');
  const selected = workspaceWithJobs([newer, makeVideoJob()], newer.id);
  fetchWorkspace.mockResolvedValue(selected);
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Выбрать для плана'}));});

  expect(selectVersion).toHaveBeenCalledWith('42', 17, 'video-job-2', 1);
  expect(screen.getByRole('button', {name: /Версия 2/})).toHaveTextContent('Выбрано для плана');
});

it('keeps the selected old version when polling brings a completed new version', async () => {
  const newer = makeVideoJob({id: 'video-job-2', status: 'processing', stage: 'polling', videoUrl: null, assetId: null});
  await renderPage(workspaceWithJobs([newer, makeVideoJob()]));
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeDisabled();
  fetchWorkspace.mockResolvedValue(workspaceWithJobs([
    {...newer, status: 'completed', stage: 'completed', videoUrl: '/media/video-2.mp4', assetId: 202}, makeVideoJob(),
  ]));
  await advance(3000);

  expect(fetchWorkspace).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', {name: /Версия 2/})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Версия 1/})).toHaveTextContent('Выбрано для плана');
  expect(screen.getByLabelText('Видео плана «Письмо на столе»')).toHaveAttribute('src', '/media/video-1.mp4');
  expect(selectVersion).not.toHaveBeenCalled();
});

it('marks stale video and requires acknowledgement before retrying an unknown paid outcome', async () => {
  const unknown = makeVideoJob({id: 'video-unknown', status: 'outcome_unknown', stage: 'outcome_unknown', videoUrl: null, assetId: null});
  await renderPage(workspaceWithJobs([unknown, makeVideoJob({stale: true, staleReasons: ['storyboard_changed']})]));

  expect(screen.getByText('Исходные данные изменились. Эта версия создана по предыдущим условиям.')).toBeInTheDocument();
  expect(screen.getByText('Результат запроса неизвестен')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeDisabled();
  expect(createJob).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', {name: 'Я проверил историю провайдера и хочу запустить новую генерацию'}));
  expect(screen.getByRole('button', {name: 'Создать видео'})).toBeEnabled();
});

it('opens a deep-linked shot and preserves its scene in navigation to earlier project stages', async () => {
  const workspace = makeVideoWorkspace();
  workspace.scenes.push({id: 12, title: 'Улица', order: 2, ready: true, blockers: [],
    shots: [makeVideoShot({sceneId: 12, sourceShotId: 'shot-outside', title: 'Анна выходит'})]});
  await renderPage(workspace, '?sceneId=12&shotId=shot-outside&sourceKind=editor_draft');

  expect(screen.getByRole('heading', {name: 'Анна выходит'})).toBeInTheDocument();
  const navigation = within(screen.getByRole('navigation', {name: 'Этапы проекта'}));
  expect(navigation.getByRole('link', {name: 'Персонажи'})).toHaveAttribute('href', '/project/42/characters');
  expect(navigation.getByRole('link', {name: 'Визуальные опоры'})).toHaveAttribute('href', '/project/42/references');
  expect(navigation.getByRole('link', {name: 'Сценарий'})).toHaveAttribute('href', '/project/42/script?sceneId=12');
  const storyboard = navigation.getByRole('link', {name: 'Раскадровка'});
  expect(storyboard).toHaveAttribute('href', '/project/42/storyboard?sceneId=12');
  fireEvent.click(storyboard);
  expect(screen.getByLabelText('Текущий адрес')).toHaveTextContent('/project/42/storyboard?sceneId=12');
});

it('retains archived video history while preventing generation after the storyboard shot is removed', async () => {
  await renderPage(makeVideoWorkspace({scenes: [], archivedShots: [makeVideoShot({sourceRemoved: true, ready: false,
    selectedJobId: 'video-job-1', jobs: [makeVideoJob()]})]}));

  expect(screen.getByText('План удалён из раскадровки. Сохранённые видео доступны в истории.')).toBeInTheDocument();
  expect(screen.getByLabelText('Видео плана «Письмо на столе»')).toHaveAttribute('src', '/media/video-1.mp4');
  expect(screen.queryByRole('button', {name: 'Создать видео'})).not.toBeInTheDocument();
  expect(fetchOptions).not.toHaveBeenCalled();
});
