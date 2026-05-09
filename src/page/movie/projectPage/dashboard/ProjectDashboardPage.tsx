import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Modal, message } from 'antd';

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

  const handleContinue = () => {
    console.log('TODO: continue project workflow');
  };
  const handleOpenScript = () => {
    navigate(PathConstants.SCRIPT_PAGE, { state: { project_id: stateProjectId } });
  };
  const handleGenerateScene = () => {
    console.log('TODO: scene generation route');
  };
  const handleCreateCharacter = () => {
    navigate(PathConstants.GENERATING, {
      state: { is_edit: false, project_id: stateProjectId },
    });
  };
  const handleAddMusic = () => {
    console.log('TODO: add music');
  };
  const handleQuickAction = useCallback(
    (key: string) => {
      const url = view.quickActionUrls[key];
      if (url) {
        console.log('Quick action:', key, '→', url);
        return;
      }
      console.log('TODO: quick action', key);
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
        style: { background: '#fab005', borderColor: '#fab005', color: '#111827', fontWeight: 700 },
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

  const handleBackToList = useCallback(() => {
    navigate(PathConstants.PROJECTS);
  }, [navigate]);

  const headerTitle = loading ? 'Загрузка…' : view.project.title;
  const headerSubtitle = useMemo(() => {
    if (loading) return '';
    if (error) return error;
    if (usingDemo) return 'Демо-данные';
    return view.project.subtitle;
  }, [loading, error, usingDemo, view.project.subtitle]);

  return (
    <div className="proj-dash flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          user={user}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
          title={headerTitle}
          subtitle={headerSubtitle}
        />

        <main className="flex-1 overflow-y-auto profile-scroll">
          <div
            className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 transition-opacity duration-200"
            style={{ opacity: loading ? 0.55 : 1 }}
            aria-busy={loading}
          >
            <button
              type="button"
              onClick={handleBackToList}
              className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-sm mb-4 transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeftOutlined />
              Все проекты
            </button>

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
                />
                <ProjectStats stats={view.stats} />
                <CharactersSection
                  characters={view.characters}
                  onCreate={handleCreateCharacter}
                />
                <ProjectPipeline pipeline={view.pipeline} />
                <ProjectMusic tracks={view.music} onAdd={handleAddMusic} />
              </div>
              <RightProjectPanel
                progressOverall={view.progressOverall}
                progressLegend={view.progressLegend}
                quickActions={view.quickActions}
                activity={view.activity}
                onQuickAction={handleQuickAction}
                loading={loading}
              />
            </div>
          </div>
        </main>
      </div>

      <EditProjectModal
        open={editOpen}
        project={view.project}
        onCancel={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
};

export default withAuth(ProjectDashboardPage);
