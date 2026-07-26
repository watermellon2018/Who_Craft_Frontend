import api, { setStoredUserTokens } from '../http';

interface RegisterRequest {
    username: string;
    password: string;
}

interface RegisterResponse {
    access: string;
    refresh: string;
    token: string;
}

async function register(values: RegisterRequest) {
    try {
        const res = await api.post<RegisterResponse>('api/auth/register/', values);
        if (res.data?.access && res.data.refresh) {
            setStoredUserTokens(res.data.access, res.data.refresh);
        }
        return res;
    } catch (err: any) {
        const payload = err?.response?.data ?? { detail: 'registration_failed' };
        throw payload;
    }
}

export { register };
