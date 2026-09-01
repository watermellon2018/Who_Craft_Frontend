import {
  AppstoreOutlined,
  AudioOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate, useParams} from 'react-router-dom';

import {getApiStatus} from '../../../../api/errors';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import PathConstants, {
  projectDashboardPath,
} from '../../../../routes/pathConstant';
import type {
  DashboardPayload,
  DashboardRoadmapBlocker,
  DashboardRoadmapStep,
  DashboardRoadmapStepKey,
} from '../dashboard/api';
import {fetchProjectDashboard} from '../dashboard/api';

import '../../../../modules/profile/profile.css';
import '../dashboard/dashboard.css';
import './ProjectRoadmapPage.css';

const PREPARATION_STEP_KEYS: DashboardRoadmapStepKey[] = [
  'script',
  'characters',
  'references',
  'music',
];

const DELIVERY_STEP_KEYS: DashboardRoadmapStepKey[] = ['storyboard', 'video'];

const STEP_ICONS: Record<DashboardRoadmapStepKey, React.ReactNode> = {
  script: <FileTextOutlined />,
  characters: <TeamOutlined />,
  references: <PictureOutlined />,
  music: <AudioOutlined />,
  storyboard: <AppstoreOutlined />,
  video: <VideoCameraOutlined />,
};

const STEP_METRIC_KEYS = {
  script: ['scenesTotal', 'scenesReady'],
  characters: ['charactersTotal', 'charactersReady'],
  references: ['referencesTotal', 'referencesReady'],
  music: ['tracksTotal', 'tracksReady'],
  storyboard: ['scenesTotal', 'scenesReady'],
  video: ['shotsTotal', 'shotsReady'],
} as const satisfies Record<
  DashboardRoadmapStepKey,
  readonly [string, string]
>;

interface RoadmapError {
  status: number | null;
}

