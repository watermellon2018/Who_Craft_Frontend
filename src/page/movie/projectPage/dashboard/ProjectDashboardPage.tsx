import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import { fetchDashboard } from '../../../../modules/profile/api/profileApi';
import { ProfileUser } from '../../../../modules/profile/types';
import PathConstants from '../../../../routes/pathConstant';
import withAuth from '../../../../utils/auth/check_auth';

import ProjectHero from './ProjectHero';
import ProjectStats from './ProjectStats';
import CharactersSection from './CharactersSection';
import ProjectPipeline from './ProjectPipeline';
import ProjectMusic from './ProjectMusic';
import RightProjectPanel from './RightProjectPanel';
import {
  activityMock,
  charactersMock,
  musicMock,
  pipelineMock,
  progressLegendMock,
  projectMock,
  quickActionsMock,
  statsMock,
  overallProgressPercent,
  ProjectMock,
  StatMock,
  CharacterMock,
  PipelineStepMock,
  TrackMock,
  ProgressLegendItem,
  QuickActionMock,
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
  DashboardPayload,
  ProjectStatusValue,
  updateProject,
  updateProjectStatus,
  deleteProject as apiDeleteProject,
} from './api';
import EditProjectModal from './EditProjectModal';
import InviteMemberModal from '../team/InviteMemberModal';
import { fetchTeamSummary, leaveProject, teamErrorCode } from '../../../../api/projects/team';
import { Modal, message } from 'antd';
import { safeHttpUrl } from '../../../../utils/safeUrl';

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
  quickActions: QuickActionMock[];
  activity: ActivityItemMock[];
  quickActionUrls: Record<string, string>;
}

const DEMO_VIEW_MODEL: ViewModel = {
  project: projectMock,
  stats: statsMock,
  characters: charactersMock,
  pipeline: pipelineMock,
  music: musicMock,
  progressOverall: overallProgressPercent,
  progressLegend: progressLegendMock,
  quickActions: quickActionsMock,
  activity: activityMock,
  quickActionUrls: {},
};

function buildEmptyViewModel(): ViewModel {
  return {
    project: {
      id: '',
      title: 'Загрузка…',
      subtitle: 'Страница проекта',
      status: 'work',
      statusLabel: '',
      isFavorite: false,
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
      { key: 'locations', label: 'Локации', value: 0, subtitle: '—', iconKey: 'locations', accent: 'yellow' },
    ],
    characters: [],
    pipeline: [
      { key: 'script', label: 'Сценарий', progress: 0, subtitle: '—', iconKey: 'script', accent: 'yellow' },
      { key: 'storyboard', label: 'Сториборд', progress: 0, subtitle: '—', iconKey: 'storyboard', accent: 'purple' },
      { key: 'reference', label: 'Референсы', progress: 0, subtitle: '—', iconKey: 'reference', accent: 'blue' },
      { key: '3d', label: '3D', progress: 0, subtitle: '—', iconKey: 'model3d', accent: 'green' },
      { key: 'video', label: 'Видео', progress: 0, subtitle: '—', iconKey: 'video', accent: 'red' },
    ],
    music: [],
    progressOverall: 0,
    progressLegend: [
      { label: 'Сценарий', value: 0, accent: 'yellow' },
      { label: 'Визуал', value: 0, accent: 'purple' },
      { label: 'Аудио', value: 0, accent: 'green' },
      { label: 'Постпродакшн', value: 0, accent: 'blue' },
    ],
    quickActions: [
      { key: 'new_scene', label: 'Новая сцена', iconKey: 'newScene', accent: 'blue' },
      { key: 'generate_video', label: 'Генерация видео', iconKey: 'genVideo', accent: 'red' },
      { key: 'create_location', label: 'Создать локацию', iconKey: 'newLocation', accent: 'yellow' },
    ],
    activity: [],
    quickActionUrls: {},
  };
}

