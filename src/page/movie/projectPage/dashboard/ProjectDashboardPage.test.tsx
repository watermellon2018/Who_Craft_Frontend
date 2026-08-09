import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
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
  mockedAdaptProgress.mockReturnValue({overall: 0, legend: []});
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

it('opens Music Studio from the dashboard music statistic', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);
  mockedAdaptStats.mockReturnValue([{key: 'music', label: 'Музыка', value: 2, subtitle: '1 используется', iconKey: 'music', accent: 'green'}]);

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/music" element={<div>Музыкальная студия проекта</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Музыка'}));
  expect(await screen.findByText('Музыкальная студия проекта')).toBeInTheDocument();
});

it('opens the visual library from quick actions for editors and viewers', async () => {
  mockedFetchProjectDashboard.mockResolvedValue({} as never);
  mockedAdaptQuickActions.mockReturnValue([
    {
      accent: 'yellow',
      iconKey: 'newLocation',
      key: 'create_location',
      label: 'Открыть визуальную библиотеку',
    },
  ] as never);

  const {unmount} = render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/project/:projectId/references" element={<div>Вся визуальная библиотека</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Открыть визуальную библиотеку'}));
  expect(await screen.findByText('Вся визуальная библиотека')).toBeInTheDocument();
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
        <Route path="/project/:projectId/references" element={<div>Библиотека для просмотра</div>} />
      </Routes>
    </MemoryRouter>,
  );

  const viewerAction = await screen.findByRole('button', {name: /Открыть визуальную библиотеку/});
  expect(viewerAction).toBeEnabled();
  fireEvent.click(viewerAction);
  expect(await screen.findByText('Библиотека для просмотра')).toBeInTheDocument();
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
  const music = screen.getByRole('heading', {name: 'Музыкальная студия'}).closest('section');
  expect(music).not.toBeNull();
  expect(library.compareDocumentPosition(music as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
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

    fireEvent.click(await screen.findByRole('button', {name: label}));
    expect(await screen.findByText(destinationLabel)).toBeInTheDocument();
  },
);
