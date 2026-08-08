import api from '../../../api/http';

// Token is injected as an X-User-Token header by api/http.ts — do NOT add
// token_user to query params or request body.

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
  const res = await api.get<MySubscriptionsResponse>('api/subscriptions/', {
    params: { limit, offset },
  });
  return res.data;
}

export async function searchChannels(q: string, limit = 20, offset = 0): Promise<SearchChannelsResponse> {
  const res = await api.get<SearchChannelsResponse>('api/channels/search/', {
    params: { q, limit, offset },
  });
  return res.data;
}

export async function subscribeToChannel(userId: number): Promise<MutationResponse> {
  const res = await api.post<MutationResponse>(`api/channels/${userId}/subscribe/`);
  return res.data;
}

export async function unsubscribeFromChannel(userId: number): Promise<MutationResponse> {
  const res = await api.delete<MutationResponse>(`api/channels/${userId}/subscribe/`);
  return res.data;
}

export async function updateSubscriptionSettings(
  userId: number,
  payload: { isFavorite?: boolean; notificationsEnabled?: boolean },
): Promise<MutationResponse> {
  const res = await api.patch<MutationResponse>(
    `api/channels/${userId}/subscription/`,
    payload,
  );
  return res.data;
}
