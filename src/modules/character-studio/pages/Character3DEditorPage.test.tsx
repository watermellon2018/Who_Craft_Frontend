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
    onGestureStart,
    onGestureEnd,
    reconstructedHeadUrl,
    zoneParams,
  }: {
    onParameterChange: (zoneId: string, paramId: string, value: number, side?: 'L' | 'R') => void;
    onGestureStart: () => void;
    onGestureEnd: () => void;
    reconstructedHeadUrl: string | null;
    zoneParams: unknown;
  },
) {
  return <>
    <div data-testid="zone-params">{JSON.stringify(zoneParams)}</div>
    <div data-testid="head-url">{reconstructedHeadUrl}</div>
    <button type="button" onClick={onGestureStart}>Start drag</button>
    <button type="button" onClick={onGestureEnd}>End drag</button>
    <button type="button" onClick={() => onParameterChange('head_neck', 'headSize', 0.9)}>Edit 3D</button>
    <button type="button" onClick={() => onParameterChange('head_neck', 'headSize', 0.7)}>Continue drag</button>
    <button type="button" onClick={() => onParameterChange('eyes', 'eyeSize', 1, 'L')}>Asymmetric change</button>
    <button type="button" onClick={() => onParameterChange('hair', 'hairLength', -1)}>Hair below range</button>
  </>;
});
jest.mock('../components/character3d/BottomQuickBar', () => function MockBottomQuickBar(
  {onSave, saveDisabled, onUndo, canUndo, onReset, onCancel}: {
    onSave: () => void; saveDisabled?: boolean; onUndo: () => void; canUndo: boolean;
    onReset: () => void; onCancel: () => void;
  },
) {
  return <>
    <button type="button" onClick={onSave} disabled={saveDisabled}>Сохранить 3D</button>
    <button type="button" onClick={onUndo} disabled={!canUndo}>Undo 3D</button>
    <button type="button" onClick={onReset}>Reset 3D</button>
    <button type="button" onClick={onCancel}>Cancel 3D</button>
  </>;
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
  mockedApi.listRevisions.mockResolvedValue({data: [{revision_id: 'rev-a', revision_number: 108, after_snapshot: {model3d_params: {head_neck: {headSize: .1}}}}]} as never);
  mockedApi.restoreRevision.mockResolvedValue({data: {}} as never);
});

