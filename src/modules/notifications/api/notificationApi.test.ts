import api from '../../../api/http';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  parseNotificationList,
} from './notificationApi';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const unread = {
  id: 1,
  type: 'generation.completed',
  title: 'Generation completed',
  message: 'Shot 12 is ready.',
  created_at: '2026-08-30T12:00:00Z',
  is_read: false,
  target_url: '/project/7/video',
};

describe('notificationApi', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
  });

  it('parses the notification list contract and keeps the backend unread total', () => {
    expect(parseNotificationList({results: [unread], unread_count: 3})).toEqual({
      results: [unread],
      unread_count: 3,
    });
  });

  it('accepts a legacy bare array and ignores malformed rows', () => {
    expect(parseNotificationList([unread, {id: 2}])).toEqual({
      results: [unread],
      unread_count: 1,
    });
  });

  it('loads notifications from the shared authenticated client', async () => {
    mockedApi.get.mockResolvedValueOnce({data: {results: [unread], unread_count: 1}} as never);

    await expect(fetchNotifications()).resolves.toEqual({results: [unread], unread_count: 1});
    expect(mockedApi.get).toHaveBeenCalledWith('api/notifications/');
  });

  it('marks one or all notifications read and tolerates an empty response', async () => {
    mockedApi.post
      .mockResolvedValueOnce({data: unread} as never)
      .mockResolvedValueOnce({data: undefined} as never);

    await expect(markNotificationRead('notification/id')).resolves.toEqual(unread);
    expect(mockedApi.post).toHaveBeenNthCalledWith(
      1,
      'api/notifications/notification%2Fid/read/',
    );
    await expect(markAllNotificationsRead()).resolves.toBe(0);
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, 'api/notifications/read-all/');
  });
});
