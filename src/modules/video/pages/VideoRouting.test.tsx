import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

jest.mock('../../profile/components/DashboardHeader', () =>
  function MockDashboardHeader() {
    return <header>Dashboard header</header>;
  },
);
jest.mock('../api');

import {fetchVideoPreparation} from '../api';
import type {VideoPreparationResponse} from '../api';
import VideoEntryGatePage from './VideoEntryGatePage';
import VideoPreparationPage from './VideoPreparationPage';

const mockedFetchVideoPreparation = fetchVideoPreparation as jest.MockedFunction<
  typeof fetchVideoPreparation
>;

function preparationResponse(
  overrides: Partial<VideoPreparationResponse> = {},
): VideoPreparationResponse {
  return {
    project: {
      id: 42,
      permissions: {
        currentUserRole: 'editor',
        canView: true,
        canEdit: true,
        canRunGeneration: true,
        canEditSettings: false,
        canPublish: false,
        canManageTeam: false,
        canTransferOwnership: false,
        canDeleteProject: false,
        canLeaveProject: true,
      },
      title: 'Анчоус Тим',
    },
    ready: true,
    taskCount: 0,
    missingCharacters: [],
    emptyScenes: [],
    storyboard: {
      ready: true,
      progress: 1,
      readyCount: 2,
      totalCount: 2,
      missingCount: 0,
      staleCount: 0,
      scenes: [],
    },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  const initialName = (location.state as {initialCharacterName?: string} | null)
    ?.initialCharacterName;
  return <div>{`${location.pathname}${location.search}|${initialName ?? ''}`}</div>;
}

beforeEach(() => jest.clearAllMocks());

it('opens the workspace without requiring whole-project readiness', async () => {

  render(
    <MemoryRouter initialEntries={['/project/42/video']}>
      <Routes>
        <Route path="/project/:projectId/video" element={<VideoEntryGatePage />} />
        <Route path="/project/:projectId/video/generate" element={<div>Generation route</div>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Generation route')).toBeInTheDocument();
  expect(mockedFetchVideoPreparation).not.toHaveBeenCalled();
});

it('preserves the requested scene and shot when opening the workspace', async () => {
  render(
    <MemoryRouter initialEntries={['/project/42/video?sceneId=17&shotId=local-shot']}>
      <Routes>
        <Route path="/project/:projectId/video" element={<VideoEntryGatePage />} />
        <Route path="/project/:projectId/video/generate" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('/project/42/video/generate?sceneId=17&shotId=local-shot|')).toBeInTheDocument();
});

it('lets users open video history from preparation while prerequisites are blocked', async () => {
  mockedFetchVideoPreparation.mockResolvedValue(preparationResponse({ready: false, taskCount: 1}));

  render(
    <MemoryRouter initialEntries={['/project/42/video/preparation']}>
      <Routes>
        <Route path="/project/:projectId/video/preparation" element={<VideoPreparationPage />} />
        <Route path="/project/:projectId/video/generate" element={<div>Video history</div>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('link', {name: 'Создание видео'}));
  expect(await screen.findByText('Video history')).toBeInTheDocument();
  expect(mockedFetchVideoPreparation).toHaveBeenCalledWith('42', expect.any(AbortSignal));
});

it('renders grouped tasks with direct character and screenplay links', async () => {
  mockedFetchVideoPreparation.mockResolvedValue(preparationResponse({
    ready: false,
    taskCount: 3,
    missingCharacters: [{dialogueCount: 6, name: 'Продавец', sceneCount: 1}],
    emptyScenes: [{order: 2, sceneId: 17, title: 'Пустой павильон'}],
    storyboard: {
      ready: false,
      progress: 0.5,
      readyCount: 1,
      totalCount: 2,
      missingCount: 1,
      staleCount: 0,
      scenes: [{
        acceptedVersion: null,
        currentVersion: 1,
        order: 2,
        sceneId: 17,
        status: 'missing',
        title: 'Пустой павильон',
      }],
    },
  }));

  const {unmount} = render(
    <MemoryRouter initialEntries={['/project/42/video/preparation']}>
      <Routes>
        <Route path="/project/:projectId/video/preparation" element={<VideoPreparationPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', {name: 'Недостающие персонажи'})).toBeInTheDocument();
  expect(screen.getByRole('heading', {name: 'Пустые сцены'})).toBeInTheDocument();
  expect(screen.getByRole('progressbar', {name: 'Готовность раскадровки: 50%'}))
    .toHaveAttribute('aria-valuenow', '50');

  fireEvent.click(screen.getByRole('link', {name: /Создать персонажа/}));
  expect(await screen.findByText('/project/42/characters/create|Продавец')).toBeInTheDocument();
  unmount();

  render(
    <MemoryRouter initialEntries={['/project/42/video/preparation']}>
      <Routes>
        <Route path="/project/:projectId/video/preparation" element={<VideoPreparationPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('link', {name: /Открыть сцену/}));
  await waitFor(() => {
    expect(screen.getByText('/project/42/script?sceneId=17|')).toBeInTheDocument();
  });
});

it('omits the storyboard task after full coverage is reached', async () => {
  mockedFetchVideoPreparation.mockResolvedValue(preparationResponse());

  render(
    <MemoryRouter initialEntries={['/project/42/video/preparation']}>
      <Routes>
        <Route path="/project/:projectId/video/preparation" element={<VideoPreparationPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Готово к созданию видео')).toBeInTheDocument();
  expect(screen.queryByRole('heading', {name: 'Полное покрытие сценария раскадровкой'}))
    .not.toBeInTheDocument();
});
