import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import Character3DEditorPage from './Character3DEditorPage';

const route = {projectId: 'project-a', characterId: 'char-a'};

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({...route}),
}));
jest.mock('../hooks/useProjectIdFromRoute', () => ({
  useProjectIdFromRoute: () => route.projectId,
}));
jest.mock('../hooks/useCharacter', () => ({
  useCharacter: () => ({
    character: {character_id: route.characterId, project_id: 1, name: route.characterId, identity_locked: false},
  }),
}));
jest.mock('../../../api/http', () => ({backendAssetUrl: (url: string) => url}));
jest.mock('antd', () => ({
  message: {error: jest.fn(), success: jest.fn()},
}));
jest.mock('../api/characterApi');
jest.mock('../components/character3d/CharacterCategoryRail', () => () => null);
jest.mock('../components/character3d/ContextualZonePanel', () => () => null);
jest.mock('../components/character3d/ReferenceDock', () => () => null);
jest.mock('../components/character3d/StepperHeader', () => () => null);
jest.mock('../components/character3d/CharacterViewport', () => function MockCharacterViewport(
  {zoneParams}: {zoneParams: unknown},
) {
  return <div data-testid="zone-params">{JSON.stringify(zoneParams)}</div>;
});
jest.mock('../components/character3d/BottomQuickBar', () => function MockBottomQuickBar(
  {onSave, saveDisabled}: {onSave: () => void; saveDisabled?: boolean},
) {
  return <button type="button" onClick={onSave} disabled={saveDisabled}>Сохранить 3D</button>;
});

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {promise, reject, resolve};
}

function modelResponse(headSize: number) {
  return {
    data: {
      params: {head_neck: {headSize}},
      autofit_done: true,
      autofit_version: 7,
      reconstruction: {
        status: 'missing',
        progress: 0,
        job_id: null,
        asset_id: null,
        model_url: null,
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  route.projectId = 'project-a';
  route.characterId = 'char-a';
  mockedApi.saveModel3D.mockResolvedValue({data: {}} as never);
});

test('discards late model parameters from route A after route B has loaded', async () => {
  const loadA = deferred<ReturnType<typeof modelResponse>>();
  const loadB = deferred<ReturnType<typeof modelResponse>>();
  mockedApi.getModel3D.mockImplementation((_projectId, characterId) => (
    characterId === 'char-a' ? loadA.promise : loadB.promise
  ) as never);

  const view = render(<Character3DEditorPage />);
  route.projectId = 'project-b';
  route.characterId = 'char-b';
  view.rerender(<Character3DEditorPage />);

  await act(async () => {
    loadB.resolve(modelResponse(0.2));
  });
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));

  await act(async () => {
    loadA.resolve(modelResponse(0.8));
  });
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2');
  expect(screen.getByTestId('zone-params')).not.toHaveTextContent('"headSize":0.8');
});

test('resets parameters and blocks Save when loading route B fails', async () => {
  const loadB = deferred<ReturnType<typeof modelResponse>>();
  mockedApi.getModel3D.mockImplementation((_projectId, characterId) => (
    characterId === 'char-a' ? Promise.resolve(modelResponse(0.8)) : loadB.promise
  ) as never);

  const view = render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.8'));

  route.projectId = 'project-b';
  route.characterId = 'char-b';
  view.rerender(<Character3DEditorPage />);
  expect(screen.getByTestId('zone-params')).not.toHaveTextContent('"headSize":0.8');
  expect(screen.getByRole('button', {name: 'Сохранить 3D'})).toBeDisabled();

  await act(async () => {
    loadB.reject(new Error('load failed'));
  });
  await waitFor(() => expect(screen.getByRole('button', {name: 'Сохранить 3D'})).toBeDisabled());
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить 3D'}));
  expect(mockedApi.saveModel3D).not.toHaveBeenCalled();
});