import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import Character3DEditorPage from './Character3DEditorPage';

const route = {projectId: 'project-a', characterId: 'char-a'};
const mockUnsavedChangesGuard = jest.fn();

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
jest.mock('../../../utils/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: (dirty: boolean) => {
    mockUnsavedChangesGuard(dirty);
    return {allowNextNavigation: jest.fn()};
  },
}));
jest.mock('antd', () => ({
  message: {error: jest.fn(), success: jest.fn()},
}));
jest.mock('../api/characterApi');
jest.mock('../components/character3d/CharacterCategoryRail', () => () => null);
jest.mock('../components/character3d/ContextualZonePanel', () => function MockContextualZonePanel(
  {hasChanges, onApply}: {hasChanges: boolean; onApply: () => void},
) {
  return <>
    <span data-testid="unapplied">{hasChanges ? 'yes' : 'no'}</span>
    <button type="button" onClick={onApply}>Apply 3D</button>
  </>;
});
jest.mock('../components/character3d/ReferenceDock', () => () => null);
jest.mock('../components/character3d/StepperHeader', () => () => null);
jest.mock('../components/character3d/CharacterViewport', () => function MockCharacterViewport(
  {
    onParameterChange,
    zoneParams,
  }: {
    onParameterChange: (zoneId: string, paramId: string, value: number) => void;
    zoneParams: unknown;
  },
) {
  return <>
    <div data-testid="zone-params">{JSON.stringify(zoneParams)}</div>
    <button type="button" onClick={() => onParameterChange('head_neck', 'headSize', 0.9)}>Edit 3D</button>
  </>;
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

test('keeps applied parameters dirty until they are persisted', async () => {
  mockedApi.getModel3D.mockResolvedValue(modelResponse(0.2) as never);

  render(<Character3DEditorPage />);
  const saveButton = await screen.findByRole('button', {
    name: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c 3D',
  });
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(false);

  fireEvent.click(screen.getByRole('button', {name: 'Edit 3D'}));
  expect(screen.getByTestId('unapplied')).toHaveTextContent('yes');
  expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(true);

  fireEvent.click(screen.getByRole('button', {name: 'Apply 3D'}));
  expect(screen.getByTestId('unapplied')).toHaveTextContent('no');
  expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(true);

  fireEvent.click(saveButton);
  await waitFor(() => expect(mockedApi.saveModel3D).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(false));
});
