import {
  AppstoreOutlined,
  AudioOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import type {
  DashboardRoadmap,
  DashboardRoadmapBlocker,
  DashboardRoadmapStep,
  DashboardRoadmapStepKey,
} from './api';

const STEP_ICONS: Record<DashboardRoadmapStepKey, React.ReactNode> = {
  script: <FileTextOutlined />,
  characters: <TeamOutlined />,
  references: <PictureOutlined />,
  music: <AudioOutlined />,
  storyboard: <AppstoreOutlined />,
  video: <VideoCameraOutlined />,
};

interface PipelineStepProps {
  step: DashboardRoadmapStep;
}

function blockerFallbackCount(
  blocker: DashboardRoadmapBlocker,
  metrics: Record<string, number>,
): number | undefined {
  if (blocker.count !== undefined) return blocker.count;

  if (blocker.code === 'incompleteScenes') {
    return Math.max(0, (metrics.scenesTotal ?? 0) - (metrics.scenesReady ?? 0));
  }
  if (blocker.code === 'missingCharacters') return metrics.missingCharacters;
  if (blocker.code === 'staleStoryboards') return metrics.scenesStale;
  if (blocker.code === 'storyboardNotReady') return metrics.scenesMissing;
  if (blocker.code === 'generationFailed') {
    return metrics.failedReferences ?? metrics.failedTracks;
  }
  return undefined;
}

const PipelineStep: React.FC<PipelineStepProps> = ({step}) => {
  const {t} = useTranslation();
  const warningId = React.useId();
  const title = t(`projectRoadmap.steps.${step.key}.title`);
  const statusKey = step.key === 'storyboard' && step.state === 'not_started'
    ? 'open'
    : step.state;
  const warningText = step.blockers.map((blocker) => {
    const count = blockerFallbackCount(blocker, step.metrics);
    return t(`projectRoadmap.blockers.${blocker.code}`, {
      count,
      defaultValue: t('projectRoadmap.blockers.unknown'),
    });
  }).join(' ');
  const content = (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="proj-pipeline-icon" aria-hidden="true">
          {STEP_ICONS[step.key]}
        </span>
        {(!step.optional || warningText) && (
          <span className="proj-pipeline-indicators">
            {!step.optional && (
              <span className={`proj-pipeline-status proj-pipeline-status--${step.state}`}>
                {t(`projectRoadmap.status.${statusKey}`)}
              </span>
            )}
            {warningText && (
              <span className="proj-pipeline-warning">
                <ExclamationCircleOutlined aria-hidden="true" />
                <span
                  className="proj-pipeline-warning__tooltip"
                  id={warningId}
                  role="tooltip"
                >
                  {warningText}
                </span>
              </span>
            )}
          </span>
        )}
      </div>
      <div className="text-white text-sm font-semibold leading-tight">{title}</div>
      {step.optional && (
        <div className="proj-pipeline-optional">{t('projectRoadmap.optional')}</div>
      )}
      {step.availability === 'coming_soon' && (
        <div className="proj-pipeline-availability">{t('projectRoadmap.comingSoon')}</div>
      )}
      {!step.optional && step.progressPercent !== null && (
        <>
          <div className="proj-pipeline-progress-label">{step.progressPercent}%</div>
          <div className="proj-progress-track mt-2" aria-hidden="true">
            <div
              className="proj-progress-fill proj-pipeline-progress-fill"
              style={{width: `${step.progressPercent}%`}}
            />
          </div>
        </>
      )}
    </>
  );

  if (step.availability === 'available') {
    return (
      <Link
        className="proj-pipeline-step"
        to={step.actionUrl}
        aria-label={t('projectRoadmap.actions.openStepLabel', {title})}
        aria-describedby={warningText ? warningId : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className="proj-pipeline-step proj-pipeline-step--disabled"
      aria-disabled="true"
      aria-describedby={warningText ? warningId : undefined}
    >
      {content}
    </div>
  );
};

interface Props {
  roadmap: DashboardRoadmap | null;
  roadmapUrl: string;
}

const ProjectPipeline: React.FC<Props> = ({roadmap, roadmapUrl}) => {
  const {t} = useTranslation();

  return (
    <section className="proj-card p-5 sm:p-6">
      <div className="proj-pipeline-heading">
        <div>
          <h3 className="proj-section-title">{t('projectRoadmap.preview.title')}</h3>
          <p>{t('projectRoadmap.preview.description')}</p>
        </div>
        <Link className="proj-btn proj-btn-secondary" to={roadmapUrl}>
          {t('projectRoadmap.preview.open')}
        </Link>
      </div>
      {roadmap && (
        <div className="proj-pipeline-grid">
          {roadmap.steps.map((step) => (
            <PipelineStep key={step.key} step={step} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProjectPipeline;
