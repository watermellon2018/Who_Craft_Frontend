import React, { useCallback, useEffect, useState } from 'react';
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
  referenceCreatePath,
  referenceEditPath,
  referenceLibraryPath,
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
  PipelineStepMock,
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
  adaptPipeline,
  adaptProgress,
  adaptProject,
  adaptQuickActions,
  adaptStats,
  updateProjectStatus,
  deleteProject as apiDeleteProject,
} from './api';
import type { DashboardPayload, ProjectStatusValue } from './api';
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
  pipeline: PipelineStepMock[];
  music: TrackMock[];
  progressOverall: number;
  progressLegend: ProgressLegendItem[];
  storyboardNeedsReview: number;
  storyboardReviewScenes: StoryboardReviewSceneMock[];
  quickActions: QuickActionMock[];
  activity: ActivityItemMock[];
}

function buildEmptyViewModel(): ViewModel {
  return {
    project: {
      id: '',
      title: 'Загрузка…',
      subtitle: 'Страница проекта',
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
      { key: 'characters', label: 'Персонажи', value: 0, subtitle: '—', iconKey: 'characters', accent: 'purple' },
      { key: 'scenes', label: 'Сцены', value: 0, subtitle: '—', iconKey: 'scenes', accent: 'blue' },
      { key: 'music', label: 'Музыка', value: 0, subtitle: '—', iconKey: 'music', accent: 'green' },
      { key: 'locations', label: 'Визуальная библиотека', value: 0, subtitle: '—', iconKey: 'locations', accent: 'yellow' },
    ],
    characters: [],
    pipeline: [
      { key: 'script', label: 'Сценарий', progress: 0, subtitle: '—', iconKey: 'script', accent: 'yellow' },
      { key: 'storyboard', label: 'Сториборд', progress: 0, subtitle: '—', iconKey: 'storyboard', accent: 'purple' },
      { key: 'reference', label: 'Визуальная библиотека', progress: 0, subtitle: '—', iconKey: 'reference', accent: 'blue' },
      { key: '3d', label: '3D', progress: 0, subtitle: '—', iconKey: 'model3d', accent: 'green' },
      { key: 'video', label: 'Видео', progress: 0, subtitle: '—', iconKey: 'video', accent: 'red' },
    ],
    music: [],
    progressOverall: 0,
    progressLegend: [
      { label: 'Сценарий', value: 0, accent: 'yellow' },
      { label: 'Персонажи', value: null, accent: 'purple' },
      { label: 'Раскадровка', value: 0, accent: 'green' },
      { label: 'Видео', value: 0, accent: 'blue' },
    ],
    storyboardNeedsReview: 0,
    storyboardReviewScenes: [],
    quickActions: [
      { key: 'new_scene', label: 'Новая сцена', iconKey: 'newScene', accent: 'blue' },
      { key: 'generate_video', label: 'Генерация видео', iconKey: 'genVideo', accent: 'red' },
      { key: 'create_location', label: 'Создать визуальную опору', iconKey: 'newReference', accent: 'yellow' },
      { key: 'create_character', label: 'Создать персонажа', iconKey: 'newCharacter', accent: 'purple' },
      { key: 'create_track', label: 'Создать трек', iconKey: 'newTrack', accent: 'green' },
    ],
    activity: [],
  };
}

function buildViewModel(data: DashboardPayload): ViewModel {
  const progress = adaptProgress(data.progress);

  return {
    project: adaptProject(data.project),
    stats: adaptStats(data.stats),
    characters: adaptCharacters(data.characters),
    pipeline: adaptPipeline(data.pipeline),
    music: adaptMusic(data.music),
    progressOverall: progress.overall,
    progressLegend: progress.legend,
    storyboardNeedsReview: progress.storyboardNeedsReview,
    storyboardReviewScenes: progress.storyboardReviewScenes,
    quickActions: adaptQuickActions(data.quickActions),
    activity: adaptActivity(data.recentActivity),
  };
}

