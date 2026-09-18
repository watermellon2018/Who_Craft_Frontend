import {useCallback, useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useBlocker} from 'react-router-dom';
import type {unstable_BlockerFunction as BlockerFunction} from 'react-router-dom';
import {AUTH_EXPIRED_EVENT} from '../api/http';

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
  message?: string,
): UnsavedChangesGuard {
  const {t} = useTranslation();
  const confirmationMessage = message ?? t('unsavedChanges.confirm');
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
    if (window.confirm(confirmationMessage)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, confirmationMessage]);

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
