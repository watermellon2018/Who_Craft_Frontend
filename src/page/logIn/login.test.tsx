import React from 'react';
import type {RenderResult} from '@testing-library/react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import {login} from '../../api/auth/login';
import LoginPage from './login';

jest.mock('../../api/auth/login', () => ({
  login: jest.fn(),
}));

const mockedLogin = login as jest.MockedFunction<typeof login>;

function renderLogin(): RenderResult {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

function submitCredentials(): void {
  fireEvent.change(screen.getByLabelText('Имя пользователя'), {
    target: {value: 'alice'},
  });
  fireEvent.change(screen.getByLabelText('Пароль'), {
    target: {value: 'secret-password'},
  });
  fireEvent.click(screen.getByRole('button', {name: 'Войти'}));
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('shows invalid credentials for a 401 response', async () => {
    mockedLogin.mockRejectedValue({status: 401});
    renderLogin();

    submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверное имя пользователя или пароль',
    );
  });

  it('distinguishes server failures from transport failures', async () => {
    mockedLogin.mockRejectedValueOnce({status: 503});
    const first = renderLogin();
    submitCredentials();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Сервер временно недоступен',
    );
    first.unmount();

    mockedLogin.mockRejectedValueOnce({});
    renderLogin();
    submitCredentials();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось подключиться к серверу',
    );
  });

  it('uses sessionStorage when Remember me is unchecked', async () => {
    mockedLogin.mockResolvedValue({
      status: 200,
      access: 'session-access',
      refresh: 'session-refresh',
    });
    renderLogin();
    fireEvent.click(screen.getByRole('checkbox', {name: 'Запомнить меня'}));

    submitCredentials();

    await waitFor(() => {
      expect(sessionStorage.getItem('authToken')).toBe('session-access');
    });
    expect(sessionStorage.getItem('authRefreshToken')).toBe('session-refresh');
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('does not render an inactive forgot-password link', () => {
    renderLogin();

    expect(screen.queryByText('Забыли пароль?')).not.toBeInTheDocument();
  });
});
