import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const SubscriptionSearch: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
  <div
    className="rounded-2xl p-5 mb-2"
    style={{
      background: '#151922',
      border: '1px solid rgba(255,255,255,0.07)',
    }}
  >
    <div className="relative">
      <span
        className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.3)' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('subscriptions.search.placeholder')}
        className="w-full outline-none text-sm transition-all duration-200"
        style={{
          height: '50px',
          background: 'rgba(255,255,255,0.03)',
          border: value ? '1px solid rgba(250,176,5,0.45)' : '1px solid rgba(255,255,255,0.09)',
          borderRadius: '14px',
          paddingLeft: '44px',
          paddingRight: value ? '44px' : '16px',
          color: 'rgba(255,255,255,0.88)',
          fontSize: '14px',
        }}
        onFocus={(e) => {
          e.target.style.border = '1px solid rgba(250,176,5,0.45)';
        }}
        onBlur={(e) => {
          if (!value) e.target.style.border = '1px solid rgba(255,255,255,0.09)';
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label={t('subscriptions.search.clearAria')}
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-150 flex items-center justify-center w-5 h-5 rounded-full"
          style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
    <p className="mt-3 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.52)' }}>
      {t('subscriptions.search.hint')}{' '}
      <span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('subscriptions.search.hintSecondary')}</span>
    </p>
  </div>
  );
};

export default SubscriptionSearch;
