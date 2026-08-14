import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

/** Shared API client with X-User-Token access-token authentication. */

const rawBackend = process.env.REACT_APP_BACKEND_URL || '';
const baseURL = rawBackend.endsWith('/') ? rawBackend.slice(0, -1) : rawBackend;

const TOKEN_STORAGE_KEY = 'authToken';
const REFRESH_TOKEN_STORAGE_KEY = 'authRefreshToken';
const RETIRED_TOKEN_STORAGE_KEYS = ['userId'] as const;

type TokenPersistence = 'local' | 'session';

interface TokenPairResponse {
    access: string;
    refresh: string;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
    _authRetry?: boolean;
}

function getTokenStorage(persistence: TokenPersistence): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return persistence === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
        return null;
    }
}

function readStoredValue(persistence: TokenPersistence, key: string): string | null {
    try {
        const value = getTokenStorage(persistence)?.getItem(key);
        return value && value.trim() ? value.trim() : null;
    } catch {
        return null;
    }
}

function purgeRetiredStoredTokens(): void {
    for (const persistence of ['local', 'session'] as const) {
        try {
            const storage = getTokenStorage(persistence);
            RETIRED_TOKEN_STORAGE_KEYS.forEach((key) => storage?.removeItem(key));
        } catch {
            // Ignore unavailable browser storage.
        }
    }
}

function storedTokenPersistence(): TokenPersistence | null {
    purgeRetiredStoredTokens();
    if (
        readStoredValue('session', TOKEN_STORAGE_KEY)
        || readStoredValue('session', REFRESH_TOKEN_STORAGE_KEY)
    ) {
        return 'session';
    }
    if (
        readStoredValue('local', TOKEN_STORAGE_KEY)
        || readStoredValue('local', REFRESH_TOKEN_STORAGE_KEY)
    ) {
        return 'local';
    }
    return null;
}

function removeStoredTokens(persistence: TokenPersistence): void {
    try {
        const storage = getTokenStorage(persistence);
        storage?.removeItem(TOKEN_STORAGE_KEY);
        storage?.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        RETIRED_TOKEN_STORAGE_KEYS.forEach((key) => storage?.removeItem(key));
    } catch {
        // Ignore unavailable browser storage.
    }
}

export function getStoredUserToken(): string | null {
    const persistence = storedTokenPersistence();
    if (persistence) return readStoredValue(persistence, TOKEN_STORAGE_KEY);
    return null;
}

export function getStoredRefreshToken(): string | null {
    const persistence = storedTokenPersistence();
    return persistence ? readStoredValue(persistence, REFRESH_TOKEN_STORAGE_KEY) : null;
}

export const AUTH_EXPIRED_EVENT = 'wcraft:auth-expired';

export interface AuthExpiredEventDetail {
    returnTo: string;
}

let authGeneration = 0;
let authExpiryNotified = false;

function writeStoredUserTokens(
    access: string,
    refresh: string,
    persistence: TokenPersistence,
): void {
    removeStoredTokens('local');
    removeStoredTokens('session');
    try {
        const storage = getTokenStorage(persistence);
        storage?.setItem(TOKEN_STORAGE_KEY, access);
        storage?.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh);
    } catch {
        // A protected request will surface unavailable storage as an auth error.
    }
}

export function setStoredUserTokens(
    access: string,
    refresh: string,
    remember = true,
): void {
    authGeneration += 1;
    authExpiryNotified = false;
    writeStoredUserTokens(access, refresh, remember ? 'local' : 'session');
}

export function clearStoredUserToken(): void {
    authGeneration += 1;
    removeStoredTokens('local');
    removeStoredTokens('session');
}

function notifyAuthExpired(): void {
    if (authExpiryNotified || typeof window === 'undefined') return;
    authExpiryNotified = true;
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.dispatchEvent(new CustomEvent<AuthExpiredEventDetail>(AUTH_EXPIRED_EVENT, {
        detail: { returnTo },
    }));
}

const api: AxiosInstance = axios.create({
    baseURL: baseURL ? `${baseURL}/` : '/',
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getStoredUserToken();
    if (token) {
        config.headers.set('X-User-Token', token);
    }
    return config;
});

let refreshPromise: Promise<string | null> | null = null;

function isPublicAuthRequest(url = ''): boolean {
    return /api\/auth\/(?:login|register|refresh)\/?$/.test(url);
}

async function requestFreshAccessToken(): Promise<string | null> {
    const persistence = storedTokenPersistence();
    const refresh = getStoredRefreshToken();
    if (!persistence || !refresh) return null;
    const generation = authGeneration;

    try {
        const refreshUrl = baseURL
            ? `${baseURL}/api/auth/refresh/`
            : '/api/auth/refresh/';
        const response = await axios.post<TokenPairResponse>(refreshUrl, { refresh });
        if (
            generation !== authGeneration ||
            storedTokenPersistence() !== persistence ||
            getStoredRefreshToken() !== refresh
        ) {
            return null;
        }
        writeStoredUserTokens(response.data.access, response.data.refresh, persistence);
        authExpiryNotified = false;
        return response.data.access;
    } catch {
        if (
            generation === authGeneration &&
            storedTokenPersistence() === persistence &&
            getStoredRefreshToken() === refresh
        ) {
            clearStoredUserToken();
        }
        return null;
    }
}

async function getFreshAccessToken(): Promise<string | null> {
    if (!refreshPromise) {
        const pendingRefresh = requestFreshAccessToken();
        refreshPromise = pendingRefresh;
        void pendingRefresh.finally(() => {
            if (refreshPromise === pendingRefresh) refreshPromise = null;
        });
    }
    return refreshPromise;
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const config = error.config as RetriableRequestConfig | undefined;
        if (
            error.response?.status !== 401 ||
            !config ||
            isPublicAuthRequest(config.url)
        ) {
            throw error;
        }

        if (config._authRetry) {
            const currentAccess = getStoredUserToken();
            const requestAccess = config.headers.get('X-User-Token');
            if (currentAccess && requestAccess !== currentAccess) {
                config.headers.set('X-User-Token', currentAccess);
                return api.request(config);
            }
            clearStoredUserToken();
            notifyAuthExpired();
            throw error;
        }

        config._authRetry = true;
        const refreshAtStart = getStoredRefreshToken();
        const access = await getFreshAccessToken();
        if (!access) {
            const currentAccess = getStoredUserToken();
            const currentRefresh = getStoredRefreshToken();
            if (currentAccess && currentRefresh !== refreshAtStart) {
                config.headers.set('X-User-Token', currentAccess);
                return api.request(config);
            }
            if (currentRefresh === refreshAtStart) {
                clearStoredUserToken();
                notifyAuthExpired();
            }
            throw error;
        }

        config.headers.set('X-User-Token', access);
        return api.request(config);
    },
);

export async function logout(): Promise<void> {
    authGeneration += 1;
    refreshPromise = null;
    try {
        if (getStoredUserToken()) {
            await api.post('api/auth/logout/');
        }
    } catch {
        // Local credentials still need to be removed when the server is unavailable.
    } finally {
        clearStoredUserToken();
    }
}

export default api;

/** Build a full backend URL for media/static asset paths returned by the API. */
export function backendAssetUrl(path: string): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return baseURL ? `${baseURL}/${trimmed}` : `/${trimmed}`;
}
