import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import Cookies from 'js-cookie';
import React from 'react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import {clearStoredUserToken} from '../../../api/http';
import {logoutAllSessions} from '../api/profileApi';
import SecurityCard from './SecurityCard';

jest.mock('../../../api/http', () => ({
  clearStoredUserToken: jest.fn(),
}));

jest.mock('../api/profileApi', () => ({
  logoutAllSessions: jest.fn(),
}));

const mockedClearStoredUserToken = clearStoredUserToken as jest.MockedFunction<typeof clearStoredUserToken>;
const mockedLogoutAllSessions = logoutAllSessions as jest.MockedFunction<typeof logoutAllSessions>;

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/profile/settings']}>
      <Routes>
        <Route path="/profile/settings" element={<SecurityCard />} />
        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SecurityCard', () => {
  let removeCookieSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    removeCookieSpy = jest.spyOn(Cookies, 'remove').mockImplementation(() => undefined);
  });

  afterEach(() => {
    removeCookieSpy.mockRestore();
  });

  it('requires confirmation before ending sessions', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', {name: 'Выйти со всех устройств'}));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(/Все активные сеансы WCraft будут завершены/)).toBeInTheDocument();
    expect(mockedLogoutAllSessions).not.toHaveBeenCalled();
  });

  it('invalidates sessions, clears credentials, and replaces the route after confirmation', async () => {
    mockedLogoutAllSessions.mockResolvedValueOnce();
    renderCard();

    fireEvent.click(screen.getByRole('button', {name: 'Выйти со всех устройств'}));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Выйти'}));

    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(mockedLogoutAllSessions).toHaveBeenCalledTimes(1);
    expect(mockedClearStoredUserToken).toHaveBeenCalledTimes(1);
    expect(removeCookieSpy).toHaveBeenCalledWith('token');
  });

  it('keeps local credentials when the server cannot invalidate sessions', async () => {
    mockedLogoutAllSessions.mockRejectedValueOnce(new Error('network'));
    renderCard();

    fireEvent.click(screen.getByRole('button', {name: 'Выйти со всех устройств'}));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', {name: 'Выйти'}));

    await waitFor(() => expect(mockedLogoutAllSessions).toHaveBeenCalledTimes(1));
    expect(mockedClearStoredUserToken).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
