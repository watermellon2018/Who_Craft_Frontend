import React from 'react';
import { SocialLinks } from '../../types';

interface Props {
  socials: SocialLinks;
  error?: string;
  onChange: (next: SocialLinks) => void;
}

interface Row {
  key: keyof SocialLinks;
  label: string;
  icon: string;
  placeholder: string;
}

const ROWS: Row[] = [
  { key: 'telegram', label: 'Telegram', icon: '✈', placeholder: 'https://t.me/username' },
  { key: 'instagram', label: 'Instagram', icon: '📸', placeholder: 'https://instagram.com/username' },
  { key: 'youtube', label: 'YouTube', icon: '▶', placeholder: 'https://youtube.com/@channel' },
  { key: 'website', label: 'Website', icon: '🌐', placeholder: 'https://example.com' },
];

const SocialLinksCard: React.FC<Props> = ({ socials, error, onChange }) => {
  const update = (key: keyof SocialLinks, value: string) => {
    onChange({ ...socials, [key]: value });
  };

  return (
    <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3
        className="text-white font-semibold text-base mb-4"
        style={{ color: '#ffffff' }}
      >
        Соцсети и ссылки
      </h3>
      {error && (
        <p className="text-xs mb-3" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}

      <div className="space-y-2.5">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2 w-28 flex-shrink-0">
              <span
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-white/5 text-sm"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {row.icon}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {row.label}
              </span>
            </div>
            <input
              type="url"
              value={socials[row.key]}
              onChange={(e) => update(row.key, e.target.value)}
              placeholder={row.placeholder}
              className="flex-1 min-w-0 bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-[#fab005]/60 focus:ring-2 focus:ring-[#fab005]/15 transition-colors"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default SocialLinksCard;
