export type AccentColor = 'yellow' | 'purple' | 'blue' | 'green' | 'red' | 'pink';
import {CRAFT_ACCENT} from '../../../../constants/theme';

export const ACCENT_HEX: Record<AccentColor, string> = {
  yellow: CRAFT_ACCENT,
  purple: '#8B5CF6',
  blue: '#3B82F6',
  green: '#22C55E',
  red: '#EF4444',
  pink: '#EC4899',
};

export type ProjectStatusKey = 'draft' | 'in_progress' | 'completed' | 'archived';
export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ProjectPermissionFlags {
  canEdit: boolean;
  canRunGeneration?: boolean;
  canEditSettings: boolean;
  canPublish: boolean;
  canManageTeam: boolean;
  canTransferOwnership: boolean;
  canDeleteProject: boolean;
  canLeaveProject: boolean;
}

export interface ProjectTeamMemberMini {
  userId: number;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  role?: string;
}

export interface ProjectMock {
  id: string;
  title: string;
  subtitle: string;
  status: 'work' | 'paused' | 'done';
  statusKey?: ProjectStatusKey;
  statusLabel: string;
  isFavorite: boolean;
  coverGradient: string;
  genres: string[];
  description: string;
  updatedAtLabel: string;
  team: { id: string; name: string; gradient: string }[];
  teamExtraCount: number;
  currentUserRole?: ProjectRole;
  // Team-collaboration extras (populated from the API; optional for mocks).
  roleLabel?: string;
  memberCount?: number;
  ownerName?: string | null;
  isTeamProject?: boolean;
  teamMembers?: ProjectTeamMemberMini[];
  permissions?: ProjectPermissionFlags;
}

export const projectMock: ProjectMock = {
  id: 'demo-cyber-city-dawn',
  title: 'Cyber City Dawn',
  subtitle: 'Страница проекта',
  status: 'work',
  statusKey: 'in_progress',
  statusLabel: 'В работе',
  currentUserRole: 'owner',
  isFavorite: true,
  coverGradient:
    'radial-gradient(120% 100% at 0% 0%, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0) 55%), radial-gradient(120% 100% at 100% 100%, rgba(236,72,153,0.55) 0%, rgba(236,72,153,0) 55%), linear-gradient(135deg, #0b1024 0%, #1a0b2e 50%, #2a0b3a 100%)',
  genres: ['Научная фантастика', 'Киберпанк', 'Драма'],
  description:
    'Детектив в мире будущего раскрывает заговор, способный изменить судьбу всего человечества. Неон, дождь и тени корпораций.',
  updatedAtLabel: 'Обновлено 2 часа назад',
  team: [
    { id: 't1', name: 'Анна', gradient: 'linear-gradient(135deg, #fab005, #d97706)' },
    { id: 't2', name: 'Кирилл', gradient: 'linear-gradient(135deg, #8B5CF6, #4338CA)' },
    { id: 't3', name: 'Мария', gradient: 'linear-gradient(135deg, #22C55E, #047857)' },
    { id: 't4', name: 'Олег', gradient: 'linear-gradient(135deg, #3B82F6, #1E3A8A)' },
  ],
  teamExtraCount: 3,
};

export interface StatMock {
  key: string;
  label: string;
  value: number;
  subtitle: string;
  iconKey: 'characters' | 'scenes' | 'music' | 'locations';
  accent: AccentColor;
}

export const statsMock: StatMock[] = [
  { key: 'characters', label: 'Персонажи', value: 12, subtitle: '8 активных', iconKey: 'characters', accent: 'purple' },
  { key: 'scenes', label: 'Сцены', value: 24, subtitle: '12 завершено', iconKey: 'scenes', accent: 'blue' },
  { key: 'music', label: 'Музыка', value: 18, subtitle: '6 треков используется', iconKey: 'music', accent: 'green' },
  { key: 'locations', label: 'Локации', value: 9, subtitle: '6 создано', iconKey: 'locations', accent: 'yellow' },
];

export interface CharacterMock {
  id: string;
  name: string;
  role: string;
  tag: string;
  initial: string;
  gradient: string;
  imageUrl?: string | null;
  isMain?: boolean;
}

export const charactersMock: CharacterMock[] = [
  {
    id: 'c1',
    name: 'Кай Синклер',
    role: 'Детектив',
    tag: 'Главная роль',
    initial: 'К',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #4c1d95 100%)',
    isMain: true,
  },
  {
    id: 'c2',
    name: 'Лира Вэй',
    role: 'Хакер',
    tag: 'Второстепенная',
    initial: 'Л',
    gradient: 'linear-gradient(135deg, #0c4a6e 0%, #155e75 50%, #0e7490 100%)',
  },
  {
    id: 'c3',
    name: 'Виктор Хейл',
    role: 'Глава корпорации',
    tag: 'Антагонист',
    initial: 'В',
    gradient: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)',
  },
  {
    id: 'c4',
    name: 'Мира Кейн',
    role: 'Агент',
    tag: 'Второстепенная',
    initial: 'М',
    gradient: 'linear-gradient(135deg, #4c1d95 0%, #6b21a8 50%, #86198f 100%)',
  },
];

