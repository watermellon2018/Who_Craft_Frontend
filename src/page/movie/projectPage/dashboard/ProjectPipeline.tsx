import React from 'react';
import {
  FileTextOutlined,
  AppstoreOutlined,
  PictureOutlined,
  BoxPlotOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { ACCENT_HEX, PipelineStepMock } from './mocks';

const ICONS: Record<PipelineStepMock['iconKey'], React.ReactNode> = {
  script: <FileTextOutlined />,
  storyboard: <AppstoreOutlined />,
  reference: <PictureOutlined />,
  model3d: <BoxPlotOutlined />,
  video: <VideoCameraOutlined />,
};

const PipelineStep: React.FC<{ step: PipelineStepMock }> = ({ step }) => {
  const accent = ACCENT_HEX[step.accent];
  return (
    <div
      className="proj-pipeline-step"
      onClick={() => console.log('TODO: open pipeline stage', step.key)}
      role="button"
      tabIndex={0}
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
          style={{ width: `${step.progress}%`, background: accent }}
        />
      </div>
    </div>
  );
};

interface Props {
  pipeline: PipelineStepMock[];
}

const ProjectPipeline: React.FC<Props> = ({ pipeline }) => {
  return (
    <section className="proj-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="proj-section-title">Структура проекта</h3>
      </div>
      <div className="proj-pipeline-grid">
        {pipeline.map((s) => (
          <PipelineStep key={s.key} step={s} />
        ))}
      </div>
    </section>
  );
};

export default ProjectPipeline;
