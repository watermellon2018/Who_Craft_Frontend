import React from 'react';
import { ProfileStats } from '../types';

interface StatCard {
  label: string;
  value: number | string;
  icon: string;
}

interface Props {
  stats: ProfileStats;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const QuickStatsGrid: React.FC<Props> = ({ stats }) => {
  const cards: StatCard[] = [
    { label: 'Сообщения', value: stats.new_messages, icon: '💬' },
    { label: 'Подписки', value: stats.subscriptions_count, icon: '👥' },
    { label: 'История просмотров', value: stats.watch_history_count, icon: '📺' },
    { label: 'Просмотры', value: stats.total_views, icon: '👁️' },
    { label: 'Рекомендации', value: stats.recommendations_count, icon: '✨' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[#16191f] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-[#fab005]/20 transition-all duration-200 group shadow-md"
        >
          <span className="text-2xl">{card.icon}</span>
          <span className="text-white font-bold text-xl">{formatNum(Number(card.value))}</span>
          <span className="text-white/40 text-xs leading-tight">{card.label}</span>
        </div>
      ))}
    </div>
  );
};

export default QuickStatsGrid;
