import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';

import {
  createPersonalApiConnection,
  deletePersonalApiConnection,
  fetchPersonalApiSettings,
  refreshPersonalVideoModels,
  saveGenerationPreference,
  updatePersonalApiConnection,
} from '../api/personalApi';
import type {PersonalApiSettings as Settings} from '../api/personalApi';
import PersonalApiSettings from './PersonalApiSettings';

jest.mock('../api/personalApi', () => ({
  createPersonalApiConnection: jest.fn(),
  deletePersonalApiConnection: jest.fn(),
  fetchPersonalApiSettings: jest.fn(),
  refreshPersonalVideoModels: jest.fn(),
  saveGenerationPreference: jest.fn(),
  updatePersonalApiConnection: jest.fn(),
}));

const fetchSettings = fetchPersonalApiSettings as jest.MockedFunction<typeof fetchPersonalApiSettings>;
const refreshVideoModels = refreshPersonalVideoModels as jest.MockedFunction<typeof refreshPersonalVideoModels>;
const createConnection = createPersonalApiConnection as jest.MockedFunction<typeof createPersonalApiConnection>;
const updateConnection = updatePersonalApiConnection as jest.MockedFunction<typeof updatePersonalApiConnection>;
const deleteConnection = deletePersonalApiConnection as jest.MockedFunction<typeof deletePersonalApiConnection>;
const savePreference = saveGenerationPreference as jest.MockedFunction<typeof saveGenerationPreference>;

const settings: Settings = {
  connections: [
    {id: 'gemini-1', name: 'Gemini основной', provider: 'gemini', keyHint: '••••1234', isActive: true, version: 1, createdAt: '2026-09-26', updatedAt: '2026-09-26'},
    {id: 'openrouter-1', name: 'OpenRouter запасной', provider: 'openrouter', keyHint: '••••5678', isActive: true, version: 1, createdAt: '2026-09-26', updatedAt: '2026-09-26'},
  ],
  preferences: [
    {modality: 'text', source: 'platform', routes: []},
    {modality: 'video', source: 'platform', routes: []},
    {modality: 'image', source: 'personal', routes: [
      {connectionId: 'gemini-1', modelKey: 'gemini-image'},
      {connectionId: 'openrouter-1', modelKey: 'router-image'},
    ]},
  ],
  providers: [
    {id: 'gemini', label: 'Google Gemini', modalities: ['text', 'image', 'video']},
    {id: 'openrouter', label: 'OpenRouter', modalities: ['text', 'image']},
  ],
  models: [
    {key: 'gemini-image', label: 'Gemini Image', modality: 'image', providers: ['gemini'], operations: ['generate', 'edit'], isFree: false},
    {key: 'router-image', label: 'Router Image', modality: 'image', providers: ['openrouter'], operations: ['generate'], isFree: false},
    {key: 'router-free', label: 'Free text', modality: 'text', providers: ['openrouter'], operations: ['generate'], isFree: true},
    {key: 'veo-fast', label: 'Veo Fast', modality: 'video', providers: ['gemini'], operations: ['generate'], isFree: false},
    {key: 'veo-quality', label: 'Veo Quality', modality: 'video', providers: ['gemini'], operations: ['generate'], isFree: false},
  ],
  hasPaidSubscription: false,
  storageAvailable: true,
};

beforeEach(() => {
  jest.resetAllMocks();
  fetchSettings.mockResolvedValue(settings);
  savePreference.mockImplementation(async (modality, preference) => ({modality, ...preference}));
});

async function renderSettings() {
  render(<PersonalApiSettings />);
  await screen.findByRole('heading', {name: 'Мои подключения'});
}

it('saves a key once, displays only its hint and clears the editor without browser persistence', async () => {
  const storage = jest.spyOn(Storage.prototype, 'setItem');
  const secret = 'private-test-key-never-store';
  createConnection.mockResolvedValueOnce({...settings.connections[0], id: 'new-key', name: 'Мой второй Gemini', keyHint: '••••tore'});
  await renderSettings();
  fireEvent.click(screen.getByRole('button', {name: 'Добавить подключение'}));
  fireEvent.change(screen.getByLabelText('Название подключения'), {target: {value: 'Мой второй Gemini'}});
  fireEvent.change(screen.getByLabelText('API-ключ'), {target: {value: secret}});
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));

  expect(await screen.findByText('Подключение сохранено.')).toBeInTheDocument();
  expect(createConnection).toHaveBeenCalledWith({name: 'Мой второй Gemini', provider: 'gemini', apiKey: secret});
  expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
  expect(screen.getByText('••••tore')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Изменить подключение «Мой второй Gemini»'}));
  expect(screen.getByLabelText('Новый API-ключ')).toHaveValue('');
  expect(storage.mock.calls.some((call) => call.some((value) => String(value).includes(secret)))).toBe(false);
  storage.mockRestore();
});

