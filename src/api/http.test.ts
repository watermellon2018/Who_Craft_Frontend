jest.mock('axios', () => {
    const requestUse = jest.fn();
    const responseUse = jest.fn();
    const api = {
        interceptors: {
            request: { use: requestUse },
            response: { use: responseUse },
        },
        request: jest.fn(),
        post: jest.fn(),
    };
    return {
        __esModule: true,
        default: {
            create: jest.fn(() => api),
            post: jest.fn(),
            __api: api,
        },
    };
});

import axios from 'axios';
import {
    AUTH_EXPIRED_EVENT,
    getAuthGeneration,
    getStoredRefreshToken,
    getStoredUserToken,
    logout,
    setStoredUserTokens,
} from './http';

const axiosTestDouble = axios as unknown as {
    post: jest.Mock;
    __api: {
        request: jest.Mock;
        post: jest.Mock;
        interceptors: { response: { use: jest.Mock }; request: { use: jest.Mock } };
    };
};
const mockAxiosPost = axiosTestDouble.post;
const mockApiRequest = axiosTestDouble.__api.request;
const mockApiPost = axiosTestDouble.__api.post;
const onRequest = axiosTestDouble.__api.interceptors.request.use.mock.calls[0][0] as (
    config: {headers: {set: jest.Mock}; expectedAuthGeneration?: number},
) => unknown;
const onResponseError = axiosTestDouble.__api.interceptors.response.use.mock.calls[0][1] as (
    error: unknown,
) => Promise<unknown>;

const AUTH_SESSION_STORAGE_KEY = 'wcraft:auth-session:v1';

function unauthorizedError(expectedAuthGeneration?: number) {
    return {
        response: { status: 401 },
        config: {
            url: 'api/profile/me/',
            expectedAuthGeneration,
            headers: { set: jest.fn() },
        },
    };
}

