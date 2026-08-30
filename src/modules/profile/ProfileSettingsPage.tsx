import {Button, Spin} from 'antd';
import React, {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {fetchSettings} from './api/profileApi';
import AccountDeletionCard from './components/AccountDeletionCard';
import ProfileSidebar from './components/ProfileSidebar';
import SettingsCard from './components/SettingsCard';
import type {ProfileSettings} from './types';
import NotificationBell from '../notifications/NotificationBell';
import './profile.css';

export default function ProfileSettingsPage() {
  const {t} = useTranslation();
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSettings(await fetchSettings());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="profile-theme-page flex h-screen overflow-hidden">
      <ProfileSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto profile-scroll">
          <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 2xl:px-10 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSidebarOpen((current) => !current)}
                className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                style={{background: 'transparent', border: 'none'}}
                aria-label={t('profile.settings.menuAria')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <span className="ml-auto"><NotificationBell /></span>
            </div>

            <header>
              <h1 className="text-2xl font-bold">{t('profile.settings.pageTitle')}</h1>
              <p className="text-white/50 text-sm mt-1">{t('profile.settings.pageDescription')}</p>
            </header>

            {loading && (
              <div className="profile-settings-state" role="status" aria-label={t('common.loading')}>
                <Spin />
              </div>
            )}

            {error && !loading && (
              <div className="profile-settings-state" role="alert">
                <p>{t('profile.settings.loadError')}</p>
                <Button onClick={() => void load()}>{t('common.retry')}</Button>
              </div>
            )}

            {!loading && !error && settings && (
              <>
                <SettingsCard settings={settings} onChange={setSettings} />
                <AccountDeletionCard />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