export interface PipelineStepMock {
  key: string;
  label: string;
  progress: number;
  subtitle: string;
  iconKey: 'script' | 'storyboard' | 'reference' | 'model3d' | 'video';
  accent: AccentColor;
}

export const pipelineMock: PipelineStepMock[] = [
  { key: 'script', label: 'Сценарий', progress: 80, subtitle: '24 сцены', iconKey: 'script', accent: 'yellow' },
  { key: 'storyboard', label: 'Сториборд', progress: 55, subtitle: '13 сцен', iconKey: 'storyboard', accent: 'purple' },
  { key: 'reference', label: 'Референсы', progress: 70, subtitle: '210 файлов', iconKey: 'reference', accent: 'blue' },
  { key: '3d', label: '3D', progress: 35, subtitle: '8 моделей', iconKey: 'model3d', accent: 'green' },
  { key: 'video', label: 'Видео', progress: 15, subtitle: '3 сцены', iconKey: 'video', accent: 'red' },
];

export interface TrackMock {
  id: string;
  title: string;
  author: string;
  duration: string;
  audioUrl?: string | null;
  versionNumber?: number | null;
  usageCount: number;
  tags: string[];
  usageLabel: string;
  coverGradient: string;
  waveSeed: number;
}

export const musicMock: TrackMock[] = [
  {
    id: 'm1',
    title: 'Neon Shadows',
    author: 'SynthWave Collective',
    duration: '03:42',
    audioUrl: '/media/music/neon-shadows.mp3',
    versionNumber: 2,
    usageCount: 6,
    tags: ['Напряжённый', 'Киберпанк'],
    usageLabel: 'Используется в 6 сценах',
    coverGradient: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
    waveSeed: 17,
  },
  {
    id: 'm2',
    title: 'Rain Over Tokyo',
    author: 'Akira Yamaoka',
    duration: '04:18',
    audioUrl: '/media/music/rain-over-tokyo.mp3',
    versionNumber: 1,
    usageCount: 4,
    tags: ['Меланхоличный', 'Атмосферный'],
    usageLabel: 'Используется в 4 сценах',
    coverGradient: 'linear-gradient(135deg, #1e3a8a, #155e75)',
    waveSeed: 42,
  },
];

export interface ProgressLegendItem {
  label: string;
  value: number;
  accent: AccentColor;
}

export const overallProgressPercent = 58;

export const progressLegendMock: ProgressLegendItem[] = [
  { label: 'Сценарий', value: 80, accent: 'yellow' },
  { label: 'Визуал', value: 42, accent: 'purple' },
  { label: 'Аудио', value: 67, accent: 'green' },
  { label: 'Постпродакшн', value: 30, accent: 'blue' },
];

export interface QuickActionMock {
  key: string;
  label: string;
  iconKey: 'newScene' | 'genVideo' | 'upload' | 'newLocation';
  accent: AccentColor;
}

export const quickActionsMock: QuickActionMock[] = [
  { key: 'new-scene', label: 'Новая сцена', iconKey: 'newScene', accent: 'blue' },
  { key: 'gen-video', label: 'Генерация видео', iconKey: 'genVideo', accent: 'red' },
  { key: 'upload-ref', label: 'Загрузить референс', iconKey: 'upload', accent: 'purple' },
  { key: 'new-location', label: 'Создать локацию', iconKey: 'newLocation', accent: 'yellow' },
];

export interface ActivityItemMock {
  id: string;
  title: string;
  description: string;
  time: string;
  iconKey: 'character' | 'scene' | 'music' | 'created';
  accent: AccentColor;
  thumbnailGradient?: string;
}

export const activityMock: ActivityItemMock[] = [
  {
    id: 'a1',
    title: 'Лира Вэй',
    description: 'персонаж обновлён',
    time: '2 часа назад',
    iconKey: 'character',
    accent: 'purple',
  },
  {
    id: 'a2',
    title: 'Сцена 07 — Ночной рынок',
    description: 'рендер завершён',
    time: '4 часа назад',
    iconKey: 'scene',
    accent: 'blue',
    thumbnailGradient: 'linear-gradient(135deg, #312e81, #db2777)',
  },
  {
    id: 'a3',
    title: 'Добавлен трек',
    description: 'Neon Shadows',
    time: '6 часов назад',
    iconKey: 'music',
    accent: 'green',
  },
  {
    id: 'a4',
    title: 'Виктор Хейл',
    description: 'персонаж создан',
    time: 'Вчера, 23:15',
    iconKey: 'created',
    accent: 'red',
  },
];