function buildViewModel(data: DashboardPayload): ViewModel {
  const progress = adaptProgress(data.progress);
  const quickActionUrls: Record<string, string> = {};
  (data.quickActions || []).forEach((a) => {
    if (a.url) quickActionUrls[a.key] = a.url;
  });
  return {
    project: adaptProject(data.project),
    stats: adaptStats(data.stats),
    characters: adaptCharacters(data.characters),
    pipeline: adaptPipeline(data.pipeline),
    music: adaptMusic(data.music),
    progressOverall: progress.overall,
    progressLegend: progress.legend,
    quickActions: adaptQuickActions(data.quickActions),
    activity: adaptActivity(data.recentActivity),
    quickActionUrls,
  };
}

const ProjectDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stateProjectId = (location.state as { project_id?: string | number } | null)?.project_id;

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewModel, setViewModel] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(!!stateProjectId);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamRoleOptions, setTeamRoleOptions] = useState<{ value: string; label: string }[]>([]);

  // When we have a project_id we render an empty skeleton until the API
  // responds — never the demo mocks. Demo mocks only appear when the page is
  // opened without a project_id (e.g. design preview).
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
    if (!stateProjectId) {
      setViewModel(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProjectDashboard(stateProjectId)
      .then((data) => {
        if (cancelled) return;
        setViewModel(buildViewModel(data));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 401) setError('Требуется авторизация');
        else if (status === 403) setError('Нет доступа к проекту');
        else if (status === 404) setError('Проект не найден');
        else setError('Не удалось загрузить проект');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateProjectId]);

  // Render priority:
  //  1) real data from API (viewModel)
  //  2) skeleton if we are fetching (project_id present, no data yet)
  //  3) demo mocks only when the page opened without a project_id
  const usingDemo = !stateProjectId && viewModel === null;
  const view: ViewModel = viewModel ?? (stateProjectId ? skeleton : DEMO_VIEW_MODEL);

  const handleContinue = () => undefined;
  const handleOpenScript = () => {
    navigate(PathConstants.SCRIPT_PAGE, { state: { project_id: stateProjectId } });
  };
  const handleGenerateScene = () => undefined;
  const handleCreateCharacter = () => {
    if (!stateProjectId) return;
    // Route the "create character" CTA to the modern character studio gallery
    // (the legacy ``/generating`` route was removed along with the legacy
    // hero editor).
    const url = PathConstants.CHARACTER_STUDIO.replace(':projectId', String(stateProjectId));
    navigate(url);
  };
  const handleCharacterClick = useCallback(
    (characterId: string) => {
      if (!stateProjectId) return;
      const url = PathConstants.CHARACTER_STUDIO_EDITOR
        .replace(':projectId', String(stateProjectId))
        .replace(':characterId', String(characterId));
      navigate(url);
    },
    [navigate, stateProjectId],
  );
  const handleAddMusic = () => undefined;
  const handleQuickAction = useCallback(
    (key: string) => {
      const raw = view.quickActionUrls[key];
      // Quick-action URLs come from the API. Reject anything that isn't a
      // safe http(s) target or a same-origin relative path — otherwise an
      // attacker-controlled value could redirect the user to phishing.
      const safe = safeHttpUrl(raw);
      if (!safe) return;
      window.open(safe, '_self');
    },
    [view.quickActionUrls],
  );

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
      if (!stateProjectId) return;
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
        const summary = await updateProjectStatus(stateProjectId, next);
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
      } catch (e: any) {
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
        const status = e?.response?.status;
        if (status === 403) message.error('Нет прав изменить статус');
        else message.error('Не удалось изменить статус');
      } finally {
        setStatusUpdating(false);
      }
    },
    [stateProjectId, view.project, applySummaryToView],
  );

  const handleEdit = useCallback(() => setEditOpen(true), []);

  const handleOpenTeam = useCallback(() => {
    if (!stateProjectId) return;
    const url = PathConstants.PROJECT_TEAM.replace(
      ':projectId',
      String(stateProjectId),
    );
    navigate(url, { state: { project_id: stateProjectId } });
  }, [navigate, stateProjectId]);

  const handleOpenInvite = useCallback(async () => {
    // Lazily fetch the professional-role options for the invite form select.
    if (teamRoleOptions.length === 0 && stateProjectId) {
      try {
        const summary = await fetchTeamSummary(stateProjectId);
        setTeamRoleOptions(summary.teamRoleOptions || []);
      } catch {
        /* non-fatal — the modal still works without prof-role options */
      }
    }
    setInviteOpen(true);
  }, [teamRoleOptions.length, stateProjectId]);

  const handleEditSubmit = useCallback(
    async (values: {
      title: string;
      description: string;
      tags: string[];
      is_favorite: boolean;
    }) => {
      if (!stateProjectId) return;
      const summary = await updateProject(stateProjectId, values);
      applySummaryToView({
        title: summary.title,
        description: summary.description,
        status: summary.status,
        statusLabel: summary.statusLabel,
        isFavorite: summary.isFavorite,
        tags: summary.tags,
        updatedAtLabel: summary.updatedAtLabel,
      });
      setEditOpen(false);
      message.success('Изменения сохранены');
    },
    [stateProjectId, applySummaryToView],
  );

  const handleArchive = useCallback(() => {
    if (!stateProjectId) return;
    Modal.confirm({
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
          const summary = await updateProjectStatus(stateProjectId, 'archived');
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
        } catch (e: any) {
          const status = e?.response?.status;
          if (status === 403) message.error('Нет прав архивировать проект');
          else message.error('Не удалось архивировать проект');
          throw e;
        }
      },
    });
  }, [stateProjectId, applySummaryToView]);

  const handleUnarchive = useCallback(async () => {
    if (!stateProjectId) return;
    try {
      const summary = await updateProjectStatus(stateProjectId, 'in_progress');
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
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) message.error('Нет прав восстановить проект');
      else message.error('Не удалось восстановить проект');
    }
  }, [stateProjectId, applySummaryToView]);

  const handleLeave = useCallback(() => {
    if (!stateProjectId) return;
    Modal.confirm({
      title: 'Покинуть проект?',
      content:
        'Ваш доступ будет отозван немедленно. Созданные вами материалы останутся в проекте.',
      okText: 'Покинуть',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await leaveProject(stateProjectId);
          message.success('Вы покинули проект');
          navigate(PathConstants.PROJECTS);
        } catch (e: any) {
          const code = teamErrorCode(e);
          if (code === 'OWNER_CANNOT_LEAVE') {
            message.error('Владелец не может покинуть проект — сначала передайте владение');
          } else {
            message.error('Не удалось покинуть проект');
          }
          throw e;
        }
      },
    });
  }, [stateProjectId, navigate]);

  const handleDelete = useCallback(() => {
    if (!stateProjectId) return;
    Modal.confirm({
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
          await apiDeleteProject(stateProjectId);
          message.success('Проект удалён');
          navigate(PathConstants.PROJECTS);
        } catch (e: any) {
          const status = e?.response?.status;
          if (status === 403) message.error('Нет прав удалить проект');
          else message.error('Не удалось удалить проект');
          throw e;
        }
      },
    });
  }, [stateProjectId, navigate]);

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
          style={{ opacity: loading ? 0.55 : 1 }}
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
                <ProjectStats stats={view.stats} />
                <CharactersSection
                  characters={view.characters}
                  onCreate={handleCreateCharacter}
                  onCharacterClick={stateProjectId ? handleCharacterClick : undefined}
                />
                <ProjectPipeline pipeline={view.pipeline} />
                <ProjectMusic tracks={view.music} onAdd={handleAddMusic} />
              </div>
              <RightProjectPanel
                project={view.project}
                progressOverall={view.progressOverall}
                progressLegend={view.progressLegend}
                quickActions={view.quickActions}
                activity={view.activity}
                onQuickAction={handleQuickAction}
                onOpenTeam={handleOpenTeam}
                onInvite={handleOpenInvite}
                loading={loading}
              />
          </div>
        </div>
      </main>

      <EditProjectModal
        open={editOpen}
        project={view.project}
        onCancel={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      {stateProjectId && (
        <InviteMemberModal
          open={inviteOpen}
          projectId={stateProjectId}
          teamRoleOptions={teamRoleOptions}
          onClose={() => setInviteOpen(false)}
          onInvited={() => message.success('Приглашение создано')}
        />
      )}
    </div>
  );
};

export default withAuth(ProjectDashboardPage);
