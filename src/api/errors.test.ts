import {
  getApiErrorCode,
  getApiErrorEnvelope,
  getApiErrorMessage,
  getApiStatus,
  sanitizeApiError,
} from './errors';

const axiosError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: {status, data},
});

describe('API error boundary', () => {
  it('reads the canonical nested envelope', () => {
    const error = axiosError(403, {
      error: {code: 'INSUFFICIENT_PERMISSIONS', message: 'Forbidden'},
      code: 'legacy-code',
    });

    expect(getApiErrorCode(error)).toBe('INSUFFICIENT_PERMISSIONS');
    expect(getApiErrorMessage(error, 'fallback')).toBe('Forbidden');
    expect(getApiStatus(error)).toBe(403);
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
