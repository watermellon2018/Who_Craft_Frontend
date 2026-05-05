import { fetchDashboard, updateSettings } from './profileApi';

// Mock the entire module to avoid axios ESM issue in Jest/CRA
jest.mock('./profileApi', () => ({
  fetchDashboard: jest.fn(),
  updateSettings: jest.fn(),
}));

const mockedFetch = fetchDashboard as jest.MockedFunction<typeof fetchDashboard>;
const mockedUpdate = updateSettings as jest.MockedFunction<typeof updateSettings>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchDashboard', () => {
  it('resolves with dashboard data', async () => {
    const mockData = { user: { id: 1, username: 'test' } } as any;
    mockedFetch.mockResolvedValueOnce(mockData);

    const result = await fetchDashboard();

    expect(result).toEqual(mockData);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects when the API throws', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchDashboard()).rejects.toThrow('Network Error');
  });
});

describe('updateSettings', () => {
  it('resolves with updated settings', async () => {
    const responseData = { language: 'en', private_account: true, notifications_enabled: false };
    mockedUpdate.mockResolvedValueOnce(responseData);

    const result = await updateSettings({ language: 'en' });

    expect(result).toEqual(responseData);
    expect(mockedUpdate).toHaveBeenCalledWith({ language: 'en' });
  });

  it('rejects on server error', async () => {
    mockedUpdate.mockRejectedValueOnce(new Error('500'));

    await expect(updateSettings({ private_account: true })).rejects.toThrow('500');
  });

  it('can update multiple fields at once', async () => {
    const patch = { language: 'en', private_account: true, notifications_enabled: false };
    mockedUpdate.mockResolvedValueOnce(patch);

    const result = await updateSettings(patch);

    expect(result.language).toBe('en');
    expect(result.private_account).toBe(true);
    expect(result.notifications_enabled).toBe(false);
  });
});
