import React from 'react';
import {act, render, renderHook, screen} from '@testing-library/react';

import type {MessagingConversationList, MessagingUnread} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import {messagingApi} from './api';
import {MessagingUnreadBadge} from './MessagingUnreadBadge';
import {useConversations} from './useConversations';
import {conversation, deferred} from './testFixtures';

jest.mock('../../api/http', () => ({getAuthGeneration: jest.fn(() => 1), getStoredUserToken: () => 'token', AUTH_EXPIRED_EVENT: 'expired'}));
jest.mock('./api', () => ({messagingApi: {unread: jest.fn(), conversations: jest.fn()}}));

const api = messagingApi as jest.Mocked<typeof messagingApi>;
beforeEach(() => {jest.useFakeTimers(); jest.clearAllMocks(); (getAuthGeneration as jest.Mock).mockReturnValue(1);});
afterEach(() => {jest.useRealTimers();});

it('displays unread counts even when requests take longer than the polling interval', async () => {
  const first = deferred<MessagingUnread>();
  const next = deferred<MessagingUnread>();
  api.unread.mockImplementationOnce(() => first.promise).mockImplementation(() => next.promise);
  render(<MessagingUnreadBadge />);
  await act(async () => {jest.advanceTimersByTime(15000);});
  expect(api.unread).toHaveBeenCalledTimes(1);
  await act(async () => {first.resolve({unread_count: 7});});
  expect(screen.getByLabelText('7 непрочитанных сообщений')).toHaveTextContent('7');
  expect(api.unread).toHaveBeenCalledTimes(2);
});

it('finishes a slow conversation-list request instead of aborting it on each poll', async () => {
  const first = deferred<MessagingConversationList>();
  const next = deferred<MessagingConversationList>();
  api.conversations.mockImplementationOnce(() => first.promise).mockImplementation(() => next.promise);
  const {result} = renderHook(() => useConversations(1));
  await act(async () => {jest.advanceTimersByTime(15000);});
  expect(api.conversations).toHaveBeenCalledTimes(1);
  await act(async () => {first.resolve({items: [conversation()], total: 1, unread_count: 1, offset: 0, limit: 50});});
  expect(result.current.items[0]?.peer.display_name).toBe('Alice');
  expect(result.current.loading).toBe(false);
  expect(api.conversations).toHaveBeenCalledTimes(2);
});
