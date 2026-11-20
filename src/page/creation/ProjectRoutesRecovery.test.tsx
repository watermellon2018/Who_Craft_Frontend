import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {create_project, fetch_project, patch_project} from '../../api/projects/properties/project';
import {openNotificationWithIcon} from '../../utils/global/notification';
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
  getPosterClientErrorCode: jest.fn(() => null),
  selectPosterVariant: jest.fn(),
}));
jest.mock('./edit_generation', () => () => null);

const mockedFetchProject = fetch_project as jest.MockedFunction<typeof fetch_project>;
const mockedCreateProject = create_project as jest.MockedFunction<typeof create_project>;
const mockedPatchProject = patch_project as jest.MockedFunction<typeof patch_project>;

function renderRoute(path: string, element: React.ReactNode, routePath: string, destination?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        {destination}
      </Routes>
    </MemoryRouter>,
  );
}

function fillProjectBasics() {
  fireEvent.change(screen.getByPlaceholderText('Введите название'), {target: {value: 'New project'}});
  fireEvent.mouseDown(screen.getByText('Выберите жанр'));
  fireEvent.click(screen.getByText('Драма'));
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
    generationSettings: {image_generation_model: 'mock', visual_style: 'noir'},
  } as never);

  renderRoute('/projects/77/edit', <ProjectCreatePage />, '/projects/:projectId/edit');

  await waitFor(() => expect(mockedFetchProject).toHaveBeenCalledWith('77'));
  expect(await screen.findByDisplayValue('Recovered project')).toBeInTheDocument();
  expect(screen.getByText('Нуар')).toBeInTheDocument();
});

test('saves a changed project style without resending the image model', async () => {
  const project = {
    id: 77,
    title: 'Recovered project',
    format: 'feature_film' as const,
    annotation: 'Recovered annotation',
    synopsis: 'Recovered synopsis',
    audience: ['all'],
    genre: ['drama'],
    generationSettings: {image_generation_model: 'mock', visual_style: 'noir' as const},
  };
  mockedFetchProject.mockResolvedValue(project);
  mockedPatchProject.mockResolvedValue({
    ...project, generationSettings: {...project.generationSettings, visual_style: 'watercolor'},
  });
  renderRoute('/projects/77/edit', <ProjectCreatePage />, '/projects/:projectId/edit');

  fireEvent.mouseDown(await screen.findByRole('combobox', {name: 'Визуальный стиль'}));
  fireEvent.click(screen.getByText('Акварель'));
  fireEvent.click(screen.getByRole('button', {name: /Сохранить изменения/}));

  await waitFor(() => expect(mockedPatchProject).toHaveBeenCalledWith('77', expect.objectContaining({
    generation_settings: {visual_style: 'watercolor'},
  })));
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

  expect(await screen.findByText('Проект не найден.')).toBeInTheDocument();
});

test('keeps poster generation disabled until a new project is saved', () => {
  renderRoute('/create-project', <ProjectCreatePage />, '/create-project');

  expect(screen.getByRole('button', {name: /Сгенерировать постер/})).toBeDisabled();
  expect(screen.getByText('Сначала создайте проект, чтобы открыть генератор постера.')).toBeInTheDocument();
  expect(mockedFetchProject).not.toHaveBeenCalled();
});

test('creates the project with the selected style and then opens its dashboard', async () => {
  mockedCreateProject.mockResolvedValue({id: 77, title: 'New project'});
  renderRoute(
    '/create-project', <ProjectCreatePage />, '/create-project',
    <Route path="/projects/77" element={<h1>New project dashboard</h1>} />,
  );
  fillProjectBasics();
  expect(screen.getByText('Кинематографичный реализм')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Визуальный стиль'}));
  fireEvent.click(screen.getByText('Аниме'));
  fireEvent.change(screen.getByPlaceholderText('Опишите идею проекта…'), {target: {value: 'Annotation'}});
  fireEvent.change(screen.getByPlaceholderText('Опишите сюжет и ключевые события…'), {target: {value: 'Synopsis'}});
  fireEvent.click(screen.getByRole('button', {name: /Создать проект/}));

  expect(await screen.findByRole('heading', {name: 'New project dashboard'})).toBeInTheDocument();
  expect(mockedCreateProject).toHaveBeenCalledWith(expect.objectContaining({
    title: 'New project', generation_settings: {visual_style: 'anime'},
  }));
});

test('reports empty annotation and synopsis as required fields', () => {
  renderRoute('/create-project', <ProjectCreatePage />, '/create-project');
  fillProjectBasics();
  const submit = screen.getByRole('button', {name: /Создать проект/});

  fireEvent.click(submit);
  expect(openNotificationWithIcon).toHaveBeenLastCalledWith('Аннотация не должна быть пустой');

  fireEvent.change(screen.getByPlaceholderText('Опишите идею проекта…'), {target: {value: 'Annotation'}});
  fireEvent.change(screen.getByPlaceholderText('Опишите сюжет и ключевые события…'), {target: {value: '   '}});
  fireEvent.click(submit);
  expect(openNotificationWithIcon).toHaveBeenLastCalledWith('Синопсис не должен быть пустым');
  expect(mockedCreateProject).not.toHaveBeenCalled();
});
