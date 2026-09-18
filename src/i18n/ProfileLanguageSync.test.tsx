import {cleanup, render, waitFor} from '@testing-library/react';
import React from 'react';

import * as profileApi from '../modules/profile/api/profileApi';
import i18n from './index';
import ProfileLanguageSync from './ProfileLanguageSync';

describe('ProfileLanguageSync', () => {
  beforeEach(() => {
    window.localStorage.setItem('authToken', 'test-access-token');
  });

  afterEach(async () => {
    cleanup();
    jest.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    await i18n.changeLanguage('ru');
  });

  it('applies the authenticated profile language globally', async () => {
    jest.spyOn(profileApi, 'fetchSettings').mockResolvedValue({
      language: 'en',
      content_language: 'ru',
      private_account: false,
      notifications_in_app: true,
      notifications_email: true,
      comment_permission: 'everyone',
    });
    await i18n.changeLanguage('ru');

    render(<ProfileLanguageSync><span>Private UI</span></ProfileLanguageSync>);

    await waitFor(() => expect(document.body).toHaveTextContent('Private UI'));
    expect(i18n.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps the locally selected language when settings cannot be loaded', async () => {
    jest.spyOn(profileApi, 'fetchSettings').mockRejectedValue(new Error('offline'));
    await i18n.changeLanguage('en');

    render(<ProfileLanguageSync><span>Local UI</span></ProfileLanguageSync>);

    await waitFor(() => expect(document.body).toHaveTextContent('Local UI'));
    expect(profileApi.fetchSettings).toHaveBeenCalledTimes(1);
    expect(i18n.resolvedLanguage).toBe('en');
  });

  it('does not delay the auth redirect when there is no stored token', () => {
    window.localStorage.clear();
    const fetchSettings = jest.spyOn(profileApi, 'fetchSettings');

    render(<ProfileLanguageSync><span>Auth gate</span></ProfileLanguageSync>);

    expect(document.body).toHaveTextContent('Auth gate');
    expect(fetchSettings).not.toHaveBeenCalled();
  });
});
