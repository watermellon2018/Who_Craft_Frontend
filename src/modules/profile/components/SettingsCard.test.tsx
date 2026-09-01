import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {CraftThemeProvider} from '../../../theme/CraftThemeProvider';
import {CRAFT_THEME_STORAGE_KEY} from '../../../theme/craftTheme';
import {updateSettings} from '../api/profileApi';
import type {ProfileSettings} from '../types';
import SettingsCard from './SettingsCard';

jest.mock('../api/profileApi', () => ({
  updateSettings: jest.fn(),
}));

const mockedUpdateSettings = updateSettings as jest.MockedFunction<typeof updateSettings>;

const defaultSettings: ProfileSettings = {
  comment_permission: 'everyone',
  content_language: 'ru',
  language: 'ru',
  notifications_email: false,
  notifications_in_app: true,
  private_account: false,
};

function renderSettings(onChange: (updated: ProfileSettings) => void = jest.fn()) {
  return render(
    <MemoryRouter>
      <SettingsCard settings={defaultSettings} onChange={onChange} />
    </MemoryRouter>,
  );
}

describe('SettingsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.removeItem(CRAFT_THEME_STORAGE_KEY);
  });

  it('renders settings in the requested groups without content language', () => {
    renderSettings();

    expect(screen.getByRole('heading', {name: 'Оформление и интерфейс'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Уведомления'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Конфиденциальность и безопасность'})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Язык интерфейса'})).toBeInTheDocument();
    expect(screen.queryByRole('combobox', {name: 'Язык контента'})).not.toBeInTheDocument();
    expect(screen.getByRole('switch', {name: 'В интерфейсе'})).toBeChecked();
    expect(screen.getByRole('switch', {name: 'По email'})).not.toBeChecked();
    expect(screen.getByRole('switch', {name: 'Закрытый аккаунт'})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Кто может комментировать мои видео'}))
      .toBeInTheDocument();
  });

  it('changes and persists the interface theme without a backend request', () => {
    render(
      <MemoryRouter>
        <CraftThemeProvider>
          <SettingsCard settings={defaultSettings} onChange={jest.fn()} />
        </CraftThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Светлая'));

    expect(screen.getByLabelText('Светлая')).toBeChecked();
    expect(document.documentElement.dataset.craftTheme).toBe('light');
    expect(window.localStorage.getItem(CRAFT_THEME_STORAGE_KEY)).toBe('light');
    expect(mockedUpdateSettings).not.toHaveBeenCalled();
  });

  it.each([
    ['В интерфейсе', {notifications_in_app: false}],
    ['По email', {notifications_email: true}],
    ['Закрытый аккаунт', {private_account: true}],
  ])('sends an exact partial PATCH for %s', async (accessibleName, patch) => {
    mockedUpdateSettings.mockResolvedValueOnce({...defaultSettings, ...patch});
    renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', {name: accessibleName}));
    });

    await waitFor(() => expect(mockedUpdateSettings).toHaveBeenCalledWith(patch));
  });

  it('persists the selected comment permission', async () => {
    mockedUpdateSettings.mockResolvedValueOnce({...defaultSettings, comment_permission: 'followers'});
    renderSettings();

    fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Кто может комментировать мои видео'}));
    fireEvent.click(await screen.findByRole('option', {name: 'Подписчики'}));

    await waitFor(() => {
      expect(mockedUpdateSettings).toHaveBeenCalledWith({comment_permission: 'followers'});
    });
  });

  it('keeps the server value and reports an error when saving fails', async () => {
    mockedUpdateSettings.mockRejectedValueOnce(new Error('Network error'));
    const onChange = jest.fn();
    renderSettings(onChange);

    fireEvent.click(screen.getByRole('switch', {name: 'Закрытый аккаунт'}));

    await waitFor(() => expect(mockedUpdateSettings).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', {name: 'Закрытый аккаунт'})).not.toBeChecked();
  });

  it('disables every backend-backed control while a setting is being saved', async () => {
    let resolveSave: ((settings: ProfileSettings) => void) | undefined;
    mockedUpdateSettings.mockReturnValueOnce(new Promise((resolve) => {
      resolveSave = resolve;
    }));
    renderSettings();

    fireEvent.click(screen.getByRole('switch', {name: 'Закрытый аккаунт'}));

    expect(screen.getByRole('combobox', {name: 'Язык интерфейса'})).toBeDisabled();
    expect(screen.getByRole('switch', {name: 'В интерфейсе'})).toBeDisabled();
    expect(screen.getByRole('switch', {name: 'По email'})).toBeDisabled();
    expect(screen.getByRole('combobox', {name: 'Кто может комментировать мои видео'})).toBeDisabled();
    expect(screen.getByRole('radio', {name: 'Синяя'})).toBeDisabled();

    resolveSave?.({...defaultSettings, private_account: true});
    await waitFor(() => {
      expect(screen.getByRole('switch', {name: 'Закрытый аккаунт'})).not.toBeDisabled();
    });
  });

  it('keeps the Craft Wallet link unchanged', () => {
    renderSettings();

    expect(screen.getByRole('link', {name: 'Открыть кошелёк Craft'}))
      .toHaveAttribute('href', '/credits');
  });
});
