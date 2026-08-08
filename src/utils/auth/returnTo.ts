export interface AuthReturnState {
  returnTo?: unknown;
}

export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/^\/(?:login|register)(?:[/?#]|$)/.test(value)) return null;
  return value;
}

export function currentReturnTo(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  return `${location.pathname}${location.search}${location.hash}`;
}