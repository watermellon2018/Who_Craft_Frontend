export type NotificationId = number | string;

export interface NotificationItem {
  id: NotificationId;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  target_url?: string | null;
  entity_reference?: string | null;
}

export interface NotificationListResponse {
  results: NotificationItem[];
  unread_count: number;
}

/**
 * Realtime delivery is intentionally transport-agnostic. A future WebSocket or
 * SSE adapter only needs to implement this subscription contract; REST
 * hydration remains separate so historical notifications are never toasted.
 */
export interface NotificationTransport {
  subscribe(listener: (notification: NotificationItem) => void): () => void;
}
