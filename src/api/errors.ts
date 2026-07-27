import axios from 'axios';

import type {ApiErrorEnvelope} from './generated/contracts';

const FALLBACK_CODE = 'API_ERROR';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseData(error: unknown): unknown {
  if (axios.isAxiosError(error)) return error.response?.data;
  if (isRecord(error) && error.isAxiosError === true && isRecord(error.response)) {
    return error.response.data;
  }
  return error;
}

export function getApiErrorEnvelope(error: unknown): ApiErrorEnvelope | null {
  const data = responseData(error);
  if (!isRecord(data)) return null;

  const nested = data.error;
  if (isRecord(nested) && typeof nested.code === 'string' && typeof nested.message === 'string') {
    return {
      error: {
        code: nested.code,
        message: nested.message,
        ...(isRecord(nested.fields) ? {fields: nested.fields} : {}),
      },
    };
  }

  const code = typeof data.code === 'string'
    ? data.code
    : typeof data.error_code === 'string'
      ? data.error_code
      : null;
  const message = typeof data.detail === 'string'
    ? data.detail
    : typeof data.message === 'string'
      ? data.message
      : typeof data.error === 'string'
        ? data.error
        : null;
  if (!code && !message) return null;

  return {
    error: {
      code: code ?? FALLBACK_CODE,
      message: message ?? 'API request failed',
      ...(isRecord(data.errors) ? {fields: data.errors} : {}),
    },
  };
}

export function getApiErrorCode(error: unknown): string | null {
  return getApiErrorEnvelope(error)?.error.code ?? null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorEnvelope(error)?.error.message
    ?? (error instanceof Error ? error.message : fallback);
}

export function getApiStatus(error: unknown): number | null {
  if (axios.isAxiosError(error) && typeof error.response?.status === 'number') {
    return error.response.status;
  }
  if (isRecord(error) && isRecord(error.response) && typeof error.response.status === 'number') {
    return error.response.status;
  }
  return null;
}

export function sanitizeApiError(error: unknown, fallback: string): ApiErrorEnvelope {
  return getApiErrorEnvelope(error) ?? {
    error: {
      code: FALLBACK_CODE,
      message: error instanceof Error ? error.message : fallback,
    },
  };
}
