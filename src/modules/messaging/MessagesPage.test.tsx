import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import type {ModalFuncProps} from 'antd';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import {getAuthGeneration, getStoredUserToken} from '../../api/http';
import {craftModal} from '../../theme/CraftModalHost';
import {messagingApi} from './api';
import MessagesPage from './MessagesPage';
import {conversation, conversationId, history, message, secondConversationId} from './testFixtures';

jest.mock('../../api/http', () => ({
  getAuthGeneration: jest.fn(() => 1), getStoredUserToken: jest.fn(() => 'access'),
  backendAssetUrl: (path: string) => path, AUTH_EXPIRED_EVENT: 'expired',
}));
jest.mock('./api', () => ({
  messagingApi: {history: jest.fn(), changes: jest.fn(), read: jest.fn(), conversations: jest.fn(), users: jest.fn(), create: jest.fn(), send: jest.fn(), edit: jest.fn(), remove: jest.fn(), clear: jest.fn()},
  messagingErrorStatus: (error: {response?: {status?: number}}) => error?.response?.status,
}));
jest.mock('../profile/components/ProfileSidebar', () => function MockProfileSidebar() {return <div data-testid="sidebar" />;});
jest.mock('../../theme/CraftModalHost', () => ({craftModal: {confirm: jest.fn(() => ({destroy: jest.fn()}))}}));

const api = messagingApi as jest.Mocked<typeof messagingApi>;
const alice = conversation({last_message: message(1, {is_own: true}), unread_count: 0});
const bob = conversation({id: secondConversationId, peer: {id: 3, username: 'bob', display_name: 'Bob', avatar_url: null, is_active: true}, unread_count: 0});

function renderPage() {
  return render(<MemoryRouter initialEntries={[`/profile/messages/${conversationId}`]}><Routes>
    <Route path="/profile/messages/:conversationId?" element={<MessagesPage />} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (getAuthGeneration as jest.Mock).mockReturnValue(1);
  (getStoredUserToken as jest.Mock).mockReturnValue('access');
  api.conversations.mockResolvedValue({items: [alice, bob], total: 2, unread_count: 0, limit: 50, offset: 0});
  api.history.mockImplementation(async (id) => history({conversation: id === conversationId ? alice : bob, items: [message(1, {conversation_id: id, is_own: true})]}));
  api.changes.mockImplementation(async (id) => ({items: [], conversation: id === conversationId ? alice : bob, next_revision: 1, has_more: false}));
  api.users.mockResolvedValue({items: [], total: 0, limit: 30, offset: 0});
});

it('preserves failed drafts across conversations and retries the same send without another client id', async () => {
  api.send.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({message: message(2, {is_own: true, text: 'Keep this draft'}), conversation: {...alice, revision: 2, last_sequence: 2}});
  renderPage();
  const input = await screen.findByRole('textbox', {name: 'Написать сообщение'});
  fireEvent.change(input, {target: {value: 'Keep this draft'}});
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Отправить'}));});
  await screen.findByText(/Не удалось подтвердить отправку/);
  expect(input).toHaveValue('Keep this draft');
  fireEvent.click(screen.getByRole('link', {name: /Bob/}));
  await screen.findByRole('heading', {name: 'Bob'});
  expect(screen.getByRole('textbox', {name: 'Написать сообщение'})).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox', {name: 'Написать сообщение'}), {target: {value: 'Another conversation'}});
  fireEvent.click(screen.getByRole('link', {name: /Alice/}));
  await screen.findByRole('heading', {name: 'Alice'});
  expect(screen.getByRole('textbox', {name: 'Написать сообщение'})).toHaveValue('Keep this draft');
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Отправить'}));});
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Написать сообщение'})).toHaveValue(''));
  expect(api.send).toHaveBeenCalledTimes(2);
  expect(api.send.mock.calls[1][2]).toBe(api.send.mock.calls[0][2]);
  expect(screen.getByText('Keep this draft')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', {name: /Bob/}));
  await screen.findByRole('heading', {name: 'Bob'});
  expect(screen.getByRole('textbox', {name: 'Написать сообщение'})).toHaveValue('Another conversation');
});

it('allows editing own retained messages to an inactive peer while disabling new sends', async () => {
  const inactive = {...alice, can_send: false, peer: {...alice.peer, is_active: false, display_name: '', username: ''}};
  api.conversations.mockResolvedValue({items: [inactive], total: 1, unread_count: 0, limit: 50, offset: 0});
  api.history.mockResolvedValue(history({conversation: inactive, items: [message(1, {is_own: true})]}));
  api.edit.mockResolvedValue({message: message(1, {is_own: true, text: 'My revised message', edited_at: '2026-09-26T11:00:00Z', version: 2}), conversation: {...inactive, revision: 2}});
  renderPage();
  expect(await screen.findByRole('textbox', {name: 'Написать сообщение'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Отправить'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Редактировать сообщение'}));
  const editor = screen.getByRole('textbox', {name: 'Редактирование сообщения'});
  expect(editor).not.toBeDisabled();
  fireEvent.change(editor, {target: {value: 'My revised message'}});
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));});
  expect(within(screen.getByRole('list', {name: 'История сообщений'})).getByText('My revised message')).toBeInTheDocument();
  expect(api.send).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', {name: 'Написать сообщение'})).toBeDisabled();
  expect(screen.getByText('изменено')).toBeInTheDocument();
});

