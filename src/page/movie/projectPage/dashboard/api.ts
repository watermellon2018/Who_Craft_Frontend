import api from '../../../../api/http';

import {
  AccentColor,
  ActivityItemMock,
  CharacterMock,
  PipelineStepMock,
  ProjectMock,
  QuickActionMock,
  StatMock,
  TrackMock,
} from './mocks';

// Token is attached as X-User-Token by api/http.ts.

export type ProjectStatusValue = 'draft' | 'in_progress' | 'completed' | 'archived';
export type ProjectMemberRole = 'owner' | 'editor' | 'viewer';

export interface DashboardProject {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  status: ProjectStatusValue;
  statusLabel: string;
  coverImageUrl: string | null;
  isFavorite: boolean;
  updatedAt: string | null;
  updatedAtLabel: string;
  tags: string[];
  teamMembers: Array<{
    id: number;
    displayName: string;
    avatarUrl: string | null;
    initials: string;
    role: ProjectMemberRole | string;
  }>;
  currentUserRole: ProjectMemberRole | string;
}

export interface DashboardStats {
  charactersTotal: number;
  charactersActive: number;
  scenesTotal: number;
  scenesCompleted: number;
  musicTotal: number;
  musicUsed: number;
  locationsTotal: number;
  locationsCreated: number;
}

export interface DashboardCharacter {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  shortDescription: string;
  avatarImageUrl: string | null;
  mainImageUrl: string | null;
  isActive: boolean;
}

export interface DashboardPipelineStep {
  label: string;
  progress: number;
  subtitle: string;
}

export interface DashboardPipeline {
  script: DashboardPipelineStep;
  storyboard: DashboardPipelineStep;
  references: DashboardPipelineStep;
  models3d: DashboardPipelineStep;
  video: DashboardPipelineStep;
}

export interface DashboardMusicTrack {
  id: number;
  title: string;
  author: string;
  durationSeconds: number;
  durationLabel: string;
  tags: string[];
  coverImageUrl: string | null;
  usageCount: number;
  usageLabel: string;
}

export interface DashboardProgress {
  overall: number;
  script: number;
  visual: number;
  audio: number;
  postproduction: number;
}

export interface DashboardQuickAction {
  key: string;
  label: string;
  url: string;
}

export interface DashboardActivity {
  id: number;
  type: string;
  title: string;
  description: string;
  createdAt: string | null;
  createdAtLabel: string;
  thumbnailUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface DashboardPayload {
  project: DashboardProject;
  stats: DashboardStats;
  characters: DashboardCharacter[];
  pipeline: DashboardPipeline;
  music: DashboardMusicTrack[];
  progress: DashboardProgress;
  quickActions: DashboardQuickAction[];
  recentActivity: DashboardActivity[];
}

export async function fetchProjectDashboard(
  projectId: number | string,
): Promise<DashboardPayload> {
  const res = await api.get<DashboardPayload>(
    `api/projects/${projectId}/dashboard/`,
  );
  return res.data;
}

export async function createCharacter(
  projectId: number | string,
  data: { name: string; short_description?: string; role?: string },
) {
  return api.post(`api/projects/${projectId}/characters/`, data);
}

// ----------------------------------------------------------------------------
// Project mutations
// ----------------------------------------------------------------------------

export interface ProjectSummaryPayload {
  id: number;
  title: string;
  description: string;
  status: ProjectStatusValue;
  statusLabel: string;
  coverImageUrl: string | null;
  updatedAt: string | null;
  updatedAtLabel?: string;
  isFavorite: boolean;
  tags?: string[];
  stats?: { charactersTotal: number; scenesTotal: number };
}

export interface ProjectUpdatePayload {
  title?: string;
  description?: string;
  status?: ProjectStatusValue;
  is_favorite?: boolean;
  tags?: string[];
}

export async function updateProject(
  projectId: number | string,
  payload: ProjectUpdatePayload,
): Promise<ProjectSummaryPayload> {
  const res = await api.patch<ProjectSummaryPayload>(
    `api/projects/${projectId}/`,
    payload,
  );
  return res.data;
}

export async function updateProjectStatus(
  projectId: number | string,
  status: ProjectStatusValue,
): Promise<ProjectSummaryPayload> {
  return updateProject(projectId, { status });
}

export async function archiveProject(
  projectId: number | string,
): Promise<ProjectSummaryPayload> {
  return updateProject(projectId, { status: 'archived' });
}

export async function deleteProject(projectId: number | string): Promise<void> {
  await api.delete(`api/projects/${projectId}/`);
}

// ----------------------------------------------------------------------------
// Adapters: API payload -> presentation shapes used by mock-driven components.
// ----------------------------------------------------------------------------

const PROJECT_COVER_GRADIENT =
  'radial-gradient(120% 100% at 0% 0%, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0) 55%),' +
  ' radial-gradient(120% 100% at 100% 100%, rgba(236,72,153,0.55) 0%, rgba(236,72,153,0) 55%),' +
  ' linear-gradient(135deg, #0b1024 0%, #1a0b2e 50%, #2a0b3a 100%)';

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #fab005, #d97706)',
  'linear-gradient(135deg, #8B5CF6, #4338CA)',
  'linear-gradient(135deg, #22C55E, #047857)',
  'linear-gradient(135deg, #3B82F6, #1E3A8A)',
  'linear-gradient(135deg, #EC4899, #BE185D)',
];

