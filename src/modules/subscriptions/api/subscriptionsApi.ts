import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

function getToken(): string | null {
  return localStorage.getItem('userId');
}

export interface ApiChannel {
  id: number;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  subscribersCount: number;
  isSubscribed: boolean;
  isFavorite: boolean;
  notificationsEnabled: boolean;
}

export interface MySubscriptionsResponse {
  items: ApiChannel[];
  total: number;
  favoriteCount: number;
  limit: number;
  offset: number;
}

export interface SearchChannelsResponse {
  items: ApiChannel[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubscriptionStatePayload {
  targetUserId: number;
  isSubscribed: boolean;
  isFavorite: boolean;
  notificationsEnabled: boolean;
}

export interface MutationResponse {
  success: boolean;
  subscription: SubscriptionStatePayload;
}

export async function fetchMySubscriptions(limit = 20, offset = 0): Promise<MySubscriptionsResponse> {
  const res = await axios.get<MySubscriptionsResponse>(`${backendUrl}api/subscriptions/`, {
    params: { token_user: getToken(), limit, offset },
  });
  return res.data;
}

export async function searchChannels(q: string, limit = 20, offset = 0): Promise<SearchChannelsResponse> {
  const res = await axios.get<SearchChannelsResponse>(`${backendUrl}api/channels/search/`, {
    params: { token_user: getToken(), q, limit, offset },
  });
  return res.data;
}

export async function subscribeToChannel(userId: number): Promise<MutationResponse> {
  const res = await axios.post<MutationResponse>(
    `${backendUrl}api/channels/${userId}/subscribe/`,
    { token_user: getToken() },
  );
  return res.data;
}

export async function unsubscribeFromChannel(userId: number): Promise<MutationResponse> {
  const res = await axios.delete<MutationResponse>(`${backendUrl}api/channels/${userId}/subscribe/`, {
    params: { token_user: getToken() },
  });
  return res.data;
}

export async function updateSubscriptionSettings(
  userId: number,
  payload: { isFavorite?: boolean; notificationsEnabled?: boolean },
): Promise<MutationResponse> {
  const res = await axios.patch<MutationResponse>(
    `${backendUrl}api/channels/${userId}/subscription/`,
    { ...payload, token_user: getToken() },
  );
  return res.data;
}
