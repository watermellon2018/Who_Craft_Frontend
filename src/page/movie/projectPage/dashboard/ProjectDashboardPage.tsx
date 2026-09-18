import React, { useCallback, useEffect, useState } from 'react';
import {useTranslation} from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import { fetchDashboard } from '../../../../modules/profile/api/profileApi';
import type { ProfileUser } from '../../../../modules/profile/types';
import PathConstants, {
  characterCreatePath,
  musicStudioCreatePath,
  musicStudioPath,
  musicTrackPath,
  projectEditPath,
  projectRoadmapPath,
  referenceCreatePath,
  referenceEditPath,
  referenceLibraryPath,
  videoPath,
  videoPreparationPath,
} from '../../../../routes/pathConstant';
import withAuth from '../../../../utils/auth/check_auth';

import ProjectHero from './ProjectHero';
import ProjectStats from './ProjectStats';
import CharactersSection from './CharactersSection';
import ProjectPipeline from './ProjectPipeline';
import ProjectVisualLibrary from './ProjectVisualLibrary';
import ProjectMusic from './ProjectMusic';
import RightProjectPanel from './RightProjectPanel';
import type {
  ProjectMock,
  StatMock,
  CharacterMock,
  TrackMock,
  ProgressLegendItem,
  QuickActionMock,
  StoryboardReviewSceneMock,
  ActivityItemMock,
} from './mocks';
import {
  fetchProjectDashboard,
  adaptActivity,
  adaptCharacters,
  adaptMusic,
  adaptProgress,
  adaptProject,
  adaptQuickActions,
  adaptStats,
  updateProjectStatus,
  deleteProject as apiDeleteProject,
} from './api';
import type {
  DashboardPayload,
  DashboardRoadmap,
  DashboardVideoPreparationSummary,
  ProjectStatusValue,
} from './api';
import InviteMemberModal from '../team/InviteMemberModal';
import { fetchTeamSummary, leaveProject, teamErrorCode } from '../../../../api/projects/team';
import { message } from 'antd';
import {craftModal} from '../../../../theme/CraftModalHost';
import { getApiStatus } from '../../../../api/errors';

import '../../../../modules/profile/profile.css';
import './dashboard.css';

interface ViewModel {
  project: ProjectMock;
  stats: StatMock[];
  characters: CharacterMock[];
  roadmap: DashboardRoadmap | null;
  music: TrackMock[];
  progressOverall: number;
  progressLegend: ProgressLegendItem[];
  storyboardNeedsReview: number;
  storyboardReviewScenes: StoryboardReviewSceneMock[];
  quickActions: QuickActionMock[];
  activity: ActivityItemMock[];
  videoPreparation: DashboardVideoPreparationSummary | null;
}

function buildEmptyViewModel(): ViewModel {
  return {
    project: {
      id: '',
      title: '',
      subtitle: 'project.dashboard.subtitle',
      status: 'work',
      statusLabel: '',
      isFavorite: false,
      coverImageUrl: null,
      coverGradient: 'linear-gradient(135deg, #131722 0%, #1a1f2c 100%)',
      genres: [],
      description: '',
      updatedAtLabel: '',
      team: [],
      teamExtraCount: 0,
    },
    stats: [
      { key: 'characters', label: 'project.dashboard.stats.characters', value: 0, iconKey: 'characters', accent: 'purple' },
      { key: 'scenes', label: 'project.dashboard.stats.scenes', value: 0, iconKey: 'scenes', accent: 'blue' },
      { key: 'music', label: 'project.dashboard.stats.music', value: 0, iconKey: 'music', accent: 'green' },
      { key: 'locations', label: 'project.dashboard.stats.references', value: 0, iconKey: 'locations', accent: 'yellow' },
    ],
    characters: [],
    roadmap: null,
    music: [],
    progressOverall: 0,
    progressLegend: [
      { label: 'project.dashboard.progress.script', value: 0, accent: 'yellow' },
      { label: 'project.dashboard.progress.characters', value: null, accent: 'purple' },
      { label: 'project.dashboard.progress.storyboard', value: 0, accent: 'green' },
      { label: 'project.dashboard.progress.video', value: 0, accent: 'blue' },
    ],
    storyboardNeedsReview: 0,
    storyboardReviewScenes: [],
    quickActions: [
      { key: 'new_scene', label: 'project.dashboard.quickActions.new_scene', iconKey: 'newScene', accent: 'blue' },
      { key: 'generate_video', label: 'project.dashboard.quickActions.generate_video', iconKey: 'genVideo', accent: 'red' },
      { key: 'create_location', label: 'project.dashboard.quickActions.create_location', iconKey: 'newReference', accent: 'yellow' },
      { key: 'create_character', label: 'project.dashboard.quickActions.create_character', iconKey: 'newCharacter', accent: 'purple' },
      { key: 'create_track', label: 'project.dashboard.quickActions.create_track', iconKey: 'newTrack', accent: 'green' },
    ],
    activity: [],
    videoPreparation: null,
  };
}

