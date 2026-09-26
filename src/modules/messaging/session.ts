import {useEffect, useState} from 'react';

import {AUTH_EXPIRED_EVENT, getAuthGeneration, getStoredUserToken} from '../../api/http';

export const MESSAGING_CHANGED_EVENT = 'craft:messaging-changed';

/** The event contains no private content; it only invalidates this tab's unread count. */
export function notifyMessagingChanged() {
  window.dispatchEvent(new Event(MESSAGING_CHANGED_EVENT));
}

export function useMessagingSession() {
  const [generation, setGeneration] = useState(getAuthGeneration);
  useEffect(() => {
    const update = () => setGeneration(getAuthGeneration());
    window.addEventListener('storage', update);
    window.addEventListener('focus', update);
    window.addEventListener(AUTH_EXPIRED_EVENT, update);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('focus', update);
      window.removeEventListener(AUTH_EXPIRED_EVENT, update);
      window.clearInterval(timer);
    };
  }, []);
  return {generation, authenticated: Boolean(getStoredUserToken())};
}

export function canReadVisibleConversation() {
  return document.visibilityState === 'visible' && document.hasFocus();
}
