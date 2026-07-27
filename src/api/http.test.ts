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
        interceptors: { response: { use: jest.Mock } };
    };
};
const mockAxiosPost = axiosTestDouble.post;
const mockApiRequest = axiosTestDouble.__api.request;
const mockApiPost = axiosTestDouble.__api.post;
const onResponseError = axiosTestDouble.__api.interceptors.response.use.mock.calls[0][1] as (
    error: unknown,
) => Promise<unknown>;

function unauthorizedError() {
    return {
        response: { status: 401 },
        config: {
            url: 'api/profile/me/',
            headers: { set: jest.fn() },
        },
    };
}

describe('auth refresh lifecycle', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockApiPost.mockResolvedValue({});
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

    it('does not overwrite a newer cross-tab login with a stale refresh', async () => {
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
});

describe('expired authentication redirect signal', () => {
    beforeEach(() => {
        localStorage.clear();
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