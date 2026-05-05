import axios from 'axios';
import { DashboardData, ProfileSettings } from '../types';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

function getToken(): string | null {
  return localStorage.getItem('userId');
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