it('discards the key when the editor is cancelled', async () => {
  await renderSettings();
  fireEvent.click(screen.getByRole('button', {name: 'Добавить подключение'}));
  fireEvent.change(screen.getByLabelText('API-ключ'), {target: {value: 'discard-me'}});
  fireEvent.click(screen.getByRole('button', {name: 'Отмена'}));
  fireEvent.click(screen.getByRole('button', {name: 'Добавить подключение'}));

  expect(screen.getByLabelText('API-ключ')).toHaveValue('');
  expect(createConnection).not.toHaveBeenCalled();
});

it('saves a reordered image priority without changing the text preference and allows an empty personal modality', async () => {
  await renderSettings();
  const images = within(screen.getByRole('region', {name: 'Изображения'}));
  const text = within(screen.getByRole('region', {name: 'Текст'}));
  fireEvent.click(images.getByRole('button', {name: 'Переместить вариант 2 выше'}));
  fireEvent.click(images.getByRole('button', {name: 'Сохранить настройки: Изображения'}));

  expect(await images.findByText('Настройки сохранены.')).toBeInTheDocument();
  expect(savePreference).toHaveBeenCalledWith('image', {source: 'personal', routes: [
    {connectionId: 'openrouter-1', modelKey: 'router-image'},
    {connectionId: 'gemini-1', modelKey: 'gemini-image'},
  ]});
  expect(text.getByRole('radio', {name: 'API Craft'})).toBeChecked();
  fireEvent.click(text.getByRole('radio', {name: 'Мой API'}));
  expect(text.getByText('Личная генерация этой модальности недоступна: добавьте подходящее подключение и модель.')).toBeInTheDocument();
  fireEvent.click(text.getByRole('button', {name: 'Сохранить настройки: Текст'}));

  expect(await text.findByText('Настройки сохранены.')).toBeInTheDocument();
  expect(savePreference).toHaveBeenLastCalledWith('text', {source: 'personal', routes: []});
});

it('offers only models compatible with the selected connection and modality', async () => {
  await renderSettings();
  const images = within(screen.getByRole('region', {name: 'Изображения'}));
  fireEvent.mouseDown(images.getByRole('combobox', {name: 'Модель 1'}));

  expect(await screen.findByRole('option', {name: 'Gemini Image'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: 'Router Image'})).not.toBeInTheDocument();
  expect(screen.queryByRole('option', {name: /Free text/})).not.toBeInTheDocument();
});

it('configures video priorities separately from image and text preferences', async () => {
  await renderSettings();
  const video = within(screen.getByRole('region', {name: 'Видео'}));
  fireEvent.click(video.getByRole('radio', {name: 'Мой API'}));
  fireEvent.click(video.getByRole('button', {name: 'Добавить в очередь'}));
  fireEvent.click(video.getByRole('button', {name: 'Добавить в очередь'}));
  fireEvent.click(video.getByRole('button', {name: 'Переместить вариант 2 выше'}));
  fireEvent.click(video.getByRole('button', {name: 'Сохранить настройки: Видео'}));

  expect(await video.findByText('Настройки сохранены.')).toBeInTheDocument();
  expect(savePreference).toHaveBeenCalledTimes(1);
  expect(savePreference).toHaveBeenCalledWith('video', {source: 'personal', routes: [
    {connectionId: 'gemini-1', modelKey: 'veo-quality'},
    {connectionId: 'gemini-1', modelKey: 'veo-fast'},
  ]});
  expect(within(screen.getByRole('region', {name: 'Текст'})).getByRole('radio', {name: 'API Craft'})).toBeChecked();
  const images = within(screen.getByRole('region', {name: 'Изображения'}));
  expect(images.getByRole('radio', {name: 'Мой API'})).toBeChecked();
  expect(images.getAllByRole('listitem')).toHaveLength(2);
});

