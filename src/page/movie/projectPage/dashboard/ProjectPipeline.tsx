import React from 'react';
import {
  FileTextOutlined,
  AppstoreOutlined,
  PictureOutlined,
  BoxPlotOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {ACCENT_HEX} from './mocks';
import type {PipelineStepMock} from './mocks';

const ICONS: Record<PipelineStepMock['iconKey'], React.ReactNode> = {
  script: <FileTextOutlined />,
  storyboard: <AppstoreOutlined />,
  reference: <PictureOutlined />,
  model3d: <BoxPlotOutlined />,
  video: <VideoCameraOutlined />,
};

interface PipelineStepProps {
  step: PipelineStepMock;
  enabled: boolean;
  onSelect?: (key: string) => void;
}

const PipelineStep: React.FC<PipelineStepProps> = ({step, enabled, onSelect}) => {
  const accent = ACCENT_HEX[step.accent];
  return (
    <button
      type="button"
      className="proj-pipeline-step"
      onClick={enabled ? () => onSelect?.(step.key) : undefined}
      disabled={!enabled}
      title={enabled ? `Открыть: ${step.label}` : `${step.label}: раздел пока недоступен`}
      aria-label={enabled ? `Открыть: ${step.label}` : `${step.label}: раздел пока недоступен`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
          style={{
            background: `${accent}1f`,
            color: accent,
          }}
        >
          {ICONS[step.iconKey]}
        </div>
        <span className="text-white/75 text-xs font-semibold tabular-nums">{step.progress}%</span>
      </div>
      <div className="text-white text-sm font-semibold leading-tight">{step.label}</div>
      <div className="text-white/60 text-xs mt-0.5">{step.subtitle}</div>
      <div className="proj-progress-track mt-3">
        <div
          className="proj-progress-fill"
          style={{width: `${step.progress}%`, background: accent}}
        />
      </div>
    </button>
  );
};

interface Props {
  pipeline: PipelineStepMock[];
  onStep?: (key: string) => void;
  isStepEnabled?: (key: string) => boolean;
}

const ProjectPipeline: React.FC<Props> = ({pipeline, onStep, isStepEnabled}) => {
  return (
    <section className="proj-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="proj-section-title">Структура проекта</h3>
      </div>
      <div className="proj-pipeline-grid">
        {pipeline.map((step) => (
          <PipelineStep
            key={step.key}
            step={step}
            enabled={Boolean(onStep && isStepEnabled?.(step.key))}
            onSelect={onStep}
          />
        ))}
      </div>
    </section>
  );
};

export default ProjectPipeline;