function buildViewModel(data: DashboardPayload): ViewModel {
  const progress = adaptProgress(data.progress);

  return {
    project: adaptProject(data.project),
    stats: adaptStats(data.stats),
    characters: adaptCharacters(data.characters),
    roadmap: data.roadmap ?? null,
    music: adaptMusic(data.music),
    progressOverall: progress.overall,
    progressLegend: progress.legend,
    storyboardNeedsReview: progress.storyboardNeedsReview,
    storyboardReviewScenes: progress.storyboardReviewScenes,
    quickActions: adaptQuickActions(data.quickActions),
    activity: adaptActivity(data.recentActivity),
    videoPreparation: data.progress?.readiness?.videoPreparation ?? null,
  };
}

export const ProjectDashboardPage: React.FC = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = routeProjectId?.trim() || null;

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [, setSidebarOpen] = useState(false);
  const [viewModel, setViewModel] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{status: number | null} | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamRoleOptions, setTeamRoleOptions] = useState<{ value: string; label: string }[]>([]);

  // Keep layout stable while the canonical URL project id is being loaded.
  const [skeleton] = useState<ViewModel>(() => buildEmptyViewModel());

  // Topbar user.
  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // Silent fail — DashboardHeader gracefully handles null user.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Project dashboard data.
  useEffect(() => {
    if (!projectId) {
      setViewModel(null);
      setError({status: null});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setViewModel(null);
    fetchProjectDashboard(projectId)
      .then((data) => {
        if (cancelled) return;
        setViewModel(buildViewModel(data));
        setLoading(false);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        const status = getApiStatus(requestError);
        setError({status});
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const view: ViewModel = viewModel ?? skeleton;

  const handleOpenScript = () => {
    if (!projectId) return;
    const url = PathConstants.SCRIPT_PAGE.replace(':projectId', String(projectId));
    navigate(url, { state: { project_id: projectId } });
  };
  const handleOpenMusic = useCallback(() => {
    if (!projectId) return;
    navigate(musicStudioPath(projectId));
  }, [navigate, projectId]);
  const handleCreateMusic = useCallback(() => {
    if (!projectId) return;
    navigate(musicStudioCreatePath(projectId));
  }, [navigate, projectId]);
  const handleOpenMusicTrack = useCallback((trackId: string) => {
    if (!projectId) return;
    navigate(musicTrackPath(projectId, trackId));
  }, [navigate, projectId]);
  const handleStat = useCallback((key: string) => {
    if (!projectId) return;

    if (key === 'characters') {
      navigate(PathConstants.CHARACTER_STUDIO.replace(':projectId', String(projectId)));
      return;
    }
    if (key === 'scenes') {
      navigate(
        PathConstants.SCRIPT_PAGE.replace(':projectId', String(projectId)),
        {state: {project_id: projectId}},
      );
      return;
    }
    if (key === 'music') {
      handleOpenMusic();
      return;
    }
    if (key === 'locations') {
      navigate(referenceLibraryPath(projectId));
    }
  }, [handleOpenMusic, navigate, projectId]);

  const handleContinue = () => {
    if (!projectId) return;
    navigate(projectRoadmapPath(projectId));
  };
  const handleOpenCharacters = () => {
    if (!projectId) return;
    const url = PathConstants.CHARACTER_STUDIO.replace(':projectId', String(projectId));
    navigate(url);
  };
  const handleCreateCharacter = handleOpenCharacters;
  const handleCharacterClick = useCallback(
    (characterId: string) => {
      if (!projectId) return;
      const url = PathConstants.CHARACTER_STUDIO_EDITOR
        .replace(':projectId', String(projectId))
        .replace(':characterId', String(characterId));
      navigate(url);
    },
    [navigate, projectId],
  );
  const handleQuickAction = (key: string) => {
    if (key === 'new_scene') handleOpenScript();
    if (key === 'create_location' && projectId) navigate(referenceCreatePath(projectId));
    if (key === 'create_character' && projectId) navigate(characterCreatePath(projectId));
    if (key === 'create_track') handleCreateMusic();
    if (key === 'generate_video' && projectId) navigate(videoPath(projectId));
  };
  const isQuickActionEnabled = (key: string) =>
    key === 'new_scene'
    || (key === 'create_location' && Boolean(view.project.permissions?.canEdit))
    || (key === 'create_character' && Boolean(view.project.permissions?.canEdit))
    || (key === 'create_track' && Boolean(view.project.permissions?.canRunGeneration))
    || (key === 'generate_video' && Boolean(view.project.permissions?.canRunGeneration));

  const handleOpenVideoPreparation = useCallback(() => {
    if (!projectId) return;
    navigate(videoPreparationPath(projectId));
  }, [navigate, projectId]);

  const applySummaryToView = useCallback(
    (summary: {
      title: string;
      description: string;
      status: ProjectStatusValue;
      statusLabel: string;
      isFavorite: boolean;
      tags?: string[];
      updatedAt?: string | null;
    }) => {
      setViewModel((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          project: {
            ...prev.project,
            title: summary.title,
            description: summary.description,
            statusKey: summary.status,
            statusLabel: summary.statusLabel,
            isFavorite: summary.isFavorite,
            genres: summary.tags ?? prev.project.genres,
            updatedAtLabel: summary.updatedAt ?? prev.project.updatedAtLabel,
            status:
              summary.status === 'completed'
                ? 'done'
                : summary.status === 'archived'
                ? 'paused'
                : 'work',
          },
        };
      });
    },
    [],
  );

  const handleStatusChange = useCallback(
    async (next: ProjectStatusValue) => {
      if (!projectId) return;
      const prev = view.project.statusKey;
      // Optimistic update.
      applySummaryToView({
        title: view.project.title,
        description: view.project.description,
        status: next,
        statusLabel: `project.status.${next}`,
        isFavorite: view.project.isFavorite,
        tags: view.project.genres,
      });
      setStatusUpdating(true);
      try {
        const summary = await updateProjectStatus(projectId, next);
        applySummaryToView({
          title: summary.title,
          description: summary.description,
          status: summary.status,
          statusLabel: summary.statusLabel,
          isFavorite: summary.isFavorite,
          tags: summary.tags,
          updatedAt: summary.updatedAt,
        });
        message.success(t('project.dashboard.notifications.statusUpdated'));
      } catch (requestError: unknown) {
        // Roll back.
        if (prev) {
          applySummaryToView({
            title: view.project.title,
            description: view.project.description,
            status: prev,
            statusLabel: view.project.statusLabel,
            isFavorite: view.project.isFavorite,
            tags: view.project.genres,
          });
        }
        const status = getApiStatus(requestError);
        if (status === 403) message.error(t('project.dashboard.errors.changeStatusForbidden'));
        else message.error(t('project.dashboard.errors.changeStatus'));
      } finally {
        setStatusUpdating(false);
      }
    },
    [projectId, view.project, applySummaryToView, t],
  );

  const handleEdit = useCallback(() => {
    if (!projectId) return;
    navigate(projectEditPath(projectId));
  }, [navigate, projectId]);

  const handleOpenTeam = useCallback(() => {
    if (!projectId) return;
    const url = PathConstants.PROJECT_TEAM.replace(
      ':projectId',
      String(projectId),
    );
    navigate(url, { state: { project_id: projectId } });
  }, [navigate, projectId]);

  const handleOpenInvite = useCallback(async () => {
    // Lazily fetch the professional-role options for the invite form select.
    if (teamRoleOptions.length === 0 && projectId) {
      try {
        const summary = await fetchTeamSummary(projectId);
        setTeamRoleOptions(summary.teamRoleOptions || []);
      } catch {
        /* non-fatal — the modal still works without prof-role options */
      }
    }
    setInviteOpen(true);
  }, [teamRoleOptions.length, projectId]);

  const handleArchive = useCallback(() => {
    if (!projectId) return;
    craftModal.confirm({
      title: t('project.dashboard.archive.title'),
      content: t('project.dashboard.archive.description'),
      okText: t('project.dashboard.archive.action'),
      cancelText: t('project.common.cancel'),
      okButtonProps: {
        style: { background: 'var(--craft-accent)', borderColor: 'var(--craft-accent)', color: '#111827', fontWeight: 700 },
      },
      onOk: async () => {
        try {
          const summary = await updateProjectStatus(projectId, 'archived');
          applySummaryToView({
            title: summary.title,
            description: summary.description,
            status: summary.status,
            statusLabel: summary.statusLabel,
            isFavorite: summary.isFavorite,
            tags: summary.tags,
            updatedAt: summary.updatedAt,
          });
          message.success(t('project.dashboard.notifications.archived'));
        } catch (requestError: unknown) {
          const status = getApiStatus(requestError);
          if (status === 403) message.error(t('project.dashboard.errors.archiveForbidden'));
          else message.error(t('project.dashboard.errors.archive'));
          throw requestError;
        }
      },
    });
  }, [projectId, applySummaryToView, t]);

  const handleUnarchive = useCallback(async () => {
    if (!projectId) return;
    try {
      const summary = await updateProjectStatus(projectId, 'in_progress');
      applySummaryToView({
        title: summary.title,
        description: summary.description,
        status: summary.status,
        statusLabel: summary.statusLabel,
        isFavorite: summary.isFavorite,
        tags: summary.tags,
        updatedAt: summary.updatedAt,
      });
      message.success(t('project.dashboard.notifications.restored'));
    } catch (requestError: unknown) {
      const status = getApiStatus(requestError);
      if (status === 403) message.error(t('project.dashboard.errors.restoreForbidden'));
      else message.error(t('project.dashboard.errors.restore'));
    }
  }, [projectId, applySummaryToView, t]);

  const handleLeave = useCallback(() => {
    if (!projectId) return;
    craftModal.confirm({
      title: t('project.dashboard.leave.title'),
      content: t('project.dashboard.leave.description'),
      okText: t('project.dashboard.leave.action'),
      okButtonProps: { danger: true },
      cancelText: t('project.common.cancel'),
      onOk: async () => {
        try {
          await leaveProject(projectId);
          message.success(t('project.dashboard.notifications.left'));
          navigate(PathConstants.PROJECTS);
        } catch (requestError: unknown) {
          const code = teamErrorCode(requestError);
          if (code === 'OWNER_CANNOT_LEAVE') {
            message.error(t('project.dashboard.errors.ownerCannotLeave'));
          } else {
            message.error(t('project.dashboard.errors.leave'));
          }
          throw requestError;
        }
      },
    });
  }, [projectId, navigate, t]);

  const handleDelete = useCallback(() => {
    if (!projectId) return;
    craftModal.confirm({
      title: t('project.dashboard.delete.title'),
      content: t('project.dashboard.delete.description'),
      okText: t('project.dashboard.delete.action'),
      cancelText: t('project.common.cancel'),
      okButtonProps: {
        danger: true,
        style: { fontWeight: 600 },
      },
      onOk: async () => {
        try {
          await apiDeleteProject(projectId);
          message.success(t('project.dashboard.notifications.deleted'));
          navigate(PathConstants.PROJECTS);
        } catch (requestError: unknown) {
          const status = getApiStatus(requestError);
          if (status === 403) message.error(t('project.dashboard.errors.deleteForbidden'));
          else message.error(t('project.dashboard.errors.delete'));
          throw requestError;
        }
      },
    });
  }, [projectId, navigate, t]);

  if (error) {
    const retryable = error.status !== 403 && error.status !== 404;
    const errorTitle = error.status === 401
      ? t('project.dashboard.errors.authentication')
      : error.status === 403
        ? t('project.dashboard.errors.forbidden')
        : error.status === 404
          ? t('project.dashboard.errors.notFound')
          : error.status === null
            ? t('project.dashboard.errors.missingProject')
            : t('project.dashboard.errors.load');
    return (
      <div className="proj-dash">
        <DashboardHeader
          user={user}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          sectionTitle={t('project.common.project')}
        />
        <main className="app-main profile-scroll">
          <section
            role="alert"
            className="proj-card"
            style={{maxWidth: 640, margin: '64px auto', padding: 32, textAlign: 'center'}}
          >
            <h1 className="text-white text-2xl font-bold">{errorTitle}</h1>
            <p className="text-white/60 mt-3">
              {error.status === 403
                ? t('project.dashboard.errors.forbiddenDescription')
                : error.status === 404
                  ? t('project.dashboard.errors.notFoundDescription')
                  : t('project.dashboard.errors.loadDescription')}
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {retryable && error.status !== 401 && (
                <button
                  type="button"
                  className="proj-btn proj-btn-primary"
                  onClick={() => {
                    setError(null);
                    setReloadKey((key) => key + 1);
                  }}
                >
                  {t('project.common.retry')}
                </button>
              )}
              {error.status === 401 && (
                <button
                  type="button"
                  className="proj-btn proj-btn-primary"
                  onClick={() => navigate(PathConstants.LOGIN, {
                    replace: true,
                    state: {returnTo: window.location.pathname},
                  })}
                >
                  {t('project.dashboard.actions.signInAgain')}
                </button>
              )}
              <button
                type="button"
                className="proj-btn proj-btn-secondary"
                onClick={() => navigate(PathConstants.PROJECTS)}
              >
                {t('project.common.backToProjects')}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const sectionTitle = loading
    ? t('project.common.project')
    : (view.project.title || t('project.common.project'));
  return (
    <div className="proj-dash">
      <DashboardHeader
        user={user}
        onMenuToggle={() => setSidebarOpen((o) => !o)}
        sectionTitle={sectionTitle}
      />

      <main className="app-main profile-scroll">
        <div
          className="transition-opacity duration-200"
          style={{opacity: loading ? 0.55 : 1, pointerEvents: loading ? 'none' : 'auto'}}
          aria-busy={loading}
        >
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6">
              <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
                <ProjectHero
                  project={view.project}
                  onContinue={handleContinue}
                  onOpenScript={handleOpenScript}
                  onStatusChange={handleStatusChange}
                  statusUpdating={statusUpdating}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onDelete={handleDelete}
                  onLeave={handleLeave}
                />
                <ProjectStats stats={view.stats} onStat={handleStat} />
                <CharactersSection
                  characters={view.characters}
                  onCreate={handleCreateCharacter}
                  onCharacterClick={projectId ? handleCharacterClick : undefined}
                  onViewAll={handleOpenCharacters}
                />
                <ProjectPipeline
                  roadmap={view.roadmap}
                  roadmapUrl={projectId ? projectRoadmapPath(projectId) : PathConstants.PROJECTS}
                />
                {projectId && (
                  <ProjectVisualLibrary
                    canCreate={Boolean(view.project.permissions?.canEdit)}
                    projectId={projectId}
                    onCreate={() => navigate(referenceCreatePath(projectId))}
                    onOpenLibrary={() => navigate(referenceLibraryPath(projectId))}
                    onOpenReference={(referenceId) => (
                      navigate(referenceEditPath(projectId, referenceId))
                    )}
                  />
                )}
                <ProjectMusic
                  tracks={view.music}
                  onAdd={view.project.permissions?.canRunGeneration ? handleCreateMusic : undefined}
                  onOpenTrack={handleOpenMusicTrack}
                />
              </div>
              <RightProjectPanel
                project={view.project}
                progressOverall={view.progressOverall}
                progressLegend={view.progressLegend}
                storyboardNeedsReview={view.storyboardNeedsReview}
                storyboardReviewScenes={view.storyboardReviewScenes}
                quickActions={view.quickActions}
                activity={view.activity}
                onQuickAction={handleQuickAction}
                isQuickActionEnabled={isQuickActionEnabled}
                onOpenTeam={handleOpenTeam}
                onInvite={handleOpenInvite}
                loading={loading}
                videoPreparation={view.videoPreparation}
                videoPreparationLabel={view.videoPreparation?.ready
                  ? t('videoPreparation.dashboard.ready')
                  : view.videoPreparation
                    ? t('videoPreparation.dashboard.notReady', {
                      count: view.videoPreparation.taskCount,
                    })
                    : undefined}
                onOpenVideoPreparation={handleOpenVideoPreparation}
              />
          </div>
        </div>
      </main>

      {projectId && (
        <InviteMemberModal
          open={inviteOpen}
          projectId={projectId}
          teamRoleOptions={teamRoleOptions}
          onClose={() => setInviteOpen(false)}
          onInvited={() => message.success(t('project.team.notifications.invitationCreated'))}
        />
      )}
    </div>
  );
};

export default withAuth(ProjectDashboardPage);
