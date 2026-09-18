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

export const BLOCK_LABEL_KEYS: Record<ScriptBlockType, string> = {
  scene_heading: 'script.blockTypes.sceneHeading',
  action: 'script.blockTypes.action',
  character: 'script.blockTypes.character',
  dialogue: 'script.blockTypes.dialogue',
  remark: 'script.blockTypes.remark',
  camera: 'script.blockTypes.camera',
  transition: 'script.blockTypes.transition',
  sound: 'script.blockTypes.sound',
  note: 'script.blockTypes.note',
};

export const SCENE_TYPE_LABEL_KEYS: Record<string, string> = {
  setup: 'script.sceneTypes.setup',
  provocation: 'script.sceneTypes.provocation',
  turn: 'script.sceneTypes.turn',
  obstacle: 'script.sceneTypes.obstacle',
  escalation: 'script.sceneTypes.escalation',
  climax: 'script.sceneTypes.climax',
  resolution: 'script.sceneTypes.resolution',
  final: 'script.sceneTypes.final',
};

export const MOOD_LABEL_KEYS: Record<string, string> = {
  calm: 'script.moods.calm',
  tense: 'script.moods.tense',
  joyful: 'script.moods.joyful',
  sad: 'script.moods.sad',
  mysterious: 'script.moods.mysterious',
  romantic: 'script.moods.romantic',
};

export const CHARACTER_ROLE_LABEL_KEYS: Record<string, string> = {
  main: 'script.characterRoles.main',
  secondary: 'script.characterRoles.secondary',
  supporting: 'script.characterRoles.supporting',
  antagonist: 'script.characterRoles.antagonist',
  episodic: 'script.characterRoles.episodic',
  cameo: 'script.characterRoles.cameo',
};
