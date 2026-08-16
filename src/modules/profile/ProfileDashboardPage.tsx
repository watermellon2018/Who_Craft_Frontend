import React, { useCallback, useEffect, useState } from 'react';
import type { DashboardData, ProfileSettings } from './types';
import { fetchDashboard } from './api/profileApi';
import ProfileSidebar from './components/ProfileSidebar';
import ProfileHero from './components/ProfileHero';
import ProfileCompletion from './components/ProfileCompletion';
import QuickStatsGrid from './components/QuickStatsGrid';
import AwardsCard from './components/AwardsCard';
import AboutCard from './components/AboutCard';
import FavoriteGenresCard from './components/FavoriteGenresCard';
import ViewsAnalyticsCard from './components/ViewsAnalyticsCard';
import RecentActivityCard from './components/RecentActivityCard';
import FavoriteAuthorsCard from './components/FavoriteAuthorsCard';
import ContinueWatchingCard from './components/ContinueWatchingCard';
import SettingsCard from './components/SettingsCard';
import SkeletonDashboard from './components/SkeletonDashboard';
import './profile.css';

const ProfileDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await fetchDashboard();
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSettingsChange = (updated: ProfileSettings) => {
    if (!data) return;
    setData({ ...data, settings: updated });
  };

  return (
    <div className="profile-theme-page flex h-screen overflow-hidden">
      <ProfileSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto profile-scroll">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              style={{ background: 'transparent', border: 'none' }}
              aria-label="Открыть меню"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            {loading && <SkeletonDashboard />}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="text-5xl">⚠️</div>
                <p className="text-white/60 text-lg font-medium">Не удалось загрузить личный кабинет</p>
                <button
                  onClick={load}
                  className="bg-accent text-[#13151a] font-semibold px-6 py-2.5 rounded-xl hover:bg-[#fcc419] transition-colors"
                >
                  Повторить
                </button>
              </div>
            )}

            {!loading && !error && data && (
              <>
                <ProfileHero user={data.user} />
                <ProfileCompletion completion={data.profile_completion} />
                {data.stats.available !== false && <QuickStatsGrid stats={data.stats} />}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.awards.length > 0 && <AwardsCard awards={data.awards} />}
                  <AboutCard bio={data.user.bio} interests={data.interests} />
                  {data.favorite_genres.length > 0 && <FavoriteGenresCard genres={data.favorite_genres} />}
                  <SettingsCard settings={data.settings} onChange={handleSettingsChange} />
                </div>

                {data.views_analytics.available !== false && (
                  <ViewsAnalyticsCard analytics={data.views_analytics} />
                )}
                {data.continue_watching.length > 0 && (
                  <ContinueWatchingCard items={data.continue_watching} />
                )}

                {(data.recent_activity.length > 0 || data.favorite_authors.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.recent_activity.length > 0 && (
                      <RecentActivityCard activities={data.recent_activity} />
                    )}
                    {data.favorite_authors.length > 0 && (
                      <FavoriteAuthorsCard authors={data.favorite_authors} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfileDashboardPage;
