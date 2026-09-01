import React from 'react';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

jest.mock('../../../../modules/profile/components/DashboardHeader', () => ({
  __esModule: true,
  default: ({breadcrumbItems}: {breadcrumbItems: Array<{label: string; to?: string}>}) => (
    <nav data-testid="breadcrumbs">{JSON.stringify(breadcrumbItems)}</nav>
  ),
}));
jest.mock('../dashboard/api');

import type {DashboardPayload} from '../dashboard/api';
import {fetchProjectDashboard} from '../dashboard/api';
import {ProjectRoadmapPage} from './ProjectRoadmapPage';

const mockedFetchProjectDashboard = fetchProjectDashboard as jest.MockedFunction<
  typeof fetchProjectDashboard
>;

const basePayload = {
  project: {id: 42, title: 'Город на рассвете'},
  roadmap: {
    version: 1,
    nextAction: {stepKey: 'script', actionUrl: '/project/42/script'},
    steps: [
      {
        key: 'script',
        optional: false,
        availability: 'available',
        state: 'in_progress',
        progressPercent: 50,
        metrics: {scenesTotal: 4, scenesReady: 2},
        blockers: [{code: 'incompleteScenes', count: 2}],
        actionUrl: '/project/42/script',
      },
      {
        key: 'characters',
        optional: false,
        availability: 'available',
        state: 'blocked',
        progressPercent: null,
        metrics: {
          charactersTotal: 1,
          charactersReady: 0,
          activeJobs: 0,
          missingCharacters: 1,
        },
        blockers: [{code: 'missingCharacters', count: 1}],
        actionUrl: '/project/42/characters',
      },
      {
        key: 'references',
        optional: true,
        availability: 'available',
        state: 'ready',
        progressPercent: 100,
        metrics: {referencesTotal: 1, referencesReady: 1, activeJobs: 0, failedReferences: 0},
        blockers: [],
        actionUrl: '/project/42/references',
      },
      {
        key: 'music',
        optional: true,
        availability: 'available',
        state: 'ready',
        progressPercent: 100,
        metrics: {tracksTotal: 1, tracksReady: 1, activeJobs: 0, failedTracks: 0},
        blockers: [],
        actionUrl: '/project/42/music',
      },
      {
        key: 'storyboard',
        optional: false,
        availability: 'available',
        state: 'in_progress',
        progressPercent: 25,
        metrics: {scenesTotal: 4, scenesReady: 1, scenesStarted: 1, scenesMissing: 2, scenesStale: 1},
        blockers: [{code: 'staleStoryboards', count: 1}],
        actionUrl: '/project/42/storyboard',
      },
      {
        key: 'video',
        optional: false,
        availability: 'available',
        state: 'blocked',
        progressPercent: null,
        metrics: {shotsTotal: 0, shotsReady: 0},
        blockers: [{code: 'storyboardNotReady'}],
        actionUrl: '/project/42/video',
      },
    ],
  },
} as unknown as DashboardPayload;

