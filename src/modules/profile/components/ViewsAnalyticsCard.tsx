import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ViewsAnalytics } from '../types';
import { CRAFT_ACCENT } from '../../../constants/theme';

interface Props {
  analytics: ViewsAnalytics;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function delta(val: number): React.ReactNode {
  const positive = val >= 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}{val}%
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2330] border border-white/10 rounded-xl px-3 py-2 text-xs text-white shadow-lg">
        <p className="text-white/50 mb-1">{label}</p>
        <p className="font-bold text-accent">{payload[0].value} просмотров</p>
      </div>
    );
  }
  return null;
};

const ViewsAnalyticsCard: React.FC<Props> = ({ analytics }) => {
  const { summary, points } = analytics;

  const chartData = points.map((p) => ({
    date: formatDate(p.date),
    views: p.views,
  }));

  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-white font-semibold text-base">📈 Статистика просмотров</h3>
        <span className="text-white/30 text-xs bg-white/5 px-3 py-1 rounded-full border border-white/5">Последние 30 дней</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white/3 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Просмотры</p>
          <p className="text-white font-bold text-lg">{summary.views.toLocaleString('ru-RU')}</p>
          {delta(summary.views_delta_percent)}
        </div>
        <div className="bg-white/3 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Уникальные зрители</p>
          <p className="text-white font-bold text-lg">{summary.unique_viewers.toLocaleString('ru-RU')}</p>
          {delta(summary.unique_viewers_delta_percent)}
        </div>
        <div className="bg-white/3 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Среднее время</p>
          <p className="text-white font-bold text-lg">{summary.average_watch_time}</p>
          {delta(summary.average_watch_time_delta_percent)}
        </div>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CRAFT_ACCENT} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CRAFT_ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={6}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="views"
              stroke={CRAFT_ACCENT}
              strokeWidth={2}
              fill="url(#viewsGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ViewsAnalyticsCard;
