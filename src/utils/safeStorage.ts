/**
 * Crash-safe localStorage helpers.
 *
 * `JSON.parse(localStorage.getItem(...)!)` is a recurring source of bugs in
 * this codebase: when the key is missing the `!` lies, and when the stored
 * payload is corrupted the parse throws an uncaught exception that brings
 * down the component tree. Always go through these helpers.
 */

export function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeJSON(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota exceeded / private mode / disabled — caller should not crash.
    }
}

export function readString(key: string): string | null {
    try {
        const v = localStorage.getItem(key);
        return v && v.trim() ? v : null;
    } catch {
        return null;
    }
}

export function removeKey(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
}
