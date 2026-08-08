import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fetch_project} from '../../api/projects/properties/project';
import GenPosterPage from './poster/GenPosterPage';
import {ProjectCreatePage} from './projects/newProjectPage';

jest.mock('../../api/projects/properties/project', () => ({
  create_project: jest.fn(),
  fetch_project: jest.fn(),
  patch_project: jest.fn(),
}));
jest.mock('../../modules/profile/components/DashboardHeader', () => function MockDashboardHeader() {
  return <div>Dashboard header</div>;
});
jest.mock('../../utils/auth/check_auth', () => (Component: React.ComponentType) => Component);
jest.mock('../../utils/global/notification', () => ({
  openNotificationWithIcon: jest.fn(),
}));
jest.mock('../../api/posters', () => ({
  editPoster: jest.fn(),
  generatePoster: jest.fn(),
  selectPosterVariant: jest.fn(),
}));
jest.mock('./edit_generation', () => () => null);

const mockedFetchProject = fetch_project as jest.MockedFunction<typeof fetch_project>;

function renderRoute(path: string, element: React.ReactNode, routePath: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('restores project edit data from the project id in the URL', async () => {
  mockedFetchProject.mockResolvedValue({
    id: 77,
    title: 'Recovered project',
    format: 'feature_film',
    annotation: 'Recovered annotation',
    synopsis: 'Recovered synopsis',
    audience: ['all'],
    genre: ['drama'],
    posterUrl: '',
  } as never);

  renderRoute('/projects/77/edit', <ProjectCreatePage />, '/projects/:projectId/edit');

  await waitFor(() => expect(mockedFetchProject).toHaveBeenCalledWith('77'));
  expect(await screen.findByDisplayValue('Recovered project')).toBeInTheDocument();
});

test('shows an explicit forbidden state on direct project edit open', async () => {
  mockedFetchProject.mockRejectedValue({response: {status: 403, data: {detail: 'Forbidden'}}});

  renderRoute('/projects/77/edit', <ProjectCreatePage />, '/projects/:projectId/edit');

  expect(await screen.findByText('Нет доступа к проекту')).toBeInTheDocument();
});

test('restores poster context from the URL and shows an explicit not-found state', async () => {
  mockedFetchProject.mockResolvedValueOnce({id: 77, title: 'Recovered project'} as never);
  const firstRender = renderRoute('/projects/77/poster', <GenPosterPage />, '/projects/:projectId/poster');

  await waitFor(() => expect(mockedFetchProject).toHaveBeenCalledWith('77'));
  expect(await screen.findByText('Создание постера')).toBeInTheDocument();
  firstRender.unmount();

  mockedFetchProject.mockReset();
  mockedFetchProject.mockRejectedValue({response: {status: 404, data: {detail: 'Not found'}}});
  renderRoute('/projects/404/poster', <GenPosterPage />, '/projects/:projectId/poster');

  expect(await screen.findByText('Проект не найден')).toBeInTheDocument();
});

test('keeps poster generation disabled until a new project is saved', () => {
  renderRoute('/create-project', <ProjectCreatePage />, '/create-project');

  expect(screen.getByRole('button', {name: /Сгенерировать постер/})).toBeDisabled();
  expect(screen.getByText('Сначала создайте проект, чтобы открыть генератор постера.')).toBeInTheDocument();
  expect(mockedFetchProject).not.toHaveBeenCalled();
});
