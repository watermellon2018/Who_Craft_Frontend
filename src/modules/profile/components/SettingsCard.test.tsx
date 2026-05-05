import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SettingsCard from './SettingsCard';
import { ProfileSettings } from '../types';

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

describe('SettingsCard', () => {
  beforeEach(() => {
    mockUpdateSettings.mockReset();
  });

  it('renders current settings values', () => {
    render(<SettingsCard settings={defaultSettings} onChange={jest.fn()} />);
    expect(screen.getByText('Язык интерфейса')).toBeInTheDocument();
    expect(screen.getByText('Закрытый аккаунт')).toBeInTheDocument();
    expect(screen.getByText('Уведомления')).toBeInTheDocument();
  });

  it('calls updateSettings and onChange when private_account toggle changes', async () => {
    const updated: ProfileSettings = { ...defaultSettings, private_account: true };
    mockUpdateSettings.mockResolvedValueOnce(updated);
    const onChange = jest.fn();

    render(<SettingsCard settings={defaultSettings} onChange={onChange} />);

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

    render(<SettingsCard settings={defaultSettings} onChange={onChange} />);

    const switches = screen.getAllByRole('switch');
    await act(async () => { fireEvent.click(switches[1]); });

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ notifications_enabled: false });
    });
  });

  it('does not crash when updateSettings throws', async () => {
    mockUpdateSettings.mockRejectedValueOnce(new Error('Network error'));
    const onChange = jest.fn();

    render(<SettingsCard settings={defaultSettings} onChange={onChange} />);

    const switches = screen.getAllByRole('switch');
    await act(async () => { fireEvent.click(switches[0]); });

    await waitFor(() => { expect(onChange).not.toHaveBeenCalled(); });
    expect(screen.getByText('Закрытый аккаунт')).toBeInTheDocument();
  });

  it('renders "Перейти ко всем настройкам" button', () => {
    render(<SettingsCard settings={defaultSettings} onChange={jest.fn()} />);
    expect(screen.getByText('Перейти ко всем настройкам')).toBeInTheDocument();
  });
});
