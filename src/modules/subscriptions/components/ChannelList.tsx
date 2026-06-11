import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Channel } from '../types';
import ChannelRow from './ChannelRow';
import EmptyState from './EmptyState';
import {CRAFT_ACCENT} from '../../../constants/theme';

interface Props {
  channels: Channel[];
  title: string;
  badge?: number;
  shown: number;
  total: number;
  isSearchMode: boolean;
  searchQuery: string;
  isLoading?: boolean;
  onSubscribe: (id: number) => void;
  onUnsubscribe: (id: number) => void;
  onShowMore: () => void;
}

const ListIcon = ({ isSearch }: { isSearch: boolean }) =>
  isSearch ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.35)' }}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.35)' }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

const ChannelList: React.FC<Props> = ({
  channels,
  title,
  badge,
  shown,
  total,
  isSearchMode,
  searchQuery,
  isLoading,
  onSubscribe,
  onUnsubscribe,
  onShowMore,
}) => {
  const { t } = useTranslation();
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  const handleToggleDropdown = useCallback((channelId: number) => {
    setOpenDropdownId((current) => (current === channelId ? null : channelId));
  }, []);

  const handleUnsubscribe = useCallback(
    (id: number) => {
      setOpenDropdownId(null);
      onUnsubscribe(id);
    },
    [onUnsubscribe]
  );

  useEffect(() => {
    if (!openDropdownId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-subscription-dropdown]')) {
        setOpenDropdownId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdownId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openDropdownId]);

  return (
  <div
    className="rounded-2xl overflow-hidden"
    style={{
      background: 'linear-gradient(180deg, #171b24 0%, #141820 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    }}
  >
    {/* Header */}
    <div
      className="flex items-center gap-3 px-6 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <ListIcon isSearch={isSearchMode} />
      <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{title}</h2>
      {badge !== undefined && (
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(250,176,5,0.12)', color: 'var(--craft-accent)' }}
        >
          {badge}
        </span>
      )}
    </div>

    {isLoading && channels.length === 0 ? (
      <div className="px-6 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {t('subscriptions.list.loading')}
      </div>
    ) : channels.length === 0 ? (
      <EmptyState query={searchQuery} />
    ) : (
      <>
        <div>
          {channels.map((ch) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              isDropdownOpen={openDropdownId === ch.id}
              onToggleDropdown={handleToggleDropdown}
              onSubscribe={onSubscribe}
              onUnsubscribe={handleUnsubscribe}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>
            {t('subscriptions.list.shownCount', { shown: Math.min(shown, total), total })}
          </span>
          {shown < total && (
            <button
              onClick={onShowMore}
              className="text-xs font-medium transition-colors duration-150"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = CRAFT_ACCENT; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; }}
            >
              {t('subscriptions.list.showMore')}
            </button>
          )}
        </div>
      </>
    )}
  </div>
  );
};

export default ChannelList;
