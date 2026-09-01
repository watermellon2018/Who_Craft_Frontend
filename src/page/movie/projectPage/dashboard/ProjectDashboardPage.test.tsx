import React from 'react';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

jest.mock('../../../../modules/profile/components/DashboardHeader', () =>
  function MockDashboardHeader() {
    return <header>Dashboard header</header>;
  },
);
jest.mock('../../../../modules/profile/api/profileApi');
jest.mock('./api');
jest.mock('./ProjectVisualLibrary', () => ({
  __esModule: true,
  default: () => <section data-testid="visual-library-section">Визуальная библиотека проекта</section>,
}));

import {fetchDashboard} from '../../../../modules/profile/api/profileApi';
import {
  adaptActivity,
  adaptCharacters,
  adaptMusic,
  adaptPipeline,
  adaptProgress,
  adaptProject,
  adaptQuickActions,
  adaptStats,
  fetchProjectDashboard,
} from './api';
import {ProjectDashboardPage} from './ProjectDashboardPage';

const mockedFetchDashboard = fetchDashboard as jest.MockedFunction<typeof fetchDashboard>;
const mockedFetchProjectDashboard = fetchProjectDashboard as jest.MockedFunction<typeof fetchProjectDashboard>;
const mockedAdaptActivity = adaptActivity as jest.MockedFunction<typeof adaptActivity>;
const mockedAdaptCharacters = adaptCharacters as jest.MockedFunction<typeof adaptCharacters>;
const mockedAdaptMusic = adaptMusic as jest.MockedFunction<typeof adaptMusic>;
const mockedAdaptPipeline = adaptPipeline as jest.MockedFunction<typeof adaptPipeline>;
const mockedAdaptProgress = adaptProgress as jest.MockedFunction<typeof adaptProgress>;
const mockedAdaptProject = adaptProject as jest.MockedFunction<typeof adaptProject>;
const mockedAdaptQuickActions = adaptQuickActions as jest.MockedFunction<typeof adaptQuickActions>;
const mockedAdaptStats = adaptStats as jest.MockedFunction<typeof adaptStats>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedFetchDashboard.mockResolvedValue({user: null} as never);
  mockedAdaptProject.mockReturnValue({
    id: '42',
    title: 'Тестовый проект',
    subtitle: 'Страница проекта',
    status: 'work',
    statusKey: 'in_progress',
    statusLabel: 'В работе',
    isFavorite: false,
    coverImageUrl: null,
    coverGradient: 'none',
    genres: [],
    description: '',
    updatedAtLabel: '',
    team: [],
    teamExtraCount: 0,
    permissions: {
      canEdit: true,
      canRunGeneration: true,
      canEditSettings: true,
      canPublish: false,
      canManageTeam: false,
      canTransferOwnership: false,
      canDeleteProject: true,
      canLeaveProject: false,
    },
  });
  mockedAdaptStats.mockReturnValue([]);
  mockedAdaptCharacters.mockReturnValue([]);
  mockedAdaptPipeline.mockReturnValue([]);
  mockedAdaptMusic.mockReturnValue([]);
  mockedAdaptProgress.mockReturnValue({
    overall: 0,
    legend: [],
    storyboardNeedsReview: 0,
    storyboardReviewScenes: [],
  });
  mockedAdaptQuickActions.mockReturnValue([]);
  mockedAdaptActivity.mockReturnValue([]);
});

it.each([
  [401, 'Требуется повторная авторизация'],
  [403, 'Нет доступа к проекту'],
  [404, 'Проект не найден'],
])('renders the %i dashboard API state for a canonical deep link', async (status, message) => {
  mockedFetchProjectDashboard.mockRejectedValue({response: {status}});

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(mockedFetchProjectDashboard).toHaveBeenCalledWith('42');
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });
  expect(screen.queryByText('Cyber City Dawn')).not.toBeInTheDocument();
});

it('navigates from the project actions menu to the canonical edit page', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectId/edit" element={<div>Страница редактирования проекта</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Действия с проектом'}));
  fireEvent.click(screen.getByRole('menuitem', {name: /Редактировать проект/}));

  expect(await screen.findByText('Страница редактирования проекта')).toBeInTheDocument();
});

it('opens the project roadmap from Continue', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectId/roadmap" element={<div>Roadmap проекта</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Продолжить'}));
  expect(await screen.findByText('Roadmap проекта')).toBeInTheDocument();
});

it.each([
  ['characters', 'Персонажи', 'characters', 'purple', '/project/:projectId/characters', 'Библиотека персонажей'],
  ['scenes', 'Сцены', 'scenes', 'blue', '/project/:projectId/script', 'Сценарий проекта'],
  ['music', 'Музыка', 'music', 'green', '/project/:projectId/music', 'Музыкальная студия проекта'],
  ['locations', 'Визуальная библиотека', 'locations', 'yellow', '/project/:projectId/references', 'Визуальная библиотека проекта'],
] as const)('opens the project section from the %s dashboard statistic', async (
  key,
  label,
  iconKey,
  accent,
  route,
  destination,
) => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);
  mockedAdaptStats.mockReturnValue([{key, label, value: 2, iconKey, accent}]);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path={route} element={<div>{destination}</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: label}));
  expect(await screen.findByText(destination)).toBeInTheDocument();
});

