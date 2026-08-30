import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import {getStoredUserToken} from '../../api/http';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './api/notificationApi';
import NotificationBell, {safeNotificationTarget} from './NotificationBell';
import {NotificationProvider} from './NotificationProvider';
import type {NotificationItem} from './types';

jest.mock('../../api/http', () => ({
  getStoredUserToken: jest.fn(),
}));

jest.mock('./api/notificationApi', () => ({
  fetchNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

const mockedGetToken = getStoredUserToken as jest.MockedFunction<typeof getStoredUserToken>;
const mockedFetch = fetchNotifications as jest.MockedFunction<typeof fetchNotifications>;
const mockedMarkRead = markNotificationRead as jest.MockedFunction<typeof markNotificationRead>;
const mockedMarkAll = markAllNotificationsRead as jest.MockedFunction<typeof markAllNotificationsRead>;

const item: NotificationItem = {
  id: 8,
  type: 'generation.completed',
  title: 'Generation completed',
  message: 'Shot 12 is ready.',
  created_at: new Date().toISOString(),
  is_read: false,
  target_url: '/project/7/video?shot=12',
};

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
};

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <NotificationProvider>
        <NotificationBell />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </NotificationProvider>
    </MemoryRouter>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    mockedGetToken.mockReturnValue('access');
    mockedFetch.mockReset();
    mockedMarkRead.mockReset();
    mockedMarkAll.mockReset();
  });

  it('hides the badge at zero and shows the empty state', async () => {
    mockedFetch.mockResolvedValueOnce({results: [], unread_count: 0});
    renderBell();

    const bell = await screen.findByRole('button', {name: 'Открыть уведомления'});
    expect(document.querySelector('.ant-badge-count')).not.toBeInTheDocument();
    fireEvent.click(bell);
    expect(await screen.findByText('Новых уведомлений нет')).toBeInTheDocument();
  });

  it('shows unread count, marks an item read, and navigates to a safe target', async () => {
    mockedFetch.mockResolvedValueOnce({results: [item], unread_count: 1});
    mockedMarkRead.mockResolvedValueOnce({...item, is_read: true});
    renderBell();

    const bell = await screen.findByRole('button', {name: 'Открыть уведомления. Непрочитанных: 1'});
    await waitFor(() => expect(document.querySelector('.ant-badge-count')).toHaveTextContent('1'));
    fireEvent.click(bell);
    fireEvent.click(await screen.findByRole('button', {name: /Generation completed/}));

    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith(8));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/project/7/video?shot=12'));
  });

  it('marks every notification read from the popover action', async () => {
    mockedFetch.mockResolvedValueOnce({results: [item], unread_count: 1});
    mockedMarkAll.mockResolvedValueOnce(0);
    renderBell();

    fireEvent.click(await screen.findByRole('button', {name: 'Открыть уведомления. Непрочитанных: 1'}));
    fireEvent.click(await screen.findByRole('button', {name: /Отметить все как прочитанные/}));

    await waitFor(() => expect(mockedMarkAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector('.ant-badge-count')).not.toBeInTheDocument());
  });

  it('allows only internal or same-origin notification targets', () => {
    expect(safeNotificationTarget('/project/1?tab=video')).toBe('/project/1?tab=video');
    expect(safeNotificationTarget(`${window.location.origin}/profile#activity`)).toBe('/profile#activity');
    expect(safeNotificationTarget('https://attacker.example/steal')).toBeNull();
    expect(safeNotificationTarget('//attacker.example/steal')).toBeNull();
    expect(safeNotificationTarget('javascript:alert(1)')).toBeNull();
  });
});
