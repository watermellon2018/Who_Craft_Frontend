import type {MissingCharacter} from '../../api/generated/contracts';

export type WorkspaceMode = 'screenplay' | 'cards' | 'characters';

export type ScriptBlockType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'remark'
  | 'camera'
  | 'transition'
  | 'sound'
  | 'note';

export interface ScriptBlock {
  id: string;
  type: ScriptBlockType;
  text: string;
  characterId?: string;
}

export interface SceneCharacter {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  imageUrl: string;
}

export interface Scene {
  id: number;
  title: string;
  description: string;
  scriptText: string;
  scriptBlocks: ScriptBlock[];
  status: string;
  order: number;
  act: number;
  durationSeconds: number;
  mood: string;
  sceneType: string;
  notes: string;
  characters: SceneCharacter[];
  version: number;
  updatedAt: string;
}

export interface ProjectPermissions {
  canEdit: boolean;
  canRunGeneration?: boolean;
  canView?: boolean;
  canManage?: boolean;
}

export interface ScriptProject {
  id: number;
  title: string;
  permissions: ProjectPermissions;
}

export interface ActStats {
  act: number;
  sceneCount: number;
  durationSeconds: number;
}

export interface ScriptStats {
  sceneCount: number;
  totalDurationSeconds: number;
  acts: ActStats[];
}

export interface ScriptWorkspaceResponse {
  project: ScriptProject;
  stats: ScriptStats;
  scenes: Scene[];
}

export interface CompactCharacter {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  shortDescription: string;
  personality: Record<string, unknown>;
  backstory: string;
  speechStyle: string;
  imageUrl: string;
  sceneCount: number;
  sceneIds: number[];
}

export interface CompactCharactersResponse {
  characters: CompactCharacter[];
}

export type MissingScriptCharacter = MissingCharacter;

export interface SceneMutation {
  title: string;
  description: string;
  script_text: string;
  script_blocks: ScriptBlock[];
  status: string;
  order: number;
  act: number;
  duration_seconds: number;
  mood: string;
  scene_type: string;
  notes: string;
  character_ids: string[];
}

export interface ScenePatch extends SceneMutation {
  version: number;
}

export interface SceneOrderUpdate {
  id: number;
  order: number;
  act: number;
  version: number;
}

export interface SceneOrderResult extends SceneOrderUpdate {
  updatedAt: string;
}

export interface SceneReorderResponse {
  scenes: SceneOrderResult[];
}

export interface WorkspaceConflict {
  sceneId: number;
  message: string;
}

export const BLOCK_LABELS: Record<ScriptBlockType, string> = {
  scene_heading: 'Заголовок сцены',
  action: 'Действие',
  character: 'Персонаж',
  dialogue: 'Диалог',
  remark: 'Ремарка',
  camera: 'Камера',
  transition: 'Переход',
  sound: 'Звук',
  note: 'Заметка',
};

export const SCENE_TYPE_LABELS: Record<string, string> = {
  setup: 'Завязка',
  provocation: 'Провокация',
  turn: 'Поворот',
  obstacle: 'Препятствие',
  escalation: 'Эскалация',
  climax: 'Кульминация',
  resolution: 'Развязка',
  final: 'Финал',
};

export const MOOD_LABELS: Record<string, string> = {
  calm: 'Спокойное',
  tense: 'Напряжённое',
  joyful: 'Радостное',
  sad: 'Грустное',
  mysterious: 'Таинственное',
  romantic: 'Романтическое',
};
