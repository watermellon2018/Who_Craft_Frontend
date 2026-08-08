/**
 * URL validation helpers.
 *
 * User- or API-controlled URLs that flow into ``<img src>``, ``<a href>``,
 * CSS ``url(...)`` or ``window.open`` must NEVER carry a ``javascript:`` or
 * ``data:`` (script) scheme — those produce XSS / cross-tab navigation.
 * The helpers below return a safe value (``null`` or a fallback) when the
 * input is anything other than http(s) or a same-origin relative path.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Return the URL unchanged if its scheme is safe (http/https or relative),
 * otherwise return ``null``. Use for ``<a href>``, ``window.open``, etc.
 */
export function safeHttpUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Relative paths are safe (same origin).
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    try {
        const url = new URL(trimmed);
        return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : null;
    } catch {
        return null;
    }
}

/**
 * Same as ``safeHttpUrl`` but also allows ``data:image/...`` payloads.
 * Use for ``<img src>`` and CSS ``background: url(...)`` where rendering an
 * inline base64 image is legitimate but ``javascript:`` is not.
 */
export function safeImageUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/')) return trimmed;
    return safeHttpUrl(trimmed);
}

/**
 * Escape a string for use inside ``url(...)`` in CSS. Prevents breaking out
 * of the url() expression with quotes/parentheses.
 */
export function cssUrl(value: unknown): string {
    const safe = safeImageUrl(value);
    if (!safe) return '';
    // Wrap in double quotes; escape backslashes and double quotes inside.
    const escaped = safe.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `url("${escaped}")`;
}
