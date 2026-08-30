import api from '../../../api/http';
import type { DashboardData, ProfileSettings } from '../types';

// All requests below go through the shared axios instance, which attaches the
// X-User-Token header automatically. We deliberately do NOT pass the token in
// query params or request body any more — query strings leak to logs/history.

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
  settings: ProfileSettings;
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
  const res = await api.get<ProfileMeResponse>('api/profile/me/');
  return res.data;
}

export async function saveProfileMe(payload: SaveProfilePayload): Promise<ProfileMeResponse> {
  const res = await api.patch<ProfileMeResponse>('api/profile/me/', payload);
  return res.data;
}

export async function uploadAvatar(file: File): Promise<ProfileMeResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ProfileMeResponse>('api/profile/me/avatar/', form);
  return res.data;
}

export async function deleteAvatar(): Promise<ProfileMeResponse> {
  const res = await api.delete<ProfileMeResponse>('api/profile/me/avatar/');
  return res.data;
}

export async function uploadCover(file: File): Promise<ProfileMeResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ProfileMeResponse>('api/profile/me/cover/', form);
  return res.data;
}

export async function deleteCover(): Promise<ProfileMeResponse> {
  const res = await api.delete<ProfileMeResponse>('api/profile/me/cover/');
  return res.data;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await api.get<DashboardData>('api/profile/dashboard/');
  return res.data;
}

export async function updateSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
  const res = await api.patch<ProfileSettings>('api/profile/settings/', settings);
  return res.data;
}

export async function fetchSettings(): Promise<ProfileSettings> {
  const res = await api.get<ProfileSettings>('api/profile/settings/');
  return res.data;
}

export async function deleteAccount(currentPassword: string): Promise<void> {
  await api.delete('api/profile/me/', {
    data: {current_password: currentPassword},
  });
}

export async function logoutAllSessions(): Promise<void> {
  await api.post('api/auth/logout-all/');
}