describe('queued private request ownership', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    it('refuses to attach another account credentials to a queued write', () => {
        setStoredUserTokens('first-access', 'first-refresh');
        const expectedAuthGeneration = getAuthGeneration();
        setStoredUserTokens('second-access', 'second-refresh');
        const headers = {set: jest.fn()};
        expect(() => onRequest({headers, expectedAuthGeneration})).toThrow('session');
        expect(headers.set).not.toHaveBeenCalled();
    });

    it('allows a queued write while the original session remains active', () => {
        setStoredUserTokens('access', 'refresh');
        const headers = {set: jest.fn()};
        onRequest({headers, expectedAuthGeneration: getAuthGeneration()});
        expect(headers.set).toHaveBeenCalledWith('X-User-Token', 'access');
    });

    it('keeps queued writes authorized after another tab refreshes the same login', () => {
        setStoredUserTokens('access', 'refresh');
        const before = getAuthGeneration();
        localStorage.setItem('authToken', 'rotated-access');
        localStorage.setItem('authRefreshToken', 'rotated-refresh');
        window.dispatchEvent(new StorageEvent('storage', {key: 'authToken', newValue: 'rotated-access'}));
        window.dispatchEvent(new StorageEvent('storage', {key: 'authRefreshToken', newValue: 'rotated-refresh'}));
        expect(getAuthGeneration()).toBe(before);
        const headers = {set: jest.fn()};
        onRequest({headers, expectedAuthGeneration: before});
        expect(headers.set).toHaveBeenCalledWith('X-User-Token', 'rotated-access');
    });

    it('detects another tab login synchronously before its storage event arrives', () => {
        setStoredUserTokens('access', 'refresh');
        const before = getAuthGeneration();
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'different-login');
        localStorage.setItem('authToken', 'other-account-access');
        localStorage.setItem('authRefreshToken', 'other-account-refresh');
        const headers = {set: jest.fn()};
        expect(() => onRequest({headers, expectedAuthGeneration: before})).toThrow('session');
        expect(headers.set).not.toHaveBeenCalled();
        expect(getAuthGeneration()).toBeGreaterThan(before);
    });

    it('rejects an account switch interleaved with access-token retrieval', () => {
        setStoredUserTokens('access', 'refresh');
        const expectedAuthGeneration = getAuthGeneration();
        const originalGetItem = Storage.prototype.getItem;
        let accessReads = 0;
        const storageRead = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
            if (this === localStorage && key === 'authToken') {
                accessReads += 1;
                // The first read locates token storage. Switch accounts before
                // the next read returns the credential, without a storage event.
                if (accessReads === 2) {
                    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'interleaved-login');
                    localStorage.setItem('authToken', 'other-account-access');
                    localStorage.setItem('authRefreshToken', 'other-account-refresh');
                }
            }
            return originalGetItem.call(this, key);
        });
        const headers = {set: jest.fn()};
        try {
            expect(() => onRequest({headers, expectedAuthGeneration})).toThrow('session');
            expect(accessReads).toBeGreaterThanOrEqual(2);
            expect(headers.set).not.toHaveBeenCalled();
        } finally {
            storageRead.mockRestore();
        }
    });

    it('notices login storage events once and ignores unrelated preferences', () => {
        setStoredUserTokens('access', 'refresh');
        const before = getAuthGeneration();
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'different-login');
        window.dispatchEvent(new StorageEvent('storage', {key: AUTH_SESSION_STORAGE_KEY}));
        expect(getAuthGeneration()).toBe(before + 1);
        const current = getAuthGeneration();
        window.dispatchEvent(new StorageEvent('storage', {key: 'unrelated-preference'}));
        expect(getAuthGeneration()).toBe(current);
    });

    it('detects cross-tab logout even before its storage event arrives', () => {
        setStoredUserTokens('access', 'refresh');
        const before = getAuthGeneration();
        localStorage.clear();
        const headers = {set: jest.fn()};
        expect(() => onRequest({headers, expectedAuthGeneration: before})).toThrow('session');
        expect(headers.set).not.toHaveBeenCalled();
    });

    it('does not invalidate a session-only login when another tab changes a local login', () => {
        setStoredUserTokens('session-access', 'session-refresh', false);
        const before = getAuthGeneration();
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'unrelated-local-login');
        localStorage.setItem('authToken', 'local-access');
        localStorage.setItem('authRefreshToken', 'local-refresh');
        window.dispatchEvent(new StorageEvent('storage', {key: AUTH_SESSION_STORAGE_KEY}));
        expect(getAuthGeneration()).toBe(before);
        const headers = {set: jest.fn()};
        onRequest({headers, expectedAuthGeneration: before});
        expect(headers.set).toHaveBeenCalledWith('X-User-Token', 'session-access');
    });

    it('does not trust unexplained token changes for a legacy login without a session marker', () => {
        localStorage.setItem('authToken', 'legacy-access');
        localStorage.setItem('authRefreshToken', 'legacy-refresh');
        const before = getAuthGeneration();
        localStorage.setItem('authToken', 'unidentified-access');
        const headers = {set: jest.fn()};
        expect(() => onRequest({headers, expectedAuthGeneration: before})).toThrow('session');
        expect(headers.set).not.toHaveBeenCalled();
    });
});