interface RoadmapStepCardProps {
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

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({step}) => {
  const {t} = useTranslation();
  const warningId = React.useId();
  const title = t(`projectRoadmap.steps.${step.key}.title`);
  const statusKey = step.key === 'storyboard' && step.state === 'not_started'
    ? 'open'
    : step.state;
  const metricEntries = STEP_METRIC_KEYS[step.key].map((metric) => (
    [metric, step.metrics[metric] ?? 0] as const
  ));
  const warningText = step.blockers.map((blocker) => {
    const count = blockerFallbackCount(blocker, step.metrics);
    return t(`projectRoadmap.blockers.${blocker.code}`, {
      count,
      defaultValue: t('projectRoadmap.blockers.unknown'),
    });
  }).join(' ');
  const openLabel = t('projectRoadmap.actions.openStepLabel', {title});

  const content = (
    <article
      className={`project-roadmap-step project-roadmap-step--${step.state}${step.optional ? ' project-roadmap-step--optional' : ''}${warningText ? ' project-roadmap-step--has-warning' : ''}`}
      data-state={step.state}
    >
      {warningText && (
        <span className="project-roadmap-warning">
          <ExclamationCircleOutlined aria-hidden="true" />
          <span
            className="project-roadmap-warning__tooltip"
            id={warningId}
            role="tooltip"
          >
            {warningText}
          </span>
        </span>
      )}
      <div className="project-roadmap-step__heading">
        <span className="project-roadmap-step__icon" aria-hidden="true">
          {STEP_ICONS[step.key]}
        </span>
        <div className="project-roadmap-step__title-wrap">
          <div className="project-roadmap-step__badges">
            {!step.optional && (
              <span className={`project-roadmap-status project-roadmap-status--${step.state}`}>
                {t(`projectRoadmap.status.${statusKey}`)}
              </span>
            )}
            {step.optional && (
              <span className="project-roadmap-optional">
                {t('projectRoadmap.optional')}
              </span>
            )}
          </div>
          <h3>{title}</h3>
        </div>
      </div>

      {!step.optional && step.progressPercent !== null && (
        <div className="project-roadmap-step__progress">
          <div className="project-roadmap-step__progress-label">
            <span>{t('projectRoadmap.progress')}</span>
            <span>{step.progressPercent}%</span>
          </div>
          <div
            className="proj-progress-track"
            role="progressbar"
            aria-label={t('projectRoadmap.progressLabel', {title})}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={step.progressPercent}
          >
            <span
              className="proj-progress-fill project-roadmap-step__progress-fill"
              style={{width: `${step.progressPercent}%`}}
            />
          </div>
        </div>
      )}

      {metricEntries.length > 0 && (
        <dl className="project-roadmap-step__metrics">
          {metricEntries.map(([metric, value]) => (
            <div key={metric}>
              <dt>{t(`projectRoadmap.metrics.${metric}`, {defaultValue: metric})}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <span className="project-roadmap-step__action">
        {step.availability === 'available'
          ? t('projectRoadmap.actions.openStep')
          : t('projectRoadmap.comingSoon')}
        {step.availability === 'available' && <span aria-hidden="true"> →</span>}
      </span>
    </article>
  );

  if (step.availability === 'available') {
    return (
      <Link
        className="project-roadmap-step-link"
        to={step.actionUrl}
        aria-label={openLabel}
        aria-describedby={warningText ? warningId : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <div aria-disabled="true" aria-describedby={warningText ? warningId : undefined}>
      {content}
    </div>
  );
};

export const ProjectRoadmapPage: React.FC = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {projectId: routeProjectId} = useParams<{projectId: string}>();
  const projectId = routeProjectId?.trim() || null;
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<RoadmapError | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setError({status: null});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setDashboard(null);
    setError(null);
    setLoading(true);
    fetchProjectDashboard(projectId)
      .then((payload) => {
        if (cancelled) return;
        setDashboard(payload);
        setLoading(false);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError({status: getApiStatus(requestError)});
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const breadcrumbItems = useMemo(() => [
    {label: t('projectRoadmap.breadcrumbs.projects'), to: PathConstants.PROJECTS},
    ...(projectId && dashboard
      ? [{
        label: dashboard.project.title,
        to: projectDashboardPath(projectId),
      }]
      : []),
    {label: t('projectRoadmap.breadcrumbs.roadmap')},
  ], [dashboard, projectId, t]);

  if (loading) {
    return (
      <div className="proj-dash">
        <DashboardHeader breadcrumbItems={breadcrumbItems} />
        <main className="app-main profile-scroll project-roadmap-page" aria-busy="true">
          <section className="proj-card project-roadmap-state" role="status">
            <h1>{t('projectRoadmap.loading')}</h1>
            <p>{t('projectRoadmap.loadingHint')}</p>
          </section>
        </main>
      </div>
    );
  }

  if (error || !dashboard) {
    const retryable = error?.status !== 403 && error?.status !== 404 && Boolean(projectId);
    const errorKey = error?.status === 401
      ? 'unauthorized'
      : error?.status === 403
        ? 'forbidden'
        : error?.status === 404
          ? 'notFound'
          : projectId
            ? 'unknown'
            : 'missingProject';

    return (
      <div className="proj-dash">
        <DashboardHeader breadcrumbItems={breadcrumbItems} />
        <main className="app-main profile-scroll project-roadmap-page">
          <section className="proj-card project-roadmap-state" role="alert">
            <h1>{t(`projectRoadmap.errors.${errorKey}.title`)}</h1>
            <p>{t(`projectRoadmap.errors.${errorKey}.description`)}</p>
            <div className="project-roadmap-state__actions">
              {retryable && error?.status !== 401 && (
                <button
                  type="button"
                  className="proj-btn proj-btn-primary"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  {t('projectRoadmap.actions.retry')}
                </button>
              )}
              {error?.status === 401 && (
                <button
                  type="button"
                  className="proj-btn proj-btn-primary"
                  onClick={() => navigate(PathConstants.LOGIN, {
                    replace: true,
                    state: {returnTo: window.location.pathname},
                  })}
                >
                  {t('projectRoadmap.actions.signIn')}
                </button>
              )}
              <Link className="proj-btn proj-btn-secondary" to={PathConstants.PROJECTS}>
                {t('projectRoadmap.actions.backToProjects')}
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const stepByKey = new Map(
    dashboard.roadmap.steps.map((step) => [step.key, step]),
  );
  const preparationSteps = PREPARATION_STEP_KEYS
    .map((key) => stepByKey.get(key))
    .filter((step): step is DashboardRoadmapStep => Boolean(step));
  const deliverySteps = DELIVERY_STEP_KEYS
    .map((key) => stepByKey.get(key))
    .filter((step): step is DashboardRoadmapStep => Boolean(step));
  return (
    <div className="proj-dash">
      <DashboardHeader breadcrumbItems={breadcrumbItems} />
      <main className="app-main profile-scroll project-roadmap-page">
        <section
          className="project-roadmap-section project-roadmap-section--first"
          aria-labelledby="roadmap-preparation-title"
        >
          <div className="project-roadmap-section__heading">
            <div>
              <h1 id="roadmap-preparation-title">{t('projectRoadmap.groups.preparation.title')}</h1>
            </div>
          </div>
          <div className="project-roadmap-preparation-grid">
            {preparationSteps.map((step) => (
              <RoadmapStepCard key={step.key} step={step} />
            ))}
          </div>
        </section>

        <div className="project-roadmap-convergence" aria-hidden="true">
          <span />
          <span>↓</span>
          <span />
        </div>

        <section className="project-roadmap-section" aria-labelledby="roadmap-delivery-title">
          <div className="project-roadmap-section__heading">
            <div>
              <h2 id="roadmap-delivery-title">{t('projectRoadmap.groups.delivery.title')}</h2>
            </div>
          </div>
          <div className="project-roadmap-delivery-grid">
            {deliverySteps.map((step, index) => (
              <React.Fragment key={step.key}>
                <RoadmapStepCard step={step} />
                {index < deliverySteps.length - 1 && (
                  <span className="project-roadmap-delivery-arrow" aria-hidden="true">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
};

export default ProjectRoadmapPage;
