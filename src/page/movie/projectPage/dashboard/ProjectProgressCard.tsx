import React from 'react';
import { ACCENT_HEX, ProgressLegendItem } from './mocks';

const RING_COLOR = '#fab005';
const RING_TRACK = 'rgba(255, 255, 255, 0.08)';

interface Props {
  overall: number;
  legend: ProgressLegendItem[];
}

const ProjectProgressCard: React.FC<Props> = ({ overall, legend }) => {
  const clamped = Math.max(0, Math.min(100, overall));
  const angle = Math.round((clamped / 100) * 360);

  return (
    <div className="proj-card p-5">
      <h4 className="text-white text-sm font-semibold mb-4">Прогресс проекта</h4>

      <div className="flex flex-col items-center mb-5">
        <div
          className="proj-ring"
          style={{
            background: `conic-gradient(${RING_COLOR} 0deg ${angle}deg, ${RING_TRACK} ${angle}deg 360deg)`,
          }}
        >
          <div className="proj-ring-content">
            <div className="text-white text-3xl font-bold leading-none tabular-nums">
              {clamped}%
            </div>
            <div className="text-white/65 text-[11px] mt-1.5">Общий прогресс</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {legend.map((item) => {
          const accent = ACCENT_HEX[item.accent];
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: accent }}
                  />
                  <span className="text-white/85 text-xs">{item.label}</span>
                </div>
                <span className="text-white/70 text-xs font-medium tabular-nums">
                  {item.value}%
                </span>
              </div>
              <div className="proj-progress-track">
                <div
                  className="proj-progress-fill"
                  style={{ width: `${item.value}%`, background: accent }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectProgressCard;