export const ProjectDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = routeProjectId?.trim() || null;

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [, setSidebarOpen] = useState(false);
  const [viewModel, setViewModel] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number | null; message: string } | null>(null);
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
      setError({ status: null, message: 'Не указан проект' });
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
        const messageText = status === 401
          ? 'Требуется повторная авторизация'
          : status === 403
            ? 'Нет доступа к проекту'
            : status === 404
              ? 'Проект не найден'
              : 'Не удалось загрузить проект';
        setError({ status, message: messageText });
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
    if (key === 'music') handleOpenMusic();
    if (key === 'locations' && projectId) navigate(referenceLibraryPath(projectId));
  }, [handleOpenMusic, navigate, projectId]);

  const handleContinue = handleOpenScript;
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
  };
  const isQuickActionEnabled = (key: string) =>
    key === 'new_scene'
    || (key === 'create_location' && Boolean(view.project.permissions?.canEdit))
    || (key === 'create_character' && Boolean(view.project.permissions?.canEdit))
    || (key === 'create_track' && Boolean(view.project.permissions?.canRunGeneration));

  const handlePipelineStep = (key: string) => {
    if (key === 'script') {
      handleOpenScript();
      return;
    }
    if (key === 'reference' && projectId) {
      navigate(referenceLibraryPath(projectId));
    }
  };
  const isPipelineStepEnabled = (key: string) => key === 'script' || key === 'reference';

  const applySummaryToView = useCallback(
    (summary: {
      title: string;
      description: string;
      status: ProjectStatusValue;
      statusLabel: string;
      isFavorite: boolean;
      tags?: string[];
      updatedAtLabel?: string;
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
            updatedAtLabel: summary.updatedAtLabel ?? prev.project.updatedAtLabel,
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
        statusLabel:
          next === 'draft'
            ? 'Черновик'
            : next === 'in_progress'
            ? 'В работе'
            : next === 'completed'
            ? 'Завершён'
            : 'В архиве',
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
          updatedAtLabel: summary.updatedAtLabel,
        });
        message.success('Статус обновлён');
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
        if (status === 403) message.error('Нет прав изменить статус');
        else message.error('Не удалось изменить статус');
      } finally {
        setStatusUpdating(false);
      }
    },
    [projectId, view.project, applySummaryToView],
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
      title: 'Архивировать проект?',
      content:
        'Проект будет перемещён в архив. Вы сможете восстановить его позже.',
      okText: 'Архивировать',
      cancelText: 'Отмена',
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
            updatedAtLabel: summary.updatedAtLabel,
          });
          message.success('Проект архивирован');
        } catch (requestError: unknown) {
          const status = getApiStatus(requestError);
          if (status === 403) message.error('Нет прав архивировать проект');
          else message.error('Не удалось архивировать проект');
          throw requestError;
        }
      },
    });
  }, [projectId, applySummaryToView]);

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
        updatedAtLabel: summary.updatedAtLabel,
      });
      message.success('Проект восстановлен');
    } catch (requestError: unknown) {
      const status = getApiStatus(requestError);
      if (status === 403) message.error('Нет прав восстановить проект');
      else message.error('Не удалось восстановить проект');
    }
  }, [projectId, applySummaryToView]);

  const handleLeave = useCallback(() => {
    if (!projectId) return;
    craftModal.confirm({
      title: 'Покинуть проект?',
      content:
        'Ваш доступ будет отозван немедленно. Созданные вами материалы останутся в проекте.',
      okText: 'Покинуть',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await leaveProject(projectId);
          message.success('Вы покинули проект');
          navigate(PathConstants.PROJECTS);
        } catch (requestError: unknown) {
          const code = teamErrorCode(requestError);
          if (code === 'OWNER_CANNOT_LEAVE') {
            message.error('Владелец не может покинуть проект — сначала передайте владение');
          } else {
            message.error('Не удалось покинуть проект');
          }
          throw requestError;
        }
      },
    });
  }, [projectId, navigate]);

  const handleDelete = useCallback(() => {
    if (!projectId) return;
    craftModal.confirm({
      title: 'Удалить проект?',
      content:
        'Это действие нельзя отменить. Проект, персонажи, сцены, музыка, ассеты и история активности будут удалены.',
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: {
        danger: true,
        style: { fontWeight: 600 },
      },
      onOk: async () => {
        try {
          await apiDeleteProject(projectId);
          message.success('Проект удалён');
          navigate(PathConstants.PROJECTS);
        } catch (requestError: unknown) {
          const status = getApiStatus(requestError);
          if (status === 403) message.error('Нет прав удалить проект');
          else message.error('Не удалось удалить проект');
          throw requestError;
        }
      },
    });
  }, [projectId, navigate]);

  if (error) {
    const retryable = error.status !== 403 && error.status !== 404;
    return (
      <div className="proj-dash">
        <DashboardHeader
          user={user}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          sectionTitle="Проект"
        />
        <main className="app-main profile-scroll">
          <section
            role="alert"
            className="proj-card"
            style={{maxWidth: 640, margin: '64px auto', padding: 32, textAlign: 'center'}}
          >
            <h1 className="text-white text-2xl font-bold">{error.message}</h1>
            <p className="text-white/60 mt-3">
              {error.status === 403
                ? 'Попросите владельца проекта выдать вам доступ.'
                : error.status === 404
                  ? 'Возможно, проект был удалён или адрес устарел.'
                  : 'Проверьте соединение и попробуйте снова.'}
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
                  Повторить
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
                  Войти снова
                </button>
              )}
              <button
                type="button"
                className="proj-btn proj-btn-secondary"
                onClick={() => navigate(PathConstants.PROJECTS)}
              >
                К проектам
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const sectionTitle = loading ? 'Проект' : (view.project.title || 'Проект');
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
                  pipeline={view.pipeline}
                  onStep={handlePipelineStep}
                  isStepEnabled={isPipelineStepEnabled}
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
          onInvited={() => message.success('Приглашение создано')}
        />
      )}
    </div>
  );
};

export default withAuth(ProjectDashboardPage);
