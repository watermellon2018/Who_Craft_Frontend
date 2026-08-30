import api from '../../../api/http';
import type {
  NotificationId,
  NotificationItem,
  NotificationListResponse,
} from '../types';

function isNotificationItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NotificationItem>;
  return (
    (typeof candidate.id === 'number' || typeof candidate.id === 'string')
    && typeof candidate.type === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.created_at === 'string'
    && typeof candidate.is_read === 'boolean'
  );
}

function asNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

export function parseNotificationList(value: unknown): NotificationListResponse {
  const payload = value && typeof value === 'object'
    ? value as {results?: unknown; unread_count?: unknown}
    : null;
  const payloadResults = payload?.results;
  const rawResults = Array.isArray(value)
    ? value
    : Array.isArray(payloadResults)
      ? payloadResults
      : [];
  const results = rawResults.filter(isNotificationItem);
  const derivedUnreadCount = results.filter((item) => !item.is_read).length;

  return {
    results,
    unread_count: asNonNegativeInteger(payload?.unread_count, derivedUnreadCount),
  };
}

export async function fetchNotifications(): Promise<NotificationListResponse> {
  const response = await api.get('api/notifications/');
  return parseNotificationList(response.data);
}

export async function markNotificationRead(id: NotificationId): Promise<NotificationItem | null> {
  const response = await api.post(`api/notifications/${encodeURIComponent(String(id))}/read/`);
  return isNotificationItem(response.data) ? response.data : null;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await api.post('api/notifications/read-all/');
  const payload = response.data && typeof response.data === 'object'
    ? response.data as {unread_count?: unknown}
    : null;
  return asNonNegativeInteger(payload?.unread_count, 0);
}
