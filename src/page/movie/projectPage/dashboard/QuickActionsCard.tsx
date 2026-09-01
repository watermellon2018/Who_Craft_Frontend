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
import type {DashboardVideoPreparationSummary} from './api';

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
  onOpenVideoPreparation?: () => void;
  videoPreparation?: DashboardVideoPreparationSummary | null;
  videoPreparationLabel?: string;
}

const QuickActionsCard: React.FC<Props> = ({
  actions,
  onAction,
  isActionEnabled,
  onOpenVideoPreparation,
  videoPreparation,
  videoPreparationLabel,
}) => {
  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-3">Быстрые действия</h4>
      <div className="flex flex-col">
        {actions.map((action) => {
          const accent = ACCENT_HEX[action.accent];
          const enabled = Boolean(onAction && isActionEnabled?.(action.key));
          return (
            <React.Fragment key={action.key}>
              <button
                type="button"
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
              {action.key === 'generate_video'
                && videoPreparation
                && videoPreparationLabel
                && onOpenVideoPreparation && (
                <button
                  aria-label={videoPreparationLabel}
                  className={`mb-2 min-h-[40px] w-full rounded-lg px-3 py-2 text-left text-xs font-medium ${
                    videoPreparation.ready
                      ? 'bg-emerald-400/10 text-emerald-300'
                      : 'bg-amber-400/10 text-amber-200'
                  }`}
                  onClick={onOpenVideoPreparation}
                  type="button"
                >
                  {videoPreparationLabel}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActionsCard;
