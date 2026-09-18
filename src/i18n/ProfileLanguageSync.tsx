import React, {useEffect, useState} from 'react';
import type {PropsWithChildren} from 'react';
import {useTranslation} from 'react-i18next';

import {getStoredUserToken} from '../api/http';
import {fetchSettings} from '../modules/profile/api/profileApi';
import {isSupportedLanguage} from './index';

/**
 * Applies the authenticated user's saved interface language to every private
 * route. Local browser detection remains the public-page fallback.
 */
export default function ProfileLanguageSync({children}: PropsWithChildren) {
  const {i18n} = useTranslation();
  const [ready, setReady] = useState(() => !getStoredUserToken());

  useEffect(() => {
    if (!getStoredUserToken()) {
      setReady(true);
      return undefined;
    }

    let active = true;

    void fetchSettings()
      .then(async ({language}) => {
        if (!active || !isSupportedLanguage(language)) return;
        if (i18n.resolvedLanguage !== language) {
          await i18n.changeLanguage(language);
        }
      })
      .catch(() => {
        // Keep the locally detected language if profile settings are unavailable.
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [i18n]);

  return ready ? <>{children}</> : null;
}
