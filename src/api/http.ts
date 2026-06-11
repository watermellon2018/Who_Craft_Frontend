import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Shared axios client.
 *
 * All callers should import this default instance instead of using `axios`
 * directly so that:
 *   - the user token is attached as an ``X-User-Token`` header (NOT as a
 *     query-string param, which would leak into logs / browser history /
 *     Referer headers sent to image CDNs);
 *   - the backend base URL is set once;
 *   - error handling can be evolved in one place.
 */

const rawBackend = process.env.REACT_APP_BACKEND_URL || '';
// Normalize: strip a single trailing slash so callers can write
// `api.get('api/foo/')` regardless of how the env var ends.
const baseURL = rawBackend.endsWith('/') ? rawBackend.slice(0, -1) : rawBackend;

const TOKEN_STORAGE_KEY = 'authToken';
// Older builds stored the token under "userId" (misleading: the value is the
// UUID auth token, not the user id). On first read we migrate any legacy value
// to the new key so existing sessions keep working without a re-login.
const LEGACY_TOKEN_STORAGE_KEY = 'userId';

function migrateLegacyTokenKey(): string | null {
    try {
        const legacy = localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
        if (legacy && legacy.trim()) {
            localStorage.setItem(TOKEN_STORAGE_KEY, legacy);
            localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
            return legacy.trim();
        }
        return null;
    } catch {
        return null;
    }
}

export function getStoredUserToken(): string | null {
    try {
        const v = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (v && v.trim()) return v.trim();
        return migrateLegacyTokenKey();
    } catch {
        return null;
    }
}

export function setStoredUserToken(token: string): void {
    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        // Best-effort cleanup of the legacy key so stale values can't resurrect.
        localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    } catch {
        // localStorage may be unavailable (private mode quota, disabled).
        // We deliberately swallow — caller will see auth failures downstream.
    }
}

export function clearStoredUserToken(): void {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    } catch {
        // ignore
    }
}

const api: AxiosInstance = axios.create({
    baseURL: baseURL ? `${baseURL}/` : '/',
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getStoredUserToken();
    if (token) {
        config.headers = config.headers ?? {};
        // X-User-Token is read by the backend's auth.utils.extract_user_token.
        (config.headers as Record<string, string>)['X-User-Token'] = token;
    }
    return config;
});

export default api;

/**
 * Build a full backend URL for media / static asset paths returned by the
 * API. Callers should NOT manually concatenate `process.env.REACT_APP_BACKEND_URL`.
 */
export function backendAssetUrl(path: string): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return baseURL ? `${baseURL}/${trimmed}` : `/${trimmed}`;
}
