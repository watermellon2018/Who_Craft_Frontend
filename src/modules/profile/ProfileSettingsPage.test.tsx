import {fireEvent, render, screen, within} from '@testing-library/react';
import Cookies from 'js-cookie';
import React from 'react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import {clearStoredUserToken} from '../../api/http';
import {deleteAccount, fetchSettings} from './api/profileApi';
import AccountDeletionCard from './components/AccountDeletionCard';
import ProfileSettingsPage from './ProfileSettingsPage';

jest.mock('../../api/http', () => ({
  __esModule: true,
  clearStoredUserToken: jest.fn(),
  default: {delete: jest.fn(), get: jest.fn(), patch: jest.fn()},
  logout: jest.fn(async () => undefined),
}));

jest.mock('../../api/errors', () => ({
  getApiErrorCode: (error: {code?: string}) => error.code ?? null,
}));

jest.mock('./api/profileApi', () => ({
  deleteAccount: jest.fn(),
  fetchSettings: jest.fn(),
  logoutAllSessions: jest.fn(),
  updateSettings: jest.fn(),
}));

const mockedDeleteAccount = deleteAccount as jest.MockedFunction<typeof deleteAccount>;
const mockedFetchSettings = fetchSettings as jest.MockedFunction<typeof fetchSettings>;
const mockedClearStoredUserToken = clearStoredUserToken as jest.MockedFunction<typeof clearStoredUserToken>;

const settingsResponse = {
  comment_permission: 'everyone' as const,
  content_language: 'ru' as const,
  language: 'ru' as const,
  notifications_email: false,
  notifications_in_app: true,
  private_account: false,
};

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/settings']}>
      <ProfileSettingsPage />
    </MemoryRouter>,
  );
}

function renderDeleteCard() {
  return render(
    <MemoryRouter initialEntries={['/profile/settings']}>
      <Routes>
        <Route path="/profile/settings" element={<AccountDeletionCard />} />
        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openDeleteModal() {
  fireEvent.click(screen.getByRole('button', {name: 'Удалить аккаунт'}));
  return screen.getByRole('dialog');
}

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and renders all existing settings on the dedicated page', async () => {
    mockedFetchSettings.mockResolvedValueOnce(settingsResponse);

    renderSettingsPage();

    expect(await screen.findByText('Цветовая тема')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Настройки', level: 1})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Язык интерфейса'})).toBeInTheDocument();
    expect(screen.queryByRole('combobox', {name: 'Язык контента'})).not.toBeInTheDocument();
    expect(screen.getByRole('switch', {name: 'Закрытый аккаунт'})).toBeInTheDocument();
    expect(screen.getByRole('switch', {name: 'В интерфейсе'})).toBeInTheDocument();
    expect(screen.getByRole('switch', {name: 'По email'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Безопасность'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Настройки/})).toHaveAttribute('aria-current', 'page');
  });

  it('shows a retry state and loads settings after retry', async () => {
    mockedFetchSettings
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(settingsResponse);

    renderSettingsPage();

    expect(await screen.findByText('Не удалось загрузить настройки. Попробуйте ещё раз.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Повторить'}));

    expect(await screen.findByText('Цветовая тема')).toBeInTheDocument();
    expect(mockedFetchSettings).toHaveBeenCalledTimes(2);
  });
});

describe('AccountDeletionCard', () => {
  let removeCookieSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    removeCookieSpy = jest.spyOn(Cookies, 'remove').mockImplementation(() => undefined);
  });

  afterEach(() => {
    removeCookieSpy.mockRestore();
  });

  it('keeps confirmation disabled while the password is empty', () => {
    renderDeleteCard();
    const modal = openDeleteModal();

    expect(within(modal).getByRole('button', {name: 'Удалить аккаунт'})).toBeDisabled();
    expect(within(modal).getByLabelText('Текущий пароль')).toHaveAttribute('autocomplete', 'current-password');
  });

  it.each([
    ['ACCOUNT_DELETE_PASSWORD_INVALID', 'Пароль неверный. Проверьте его и попробуйте ещё раз.'],
    ['ACCOUNT_HAS_OWNED_PROJECTS', 'Сначала передайте другому пользователю или удалите все проекты, которыми вы владеете.'],
  ])('shows an inline error for %s', async (code, expectedMessage) => {
    mockedDeleteAccount.mockRejectedValueOnce({code});
    renderDeleteCard();
    const modal = openDeleteModal();
    const password = within(modal).getByLabelText('Текущий пароль');

    fireEvent.change(password, {target: {value: 'wrong-password'}});
    fireEvent.click(within(modal).getByRole('button', {name: 'Удалить аккаунт'}));

    expect(await within(modal).findByRole('alert')).toHaveTextContent(expectedMessage);
    expect(mockedClearStoredUserToken).not.toHaveBeenCalled();
  });

  it('clears current and legacy credentials and replaces the route after success', async () => {
    mockedDeleteAccount.mockResolvedValueOnce();
    renderDeleteCard();
    const modal = openDeleteModal();

    fireEvent.change(within(modal).getByLabelText('Текущий пароль'), {
      target: {value: 'correct-password'},
    });
    fireEvent.click(within(modal).getByRole('button', {name: 'Удалить аккаунт'}));

    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(mockedDeleteAccount).toHaveBeenCalledWith('correct-password');
    expect(mockedClearStoredUserToken).toHaveBeenCalledTimes(1);
    expect(removeCookieSpy).toHaveBeenCalledWith('token');
  });
});