describe('token persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('stores remembered credentials only in localStorage', () => {
        setStoredUserTokens('access', 'refresh', true);

        expect(localStorage.getItem('authToken')).toBe('access');
        expect(localStorage.getItem('authRefreshToken')).toBe('refresh');
        expect(sessionStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeTruthy();
        expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('stores non-remembered credentials only in sessionStorage', () => {
        setStoredUserTokens('access', 'refresh', false);

        expect(sessionStorage.getItem('authToken')).toBe('access');
        expect(sessionStorage.getItem('authRefreshToken')).toBe('refresh');
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(getStoredUserToken()).toBe('access');
        expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeTruthy();
        expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('purges userId storage without authenticating or migrating it', () => {
        localStorage.setItem('userId', 'retired-access');
        sessionStorage.setItem('userId', 'retired-session-access');

        expect(getStoredUserToken()).toBeNull();
        expect(getStoredRefreshToken()).toBeNull();
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('userId')).toBeNull();
        expect(sessionStorage.getItem('userId')).toBeNull();
    });
});

describe('auth refresh lifecycle', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        jest.clearAllMocks();
        mockApiPost.mockResolvedValue({});
    });

    it('keeps refreshed credentials in sessionStorage for a non-remembered login', async () => {
        setStoredUserTokens('old-access', 'old-refresh', false);
        const marker = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
        const generation = getAuthGeneration();
        mockAxiosPost.mockResolvedValue({
            data: {access: 'new-access', refresh: 'new-refresh'},
        });

        const error = unauthorizedError();
        await onResponseError(error);

        expect(sessionStorage.getItem('authToken')).toBe('new-access');
        expect(sessionStorage.getItem('authRefreshToken')).toBe('new-refresh');
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBe(marker);
        expect(getAuthGeneration()).toBe(generation);
    });

    it('does not restore credentials when refresh completes after logout', async () => {
        setStoredUserTokens('old-access', 'old-refresh');

        let resolveRefresh: ((value: unknown) => void) | undefined;
        mockAxiosPost.mockReturnValue(
            new Promise((resolve) => {
                resolveRefresh = resolve;
            }),
        );

        const error = unauthorizedError();
        const protectedRequest = onResponseError(error);
        await Promise.resolve();
        expect(mockAxiosPost).toHaveBeenCalledTimes(1);

        await logout();
        if (!resolveRefresh) throw new Error('refresh request did not start');
        resolveRefresh({
            data: { access: 'stale-access', refresh: 'stale-refresh' },
        });

        await expect(protectedRequest).rejects.toBe(error);
        expect(getStoredUserToken()).toBeNull();
        expect(getStoredRefreshToken()).toBeNull();
        expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('does not overwrite another tab token rotation with a stale refresh', async () => {
        setStoredUserTokens('old-access', 'old-refresh');

        let resolveRefresh: ((value: unknown) => void) | undefined;
        mockAxiosPost.mockReturnValue(
            new Promise((resolve) => {
                resolveRefresh = resolve;
            }),
        );

        const error = unauthorizedError();
        const protectedRequest = onResponseError(error);
        await Promise.resolve();

        localStorage.setItem('authToken', 'new-access');
        localStorage.setItem('authRefreshToken', 'new-refresh');
        if (!resolveRefresh) throw new Error('refresh request did not start');
        resolveRefresh({
            data: { access: 'stale-access', refresh: 'stale-refresh' },
        });

        await expect(protectedRequest).resolves.toBeUndefined();
        expect(getStoredUserToken()).toBe('new-access');
        expect(getStoredRefreshToken()).toBe('new-refresh');
        expect(error.config.headers.set).toHaveBeenCalledWith('X-User-Token', 'new-access');
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    it('does not retry a queued private write for another account after an in-flight refresh', async () => {
        setStoredUserTokens('old-access', 'old-refresh');
        const error = unauthorizedError(getAuthGeneration());
        let resolveRefresh: ((value: unknown) => void) | undefined;
        mockAxiosPost.mockReturnValue(new Promise((resolve) => {resolveRefresh = resolve;}));
        const protectedRequest = onResponseError(error);
        await Promise.resolve();

        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'different-login');
        localStorage.setItem('authToken', 'other-account-access');
        localStorage.setItem('authRefreshToken', 'other-account-refresh');
        if (!resolveRefresh) throw new Error('refresh request did not start');
        resolveRefresh({data: {access: 'stale-access', refresh: 'stale-refresh'}});

        await expect(protectedRequest).rejects.toBe(error);
        expect(getStoredUserToken()).toBe('other-account-access');
        expect(getStoredRefreshToken()).toBe('other-account-refresh');
        expect(mockApiRequest).not.toHaveBeenCalled();
        expect(error.config.headers.set).not.toHaveBeenCalled();
    });

    it('does not refresh another account when a stale queued request receives a 401', async () => {
        setStoredUserTokens('first-access', 'first-refresh');
        const error = unauthorizedError(getAuthGeneration());
        setStoredUserTokens('second-access', 'second-refresh');
        await expect(onResponseError(error)).rejects.toBe(error);
        expect(mockAxiosPost).not.toHaveBeenCalled();
        expect(mockApiRequest).not.toHaveBeenCalled();
        expect(getStoredUserToken()).toBe('second-access');
    });
});

describe('expired authentication redirect signal', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    it('clears an expired session and emits the current return URL when refresh is unavailable', async () => {
        window.history.pushState({}, '', '/projects/42?tab=script#scene-3');
        setStoredUserTokens('expired-access', '');
        const listener = jest.fn();
        window.addEventListener(AUTH_EXPIRED_EVENT, listener);

        const error = unauthorizedError();
        await expect(onResponseError(error)).rejects.toBe(error);

        expect(getStoredUserToken()).toBeNull();
        expect(listener).toHaveBeenCalledTimes(1);
        const event = listener.mock.calls[0][0] as CustomEvent<{returnTo: string}>;
        expect(event.detail.returnTo).toBe('/projects/42?tab=script#scene-3');
        window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
    });
});
