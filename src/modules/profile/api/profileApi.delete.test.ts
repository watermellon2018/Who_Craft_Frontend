import api from '../../../api/http';

import {deleteAccount, fetchSettings, logoutAllSessions, updateSettings} from './profileApi';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {delete: jest.fn(), get: jest.fn(), patch: jest.fn(), post: jest.fn()},
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('deleteAccount', () => {
  it('sends the current password in a DELETE request body', async () => {
    mockedApi.delete.mockResolvedValueOnce({status: 204});

    await deleteAccount('current-secret');

    expect(mockedApi.delete).toHaveBeenCalledWith('api/profile/me/', {
      data: {current_password: 'current-secret'},
    });
  });
});

describe('profile settings API', () => {
  const settings = {
    comment_permission: 'followers' as const,
    content_language: 'en' as const,
    language: 'ru' as const,
    notifications_email: false,
    notifications_in_app: true,
    private_account: false,
  };

  it('loads settings from the shared settings endpoint', async () => {
    mockedApi.get.mockResolvedValueOnce({data: settings});

    await expect(fetchSettings()).resolves.toEqual(settings);
    expect(mockedApi.get).toHaveBeenCalledWith('api/profile/settings/');
  });

  it('sends only the changed setting in PATCH', async () => {
    mockedApi.patch.mockResolvedValueOnce({data: settings});

    await updateSettings({content_language: 'en'});

    expect(mockedApi.patch).toHaveBeenCalledWith('api/profile/settings/', {
      content_language: 'en',
    });
  });

  it('uses the existing auth namespace to end every session', async () => {
    mockedApi.post.mockResolvedValueOnce({status: 204});

    await logoutAllSessions();

    expect(mockedApi.post).toHaveBeenCalledWith('api/auth/logout-all/');
  });
});
