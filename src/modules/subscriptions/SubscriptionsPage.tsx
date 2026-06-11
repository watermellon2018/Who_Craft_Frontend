import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import ProfileSidebar from '../profile/components/ProfileSidebar';
import { fetchDashboard } from '../profile/api/profileApi';
import { ProfileUser } from '../profile/types';
import SubscriptionStats from './components/SubscriptionStats';
import SubscriptionSearch from './components/SubscriptionSearch';
import ChannelList from './components/ChannelList';
import { Channel } from './types';
import {
  ApiChannel,
  fetchMySubscriptions,
  searchChannels,
  subscribeToChannel,
  unsubscribeFromChannel,
} from './api/subscriptionsApi';
import '../profile/profile.css';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function formatSubscribers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function avatarFallback(name: string, username: string | null): string {
  const source = (name || username || '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function toChannel(api: ApiChannel): Channel {
  const name = api.displayName || api.username || 'Unknown';
  return {
    id: api.id,
    name,
    username: api.username || '',
    subscribers: formatSubscribers(api.subscribersCount),
    avatarUrl: api.avatarUrl,
    avatarFallback: avatarFallback(name, api.username),
    isSubscribed: api.isSubscribed,
    notificationsEnabled: api.notificationsEnabled,
    isFavorite: api.isFavorite,
  };
}

const SubscriptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<ProfileUser | null>(null);

  const [mySubs, setMySubs] = useState<Channel[]>([]);
  const [totalSubs, setTotalSubs] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loadingSubs, setLoadingSubs] = useState(true);

  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchSeqRef = useRef(0);

  const normalizedQuery = searchQuery.replace(/^@/, '').trim();
  const isSearchMode = normalizedQuery.length > 0;

  // -- load dashboard user (for header) --
  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((d) => { if (!cancelled) setUser(d.user); })
      .catch(() => { /* header has graceful fallback */ });
    return () => { cancelled = true; };
  }, []);

  // -- load my subscriptions --
  const loadMySubs = useCallback(async (options?: {silent?: boolean}) => {
    setLoadingSubs(true);
    try {
      const res = await fetchMySubscriptions(PAGE_SIZE, 0);
      setMySubs(res.items.map(toChannel));
      setTotalSubs(res.total);
      setFavoriteCount(res.favoriteCount);
    } catch {
      if (!options?.silent) {
        message.error(t('subscriptions.errors.loadFailed'));
      }
    } finally {
      setLoadingSubs(false);
    }
  }, [t]);

  useEffect(() => { loadMySubs(); }, [loadMySubs]);

  // -- debounced search --
  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const seq = ++searchSeqRef.current;
    setSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchChannels(normalizedQuery, PAGE_SIZE, 0);
        if (seq !== searchSeqRef.current) return;
        setSearchResults(res.items.map(toChannel));
      } catch {
        if (seq !== searchSeqRef.current) return;
        setSearchResults([]);
        message.error(t('subscriptions.errors.searchFailed'));
      } finally {
        if (seq === searchSeqRef.current) setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [isSearchMode, normalizedQuery]);

  const displayedChannels = isSearchMode ? searchResults : mySubs;

  const updateChannelInLists = useCallback(
    (id: number, patch: Partial<Channel>) => {
      setMySubs((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      setSearchResults((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [],
  );

  const handleSubscribe = useCallback(async (id: number) => {
    try {
      const res = await subscribeToChannel(id);
      updateChannelInLists(id, {
        isSubscribed: res.subscription.isSubscribed,
        isFavorite: res.subscription.isFavorite,
        notificationsEnabled: res.subscription.notificationsEnabled,
      });
      // Refresh subscriptions list + counters so the new subscription appears in "Мои подписки".
      loadMySubs({silent: true});
    } catch {
      message.error(t('subscriptions.errors.subscribeFailed'));
    }
  }, [loadMySubs, updateChannelInLists, t]);

  const handleUnsubscribe = useCallback(async (id: number) => {
    try {
      const res = await unsubscribeFromChannel(id);
      // Drop from "Мои подписки" immediately; in search mode keep the item but flip state.
      setMySubs((prev) => prev.filter((c) => c.id !== id));
      setSearchResults((prev) => prev.map((c) =>
        c.id === id
          ? {
              ...c,
              isSubscribed: res.subscription.isSubscribed,
              isFavorite: res.subscription.isFavorite,
              notificationsEnabled: res.subscription.notificationsEnabled,
            }
          : c,
      ));
      setTotalSubs((n) => Math.max(0, n - 1));
      setFavoriteCount((n) => Math.max(0, n));
      // Refetch authoritative counts (favorites may have decreased too).
      loadMySubs({silent: true});
    } catch {
      message.error(t('subscriptions.errors.unsubscribeFailed'));
    }
  }, [loadMySubs, t]);

  const listTitle = isSearchMode ? t('subscriptions.list.searchResults') : t('subscriptions.list.mySubscriptions');
  const listBadge = isSearchMode ? displayedChannels.length : undefined;
  const listTotal = isSearchMode ? displayedChannels.length : totalSubs;
  const listShown = displayedChannels.length;

  const isInitialLoading = !isSearchMode && loadingSubs && mySubs.length === 0;

  const stats = useMemo(
    () => ({ total: totalSubs, favorites: favoriteCount }),
    [totalSubs, favoriteCount],
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d1016' }}>
      <ProfileSidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem="Подписки"
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto profile-scroll">
          <div
            className="w-full mx-auto"
            style={{ maxWidth: '1240px', padding: '32px 40px 56px' }}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors mb-2"
              style={{ background: 'transparent', border: 'none' }}
              aria-label={t('subscriptions.menuAria')}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <div className="mb-7">
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {t('subscriptions.pageTitle')}
              </h1>
            </div>

            <SubscriptionStats total={stats.total} favorites={stats.favorites} />

            <SubscriptionSearch value={searchQuery} onChange={setSearchQuery} />

            <ChannelList
              channels={displayedChannels}
              title={listTitle}
              badge={listBadge}
              shown={listShown}
              total={listTotal}
              isSearchMode={isSearchMode}
              searchQuery={searchQuery}
              isLoading={isSearchMode ? searchLoading : isInitialLoading}
              onSubscribe={handleSubscribe}
              onUnsubscribe={handleUnsubscribe}
              onShowMore={() => { /* pagination intentionally simple for now */ }}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SubscriptionsPage;