const CHARACTER_GRADIENTS = [
  'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #4c1d95 100%)',
  'linear-gradient(135deg, #0c4a6e 0%, #155e75 50%, #0e7490 100%)',
  'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)',
  'linear-gradient(135deg, #4c1d95 0%, #6b21a8 50%, #86198f 100%)',
  'linear-gradient(135deg, #1f2937 0%, #374151 50%, #4b5563 100%)',
];

const TRACK_GRADIENTS = [
  'linear-gradient(135deg, #8B5CF6, #EC4899)',
  'linear-gradient(135deg, #1e3a8a, #155e75)',
  'linear-gradient(135deg, #22C55E, #047857)',
  'linear-gradient(135deg, #fab005, #d97706)',
];

const ACTIVITY_THUMB_GRADIENT = 'linear-gradient(135deg, #312e81, #db2777)';

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const a1 = a % 10;
  if (a > 10 && a < 20) return many;
  if (a1 === 1) return one;
  if (a1 >= 2 && a1 <= 4) return few;
  return many;
}

export function adaptProject(api: DashboardProject): ProjectMock {
  const team = (api.teamMembers || []).slice(0, 4).map((m, i) => ({
    id: String(m.id),
    name: m.displayName || m.initials || `User ${m.id}`,
    gradient: TEAM_GRADIENTS[i % TEAM_GRADIENTS.length],
  }));
  const teamExtra = Math.max(0, (api.teamMembers?.length || 0) - team.length);
  const role = (api.currentUserRole as 'owner' | 'editor' | 'viewer') || 'viewer';
  return {
    id: String(api.id),
    title: api.title,
    subtitle: api.subtitle || 'Страница проекта',
    status: api.status === 'completed' ? 'done' : api.status === 'archived' ? 'paused' : 'work',
    statusKey: api.status,
    statusLabel: api.statusLabel,
    currentUserRole: role,
    isFavorite: !!api.isFavorite,
    coverGradient: PROJECT_COVER_GRADIENT,
    genres: api.tags || [],
    description: api.description || '',
    updatedAtLabel: api.updatedAtLabel || '',
    team,
    teamExtraCount: teamExtra,
  };
}

const STAT_DEFS: Array<{
  key: string;
  label: string;
  iconKey: StatMock['iconKey'];
  accent: AccentColor;
  total: keyof DashboardStats;
  sub: keyof DashboardStats;
  subLabel: (n: number) => string;
}> = [
  {
    key: 'characters',
    label: 'Персонажи',
    iconKey: 'characters',
    accent: 'purple',
    total: 'charactersTotal',
    sub: 'charactersActive',
    subLabel: (n) => `${n} ${plural(n, 'активный', 'активных', 'активных')}`,
  },
  {
    key: 'scenes',
    label: 'Сцены',
    iconKey: 'scenes',
    accent: 'blue',
    total: 'scenesTotal',
    sub: 'scenesCompleted',
    subLabel: (n) => `${n} ${plural(n, 'завершена', 'завершено', 'завершено')}`,
  },
  {
    key: 'music',
    label: 'Музыка',
    iconKey: 'music',
    accent: 'green',
    total: 'musicTotal',
    sub: 'musicUsed',
    subLabel: (n) =>
      `${n} ${plural(n, 'трек используется', 'трека используется', 'треков используется')}`,
  },
  {
    key: 'locations',
    label: 'Локации',
    iconKey: 'locations',
    accent: 'yellow',
    total: 'locationsTotal',
    sub: 'locationsCreated',
    subLabel: (n) => `${n} ${plural(n, 'создана', 'создано', 'создано')}`,
  },
];

export function adaptStats(api: DashboardStats): StatMock[] {
  return STAT_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    iconKey: d.iconKey,
    accent: d.accent,
    value: Number(api[d.total] || 0),
    subtitle: d.subLabel(Number(api[d.sub] || 0)),
  }));
}

