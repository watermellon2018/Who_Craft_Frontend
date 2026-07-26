import React from 'react';
import { Award } from '../types';

interface Props {
  awards: Award[];
}

const AWARD_ICONS: Record<string, string> = {
  first_step: '🚀',
  storyteller: '📖',
  popular: '⭐',
  creator: '🎨',
};

const AwardsCard: React.FC<Props> = ({ awards }) => {
  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-base">🏆 Награды</h3>
        <button className="text-accent text-xs hover:underline">Смотреть все</button>
      </div>

      {awards.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-4">Награды появятся после первых действий на Craft</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {awards.map((award) => (
            <div
              key={award.code}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                award.unlocked
                  ? 'bg-accent/8 border-accent/20'
                  : 'bg-white/3 border-white/5 opacity-40'
              }`}
            >
              <span className="text-2xl flex-shrink-0">{AWARD_ICONS[award.code] || '🏅'}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${award.unlocked ? 'text-white' : 'text-white/50'}`}>
                  {award.title}
                </p>
                <p className="text-xs text-white/30 truncate">{award.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AwardsCard;
