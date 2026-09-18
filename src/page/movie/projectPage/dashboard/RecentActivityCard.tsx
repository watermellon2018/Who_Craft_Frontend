import React from 'react';
import {useTranslation} from 'react-i18next';
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
  const {t, i18n} = useTranslation();
  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-3">{t('project.dashboard.activity.title')}</h4>

      {!loading && activity.length === 0 && (
        <div className="text-white/45 text-xs py-4 text-center">
          {t('project.dashboard.activity.empty')}
        </div>
      )}

      <div className="flex flex-col">
        {activity.map((item) => {
          const accent = ACCENT_HEX[item.accent];
          const description = item.description.startsWith('project.')
            ? t(item.description)
            : item.description;
          const title = item.title.startsWith('project.') ? t(item.title) : item.title;
          const parsedTime = item.time ? new Date(item.time) : null;
          const time = parsedTime && !Number.isNaN(parsedTime.getTime())
            ? new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(parsedTime)
            : '';
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
                  {title}
                </div>
                <div className="text-white/70 text-xs mt-0.5">
                  {description}
                </div>
                <div className="text-white/50 text-[11px] mt-1">{time}</div>
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