export function adaptCharacters(list: DashboardCharacter[]): CharacterMock[] {
  return (list || []).map((c, i) => {
    const initial = (c.name || '?').trim().charAt(0).toUpperCase() || '?';
    return {
      id: c.id,
      name: c.name,
      role: c.shortDescription || c.roleLabel || '',
      tag: c.roleLabel || '',
      initial,
      gradient: pick(CHARACTER_GRADIENTS, i),
      imageUrl: c.mainImageUrl || c.avatarImageUrl || null,
      isMain: c.role === 'main',
    };
  });
}

const PIPELINE_DEFS: Array<{
  key: PipelineStepMock['key'];
  apiKey: keyof DashboardPipeline;
  iconKey: PipelineStepMock['iconKey'];
  accent: AccentColor;
}> = [
  { key: 'script', apiKey: 'script', iconKey: 'script', accent: 'yellow' },
  { key: 'storyboard', apiKey: 'storyboard', iconKey: 'storyboard', accent: 'purple' },
  { key: 'reference', apiKey: 'references', iconKey: 'reference', accent: 'blue' },
  { key: '3d', apiKey: 'models3d', iconKey: 'model3d', accent: 'green' },
  { key: 'video', apiKey: 'video', iconKey: 'video', accent: 'red' },
];

export function adaptPipeline(api: DashboardPipeline): PipelineStepMock[] {
  return PIPELINE_DEFS.map((d) => {
    const step = api[d.apiKey];
    return {
      key: d.key,
      label: step.label,
      progress: Math.max(0, Math.min(100, Number(step.progress || 0))),
      subtitle: step.subtitle,
      iconKey: d.iconKey,
      accent: d.accent,
    };
  });
}

export function adaptMusic(list: DashboardMusicTrack[]): TrackMock[] {
  return (list || []).map((t, i) => ({
    id: String(t.id),
    title: t.title,
    author: t.author || '',
    duration: t.durationLabel,
    tags: t.tags || [],
    usageLabel: t.usageLabel,
    coverGradient: pick(TRACK_GRADIENTS, i),
    waveSeed: ((t.id || 0) * 17 + 3) || 17,
  }));
}

export interface ProgressView {
  overall: number;
  legend: { label: string; value: number; accent: AccentColor }[];
}

export function adaptProgress(api: DashboardProgress): ProgressView {
  return {
    overall: Number(api.overall || 0),
    legend: [
      { label: 'Сценарий', value: Number(api.script || 0), accent: 'yellow' },
      { label: 'Визуал', value: Number(api.visual || 0), accent: 'purple' },
      { label: 'Аудио', value: Number(api.audio || 0), accent: 'green' },
      { label: 'Постпродакшн', value: Number(api.postproduction || 0), accent: 'blue' },
    ],
  };
}

const QUICK_ACTION_VISUALS: Record<string, { iconKey: QuickActionMock['iconKey']; accent: AccentColor }> = {
  new_scene: { iconKey: 'newScene', accent: 'blue' },
  generate_video: { iconKey: 'genVideo', accent: 'red' },
  upload_reference: { iconKey: 'upload', accent: 'purple' },
  create_location: { iconKey: 'newLocation', accent: 'yellow' },
};

export function adaptQuickActions(list: DashboardQuickAction[]): QuickActionMock[] {
  return (list || []).map((a) => {
    const v = QUICK_ACTION_VISUALS[a.key] || { iconKey: 'newScene' as const, accent: 'blue' as const };
    return {
      key: a.key,
      label: a.label,
      iconKey: v.iconKey,
      accent: v.accent,
    };
  });
}

const ACTIVITY_VISUALS: Record<string, { iconKey: ActivityItemMock['iconKey']; accent: AccentColor; thumb: boolean }> = {
  character_created: { iconKey: 'created', accent: 'red', thumb: false },
  character_updated: { iconKey: 'character', accent: 'purple', thumb: false },
  scene_created: { iconKey: 'scene', accent: 'blue', thumb: false },
  scene_render_completed: { iconKey: 'scene', accent: 'blue', thumb: true },
  music_added: { iconKey: 'music', accent: 'green', thumb: false },
  location_created: { iconKey: 'created', accent: 'yellow', thumb: false },
  asset_uploaded: { iconKey: 'created', accent: 'purple', thumb: false },
  project_updated: { iconKey: 'created', accent: 'yellow', thumb: false },
};

export function adaptActivity(list: DashboardActivity[]): ActivityItemMock[] {
  return (list || []).map((a) => {
    const v = ACTIVITY_VISUALS[a.type] || { iconKey: 'created' as const, accent: 'purple' as const, thumb: false };
    return {
      id: String(a.id),
      title: a.title,
      description: a.description,
      time: a.createdAtLabel,
      iconKey: v.iconKey,
      accent: v.accent,
      thumbnailGradient: a.thumbnailUrl ? undefined : v.thumb ? ACTIVITY_THUMB_GRADIENT : undefined,
    };
  });
}
