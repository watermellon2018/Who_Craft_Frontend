import {BellOutlined, CheckOutlined, ReloadOutlined} from '@ant-design/icons';
import {Badge, Button, Popover, Skeleton} from 'antd';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';

import {useNotificationCenter} from './NotificationProvider';
import type {NotificationItem} from './types';
import './notificationCenter.css';

export function safeNotificationTarget(value: string | null | undefined): string | null {
  if (!value || typeof window === 'undefined') return null;
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin) return null;
    if (!target.pathname.startsWith('/') || target.pathname.startsWith('//')) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

interface TimeAgoProps {
  createdAt: string;
}

const TimeAgo: React.FC<TimeAgoProps> = ({createdAt}) => {
  const {i18n, t} = useTranslation();
  const label = useMemo(() => {
    const timestamp = Date.parse(createdAt);
    if (Number.isNaN(timestamp)) return '';
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSeconds < 60) return t('notifications.center.justNow');

    const formatter = new Intl.RelativeTimeFormat(i18n.resolvedLanguage || i18n.language, {
      numeric: 'always',
    });
    if (elapsedSeconds < 3600) return formatter.format(-Math.floor(elapsedSeconds / 60), 'minute');
    if (elapsedSeconds < 86400) return formatter.format(-Math.floor(elapsedSeconds / 3600), 'hour');
    return formatter.format(-Math.floor(elapsedSeconds / 86400), 'day');
  }, [createdAt, i18n.language, i18n.resolvedLanguage, t]);

  return label ? <time dateTime={createdAt}>{label}</time> : null;
};

interface NotificationRowProps {
  item: NotificationItem;
  pending: boolean;
  onActivate: (item: NotificationItem) => void;
}

const NotificationRow: React.FC<NotificationRowProps> = ({item, pending, onActivate}) => (
  <button
    type="button"
    className={`notification-center__item${item.is_read ? '' : ' notification-center__item--unread'}`}
    onClick={() => onActivate(item)}
    disabled={pending}
  >
    <span className="notification-center__item-body">
      <span className="notification-center__item-title">{item.title}</span>
      <span className="notification-center__item-message">{item.message}</span>
      <span className="notification-center__item-time"><TimeAgo createdAt={item.created_at} /></span>
    </span>
    {!item.is_read && <span className="notification-center__unread-dot" aria-hidden="true" />}
  </button>
);

const NotificationBell: React.FC = () => {
  const center = useNotificationCenter();
  const navigate = useNavigate();
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);

  if (!center) return null;

  const handleActivate = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await center.markRead(item.id);
      } catch {
        return;
      }
    }
    const target = safeNotificationTarget(item.target_url);
    if (target) {
      setOpen(false);
      navigate(target);
    }
  };

  const handleMarkAll = async () => {
    try {
      await center.markAllRead();
    } catch {
      // The provider exposes the failure in the popover and preserves state.
    }
  };

  const content = (
    <section
      className="notification-center"
      aria-label={t('notifications.center.title')}
      role="dialog"
    >
      <div className="notification-center__header">
        <h2>{t('notifications.center.title')}</h2>
        <Button
          type="text"
          size="small"
          icon={<CheckOutlined />}
          disabled={center.unreadCount === 0}
          loading={center.markingAllRead}
          onClick={() => void handleMarkAll()}
        >
          {t('notifications.center.markAllRead')}
        </Button>
      </div>

      {center.error && (
        <div className="notification-center__error" role="alert">
          <span>{t(center.error === 'load'
            ? 'notifications.center.loadError'
            : 'notifications.center.actionError')}</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => void center.reload()}
          >
            {t('notifications.center.retry')}
          </Button>
        </div>
      )}

      {center.loading ? (
        <div className="notification-center__loading" aria-label={t('notifications.center.loading')}>
          <Skeleton active paragraph={{rows: 3}} title={false} />
        </div>
      ) : center.notifications.length === 0 ? (
        <div className="notification-center__empty">
          <BellOutlined aria-hidden="true" />
          <span>{t('notifications.center.empty')}</span>
        </div>
      ) : (
        <div className="notification-center__list">
          {center.notifications.map((item) => (
            <NotificationRow
              key={String(item.id)}
              item={item}
              pending={center.pendingReadIds.has(item.id)}
              onActivate={(selected) => void handleActivate(selected)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <Popover
      content={content}
      placement="bottomRight"
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      overlayClassName="notification-center-popover"
    >
      <Badge count={center.unreadCount} overflowCount={99} showZero={false} size="small">
        <button
          type="button"
          className="notification-center__bell"
          aria-label={center.unreadCount > 0
            ? t('notifications.center.bellUnreadLabel', {count: center.unreadCount})
            : t('notifications.center.bellLabel')}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <BellOutlined aria-hidden="true" />
        </button>
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
