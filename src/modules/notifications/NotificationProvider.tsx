import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {getStoredUserToken} from '../../api/http';
import {openNotificationWithIcon} from '../../utils/global/notification';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './api/notificationApi';
import type {NotificationId, NotificationItem, NotificationTransport} from './types';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: 'load' | 'action' | null;
  pendingReadIds: ReadonlySet<NotificationId>;
  markingAllRead: boolean;
  reload: () => Promise<void>;
  markRead: (id: NotificationId) => Promise<void>;
  markAllRead: () => Promise<void>;
}

interface NotificationProviderProps {
  children: React.ReactNode;
  transport?: NotificationTransport;
  onRealtimeNotification?: (notification: NotificationItem) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function itemKey(item: NotificationItem): string {
  return String(item.id);
}

function newestFirst(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at);
    const rightTime = Date.parse(right.created_at);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
    return rightTime - leftTime;
  });
}

function mergeNotifications(
  current: NotificationItem[],
  incoming: NotificationItem[],
): NotificationItem[] {
  const byId = new Map(current.map((item) => [itemKey(item), item]));
  incoming.forEach((item) => {
    const existing = byId.get(itemKey(item));
    byId.set(itemKey(item), existing ? {...existing, ...item} : item);
  });
  return newestFirst(Array.from(byId.values()));
}

const defaultRealtimeToast = (item: NotificationItem) => {
  openNotificationWithIcon(item.message, item.title, 'info');
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  transport,
  onRealtimeNotification = defaultRealtimeToast,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'load' | 'action' | null>(null);
  const [pendingReadIds, setPendingReadIds] = useState<Set<NotificationId>>(new Set());
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const notificationsRef = useRef<NotificationItem[]>([]);
  const pendingReadIdsRef = useRef<Set<NotificationId>>(new Set());
  const markingAllReadRef = useRef(false);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const reload = useCallback(async () => {
    if (!getStoredUserToken()) {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchNotifications();
      setNotifications((current) => mergeNotifications(current, response.results));
      setUnreadCount(response.unread_count);
    } catch {
      setError('load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!transport) return undefined;

    return transport.subscribe((incoming) => {
      const alreadyPresent = notificationsRef.current.some(
        (item) => itemKey(item) === itemKey(incoming),
      );
      setNotifications((current) => mergeNotifications(current, [incoming]));
      if (!alreadyPresent && !incoming.is_read) {
        setUnreadCount((current) => current + 1);
      }
      if (!alreadyPresent) onRealtimeNotification(incoming);
    });
  }, [onRealtimeNotification, transport]);

  const markRead = useCallback(async (id: NotificationId) => {
    if (pendingReadIdsRef.current.has(id)) return;
    const existing = notificationsRef.current.find((item) => itemKey(item) === String(id));
    if (!existing || existing.is_read) return;

    pendingReadIdsRef.current.add(id);
    setPendingReadIds((current) => new Set(current).add(id));
    setError(null);
    try {
      const updated = await markNotificationRead(id);
      setNotifications((current) => current.map((item) => (
        itemKey(item) === String(id)
          ? updated ?? {...item, is_read: true}
          : item
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError('action');
      throw new Error('notification-mark-read-failed');
    } finally {
      setPendingReadIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      pendingReadIdsRef.current.delete(id);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (markingAllReadRef.current || unreadCount === 0) return;

    markingAllReadRef.current = true;
    setMarkingAllRead(true);
    setError(null);
    try {
      const remainingUnread = await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({...item, is_read: true})));
      setUnreadCount(remainingUnread);
    } catch {
      setError('action');
      throw new Error('notification-mark-all-read-failed');
    } finally {
      markingAllReadRef.current = false;
      setMarkingAllRead(false);
    }
  }, [unreadCount]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    loading,
    error,
    pendingReadIds,
    markingAllRead,
    reload,
    markRead,
    markAllRead,
  }), [
    error,
    loading,
    markAllRead,
    markRead,
    markingAllRead,
    notifications,
    pendingReadIds,
    reload,
    unreadCount,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotificationCenter(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
