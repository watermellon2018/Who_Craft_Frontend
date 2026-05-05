import React, { useCallback, useEffect, useState } from 'react';
import { DashboardData, ProfileSettings } from './types';
import { fetchDashboard } from './api/profileApi';
import ProfileSidebar from './components/ProfileSidebar';
import DashboardHeader from './components/DashboardHeader';
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
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      <ProfileSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          user={data?.user ?? null}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            {loading && <SkeletonDashboard />}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="text-5xl">⚠️</div>
                <p className="text-white/60 text-lg font-medium">Не удалось загрузить личный кабинет</p>
                <button
                  onClick={load}
                  className="bg-[#fab005] text-[#13151a] font-semibold px-6 py-2.5 rounded-xl hover:bg-[#fcc419] transition-colors"
                >
                  Повторить
                </button>
              </div>
            )}

            {!loading && !error && data && (
              <>
                <ProfileHero user={data.user} />
                <ProfileCompletion completion={data.profile_completion} />
                <QuickStatsGrid stats={data.stats} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AwardsCard awards={data.awards} />
                  <AboutCard bio={data.user.bio} interests={data.interests} />
                  <FavoriteGenresCard genres={data.favorite_genres} />
                  <SettingsCard settings={data.settings} onChange={handleSettingsChange} />
                </div>

                <ViewsAnalyticsCard analytics={data.views_analytics} />
                <ContinueWatchingCard items={data.continue_watching} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RecentActivityCard activities={data.recent_activity} />
                  <FavoriteAuthorsCard authors={data.favorite_authors} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfileDashboardPage;
