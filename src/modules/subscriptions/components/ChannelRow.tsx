import React from 'react';
import { Channel } from '../types';

interface Props {
  channel: Channel;
  isDropdownOpen: boolean;
  onToggleDropdown: (id: number) => void;
  onSubscribe: (id: number) => void;
  onUnsubscribe: (id: number) => void;
}

const AVATAR_GRADIENTS: Record<string, string> = {
  VA: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  NS: 'linear-gradient(135deg, #06B6D4, #0E7490)',
  CA: 'linear-gradient(135deg, #F59E0B, #D97706)',
  DF: 'linear-gradient(135deg, #10B981, #059669)',
  ML: 'linear-gradient(135deg, #EF4444, #DC2626)',
  SP: 'linear-gradient(135deg, #EC4899, #DB2777)',
  FS: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
  FF: 'linear-gradient(135deg, #F97316, #EA580C)',
  FL: 'linear-gradient(135deg, #14B8A6, #0D9488)',
  FP: 'linear-gradient(135deg, #6366F1, #4F46E5)',
  EF: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
  FC: 'linear-gradient(135deg, #fab005, #d97706)',
};

const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#fab005" stroke="#fab005" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ChannelRow: React.FC<Props> = ({ channel, isDropdownOpen, onToggleDropdown, onSubscribe, onUnsubscribe }) => {
  const avatarGradient = AVATAR_GRADIENTS[channel.avatarFallback] ?? 'linear-gradient(135deg, #374151, #1F2937)';

  return (
    <div
      className="flex items-center gap-4 px-5 transition-colors duration-150 relative"
      style={{
        height: '80px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold overflow-hidden"
        style={{
          width: '48px',
          height: '48px',
          background: channel.avatarUrl ? 'transparent' : avatarGradient,
          color: '#fff',
          fontSize: '13px',
          letterSpacing: '0.5px',
        }}
      >
        {channel.avatarUrl
          ? <img src={channel.avatarUrl} alt={channel.name} className="w-full h-full object-cover" />
          : channel.avatarFallback
        }
      </div>

      {/* Name + username */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.90)' }}>
            {channel.name}
          </span>
          {channel.isFavorite && <StarIcon />}
        </div>
        <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
          @{channel.username}
        </div>
      </div>

      {/* Subscribers */}
      <div className="hidden md:block flex-shrink-0 text-xs text-right" style={{ color: 'rgba(255,255,255,0.40)', minWidth: '80px' }}>
        {channel.subscribers}
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '10px', marginTop: '2px' }}>подписчиков</div>
      </div>

      {/* Action */}
      <div className="relative flex-shrink-0" data-subscription-dropdown>
        {channel.isSubscribed ? (
          <>
            <button
              onClick={() => onToggleDropdown(channel.id)}
              className="flex items-center gap-2 text-xs font-medium transition-all duration-150"
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.75)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Подписан
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div
                className="absolute right-0 top-11 z-20 shadow-2xl"
                style={{
                  background: '#1e2230',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  minWidth: '168px',
                  padding: 0,
                }}
              >
                <button
                  className="w-full text-sm text-left transition-colors duration-100"
                  style={{
                    height: '44px',
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'transparent',
                    color: 'rgba(239, 68, 68, 0.85)',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,120,120,1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.85)'; }}
                  onClick={() => onUnsubscribe(channel.id)}
                >
                  Отписаться
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => onSubscribe(channel.id)}
            className="text-xs font-semibold transition-all duration-150"
            style={{
              height: '38px',
              padding: '0 20px',
              borderRadius: '12px',
              background: '#fab005',
              color: '#13151a',
              border: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fcc419'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fab005'; }}
          >
            Подписаться
          </button>
        )}
      </div>
    </div>
  );
};

export default ChannelRow;
