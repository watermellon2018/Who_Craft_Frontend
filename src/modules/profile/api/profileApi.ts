import axios from 'axios';
import { DashboardData, ProfileSettings } from '../types';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

function getToken(): string | null {
  return localStorage.getItem('userId');
}

export interface ProfileMeResponse {
  user: {
    id: number;
    username: string;
    public_username: string | null;
    effective_username: string;
    display_name: string;
    bio: string | null;
    tagline: string | null;
    location: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    joined_at: string | null;
  };
  interests: string[];
  socials: Array<{ platform: string; url: string; display_order: number }>;
  settings: { language: string; private_account: boolean; notifications_enabled: boolean };
  profile_completion: { percent: number; items: Record<string, boolean> };
}

export interface SaveProfilePayload {
  display_name?: string;
  public_username?: string | null;
  bio?: string;
  interests?: string[];
  socials?: Array<{ platform: string; url: string; display_order?: number }>;
}

export async function fetchProfileMe(): Promise<ProfileMeResponse> {
  const token = getToken();
  const res = await axios.get<ProfileMeResponse>(`${backendUrl}api/profile/me/`, {
    params: { token_user: token },
  });
  return res.data;
}

export async function saveProfileMe(payload: SaveProfilePayload): Promise<ProfileMeResponse> {
  const token = getToken();
  const res = await axios.patch<ProfileMeResponse>(`${backendUrl}api/profile/me/`, {
    ...payload,
    token_user: token,
  });
  return res.data;
}

export async function uploadAvatar(file: File): Promise<ProfileMeResponse> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await axios.post<ProfileMeResponse>(
    `${backendUrl}api/profile/me/avatar/`,
    form,
    { params: { token_user: token } },
  );
  return res.data;
}

export async function deleteAvatar(): Promise<ProfileMeResponse> {
  const token = getToken();
  const res = await axios.delete<ProfileMeResponse>(`${backendUrl}api/profile/me/avatar/`, {
    params: { token_user: token },
  });
  return res.data;
}

export async function uploadCover(file: File): Promise<ProfileMeResponse> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await axios.post<ProfileMeResponse>(
    `${backendUrl}api/profile/me/cover/`,
    form,
    { params: { token_user: token } },
  );
  return res.data;
}

export async function deleteCover(): Promise<ProfileMeResponse> {
  const token = getToken();
  const res = await axios.delete<ProfileMeResponse>(`${backendUrl}api/profile/me/cover/`, {
    params: { token_user: token },
  });
  return res.data;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const token = getToken();
  const res = await axios.get<DashboardData>(`${backendUrl}api/profile/dashboard/`, {
    params: { token_user: token },
  });
  return res.data;
}

export async function updateSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
  const token = getToken();
  const res = await axios.patch<ProfileSettings>(`${backendUrl}api/profile/settings/`, {
    ...settings,
    token_user: token,
  });
  return res.data;
}
