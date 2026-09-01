import {WarningOutlined} from '@ant-design/icons';
import React from 'react';

import {CRAFT_ACCENT} from '../../../../constants/theme';
import type {ProgressLegendItem, StoryboardReviewSceneMock} from './mocks';
import {ACCENT_HEX} from './mocks';

const RING_COLOR = CRAFT_ACCENT;
const RING_TRACK = 'rgba(255, 255, 255, 0.08)';

interface Props {
  overall: number;
  legend: ProgressLegendItem[];
  storyboardNeedsReview: number;
  storyboardReviewScenes: StoryboardReviewSceneMock[];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function reviewWarningText(count: number): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} раскадровок требуют проверки`;
  }
  if (lastDigit === 1) return `${count} раскадровка требует проверки`;
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} раскадровки требуют проверки`;
  }
  return `${count} раскадровок требуют проверки`;
}

const ProjectProgressCard: React.FC<Props> = ({
  overall,
  legend,
  storyboardNeedsReview,
  storyboardReviewScenes,
}) => {
  const clamped = clampPercent(overall);
  const angle = Math.round((clamped / 100) * 360);
  const visibleReviewScenes = storyboardReviewScenes.slice(0, 3);
  const hiddenReviewSceneCount = Math.max(0, storyboardNeedsReview - visibleReviewScenes.length);

  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-4">Готовность проекта</h4>

      <div className="flex flex-col items-center mb-5">
        <div
          className="proj-ring"
          role="progressbar"
          aria-label="Общая готовность проекта"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
          style={{
            background: `conic-gradient(${RING_COLOR} 0deg ${angle}deg, ${RING_TRACK} ${angle}deg 360deg)`,
          }}
        >
          <div className="proj-ring-content">
            <div className="text-white text-3xl font-bold leading-none tabular-nums">
              {clamped}%
            </div>
            <div className="text-white/65 text-[11px] mt-1.5">Общая готовность</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {legend.map((item) => {
          const accent = ACCENT_HEX[item.accent];
          const value = item.value === null ? null : clampPercent(item.value);
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    aria-hidden="true"
                    style={{ background: accent }}
                  />
                  <span className="text-white/85 text-xs">{item.label}</span>
                </div>
                <span className="text-white/70 text-xs font-medium tabular-nums">
                  {value === null ? 'N/A' : `${value}%`}
                </span>
              </div>
              <div
                className="proj-progress-track"
                {...(value === null
                  ? {'aria-hidden': true}
                  : {
                      'aria-label': item.label,
                      'aria-valuemax': 100,
                      'aria-valuemin': 0,
                      'aria-valuenow': value,
                      role: 'progressbar',
                    })}
              >
                <div
                  className="proj-progress-fill"
                  style={{width: `${value ?? 0}%`, background: accent}}
                />
              </div>
            </div>
          );
        })}
      </div>

      {storyboardNeedsReview > 0 && (
        <div
          className="mt-4 rounded-xl border px-3 py-2.5 text-xs"
          role="status"
          style={{
            background: 'var(--craft-accent-soft)',
            borderColor: 'var(--craft-accent-border)',
            color: 'var(--craft-text-soft)',
          }}
        >
          <div className="flex items-start gap-2 font-medium" style={{color: 'var(--craft-accent)'}}>
            <WarningOutlined aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{reviewWarningText(storyboardNeedsReview)}</span>
          </div>
          {visibleReviewScenes.length > 0 && (
            <ul className="mt-2 mb-0 pl-5 space-y-1" aria-label="Сцены с устаревшей раскадровкой">
              {visibleReviewScenes.map((scene) => (
                <li
                  key={scene.sceneId}
                  title={`Подтверждена версия ${scene.acceptedRevision}, текущая версия ${scene.currentRevision}`}
                >
                  {scene.title || `Сцена ${scene.sceneId}`}
                  <span className="sr-only">
                    {`, подтверждена версия ${scene.acceptedRevision}, текущая версия ${scene.currentRevision}`}
                  </span>
                </li>
              ))}
              {hiddenReviewSceneCount > 0 && <li>И ещё {hiddenReviewSceneCount}</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectProgressCard;
