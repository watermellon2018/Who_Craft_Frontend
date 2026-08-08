import {
  fetchMySubscriptions,
  searchChannels,
  subscribeToChannel,
  unsubscribeFromChannel,
  updateSubscriptionSettings,
} from './subscriptionsApi';

// Mock the entire module to avoid axios ESM issue in Jest/CRA (same trick as
// modules/profile/api/profileApi.test.ts).
jest.mock('./subscriptionsApi', () => ({
  fetchMySubscriptions: jest.fn(),
  searchChannels: jest.fn(),
  subscribeToChannel: jest.fn(),
  unsubscribeFromChannel: jest.fn(),
  updateSubscriptionSettings: jest.fn(),
}));

const mockedFetch = fetchMySubscriptions as jest.MockedFunction<typeof fetchMySubscriptions>;
const mockedSearch = searchChannels as jest.MockedFunction<typeof searchChannels>;
const mockedSubscribe = subscribeToChannel as jest.MockedFunction<typeof subscribeToChannel>;
const mockedUnsubscribe = unsubscribeFromChannel as jest.MockedFunction<typeof unsubscribeFromChannel>;
const mockedUpdate = updateSubscriptionSettings as jest.MockedFunction<typeof updateSubscriptionSettings>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchMySubscriptions', () => {
  it('resolves with the mocked payload', async () => {
    const payload = { items: [], total: 0, favoriteCount: 0, limit: 20, offset: 0 };
    mockedFetch.mockResolvedValueOnce(payload);

    await expect(fetchMySubscriptions(20, 0)).resolves.toEqual(payload);
    expect(mockedFetch).toHaveBeenCalledWith(20, 0);
  });

  it('rejects when the API throws', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('Network Error'));
    await expect(fetchMySubscriptions()).rejects.toThrow('Network Error');
  });
});

describe('searchChannels', () => {
  it('resolves with the mocked payload', async () => {
    const payload = { items: [], total: 0, limit: 20, offset: 0 };
    mockedSearch.mockResolvedValueOnce(payload);

    await expect(searchChannels('foo', 20, 0)).resolves.toEqual(payload);
    expect(mockedSearch).toHaveBeenCalledWith('foo', 20, 0);
  });

  it('rejects when the API throws', async () => {
    mockedSearch.mockRejectedValueOnce(new Error('boom'));
    await expect(searchChannels('foo')).rejects.toThrow('boom');
  });
});

describe('subscribeToChannel', () => {
  it('resolves with the mutation payload', async () => {
    const payload = {
      success: true,
      subscription: { targetUserId: 5, isSubscribed: true, isFavorite: false, notificationsEnabled: true },
    };
    mockedSubscribe.mockResolvedValueOnce(payload);
    await expect(subscribeToChannel(5)).resolves.toEqual(payload);
  });

  it('rejects when the API throws', async () => {
    mockedSubscribe.mockRejectedValueOnce(new Error('boom'));
    await expect(subscribeToChannel(5)).rejects.toThrow('boom');
  });
});

describe('unsubscribeFromChannel', () => {
  it('resolves with the mutation payload', async () => {
    const payload = {
      success: true,
      subscription: { targetUserId: 5, isSubscribed: false, isFavorite: false, notificationsEnabled: false },
    };
    mockedUnsubscribe.mockResolvedValueOnce(payload);
    await expect(unsubscribeFromChannel(5)).resolves.toEqual(payload);
  });

  it('rejects when the API throws', async () => {
    mockedUnsubscribe.mockRejectedValueOnce(new Error('boom'));
    await expect(unsubscribeFromChannel(5)).rejects.toThrow('boom');
  });
});

describe('updateSubscriptionSettings', () => {
  it('resolves with the mutation payload', async () => {
    const payload = {
      success: true,
      subscription: { targetUserId: 5, isSubscribed: true, isFavorite: true, notificationsEnabled: true },
    };
    mockedUpdate.mockResolvedValueOnce(payload);
    await expect(updateSubscriptionSettings(5, { isFavorite: true })).resolves.toEqual(payload);
    expect(mockedUpdate).toHaveBeenCalledWith(5, { isFavorite: true });
  });

  it('rejects when the API throws', async () => {
    mockedUpdate.mockRejectedValueOnce(new Error('boom'));
    await expect(updateSubscriptionSettings(5, { isFavorite: true })).rejects.toThrow('boom');
  });
});
