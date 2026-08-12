import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useLocation} from 'react-router-dom';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {message} from 'antd';
import {v4 as uuidv4} from 'uuid';
import {characterApi} from '../api/characterApi';
import CharacterCreatePage from './CharacterCreatePage';

jest.mock('../api/characterApi');
jest.mock('../hooks/useProjectIdFromRoute', () => ({
  useProjectIdFromRoute: () => 'proj-1',
}));
jest.mock('../components/create/CharacterCreateHeader', () => function MockCharacterCreateHeader() {
  return <div>Header</div>;
});
jest.mock('../components/create/BasicInformationSection', () => {
  const {Form, Input} = jest.requireActual('antd');
  return function MockBasicInformationSection() {
    return (
      <>
        <Form.Item name="name"><Input aria-label="character-name" /></Form.Item>
        <Form.Item name="character_type"><Input aria-label="character-type" /></Form.Item>
      </>
    );
  };
});
jest.mock('../components/create/AppearanceDescriptionSection', () => {
  const {Form, Input} = jest.requireActual('antd');
  return function MockAppearanceDescriptionSection() {
    return (
      <Form.Item name="appearance_description">
        <Input aria-label="appearance-description" />
      </Form.Item>
    );
  };
});
jest.mock('../components/create/PersonalitySection', () => () => null);
jest.mock('../components/create/TipsPanel', () => () => null);
jest.mock('../components/create/VisualStyleSelector', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../components/create/GenerationSettingsPanel', () => ({
  __esModule: true,
  default: ({onChange}: {onChange: (value: {
    count: 1;
    creativity: 'balanced';
    imageModel: string;
    lockSeed: boolean;
    seed: string;
  }) => void}) => (
    <>
      <button
        type="button"
        onClick={() => onChange({
          count: 1,
          creativity: 'balanced',
          imageModel: 'openrouter-images:openai/gpt-image-1',
          lockSeed: false,
          seed: '',
        })}
      >
        Выбрать GPT Image
      </button>
      <button
        type="button"
        onClick={() => onChange({
          count: 1,
          creativity: 'balanced',
          imageModel: 'openrouter-images:black-forest-labs/flux.2-pro',
          lockSeed: false,
          seed: '',
        })}
      >
        Выбрать FLUX
      </button>
    </>
  ),
  defaultGenerationOptions: {
    count: 1,
    creativity: 'balanced',
    imageModel: '',
    lockSeed: false,
    seed: '',
  },
}));
jest.mock('./CreateCharacterFromReferencePage', () => ({
  CreateCharacterFromReferenceContent: () => null,
}));
jest.mock('uuid', () => ({v4: jest.fn()}));

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
const mockedUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

function LocationEcho() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </>
  );
}

function CreateRoute() {
  return <><CharacterCreatePage /><LocationEcho /></>;
}

function renderPage(
  initialEntry: NonNullable<React.ComponentProps<typeof MemoryRouter>['initialEntries']>[number] =
  '/project/proj-1/characters/create',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/project/:projectId/characters/create" element={<CreateRoute />} />
        <Route path="/project/:projectId/characters/:characterId/variants" element={<LocationEcho />} />
        <Route path="/project/:projectId/characters/:characterId/edit" element={<LocationEcho />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUuid
    .mockReturnValueOnce('tree-node-1')
    .mockReturnValueOnce('attempt-1')
    .mockReturnValueOnce('attempt-2');
  jest.spyOn(message, 'success').mockImplementation(() => undefined as never);
  mockedApi.get.mockResolvedValue({data: {
    character_id: 'char-1',
    project_id: 1,
    name: 'Hero',
    character_type: 'human',
    role: 'main',
    visual_style: 'cinematic_realism',
    identity_locked: false,
    appearance: {appearance_prompt: 'Tall warrior'},
  }} as never);
  mockedApi.create.mockResolvedValue({data: {character_id: 'char-1'}} as never);
  mockedApi.update.mockResolvedValue({data: {character_id: 'char-1'}} as never);
  mockedApi.delete.mockResolvedValue({data: {}} as never);
  mockedApi.generateInitial
    .mockResolvedValueOnce({
      data: {job_id: 'job-failed', status: 'failed', error_message: 'provider failed'},
    } as never)
    .mockResolvedValueOnce({
      data: {job_id: 'job-retry', status: 'queued'},
    } as never);
});

test('retries a failed first generation for the same draft character', async () => {
  renderPage();

  fireEvent.change(screen.getByLabelText('character-name'), {target: {value: 'Hero'}});
  fireEvent.change(screen.getByLabelText('appearance-description'), {target: {value: 'Tall warrior'}});
  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));

  expect(await screen.findByText('provider failed')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Повторить генерацию'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Продолжить с черновиком'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Удалить черновик'})).toBeInTheDocument();
  expect(mockedApi.create).toHaveBeenCalledTimes(1);
  expect(mockedApi.generateInitial).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/proj-1/characters/create?draftId=char-1&treeNodeId=tree-node-1',
  );

  fireEvent.click(screen.getByRole('button', {name: 'Повторить генерацию'}));

  await waitFor(() => expect(mockedApi.generateInitial).toHaveBeenCalledTimes(2));
  expect(mockedApi.create).toHaveBeenCalledTimes(1);
  expect(mockedApi.generateInitial.mock.calls[0][1]).toBe('char-1');
  expect(mockedApi.generateInitial.mock.calls[1][1]).toBe('char-1');
  expect(mockedApi.generateInitial.mock.calls[0][3]).not.toBe(mockedApi.generateInitial.mock.calls[1][3]);
  expect(await screen.findByText(
    '/project/proj-1/characters/char-1/variants?jobId=job-retry&treeNodeId=tree-node-1',
  )).toBeInTheDocument();
});

