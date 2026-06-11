import React from 'react';
import {
  PlusOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  EnvironmentOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { ACCENT_HEX, QuickActionMock } from './mocks';

const ICONS: Record<QuickActionMock['iconKey'], React.ReactNode> = {
  newScene: <PlusOutlined />,
  genVideo: <ThunderboltOutlined />,
  upload: <UploadOutlined />,
  newLocation: <EnvironmentOutlined />,
};

interface Props {
  actions: QuickActionMock[];
  onAction?: (key: string) => void;
}

const QuickActionsCard: React.FC<Props> = ({ actions, onAction }) => {
  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-3">Быстрые действия</h4>
      <div className="flex flex-col">
        {actions.map((a) => {
          const accent = ACCENT_HEX[a.accent];
          return (
            <div
              key={a.key}
              className="proj-action-row"
              onClick={() => onAction?.(a.key)}
              role="button"
              tabIndex={0}
            >
              <span
                className="proj-action-icon"
                style={{
                  background: `${accent}1f`,
                  color: accent,
                }}
              >
                {ICONS[a.iconKey]}
              </span>
              <span className="text-white/90 text-sm font-medium flex-1 truncate">
                {a.label}
              </span>
              <RightOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActionsCard;
