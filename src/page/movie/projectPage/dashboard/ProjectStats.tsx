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
}

const StatCard: React.FC<StatCardProps> = ({ stat }) => {
  const accentHex = ACCENT_HEX[stat.accent];
  return (
    <div className="proj-card p-5">
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
    </div>
  );
};

interface Props {
  stats: StatMock[];
}

const ProjectStats: React.FC<Props> = ({ stats }) => {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.key} stat={stat} />
      ))}
    </section>
  );
};

export default ProjectStats;
