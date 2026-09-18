import React from 'react';
import {useTranslation} from 'react-i18next';
import { ProfileCompletion as ProfileCompletionType } from '../types';
import { CRAFT_ACCENT } from '../../../constants/theme';

interface Props {
  completion: ProfileCompletionType;
}

const ProfileCompletion: React.FC<Props> = ({ completion }) => {
  const {t} = useTranslation();
  const { percent, items } = completion;
  const labels: Record<string, string> = {
    avatar: t('profile.completion.fields.avatar'),
    about: t('profile.completion.fields.about'),
    interests: t('profile.completion.fields.interests'),
    socials: t('profile.completion.fields.socials'),
  };

  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-md">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke={CRAFT_ACCENT}
              strokeWidth="3"
              strokeDasharray={`${percent} ${100 - percent}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-accent text-xs font-bold">
            {percent}%
          </span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{t('profile.completion.title')}</p>
          <p className="text-white/40 text-xs">{t('profile.completion.description')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(items).map(([key, done]) => (
          <span
            key={key}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${
              done
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-white/3 border-white/10 text-white/30'
            }`}
          >
            {done ? '✓' : '○'} {labels[key] || key}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProfileCompletion;
