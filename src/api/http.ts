import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

/** Shared API client with X-User-Token access-token authentication. */

const rawBackend = process.env.REACT_APP_BACKEND_URL || '';
const baseURL = rawBackend.endsWith('/') ? rawBackend.slice(0, -1) : rawBackend;

const TOKEN_STORAGE_KEY = 'authToken';
const REFRESH_TOKEN_STORAGE_KEY = 'authRefreshToken';
const LEGACY_TOKEN_STORAGE_KEY = 'userId';

interface TokenPairResponse {
    access: string;
    refresh: string;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
    _authRetry?: boolean;
}

function migrateLegacyTokenKey(): string | null {
    try {
        const legacy = localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
        if (legacy && legacy.trim()) {
            localStorage.setItem(TOKEN_STORAGE_KEY, legacy);
            localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
            localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
            return legacy.trim();
        }
        return null;
    } catch {
        return null;
    }
}

export function getStoredUserToken(): string | null {
    try {
        const value = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (value && value.trim()) return value.trim();
        return migrateLegacyTokenKey();
    } catch {
        return null;
    }
}

export function getStoredRefreshToken(): string | null {
    try {
        const value = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        return value && value.trim() ? value.trim() : null;
    } catch {
        return null;
    }
}

export const AUTH_EXPIRED_EVENT = 'wcraft:auth-expired';

export interface AuthExpiredEventDetail {
    returnTo: string;
}

let authGeneration = 0;
let authExpiryNotified = false;

function writeStoredUserTokens(access: string, refresh: string): void {
    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, access);
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh);
        localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    } catch {
        // A protected request will surface unavailable storage as an auth error.
    }
}

export function setStoredUserTokens(access: string, refresh: string): void {
    authGeneration += 1;
    authExpiryNotified = false;
    writeStoredUserTokens(access, refresh);
}

export function clearStoredUserToken(): void {
    authGeneration += 1;
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    } catch {
        // ignore unavailable localStorage
    }
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
    const refresh = getStoredRefreshToken();
    if (!refresh) return null;
    const generation = authGeneration;

    try {
        const refreshUrl = baseURL
            ? `${baseURL}/api/auth/refresh/`
            : '/api/auth/refresh/';
        const response = await axios.post<TokenPairResponse>(refreshUrl, { refresh });
        if (
            generation !== authGeneration ||
            getStoredRefreshToken() !== refresh
        ) {
            return null;
        }
        writeStoredUserTokens(response.data.access, response.data.refresh);
        authExpiryNotified = false;
        return response.data.access;
    } catch {
        if (
            generation === authGeneration &&
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
