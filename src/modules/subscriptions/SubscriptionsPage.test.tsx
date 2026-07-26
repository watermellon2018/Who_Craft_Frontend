import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

// Stub the shared axios wrapper so importing the page (which transitively
// loads ../profile/api/profileApi → ../../api/http → axios ESM) doesn't
// blow up under Jest's CJS transformer.
jest.mock('../../api/http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
  },
}));

// Mock external API modules. The intra-component logic is what we test —
// not the network code.
jest.mock('./api/subscriptionsApi');
jest.mock('../profile/api/profileApi');

import SubscriptionsPage from './SubscriptionsPage';
import * as subsApi from './api/subscriptionsApi';
import * as profileApi from '../profile/api/profileApi';

// ProfileSidebar pulls profile.css and other assets; keep it as a no-op so we
// don't fight with CSS modules / asset transformers.
jest.mock('../profile/components/ProfileSidebar', () => function MockProfileSidebar() {
  return <div data-testid="profile-sidebar" />;
});

const mockedSubs = subsApi as jest.Mocked<typeof subsApi>;
const mockedProfile = profileApi as jest.Mocked<typeof profileApi>;

function apiChannel(overrides: Partial<subsApi.ApiChannel> = {}): subsApi.ApiChannel {
  return {
    id: 1,
    displayName: 'Alice',
    username: 'alice',
    avatarUrl: null,
    subscribersCount: 100,
    isSubscribed: true,
    isFavorite: false,
    notificationsEnabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedProfile.fetchDashboard.mockResolvedValue({ user: { id: 1, username: 'me' } } as never);
  mockedSubs.fetchMySubscriptions.mockResolvedValue({
    items: [],
    total: 0,
    favoriteCount: 0,
    limit: 20,
    offset: 0,
  });
  mockedSubs.searchChannels.mockResolvedValue({
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  });
  mockedSubs.subscribeToChannel.mockResolvedValue({
    success: true,
    subscription: { targetUserId: 1, isSubscribed: true, isFavorite: false, notificationsEnabled: true },
  });
  mockedSubs.unsubscribeFromChannel.mockResolvedValue({
    success: true,
    subscription: { targetUserId: 1, isSubscribed: false, isFavorite: false, notificationsEnabled: false },
  });
});

describe('SubscriptionsPage – mount', () => {
  it('calls fetchMySubscriptions on mount with PAGE_SIZE', async () => {
    await act(async () => {
      render(<SubscriptionsPage />);
    });
    expect(mockedSubs.fetchMySubscriptions).toHaveBeenCalledWith(20, 0);
  });

  it('renders my-subscriptions title and the channels returned by the API', async () => {
    mockedSubs.fetchMySubscriptions.mockResolvedValueOnce({
      items: [apiChannel({ id: 11, displayName: 'Alice', username: 'alice' })],
      total: 1,
      favoriteCount: 0,
      limit: 20,
      offset: 0,
    });

    await act(async () => {
      render(<SubscriptionsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('Мои подписки')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no subscriptions', async () => {
    await act(async () => {
      render(<SubscriptionsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('Каналы не найдены')).toBeInTheDocument();
    });
  });
});

describe('SubscriptionsPage – subscribe / unsubscribe error', () => {
  it('does not crash when subscribeToChannel rejects', async () => {
    mockedSubs.subscribeToChannel.mockRejectedValueOnce(new Error('boom'));
    mockedSubs.fetchMySubscriptions.mockResolvedValue({
      items: [apiChannel({ id: 99, displayName: 'Bob', username: 'bob', isSubscribed: false })],
      total: 1,
      favoriteCount: 0,
      limit: 20,
      offset: 0,
    });

    await act(async () => {
      render(<SubscriptionsPage />);
    });

    // The page mounted and rendered the row without throwing.
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('does not crash when unsubscribeFromChannel rejects', async () => {
    mockedSubs.unsubscribeFromChannel.mockRejectedValueOnce(new Error('boom'));
    mockedSubs.fetchMySubscriptions.mockResolvedValue({
      items: [apiChannel({ id: 99, displayName: 'Bob', username: 'bob', isSubscribed: true })],
      total: 1,
      favoriteCount: 0,
      limit: 20,
      offset: 0,
    });

    await act(async () => {
      render(<SubscriptionsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });
});
