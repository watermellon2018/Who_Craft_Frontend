import {act, renderHook, waitFor} from '@testing-library/react';

import type {MessagingHistory} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import {messagingApi} from './api';
import {useConversation} from './useConversation';
import {conversation, conversationId, deferred, history, message, secondConversationId} from './testFixtures';

jest.mock('../../api/http', () => ({getAuthGeneration: jest.fn(() => 1), getStoredUserToken: () => 'token'}));
jest.mock('./api', () => ({
  messagingApi: {history: jest.fn(), changes: jest.fn(), read: jest.fn()},
  messagingErrorStatus: (error: {response?: {status?: number}}) => error?.response?.status,
}));

const api = messagingApi as jest.Mocked<typeof messagingApi>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (getAuthGeneration as jest.Mock).mockReturnValue(1);
  api.history.mockResolvedValue(history());
  api.changes.mockResolvedValue({items: [], conversation: conversation(), next_revision: 1, has_more: false});
});

afterEach(() => {jest.useRealTimers();});

it('reconciles delayed old history against unseen edits and keeps the independent polling cursor', async () => {
  const oldPage = deferred<MessagingHistory>();
  const initialConversation = conversation({revision: 100, last_sequence: 100});
  api.history.mockResolvedValueOnce(history({items: [message(51), message(100)], conversation: initialConversation, next_before: 51, sync_revision: 100}))
    .mockImplementationOnce(() => oldPage.promise);
  api.changes.mockResolvedValue({items: [message(25, {version: 101, text: '', deleted_at: '2026-09-26T11:00:00Z'})], next_revision: 101, has_more: false, conversation: {...initialConversation, revision: 101}});
  const update = jest.fn();
  const {result} = renderHook(() => useConversation(conversationId, 1, update));
  await waitFor(() => expect(result.current.snapshot?.revision).toBe(100));
  act(() => {void result.current.loadMore();});
  await act(async () => {jest.advanceTimersByTime(3000);});
  expect(result.current.snapshot?.messages.map((item) => item.sequence)).toEqual([51, 100]);
  await act(async () => {oldPage.resolve(history({items: [message(1), message(25), message(50)], conversation: initialConversation, sync_revision: 100}));});
  expect(result.current.snapshot?.messages.find((item) => item.id === 25)?.text).toBe('');
  expect(result.current.snapshot?.messages.find((item) => item.id === 25)?.deleted_at).not.toBeNull();
  expect(result.current.snapshot?.revision).toBe(101);
  await act(async () => {jest.advanceTimersByTime(3000);});
  expect(api.changes.mock.calls[1][1]).toBe(101);
});

it('ignores a late response after switching conversation or account', async () => {
  const first = deferred<MessagingHistory>();
  api.history.mockImplementationOnce(() => first.promise).mockResolvedValueOnce(history({conversation: conversation({id: secondConversationId}), items: [message(2, {conversation_id: secondConversationId})]}));
  const update = jest.fn();
  const {result, rerender} = renderHook(({id}) => useConversation(id, 1, update), {initialProps: {id: conversationId}});
  rerender({id: secondConversationId});
  await waitFor(() => expect(result.current.snapshot?.conversation.id).toBe(secondConversationId));
  await act(async () => {first.resolve(history());});
  expect(result.current.snapshot?.conversation.id).toBe(secondConversationId);
  (getAuthGeneration as jest.Mock).mockReturnValue(2);
  await act(async () => {jest.advanceTimersByTime(3000);});
  expect(api.changes).not.toHaveBeenCalled();
});

it('does not mark history read just because it was loaded and retries only explicit visible reads', async () => {
  const focus = jest.spyOn(document, 'hasFocus').mockReturnValue(false);
  api.read.mockResolvedValue(conversation({read_through: 1, unread_count: 0}));
  const update = jest.fn();
  const {result} = renderHook(() => useConversation(conversationId, 1, update));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api.read).not.toHaveBeenCalled();
  await act(async () => {await result.current.markRead(1);});
  expect(api.read).not.toHaveBeenCalled();
  focus.mockReturnValue(true);
  await act(async () => {await result.current.markRead(1);});
  expect(result.current.snapshot?.conversation.read_through).toBe(1);
  await act(async () => {await result.current.markRead(1);});
  expect(api.read).toHaveBeenCalledTimes(1);
  focus.mockRestore();
});
