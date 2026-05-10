import React from 'react';
import {
  UserOutlined,
  VideoCameraOutlined,
  CustomerServiceOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { ACCENT_HEX, ActivityItemMock } from './mocks';

const ICONS: Record<ActivityItemMock['iconKey'], React.ReactNode> = {
  character: <UserOutlined />,
  scene: <VideoCameraOutlined />,
  music: <CustomerServiceOutlined />,
  created: <PlusOutlined />,
};

interface Props {
  activity: ActivityItemMock[];
  loading?: boolean;
}

const RecentActivityCard: React.FC<Props> = ({ activity, loading = false }) => {
  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-3">Последняя активность</h4>

      {!loading && activity.length === 0 && (
        <div className="text-white/45 text-xs py-4 text-center">
          Нет активности
        </div>
      )}

      <div className="flex flex-col">
        {activity.map((item) => {
          const accent = ACCENT_HEX[item.accent];
          return (
            <div key={item.id} className="proj-activity-item">
              <span
                className="proj-activity-icon"
                style={{
                  background: `${accent}1f`,
                  color: accent,
                }}
              >
                {ICONS[item.iconKey]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium leading-tight truncate">
                  {item.title}
                </div>
                <div className="text-white/70 text-xs mt-0.5">
                  {item.description}
                </div>
                <div className="text-white/50 text-[11px] mt-1">{item.time}</div>
              </div>
              {item.thumbnailGradient && (
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0"
                  style={{ background: item.thumbnailGradient }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivityCard;
