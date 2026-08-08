import React from 'react';
import {
  UserOutlined,
  VideoCameraOutlined,
  CustomerServiceOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { ACCENT_HEX, StatMock } from './mocks';

const ICONS: Record<StatMock['iconKey'], React.ReactNode> = {
  characters: <UserOutlined />,
  scenes: <VideoCameraOutlined />,
  music: <CustomerServiceOutlined />,
  locations: <EnvironmentOutlined />,
};

interface StatCardProps {
  stat: StatMock;
  onOpen?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ stat, onOpen }) => {
  const accentHex = ACCENT_HEX[stat.accent];
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div
          className="proj-stat-icon"
          style={{
            background: `${accentHex}1f`,
            color: accentHex,
          }}
        >
          {ICONS[stat.iconKey]}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-white text-3xl font-bold leading-none tracking-tight">
          {stat.value}
        </div>
        <div className="text-white/85 text-sm font-medium mt-2">{stat.label}</div>
        <div className="text-white/60 text-xs mt-1">{stat.subtitle}</div>
      </div>
    </>
  );
  return onOpen ? (
    <button
      type="button"
      className="proj-card proj-stat-card p-5"
      onClick={onOpen}
      aria-label={stat.label}
    >
      {content}
    </button>
  ) : <div className="proj-card p-5">{content}</div>;
};

interface Props {
  stats: StatMock[];
  onStat?: (key: string) => void;
}

const ProjectStats: React.FC<Props> = ({ stats, onStat }) => {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.key}
          stat={stat}
          onOpen={stat.key === 'music' && onStat ? () => onStat(stat.key) : undefined}
        />
      ))}
    </section>
  );
};

export default ProjectStats;
