import api, { setStoredUserToken } from '../http';

interface RegisterRequest {
    username: string;
    password: string;
}

interface RegisterResponse {
    token: string;
}

async function register(values: RegisterRequest) {
    try {
        const res = await api.post<RegisterResponse>('api/auth/register/', values);
        if (res.data && res.data.token) {
            setStoredUserToken(res.data.token);
        }
        return res;
    } catch (err: any) {
        const payload = err?.response?.data ?? { detail: 'registration_failed' };
        throw payload;
    }
}

export { register };