it('offers video models only and excludes a connection without video support', async () => {
  await renderSettings();
  const video = within(screen.getByRole('region', {name: 'Видео'}));
  fireEvent.click(video.getByRole('radio', {name: 'Мой API'}));
  fireEvent.click(video.getByRole('button', {name: 'Добавить в очередь'}));
  fireEvent.mouseDown(video.getByRole('combobox', {name: 'Модель 1'}));

  expect(await screen.findByRole('option', {name: 'Veo Fast'})).toBeInTheDocument();
  expect(screen.getByRole('option', {name: 'Veo Quality'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: 'Gemini Image'})).not.toBeInTheDocument();
  expect(screen.queryByRole('option', {name: /Free text/})).not.toBeInTheDocument();
  fireEvent.keyDown(video.getByRole('combobox', {name: 'Модель 1'}), {key: 'Escape', code: 'Escape'});
  fireEvent.mouseDown(video.getByRole('combobox', {name: 'Подключение 1'}));
  expect(await screen.findByRole('option', {name: 'Gemini основной'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: 'OpenRouter запасной'})).not.toBeInTheDocument();
});

it('warns when a personal video preference has no supported connection', async () => {
  fetchSettings.mockResolvedValueOnce({...settings, connections: settings.connections.filter((connection) => connection.provider === 'openrouter')});
  await renderSettings();
  const video = within(screen.getByRole('region', {name: 'Видео'}));
  fireEvent.click(video.getByRole('radio', {name: 'Мой API'}));

  expect(video.getByText('Личная генерация этой модальности недоступна: добавьте подходящее подключение и модель.')).toBeInTheDocument();
  expect(video.getByRole('button', {name: 'Добавить в очередь'})).toBeDisabled();
});

it('refreshes the video catalogue only on request and preserves unsaved modality preferences', async () => {
  const refreshed = JSON.parse(JSON.stringify(settings)) as Settings;
  refreshed.models.push({key: 'router-video', label: 'OpenRouter Video', modality: 'video', providers: ['openrouter'], operations: ['generate'], isFree: false});
  refreshVideoModels.mockResolvedValueOnce(refreshed);
  await renderSettings();
  expect(refreshVideoModels).not.toHaveBeenCalled();
  const images = within(screen.getByRole('region', {name: 'Изображения'}));
  fireEvent.click(images.getByRole('button', {name: 'Переместить вариант 2 выше'}));
  const video = within(screen.getByRole('region', {name: 'Видео'}));
  fireEvent.click(video.getByRole('radio', {name: 'Мой API'}));
  fireEvent.click(video.getByRole('button', {name: 'Добавить в очередь'}));
  fireEvent.click(video.getByRole('button', {name: 'Обновить видеомодели'}));

  expect(await video.findByText('Каталог видеомоделей обновлён.')).toBeInTheDocument();
  expect(refreshVideoModels).toHaveBeenCalledTimes(1);
  expect(fetchSettings).toHaveBeenCalledTimes(1);
  expect(video.getByRole('radio', {name: 'Мой API'})).toBeChecked();
  expect(video.getAllByRole('listitem')).toHaveLength(1);
  expect(savePreference).not.toHaveBeenCalled();
  fireEvent.click(video.getByRole('button', {name: 'Сохранить настройки: Видео'}));
  await video.findByText('Настройки сохранены.');
  expect(savePreference).toHaveBeenLastCalledWith('video', {source: 'personal', routes: [{connectionId: 'gemini-1', modelKey: 'veo-fast'}]});
  fireEvent.click(images.getByRole('button', {name: 'Сохранить настройки: Изображения'}));
  await images.findByText('Настройки сохранены.');
  expect(savePreference).toHaveBeenLastCalledWith('image', {source: 'personal', routes: [
    {connectionId: 'openrouter-1', modelKey: 'router-image'}, {connectionId: 'gemini-1', modelKey: 'gemini-image'},
  ]});
  const connectionSelect = video.getByRole('combobox', {name: 'Подключение 1'});
  fireEvent.mouseDown(connectionSelect);
  expect(await screen.findByRole('option', {name: 'OpenRouter запасной'})).toBeInTheDocument();
  fireEvent.keyDown(connectionSelect, {key: 'ArrowDown', code: 'ArrowDown', keyCode: 40});
  fireEvent.keyDown(connectionSelect, {key: 'Enter', code: 'Enter', keyCode: 13});
  expect(video.getByText('OpenRouter Video')).toBeInTheDocument();
});

it('keeps video settings after a refresh error and allows retry without exposing the provider error', async () => {
  refreshVideoModels.mockRejectedValueOnce(new Error('secret-key-from-provider')).mockResolvedValueOnce(settings);
  await renderSettings();
  const video = within(screen.getByRole('region', {name: 'Видео'}));
  fireEvent.click(video.getByRole('radio', {name: 'Мой API'}));
  fireEvent.click(video.getByRole('button', {name: 'Обновить видеомодели'}));

  expect(await video.findByText('Не удалось обновить видеомодели. Проверьте подключение OpenRouter и повторите обновление.')).toBeInTheDocument();
  expect(screen.queryByText('secret-key-from-provider')).not.toBeInTheDocument();
  expect(video.getByRole('radio', {name: 'Мой API'})).toBeChecked();
  fireEvent.click(await video.findByRole('button', {name: 'Обновить видеомодели'}));
  expect(await video.findByText('Каталог видеомоделей обновлён.')).toBeInTheDocument();
  expect(video.queryByRole('alert')).not.toHaveTextContent('Не удалось обновить видеомодели');
  expect(refreshVideoModels).toHaveBeenCalledTimes(2);
});