it('keeps an in-progress Storyboard clickable in the compact roadmap', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({
    roadmap: {
      version: 1,
      nextAction: {stepKey: 'storyboard', actionUrl: '/project/42/storyboard'},
      steps: [{
        actionUrl: '/project/42/storyboard',
        availability: 'available',
        blockers: [{code: 'staleStoryboards', count: 1}],
        key: 'storyboard',
        metrics: {scenesMissing: 2, scenesReady: 1, scenesTotal: 3},
        optional: false,
        progressPercent: 33,
        state: 'in_progress',
      }],
    },
  } as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/storyboard" element={<div>Раскадровка проекта</div>} />
      </Routes>
    </MemoryRouter>,
  );

  const storyboardLink = await screen.findByRole('link', {
    name: 'Открыть этап «Раскадровка»',
  });
  expect(storyboardLink).toHaveTextContent('В работе');
  fireEvent.click(storyboardLink);
  expect(await screen.findByText('Раскадровка проекта')).toBeInTheDocument();
});

it('opens visual reference creation from quick actions for editors only', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);
  mockedAdaptQuickActions.mockReturnValue([
    {
      accent: 'yellow',
      iconKey: 'newReference',
      key: 'create_location',
      label: 'Создать визуальную опору',
    },
  ] as never);

  const {unmount} = render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/references/create" element={<div>Создание визуальной опоры</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Создать визуальную опору'}));
  expect(await screen.findByText('Создание визуальной опоры')).toBeInTheDocument();
  unmount();

  const viewerProject = mockedAdaptProject({} as never);
  mockedAdaptProject.mockReturnValue({
    ...viewerProject,
    permissions: viewerProject.permissions
      ? {...viewerProject.permissions, canEdit: false}
      : undefined,
  });
  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/references/create" element={<div>Недоступное создание</div>} />
      </Routes>
    </MemoryRouter>,
  );

  const viewerAction = await screen.findByRole('button', {name: /Создать визуальную опору/});
  expect(viewerAction).toBeDisabled();
  expect(screen.queryByText('Недоступное создание')).not.toBeInTheDocument();
});

it('places the visual library before Music Studio', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );

  const library = await screen.findByTestId('visual-library-section');
  const music = screen.getByRole('heading', {name: 'Звукостудия'}).closest('section');
  expect(music).not.toBeNull();
  expect(library.compareDocumentPosition(music as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
});

it('opens the full character list from the Characters section', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/characters" element={<div>Список персонажей</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Смотреть все'}));
  expect(await screen.findByText('Список персонажей')).toBeInTheDocument();
});

it.each([
  [
    'create_character',
    'Создать персонажа',
    'newCharacter',
    '/project/:projectId/characters/create',
    'Страница создания персонажа',
  ],
  [
    'create_track',
    'Создать трек',
    'newTrack',
    '/project/:projectId/music/create',
    'Страница создания трека',
  ],
] as const)(
  'opens the %s quick action destination',
  async (key, label, iconKey, destination, destinationLabel) => {
    mockedFetchProjectDashboard.mockResolvedValue({} as never);
    mockedAdaptQuickActions.mockReturnValue([
      {accent: 'purple', iconKey, key, label},
    ] as never);

    render(
      <MemoryRouter initialEntries={['/projects/42']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
          <Route path={destination} element={<div>{destinationLabel}</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const quickActions = screen.getByRole('heading', {name: 'Быстрые действия'}).closest('.proj-card');
    expect(quickActions).not.toBeNull();
    fireEvent.click(await within(quickActions as HTMLElement).findByRole('button', {name: label}));
    expect(await screen.findByText(destinationLabel)).toBeInTheDocument();
  },
);

it('keeps video generation enabled when prerequisites are incomplete and opens the entry gate', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({
    progress: {
      readiness: {
        videoPreparation: {ready: false, taskCount: 3},
      },
    },
  } as never);
  mockedAdaptQuickActions.mockReturnValue([
    {accent: 'red', iconKey: 'genVideo', key: 'generate_video', label: 'Генерация видео'},
  ] as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/video" element={<div>Вход в создание видео</div>} />
      </Routes>
    </MemoryRouter>,
  );

  const generationButton = await screen.findByRole('button', {name: 'Генерация видео'});
  expect(generationButton).toBeEnabled();
  fireEvent.click(generationButton);
  expect(await screen.findByText('Вход в создание видео')).toBeInTheDocument();
});

it('opens preparation from the compact dashboard status', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({
    progress: {
      readiness: {
        videoPreparation: {ready: false, taskCount: 3},
      },
    },
  } as never);
  mockedAdaptQuickActions.mockReturnValue([
    {accent: 'red', iconKey: 'genVideo', key: 'generate_video', label: 'Генерация видео'},
  ] as never);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route
          path="/project/:projectId/video/preparation"
          element={<div>Чек-лист подготовки</div>}
        />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {
    name: 'Подготовка к видео: ⚠ Не готово к видео · 3 задачи → Открыть',
  }));
  expect(await screen.findByText('Чек-лист подготовки')).toBeInTheDocument();
});
