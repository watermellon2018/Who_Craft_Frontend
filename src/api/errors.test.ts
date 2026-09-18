import {
  getApiErrorCode,
  getApiErrorEnvelope,
  getApiErrorMessage,
  getApiStatus,
  sanitizeApiError,
} from './errors';
import i18n from '../i18n';

const axiosError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: {status, data},
});

describe('API error boundary', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('reads the canonical nested envelope', async () => {
    await i18n.changeLanguage('en');
    const error = axiosError(403, {
      error: {code: 'INSUFFICIENT_PERMISSIONS', message: 'Forbidden'},
      code: 'legacy-code',
    });

    expect(getApiErrorCode(error)).toBe('INSUFFICIENT_PERMISSIONS');
    expect(getApiErrorMessage(error, 'fallback')).toBe('Forbidden');
    expect(getApiStatus(error)).toBe(403);
  });

  it('does not leak a Russian backend message into the English UI', async () => {
    await i18n.changeLanguage('en');

    expect(getApiErrorMessage(
      axiosError(400, {code: 'VALIDATION_ERROR', detail: 'Неверный запрос'}),
      'Invalid request',
    )).toBe('Invalid request');
  });

  it('does not leak an English backend message into the Russian UI', () => {
    expect(getApiErrorMessage(
      axiosError(400, {code: 'VALIDATION_ERROR', detail: 'Invalid request'}),
      'Неверный запрос',
    )).toBe('Неверный запрос');
  });

  it('temporarily supports legacy backend errors', () => {
    const envelope = getApiErrorEnvelope(axiosError(400, {
      code: 'VALIDATION_ERROR',
      detail: 'Invalid request',
      errors: {prompt: ['Too long']},
    }));

    expect(envelope).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        fields: {prompt: ['Too long']},
      },
    });
  });

  it('sanitizes unknown transport failures', () => {
    expect(sanitizeApiError({}, 'Network failure')).toEqual({
      error: {code: 'API_ERROR', message: 'Network failure'},
    });
  });

  it('preserves a safe HTTP status after removing request credentials', () => {
    const sanitized = sanitizeApiError(
      axiosError(401, {status: 'fail'}),
      'Login failed',
    );

    expect(sanitized).toEqual({
      error: {code: 'API_ERROR', message: 'Login failed'},
      status: 401,
    });
    expect(getApiStatus(sanitized)).toBe(401);
  });
});
