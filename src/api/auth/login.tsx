import {sanitizeApiError} from '../errors';
import api from '../http';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  status: number | string;
  refresh: string;
  access: string;
}

async function login(values: LoginRequest): Promise<LoginResponse> {
  try {
    // POST, not GET: credentials must never appear in a URL/query string.
    const response = await api.post<LoginResponse>('api/auth/login/', values);
    return response.data;
  } catch (error: unknown) {
    // Never expose an AxiosError: it embeds request headers/body (password).
    throw sanitizeApiError(error, 'login_failed');
  }
}

export {login};
export type {LoginRequest, LoginResponse};
