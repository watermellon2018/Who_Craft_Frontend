import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';

import {
  createPersonalApiConnection,
  deletePersonalApiConnection,
  fetchPersonalApiSettings,
  saveGenerationPreference,
  updatePersonalApiConnection,
} from '../api/personalApi';
import type {PersonalApiSettings as Settings} from '../api/personalApi';
import PersonalApiSettings from './PersonalApiSettings';

jest.mock('../api/personalApi', () => ({
  createPersonalApiConnection: jest.fn(),
  deletePersonalApiConnection: jest.fn(),
  fetchPersonalApiSettings: jest.fn(),
  saveGenerationPreference: jest.fn(),
  updatePersonalApiConnection: jest.fn(),
}));

const fetchSettings = fetchPersonalApiSettings as jest.MockedFunction<typeof fetchPersonalApiSettings>;
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
    {modality: 'image', source: 'personal', routes: [
      {connectionId: 'gemini-1', modelKey: 'gemini-image'},
      {connectionId: 'openrouter-1', modelKey: 'router-image'},
    ]},
  ],
  providers: [
    {id: 'gemini', label: 'Google Gemini', modalities: ['text', 'image']},
    {id: 'openrouter', label: 'OpenRouter', modalities: ['text', 'image']},
  ],
  models: [
    {key: 'gemini-image', label: 'Gemini Image', modality: 'image', providers: ['gemini'], operations: ['generate', 'edit'], isFree: false},
    {key: 'router-image', label: 'Router Image', modality: 'image', providers: ['openrouter'], operations: ['generate'], isFree: false},
    {key: 'router-free', label: 'Free text', modality: 'text', providers: ['openrouter'], operations: ['generate'], isFree: true},
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