it('does not offer catalogue refresh for an inactive OpenRouter connection', async () => {
  fetchSettings.mockResolvedValueOnce({...settings,
    connections: settings.connections.map((connection) => ({...connection, isActive: connection.provider !== 'openrouter'})),
  });
  await renderSettings();
  const video = within(screen.getByRole('region', {name: 'Видео'}));
  fireEvent.click(video.getByRole('radio', {name: 'Мой API'}));
  expect(video.queryByRole('button', {name: 'Обновить видеомодели'})).not.toBeInTheDocument();
});

it('retains a failed edit for retry and never displays raw server errors', async () => {
  createConnection.mockRejectedValueOnce(new Error('private-sensitive-key-from-upstream'));
  await renderSettings();
  fireEvent.click(screen.getByRole('button', {name: 'Добавить подключение'}));
  fireEvent.change(screen.getByLabelText('Название подключения'), {target: {value: 'Название'}});
  fireEvent.change(screen.getByLabelText('API-ключ'), {target: {value: 'user-secret'}});
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));

  expect(await screen.findByText('Не удалось сохранить изменения. Проверьте данные и повторите попытку.')).toBeInTheDocument();
  expect(screen.getByLabelText('Название подключения')).toHaveValue('Название');
  expect(screen.getByLabelText('API-ключ')).toHaveValue('user-secret');
  expect(screen.queryByText(/private-sensitive-key-from-upstream/)).not.toBeInTheDocument();
});

it('retries loading settings after a failure', async () => {
  fetchSettings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(settings);
  render(<PersonalApiSettings />);
  expect(await screen.findByText('Не удалось загрузить настройки генерации.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Повторить'}));

  expect(await screen.findByRole('heading', {name: 'Мои подключения'})).toBeInTheDocument();
  expect(fetchSettings).toHaveBeenCalledTimes(2);
});

it('reloads routes after confirmed key deletion and can still switch to Craft', async () => {
  deleteConnection.mockResolvedValueOnce();
  await renderSettings();
  fetchSettings.mockResolvedValueOnce({...settings,
    connections: settings.connections.filter((connection) => connection.id !== 'gemini-1'),
    preferences: settings.preferences.map((preference) => ({...preference,
      routes: preference.routes.filter((route) => route.connectionId !== 'gemini-1')})),
  });
  fireEvent.click(screen.getByRole('button', {name: 'Удалить подключение «Gemini основной»'}));
  expect(deleteConnection).not.toHaveBeenCalled();
  const confirmation = within(screen.getByRole('group', {name: 'Удалить сохранённый ключ?'}));
  fireEvent.click(confirmation.getByRole('button', {name: 'Удалить'}));

  expect(await screen.findByText('Подключение удалено.')).toBeInTheDocument();
  expect(deleteConnection).toHaveBeenCalledWith('gemini-1');
  expect(fetchSettings).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('switch', {name: 'Использовать подключение «Gemini основной»'})).not.toBeInTheDocument();
  const images = within(screen.getByRole('region', {name: 'Изображения'}));
  await waitFor(() => expect(images.getAllByRole('listitem')).toHaveLength(1));
  fireEvent.click(images.getByRole('radio', {name: 'API Craft'}));
  fireEvent.click(images.getByRole('button', {name: 'Сохранить настройки: Изображения'}));
  await images.findByText('Настройки сохранены.');
  expect(savePreference).toHaveBeenLastCalledWith('image', {source: 'platform', routes: [
    {connectionId: 'openrouter-1', modelKey: 'router-image'},
  ]});
});

it('keeps the confirmed active state when disabling a connection fails', async () => {
  updateConnection.mockRejectedValueOnce(new Error('offline'));
  await renderSettings();
  fireEvent.click(screen.getByRole('switch', {name: 'Использовать подключение «Gemini основной»'}));

  expect(await screen.findByText('Не удалось обновить подключение. Повторите попытку.')).toBeInTheDocument();
  expect(screen.getByRole('switch', {name: 'Использовать подключение «Gemini основной»'})).toBeChecked();
});
