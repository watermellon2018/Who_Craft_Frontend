import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import SettingsCard from './SettingsCard';
import type { ProfileSettings } from '../types';
import {CraftThemeProvider} from '../../../theme/CraftThemeProvider';
import {CRAFT_THEME_STORAGE_KEY} from '../../../theme/craftTheme';

const mockUpdateSettings = jest.fn();
jest.mock('../api/profileApi', () => ({
  fetchDashboard: jest.fn(),
  updateSettings: (...args: any[]) => mockUpdateSettings(...args),
}));

const defaultSettings: ProfileSettings = {
  language: 'ru',
  private_account: false,
  notifications_enabled: true,
};

const renderSettings = (onChange: (updated: ProfileSettings) => void = jest.fn()) => render(
  <MemoryRouter>
    <SettingsCard settings={defaultSettings} onChange={onChange} />
  </MemoryRouter>,
);

describe('SettingsCard', () => {
  beforeEach(() => {
    mockUpdateSettings.mockReset();
    window.localStorage.removeItem(CRAFT_THEME_STORAGE_KEY);
  });

  it('renders current settings values', () => {
    renderSettings();
    expect(screen.getByText('Язык интерфейса')).toBeInTheDocument();
    expect(screen.getByText('Закрытый аккаунт')).toBeInTheDocument();
    expect(screen.getByText('Уведомления')).toBeInTheDocument();
    expect(screen.getByText('Цветовая тема')).toBeInTheDocument();
    expect(screen.getByLabelText('Светлая')).toBeInTheDocument();
    expect(screen.getByLabelText('Синяя')).toBeChecked();
    expect(screen.getByLabelText('Тёмная')).toBeInTheDocument();
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
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('calls updateSettings and onChange when private_account toggle changes', async () => {
    const updated: ProfileSettings = { ...defaultSettings, private_account: true };
    mockUpdateSettings.mockResolvedValueOnce(updated);
    const onChange = jest.fn();

    renderSettings(onChange);

    const switches = screen.getAllByRole('switch');
    await act(async () => { fireEvent.click(switches[0]); });

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ private_account: true });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ private_account: true }));
    });
  });

  it('calls updateSettings when notifications toggle changes', async () => {
    const updated: ProfileSettings = { ...defaultSettings, notifications_enabled: false };
    mockUpdateSettings.mockResolvedValueOnce(updated);
    const onChange = jest.fn();

    renderSettings(onChange);

    const switches = screen.getAllByRole('switch');
    await act(async () => { fireEvent.click(switches[1]); });

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ notifications_enabled: false });
    });
  });

  it('does not crash when updateSettings throws', async () => {
    mockUpdateSettings.mockRejectedValueOnce(new Error('Network error'));
    const onChange = jest.fn();

    renderSettings(onChange);

    const switches = screen.getAllByRole('switch');
    await act(async () => { fireEvent.click(switches[0]); });

    await waitFor(() => { expect(onChange).not.toHaveBeenCalled(); });
    expect(screen.getByText('Закрытый аккаунт')).toBeInTheDocument();
  });

  it('renders "Перейти ко всем настройкам" button', () => {
    renderSettings();
    expect(screen.getByText('Перейти ко всем настройкам')).toBeInTheDocument();
  });

  it('links to the Craft wallet from settings', () => {
    renderSettings();

    expect(screen.getByRole('link', {name: 'Открыть кошелёк Craft'}))
      .toHaveAttribute('href', '/credits');
  });
});