test('restoring a saved revision reloads its model and parameters and resets undo/baselines', async () => {
  const restored = modelResponse(.1);
  Object.assign(restored.data.reconstruction, {status: 'ready', asset_id: 'asset-restored', model_url: '/restored.glb'});
  mockedApi.getModel3D.mockResolvedValueOnce(modelResponse(.2) as never).mockResolvedValueOnce(restored as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  const details = screen.getByText('Сохранённые версии 3D').closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByRole('option', {name: /#108/});
  fireEvent.change(screen.getByRole('combobox'), {target: {value: 'rev-a'}});
  fireEvent.click(screen.getByText('Восстановить версию'));
  await waitFor(() => expect(screen.getByTestId('head-url')).toHaveTextContent('/restored.glb?asset=asset-restored'));
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.1');
  expect(screen.getByRole('button', {name: 'Undo 3D'})).toBeDisabled();
  expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(false);
});

test('each mouse gesture is one undo unit even with a pause or an immediate next gesture', async () => {
  mockedApi.getModel3D.mockResolvedValue(modelResponse(.2) as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  fireEvent.click(screen.getByText('Start drag'));
  fireEvent.click(screen.getByText('Edit 3D'));
  now.mockReturnValue(5000);
  fireEvent.click(screen.getByText('Continue drag'));
  fireEvent.click(screen.getByText('End drag'));
  now.mockReturnValue(5001);
  fireEvent.click(screen.getByText('Start drag'));
  fireEvent.click(screen.getByText('Edit 3D'));
  fireEvent.click(screen.getByText('End drag'));
  fireEvent.click(screen.getByText('Undo 3D'));
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.7');
  fireEvent.click(screen.getByText('Undo 3D'));
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2');
  expect(screen.getByText('Undo 3D')).toBeDisabled();
  now.mockRestore();
});

test('rejects unsupported asymmetric writes and clamps numeric changes to the registry', async () => {
  mockedApi.getModel3D.mockResolvedValue(modelResponse(.2) as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  fireEvent.click(screen.getByText('Asymmetric change'));
  expect(screen.getByTestId('zone-params')).not.toHaveTextContent('__L');
  expect(screen.getByText('Undo 3D')).toBeDisabled();
  fireEvent.click(screen.getByText('Hair below range'));
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"hairLength":0,');
});

test('saved revision restore refuses to discard unsaved edits', async () => {
  mockedApi.getModel3D.mockResolvedValue(modelResponse(.2) as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  const details = screen.getByText('Сохранённые версии 3D').closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByRole('option', {name: /#108/});
  fireEvent.change(screen.getByRole('combobox'), {target: {value: 'rev-a'}});
  fireEvent.click(screen.getByText('Edit 3D'));
  expect(screen.getByText('Восстановить версию')).toBeDisabled();
  expect(screen.getByText('Сохраните текущие изменения или отмените их перед восстановлением версии.')).toBeVisible();
  expect(mockedApi.restoreRevision).not.toHaveBeenCalled();
});

async function chooseSavedRevision() {
  const details = screen.getByText('Сохранённые версии 3D').closest('details') as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByRole('option', {name: /#108/});
  await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
  fireEvent.change(screen.getByRole('combobox'), {target: {value: 'rev-a'}});
  return details;
}

test('refreshing history during restore cannot unlock model writes, reset, cancel or undo', async () => {
  const restore = deferred<{data: unknown}>();
  const reload = deferred<ReturnType<typeof modelResponse>>();
  const list = deferred<{data: unknown}>();
  mockedApi.getModel3D.mockResolvedValueOnce(modelResponse(.2) as never).mockImplementationOnce(() => reload.promise as never);
  mockedApi.restoreRevision.mockImplementation(() => restore.promise as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  fireEvent.click(screen.getByText('Edit 3D'));
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить 3D'}));
  await waitFor(() => expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(false));
  expect(screen.getByText('Undo 3D')).not.toBeDisabled();
  const details = await chooseSavedRevision();
  mockedApi.listRevisions.mockImplementation(() => list.promise as never);
  fireEvent.click(screen.getByText('Восстановить версию'));
  details.open = false;
  fireEvent(details, new Event('toggle'));
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await act(async () => { list.resolve({data: [{revision_id: 'rev-a', revision_number: 108, after_snapshot: {model3d_params: {}}}]}); });
  expect(screen.getByRole('button', {name: 'Сохранить 3D'})).toBeDisabled();
  expect(screen.getByText('Восстановить версию')).toBeDisabled();
  const snapshot = screen.getByTestId('zone-params').textContent;
  fireEvent.click(screen.getByText('Reset 3D'));
  fireEvent.click(screen.getByText('Cancel 3D'));
  fireEvent.click(screen.getByText('Continue drag'));
  fireEvent.click(screen.getByText('Apply 3D'));
  fireEvent.keyDown(window, {key: 'z', ctrlKey: true});
  expect(screen.getByTestId('zone-params').textContent).toBe(snapshot);
  await act(async () => { restore.resolve({data: {}}); });
  // The mutation remains exclusive during the authoritative reload too.
  expect(screen.getByRole('button', {name: 'Сохранить 3D'})).toBeDisabled();
  fireEvent.click(screen.getByText('Reset 3D'));
  expect(screen.getByTestId('zone-params').textContent).toBe(snapshot);
  await act(async () => { reload.resolve(modelResponse(.1)); });
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.1');
  expect(screen.getByText('Undo 3D')).toBeDisabled();
  expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(false);
});

test('restore waits for both the initial model load and its autofit', async () => {
  const initial = deferred<ReturnType<typeof modelResponse>>();
  const autofit = deferred<ReturnType<typeof modelResponse>>();
  mockedApi.getModel3D.mockImplementationOnce(() => initial.promise as never).mockResolvedValueOnce(modelResponse(.1) as never);
  mockedApi.autofitModel3D.mockImplementation(() => autofit.promise as never);
  render(<Character3DEditorPage />);
  await chooseSavedRevision();
  const restoreButton = screen.getByText('Восстановить версию');
  expect(restoreButton).toBeDisabled();
  fireEvent.click(restoreButton);
  expect(mockedApi.restoreRevision).not.toHaveBeenCalled();
  const old = modelResponse(.2);
  old.data.autofit_version = 6;
  await act(async () => { initial.resolve(old); });
  expect(mockedApi.autofitModel3D).toHaveBeenCalledTimes(1);
  expect(restoreButton).toBeDisabled();
  fireEvent.click(screen.getByText('Edit 3D'));
  fireEvent.click(screen.getByText('Reset 3D'));
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2');
  await act(async () => { autofit.resolve(modelResponse(.3)); });
  expect(restoreButton).not.toBeDisabled();
  fireEvent.click(restoreButton);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.1'));
  expect(mockedApi.restoreRevision).toHaveBeenCalledTimes(1);
});

test('an outstanding Save cannot race a restore or accept concurrent parameter edits', async () => {
  const save = deferred<{data: unknown}>();
  mockedApi.getModel3D.mockResolvedValue(modelResponse(.2) as never);
  mockedApi.saveModel3D.mockImplementation(() => save.promise as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  await chooseSavedRevision();
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить 3D'}));
  expect(screen.getByText('Восстановить версию')).toBeDisabled();
  fireEvent.click(screen.getByText('Edit 3D'));
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2');
  expect(mockedApi.restoreRevision).not.toHaveBeenCalled();
  await act(async () => { save.resolve({data: {}}); });
  expect(screen.getByText('Восстановить версию')).not.toBeDisabled();
});

test('a reconstruction poll started before restoration cannot replace the restored asset', async () => {
  const poll = deferred<ReturnType<typeof modelResponse>>();
  const initial = modelResponse(.2);
  Object.assign(initial.data.reconstruction, {status: 'processing', job_id: 'job-old'});
  const restored = modelResponse(.1);
  Object.assign(restored.data.reconstruction, {status: 'ready', asset_id: 'restored', model_url: '/restored.glb'});
  mockedApi.getModel3D.mockResolvedValueOnce(initial as never)
    .mockImplementationOnce(() => poll.promise as never)
    .mockResolvedValueOnce(restored as never);
  render(<Character3DEditorPage />);
  await waitFor(() => expect(mockedApi.getModel3D).toHaveBeenCalledTimes(2));
  await chooseSavedRevision();
  fireEvent.click(screen.getByText('Восстановить версию'));
  await waitFor(() => expect(screen.getByTestId('head-url')).toHaveTextContent('/restored.glb?asset=restored'));
  const stale = modelResponse(.9);
  Object.assign(stale.data.reconstruction, {status: 'ready', asset_id: 'stale', model_url: '/stale.glb'});
  await act(async () => { poll.resolve(stale); });
  expect(screen.getByTestId('head-url')).toHaveTextContent('/restored.glb?asset=restored');
  expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.1');
});

test('failed model reload after persisted restore blocks saving the stale local model', async () => {
  mockedApi.getModel3D.mockResolvedValueOnce(modelResponse(.2) as never).mockRejectedValueOnce(new Error('reload failed'));
  render(<Character3DEditorPage />);
  await waitFor(() => expect(screen.getByTestId('zone-params')).toHaveTextContent('"headSize":0.2'));
  const details = screen.getByText('Сохранённые версии 3D').closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByRole('option', {name: /#108/});
  fireEvent.change(screen.getByRole('combobox'), {target: {value: 'rev-a'}});
  fireEvent.click(screen.getByText('Восстановить версию'));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert')).toHaveTextContent('Версия восстановлена, но модель не загрузилась. Обновите страницу.');
  expect(screen.getByRole('button', {name: 'Сохранить 3D'})).toBeDisabled();
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
