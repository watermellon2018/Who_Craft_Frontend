import React from 'react';
import { ProfileCompletion as ProfileCompletionType } from '../types';

interface Props {
  completion: ProfileCompletionType;
}

const LABELS: Record<string, string> = {
  avatar: 'Аватар',
  about: 'О себе',
  interests: 'Интересы',
  socials: 'Соцсети',
};

const ProfileCompletion: React.FC<Props> = ({ completion }) => {
  const { percent, items } = completion;

  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-md">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke="#fab005"
              strokeWidth="3"
              strokeDasharray={`${percent} ${100 - percent}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[#fab005] text-xs font-bold">
            {percent}%
          </span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Профиль заполнен</p>
          <p className="text-white/40 text-xs">Заполните все поля</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(items).map(([key, done]) => (
          <span
            key={key}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${
              done
                ? 'bg-[#fab005]/10 border-[#fab005]/30 text-[#fab005]'
                : 'bg-white/3 border-white/10 text-white/30'
            }`}
          >
            {done ? '✓' : '○'} {LABELS[key] || key}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProfileCompletion;
