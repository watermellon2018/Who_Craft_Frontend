import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {getAuthGeneration} from '../../api/http';
import {messagingApi} from './api';
import {MESSAGING_CHANGED_EVENT, useMessagingSession} from './session';
import './messaging.css';

export function MessagingUnreadBadge() {
  const {t} = useTranslation();
  const {generation, authenticated} = useMessagingSession();
  const [unread, setUnread] = useState({generation, count: 0});

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    let inFlight = false;
    let queued = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlight) {queued = true; return;}
      inFlight = true;
      try {
        const result = await messagingApi.unread({generation, signal: controller.signal});
        if (alive && generation === getAuthGeneration()) setUnread({generation, count: result.unread_count});
      } catch {
        // Keep the last confirmed count. The visible inbox owns connection errors.
      } finally {
        inFlight = false;
        if (queued && alive && generation === getAuthGeneration()) {
          queued = false;
          void refresh();
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener(MESSAGING_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(MESSAGING_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [authenticated, generation]);

  const count = authenticated && unread.generation === generation ? unread.count : 0;
  if (!count) return null;
  return <span className="messaging-unread-badge" aria-label={t('messaging.unread', {count})}>{count > 99 ? '99+' : count}</span>;
}
