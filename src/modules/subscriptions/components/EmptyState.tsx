import React from 'react';

interface Props {
  query: string;
}

const EmptyState: React.FC<Props> = ({ query }) => (
  <div className="flex flex-col items-center justify-center py-14 px-6 gap-3">
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.25)' }}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    </div>
    <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>Каналы не найдены</p>
    <p className="text-xs text-center max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
      По запросу{' '}
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>«{query}»</span>{' '}
      ничего не найдено. Проверьте имя пользователя или попробуйте другой запрос.
    </p>
  </div>
);

export default EmptyState;
