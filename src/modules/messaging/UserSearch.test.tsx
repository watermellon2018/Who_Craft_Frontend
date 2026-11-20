import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';

import type {MessagingUserList} from '../../api/generated/contracts';
import {messagingApi} from './api';
import {UserSearch} from './UserSearch';
import {conversation, deferred} from './testFixtures';

jest.mock('../../api/http', () => ({getAuthGeneration: () => 1, backendAssetUrl: (path: string) => path}));
jest.mock('./api', () => ({messagingApi: {users: jest.fn()}}));
const api = messagingApi as jest.Mocked<typeof messagingApi>;

beforeEach(() => {jest.useFakeTimers(); jest.clearAllMocks();});
afterEach(() => {jest.useRealTimers();});

it('discards a late search response after clearing or replacing its query', async () => {
  const previous = deferred<MessagingUserList>();
  api.users.mockImplementationOnce(() => previous.promise).mockResolvedValueOnce({items: [{...conversation().peer, id: 3, display_name: 'Bob', username: 'bob'}], total: 1, limit: 30, offset: 0});
  render(<UserSearch generation={1} opening={null} onOpen={jest.fn()}><p>Existing conversations</p></UserSearch>);
  const input = screen.getByRole('searchbox', {name: 'Найти собеседника'});
  fireEvent.change(input, {target: {value: '@al'}});
  await act(async () => {jest.advanceTimersByTime(350);});
  fireEvent.change(input, {target: {value: ''}});
  expect(screen.getByText('Existing conversations')).toBeInTheDocument();
  await act(async () => {previous.resolve({items: [conversation().peer], total: 1, limit: 30, offset: 0});});
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  fireEvent.change(input, {target: {value: 'bo'}});
  await act(async () => {jest.advanceTimersByTime(350);});
  expect(screen.getByRole('button', {name: 'Bob @bob'})).toBeInTheDocument();
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});
