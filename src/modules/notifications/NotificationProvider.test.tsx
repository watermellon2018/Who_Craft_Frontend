import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';

import {getStoredUserToken} from '../../api/http';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './api/notificationApi';
import {NotificationProvider, useNotificationCenter} from './NotificationProvider';
import type {NotificationItem, NotificationTransport} from './types';

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

const historical: NotificationItem = {
  id: 1,
  type: 'comment.created',
  title: 'New comment',
  message: 'Someone commented on your video.',
  created_at: '2026-08-30T12:00:00Z',
  is_read: false,
};

const Probe = () => {
  const center = useNotificationCenter();
  return (
    <div>
      <span data-testid="count">{center?.unreadCount}</span>
      <span data-testid="items">{center?.notifications.length}</span>
      <button type="button" onClick={() => void center?.markRead(1)}>read</button>
      <button type="button" onClick={() => void center?.markAllRead()}>read all</button>
    </div>
  );
};

describe('NotificationProvider', () => {
  beforeEach(() => {
    mockedGetToken.mockReturnValue('access');
    mockedFetch.mockReset();
    mockedMarkRead.mockReset();
    mockedMarkAll.mockReset();
  });

  it('hydrates historical notifications without showing realtime toast', async () => {
    mockedFetch.mockResolvedValueOnce({results: [historical], unread_count: 1});
    const toast = jest.fn();

    render(
      <NotificationProvider onRealtimeNotification={toast}>
        <Probe />
      </NotificationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(screen.getByTestId('items')).toHaveTextContent('1');
    expect(toast).not.toHaveBeenCalled();
  });

  it('adds and toasts only a fresh event supplied by a transport', async () => {
    mockedFetch.mockResolvedValueOnce({results: [historical], unread_count: 1});
    let listener: ((notification: NotificationItem) => void) | undefined;
    const transport: NotificationTransport = {
      subscribe: (next) => {
        listener = next;
        return jest.fn();
      },
    };
    const toast = jest.fn();

    render(
      <NotificationProvider transport={transport} onRealtimeNotification={toast}>
        <Probe />
      </NotificationProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1'));

    const fresh: NotificationItem = {...historical, id: 2, title: 'Fresh event'};
    act(() => listener?.(fresh));

    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(screen.getByTestId('items')).toHaveTextContent('2');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(fresh);
  });

  it('marks one and all notifications read without sending duplicate requests', async () => {
    mockedFetch.mockResolvedValueOnce({results: [historical], unread_count: 1});
    let finishRead: ((value: NotificationItem | null) => void) | undefined;
    mockedMarkRead.mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve; }));
    mockedMarkAll.mockResolvedValueOnce(0);

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    act(() => {
      screen.getByRole('button', {name: 'read'}).click();
      screen.getByRole('button', {name: 'read'}).click();
    });
    expect(mockedMarkRead).toHaveBeenCalledTimes(1);

    await act(async () => finishRead?.({...historical, is_read: true}));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
  });
});
