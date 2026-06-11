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
        const res = await api.post<LoginResponse>('api/auth/login/', values);
        return res.data;
    } catch (err: any) {
        // Re-throw a sanitized payload so callers / error UIs don't accidentally
        // serialize the full axios error (which embeds the request URL and
        // headers, including the password we just posted).
        const payload = err?.response?.data ?? { status: 'fail' };
        throw payload;
    }
}

export { login };