it('respects IME composition and Shift+Enter, validates blank text, and renders user text without HTML', async () => {
  api.history.mockResolvedValue(history({conversation: alice, items: [message(1, {text: '<img src=x onerror=alert(1)>'})]}));
  api.send.mockResolvedValue({message: message(2, {is_own: true}), conversation: {...alice, revision: 2, last_sequence: 2}});
  renderPage();
  const input = await screen.findByRole('textbox', {name: 'Написать сообщение'});
  expect(screen.getByText('<img src=x onerror=alert(1)>').querySelector('img')).toBeNull();
  expect(screen.queryByRole('button', {name: 'Редактировать сообщение'})).not.toBeInTheDocument();
  await act(async () => {fireEvent.keyDown(input, {key: 'Enter'});});
  expect(await screen.findByText('Введите текст сообщения.')).toBeInTheDocument();
  fireEvent.change(input, {target: {value: 'Some text'}});
  fireEvent.keyDown(input, {key: 'Enter', shiftKey: true});
  fireEvent.keyDown(input, {key: 'Enter', isComposing: true});
  fireEvent.keyDown(input, {key: 'Enter', keyCode: 229});
  expect(api.send).not.toHaveBeenCalled();
  await act(async () => {fireEvent.keyDown(input, {key: 'Enter'});});
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
});

it('requires a confirmation to delete an own message and replaces it with a tombstone', async () => {
  api.remove.mockResolvedValue({message: message(1, {is_own: true, text: '', deleted_at: '2026-09-26T11:00:00Z', version: 2}), conversation: {...alice, revision: 2}});
  renderPage();
  fireEvent.click(await screen.findByRole('button', {name: 'Удалить сообщение'}));
  expect(api.remove).not.toHaveBeenCalled();
  const config = (craftModal.confirm as jest.Mock).mock.calls[0][0] as ModalFuncProps;
  expect(config.title).toContain('обоих');
  await act(async () => {await config.onOk?.(); config.afterClose?.();});
  const historyList = screen.getByRole('list', {name: 'История сообщений'});
  expect(within(historyList).getByText('Сообщение удалено')).toBeInTheDocument();
  expect(within(historyList).queryByText('Message 1')).not.toBeInTheDocument();
});

it('clears the chat only after confirmation and removes the old history from view', async () => {
  api.clear.mockResolvedValue({...alice, is_hidden: true, cleared_through: 1, read_through: 1});
  renderPage();
  fireEvent.click(await screen.findByRole('button', {name: 'Удалить чат'}));
  expect(api.clear).not.toHaveBeenCalled();
  const config = (craftModal.confirm as jest.Mock).mock.calls[0][0] as ModalFuncProps;
  expect(config.content).toContain('У собеседника она останется');
  api.conversations.mockResolvedValue({items: [bob], total: 1, unread_count: 0, limit: 50, offset: 0});
  await act(async () => {await config.onOk?.(); config.afterClose?.();});
  expect(await screen.findByText('Ваши разговоры')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', {name: 'Написать сообщение'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link', {name: /Alice/})).not.toBeInTheDocument();
});
