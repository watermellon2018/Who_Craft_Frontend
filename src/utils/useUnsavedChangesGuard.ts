import {useCallback, useEffect, useRef} from 'react';
import {useBlocker} from 'react-router-dom';
import type {unstable_BlockerFunction as BlockerFunction} from 'react-router-dom';
import {AUTH_EXPIRED_EVENT} from '../api/http';

const DEFAULT_MESSAGE = '\u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044c \u043d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f. \u041f\u043e\u043a\u0438\u043d\u0443\u0442\u044c \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443?';

interface UnsavedChangesGuard {
  allowNextNavigation: () => void;
}

/**
 * Protects dirty editors from both SPA navigation and closing/reloading the tab.
 * The application uses a data router so React Router can safely restore blocked
 * POP navigations as well as intercept PUSH/REPLACE navigations.
 */
export function useUnsavedChangesGuard(
  hasUnsavedChanges: boolean,
  message = DEFAULT_MESSAGE,
): UnsavedChangesGuard {
  const allowNextNavigationRef = useRef(false);

  const shouldBlock = useCallback<BlockerFunction>(() => {
    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false;
      return false;
    }
    return hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(message)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, message]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const allowAuthExpiryRedirect = () => {
      allowNextNavigationRef.current = true;
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, allowAuthExpiryRedirect, {capture: true});
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, allowAuthExpiryRedirect, {capture: true});
    };
  }, []);

  const allowNextNavigation = useCallback(() => {
    allowNextNavigationRef.current = true;
  }, []);

  return {allowNextNavigation};
}
