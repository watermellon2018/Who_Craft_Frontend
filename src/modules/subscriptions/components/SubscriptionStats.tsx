import React from 'react';

interface Props {
  total: number;
  favorites: number;
}

const SubscriptionStats: React.FC<Props> = ({ total, favorites }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
    {/* Total subscriptions */}
    <div
      className="rounded-2xl p-6 flex items-center gap-5"
      style={{
        background: 'linear-gradient(135deg, #1a1d27 0%, #151922 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.25)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div>
        <div className="text-3xl font-bold mb-0.5" style={{ color: 'rgba(255,255,255,0.92)' }}>{total}</div>
        <div className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Всего подписок</div>
        <div className="text-xs" style={{ color: 'rgba(139, 92, 246, 0.8)' }}>+2 за последние 30 дней</div>
      </div>
    </div>

    {/* Favorite authors */}
    <div
      className="rounded-2xl p-6 flex items-center gap-5"
      style={{
        background: 'linear-gradient(135deg, #1a1d27 0%, #151922 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(250, 176, 5, 0.12)', border: '1px solid rgba(250, 176, 5, 0.2)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fab005" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div>
        <div className="text-3xl font-bold mb-0.5" style={{ color: '#fab005' }}>{favorites}</div>
        <div className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Любимые авторы</div>
        <div className="text-xs" style={{ color: 'rgba(250, 176, 5, 0.7)' }}>Топ авторы по взаимодействию</div>
      </div>
    </div>
  </div>
);

export default SubscriptionStats;
