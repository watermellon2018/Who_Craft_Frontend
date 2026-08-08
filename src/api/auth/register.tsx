import {sanitizeApiError} from '../errors';
import api, {setStoredUserTokens} from '../http';

interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

interface RegisterResponse {
  access: string;
  refresh: string;
  token: string;
}

async function register(values: RegisterRequest): Promise<RegisterResponse> {
  try {
    const response = await api.post<RegisterResponse>('api/auth/register/', values);
    if (response.data.access && response.data.refresh) {
      setStoredUserTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  } catch (error: unknown) {
    // Never expose an AxiosError: it embeds request headers/body (password).
    throw sanitizeApiError(error, 'registration_failed');
  }
}

export {register};
export type {RegisterRequest, RegisterResponse};
