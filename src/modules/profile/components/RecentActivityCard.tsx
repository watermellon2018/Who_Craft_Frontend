import React from 'react';
import { ActivityItem } from '../types';

interface Props {
  activities: ActivityItem[];
}

const TYPE_ICONS: Record<string, string> = {
  subscription: '👥',
  views_milestone: '🎉',
  bookmark: '🔖',
  lesson: '🎓',
  comment_like: '❤️',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

const RecentActivityCard: React.FC<Props> = ({ activities }) => {
  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4">⚡ Недавняя активность</h3>

      {activities.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-4">Здесь появится ваша активность на Craft</p>
      ) : (
        <div className="space-y-3">
          {activities.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-sm">
                {TYPE_ICONS[item.type] || '📌'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-sm leading-snug">{item.text}</p>
                <p className="text-white/25 text-xs mt-0.5">{timeAgo(item.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivityCard;