function renderRoadmap(payload: DashboardPayload = basePayload) {
  mockedFetchProjectDashboard.mockResolvedValue(payload);
  return render(
    <MemoryRouter initialEntries={['/projects/42/roadmap']}>
      <Routes>
        <Route path="/projects/:projectId/roadmap" element={<ProjectRoadmapPage />} />
        <Route path="/project/:projectId/script" element={<div>Редактор сценария</div>} />
        <Route path="/project/:projectId/storyboard" element={<div>Редактор раскадровки</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders the six-stage hybrid roadmap and marks two stages optional', async () => {
  renderRoadmap();

  expect(await screen.findByRole('heading', {name: 'Подготовка'})).toBeInTheDocument();
  expect(mockedFetchProjectDashboard).toHaveBeenCalledWith('42');
  expect(screen.getAllByRole('heading', {level: 3})).toHaveLength(6);
  expect(screen.getAllByText('Опционально')).toHaveLength(2);
  expect(screen.getByText('Создайте 1 недостающего персонажа.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', {name: 'Roadmap проекта «Город на рассвете»'}))
    .not.toBeInTheDocument();
  expect(screen.queryByText('Рекомендуемый следующий шаг')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', {name: 'Продолжить'})).not.toBeInTheDocument();

  const characterLink = screen.getByRole('link', {name: 'Открыть этап «Персонажи»'});
  expect(within(characterLink).queryByRole('progressbar')).not.toBeInTheDocument();
  expect(within(characterLink).getByText('Всего персонажей')).toBeInTheDocument();
  expect(within(characterLink).getByText('Готово персонажей')).toBeInTheDocument();
  expect(screen.queryByText('Активные задачи')).not.toBeInTheDocument();
  expect(screen.queryByText('Не хватает персонажей')).not.toBeInTheDocument();
  expect(screen.queryByText('Основные образы значимых героев проекта.'))
    .not.toBeInTheDocument();
  expect(screen.queryByText('Гибридный пайплайн')).not.toBeInTheDocument();
  expect(screen.queryByText(
    'Сценарий и персонажей можно развивать независимо. Визуальная библиотека и музыка доступны как дополнительные параллельные направления.',
  )).not.toBeInTheDocument();
  const referencesLink = screen.getByRole('link', {
    name: 'Открыть этап «Визуальная библиотека»',
  });
  const musicLink = screen.getByRole('link', {name: 'Открыть этап «Музыка»'});
  expect(within(referencesLink).queryByRole('progressbar')).not.toBeInTheDocument();
  expect(within(musicLink).queryByRole('progressbar')).not.toBeInTheDocument();
  expect(within(referencesLink).queryByText('Готово к следующему шагу'))
    .not.toBeInTheDocument();
  expect(within(musicLink).queryByText('Готово к следующему шагу'))
    .not.toBeInTheDocument();
  expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('/project-list');
  expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('/projects/42');
});

it('keeps an in-progress storyboard openable and describes its warning', async () => {
  renderRoadmap();

  const storyboardLink = await screen.findByRole('link', {
    name: 'Открыть этап «Раскадровка»',
  });
  const warning = screen.getByRole('tooltip', {
    name: 'Обновите 1 устаревшую раскадровку.',
  });
  expect(storyboardLink).toHaveAccessibleDescription(
    'Обновите 1 устаревшую раскадровку.',
  );
  expect(storyboardLink).toHaveTextContent('В работе');
  expect(warning).toHaveClass('project-roadmap-warning__tooltip');
  expect(document.querySelector('.project-roadmap-step__blockers')).not.toBeInTheDocument();

  fireEvent.click(storyboardLink);
  expect(await screen.findByText('Редактор раскадровки')).toBeInTheDocument();
});

it('shows an untouched storyboard as open', async () => {
  renderRoadmap({
    ...basePayload,
    roadmap: {
      ...basePayload.roadmap,
      steps: basePayload.roadmap.steps.map((step) => step.key === 'storyboard'
        ? {...step, state: 'not_started', progressPercent: 0, blockers: []}
        : step),
    },
  });

  const storyboardLink = await screen.findByRole('link', {
    name: 'Открыть этап «Раскадровка»',
  });
  expect(storyboardLink).toHaveTextContent('Открыта');
  expect(storyboardLink).not.toHaveTextContent('Заблокировано');
});

it.each([
  [403, 'Нет доступа к проекту'],
  [404, 'Проект не найден'],
  [500, 'Не удалось загрузить roadmap'],
])('renders the %i roadmap API error state', async (status, expectedTitle) => {
  mockedFetchProjectDashboard.mockRejectedValue({response: {status}});

  render(
    <MemoryRouter initialEntries={['/projects/42/roadmap']}>
      <Routes>
        <Route path="/projects/:projectId/roadmap" element={<ProjectRoadmapPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(expectedTitle);
  });
});

it('retries a transient roadmap API failure', async () => {
  mockedFetchProjectDashboard
    .mockRejectedValueOnce({response: {status: 500}})
    .mockResolvedValueOnce(basePayload);

  render(
    <MemoryRouter initialEntries={['/projects/42/roadmap']}>
      <Routes>
        <Route path="/projects/:projectId/roadmap" element={<ProjectRoadmapPage />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Повторить'}));
  expect(await screen.findByRole('heading', {name: 'Подготовка'})).toBeInTheDocument();
  expect(mockedFetchProjectDashboard).toHaveBeenCalledTimes(2);
});
