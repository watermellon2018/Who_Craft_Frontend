import React from 'react';
import {
  EnvironmentOutlined,
  PictureOutlined,
  PlusOutlined,
  RightOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {ACCENT_HEX} from './mocks';
import type {QuickActionMock} from './mocks';

const ICONS: Record<QuickActionMock['iconKey'], React.ReactNode> = {
  newScene: <PlusOutlined />,
  genVideo: <ThunderboltOutlined />,
  upload: <UploadOutlined />,
  newLocation: <EnvironmentOutlined />,
  newReference: <PictureOutlined />,
  newCharacter: <UserAddOutlined />,
  newTrack: <SoundOutlined />,
};

interface Props {
  actions: QuickActionMock[];
  onAction?: (key: string) => void;
  isActionEnabled?: (key: string) => boolean;
}

const QuickActionsCard: React.FC<Props> = ({actions, onAction, isActionEnabled}) => {
  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-3">Быстрые действия</h4>
      <div className="flex flex-col">
        {actions.map((action) => {
          const accent = ACCENT_HEX[action.accent];
          const enabled = Boolean(onAction && isActionEnabled?.(action.key));
          return (
            <button
              type="button"
              key={action.key}
              className="proj-action-row"
              onClick={enabled ? () => onAction?.(action.key) : undefined}
              disabled={!enabled}
              title={enabled ? action.label : `${action.label}: функция пока недоступна`}
              aria-label={enabled ? action.label : `${action.label}: функция пока недоступна`}
            >
              <span
                className="proj-action-icon"
                style={{
                  background: `${accent}1f`,
                  color: accent,
                }}
              >
                {ICONS[action.iconKey]}
              </span>
              <span className="text-white/90 text-sm font-medium flex-1 truncate">
                {action.label}
              </span>
              <RightOutlined style={{fontSize: 11, color: 'rgba(255,255,255,0.5)'}} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActionsCard;