test('restores the failed draft from the URL after refresh instead of creating a duplicate', async () => {
  const firstRender = renderPage();
  fireEvent.change(screen.getByLabelText('character-name'), {target: {value: 'Hero'}});
  fireEvent.change(screen.getByLabelText('appearance-description'), {target: {value: 'Tall warrior'}});
  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));
  await screen.findByText('provider failed');
  firstRender.unmount();

  renderPage('/project/proj-1/characters/create?draftId=char-1&treeNodeId=tree-node-1');
  expect(await screen.findByDisplayValue('Hero')).toBeInTheDocument();
  expect(await screen.findByDisplayValue('Tall warrior')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));

  expect(await screen.findByText(
    '/project/proj-1/characters/char-1/variants?jobId=job-retry&treeNodeId=tree-node-1',
  )).toBeInTheDocument();
  expect(mockedApi.create).toHaveBeenCalledTimes(1);
  expect(mockedApi.update).toHaveBeenCalledTimes(1);
  expect(mockedApi.generateInitial).toHaveBeenCalledTimes(2);
  expect(mockedApi.generateInitial.mock.calls[1][1]).toBe('char-1');
});
test('removes the durable draft id from the URL after deleting the draft', async () => {
  renderPage();
  fireEvent.change(screen.getByLabelText('character-name'), {target: {value: 'Hero'}});
  fireEvent.change(screen.getByLabelText('appearance-description'), {target: {value: 'Tall warrior'}});
  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));
  await screen.findByText('provider failed');

  fireEvent.click(screen.getByRole('button', {name: 'Удалить черновик'}));

  await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('proj-1', 'char-1'));
  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/project/proj-1/characters/create?treeNodeId=tree-node-1',
    ),
  );
  expect(screen.getByTestId('location')).not.toHaveTextContent('draftId=');
});
test('clears a legacy navigation-state character id when deleting the draft', async () => {
  renderPage({
    pathname: '/project/proj-1/characters/create',
    search: '?draftId=char-1&treeNodeId=tree-node-1',
    state: {characterId: 'char-1', sourceTreeNodeId: 'tree-node-1'},
  });
  expect(await screen.findByDisplayValue('Hero')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));
  await screen.findByText('provider failed');
  fireEvent.click(screen.getByRole('button', {name: 'Удалить черновик'}));

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/project/proj-1/characters/create?treeNodeId=tree-node-1',
    ),
  );
  expect(screen.getByTestId('location-state')).not.toHaveTextContent('characterId');
  expect(mockedApi.create).not.toHaveBeenCalled();
  expect(mockedApi.update).toHaveBeenCalledTimes(1);
  expect(mockedApi.delete).toHaveBeenCalledWith('proj-1', 'char-1');
});

test('includes the selected image model in the generation payload and navigation state', async () => {
  mockedApi.generateInitial.mockReset().mockResolvedValue({
    data: {job_id: 'job-selected-model', status: 'queued'},
  } as never);
  renderPage();

  fireEvent.click(screen.getByRole('button', {name: 'Выбрать GPT Image'}));
  fireEvent.change(screen.getByLabelText('character-name'), {target: {value: 'Hero'}});
  fireEvent.change(screen.getByLabelText('appearance-description'), {target: {value: 'Tall warrior'}});
  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));

  await waitFor(() => expect(mockedApi.generateInitial).toHaveBeenCalledTimes(1));
  expect(mockedApi.generateInitial.mock.calls[0][2]).toEqual(expect.objectContaining({
    image_model: 'openrouter-images:openai/gpt-image-1',
  }));
  expect(await screen.findByTestId('location-state')).toHaveTextContent(
    '"imageModel":"openrouter-images:openai/gpt-image-1"',
  );
});

test('retries and navigates with the exact options used by the failed attempt', async () => {
  mockedApi.generateInitial
    .mockReset()
    .mockResolvedValueOnce({
      data: {job_id: 'job-failed', status: 'failed', error_message: 'provider failed'},
    } as never)
    .mockResolvedValueOnce({
      data: {job_id: 'job-retry', status: 'queued'},
    } as never);
  renderPage();

  fireEvent.click(screen.getByRole('button', {name: 'Выбрать GPT Image'}));
  fireEvent.change(screen.getByLabelText('character-name'), {target: {value: 'Hero'}});
  fireEvent.change(screen.getByLabelText('appearance-description'), {target: {value: 'Tall warrior'}});
  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));
  expect(await screen.findByText('provider failed')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Выбрать FLUX'}));
  fireEvent.click(screen.getByRole('button', {name: 'Повторить генерацию'}));

  await waitFor(() => expect(mockedApi.generateInitial).toHaveBeenCalledTimes(2));
  expect(mockedApi.generateInitial.mock.calls[0][2]).toEqual(expect.objectContaining({
    image_model: 'openrouter-images:openai/gpt-image-1',
  }));
  expect(mockedApi.generateInitial.mock.calls[1][2]).toEqual(expect.objectContaining({
    image_model: 'openrouter-images:openai/gpt-image-1',
  }));
  expect(await screen.findByText(
    '/project/proj-1/characters/char-1/variants?jobId=job-retry&treeNodeId=tree-node-1',
  )).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location-state')).toHaveTextContent(
    '"imageModel":"openrouter-images:openai/gpt-image-1"',
  ));
  expect(screen.getByTestId('location-state')).not.toHaveTextContent(
    'openrouter-images:black-forest-labs/flux.2-pro',
  );
});
