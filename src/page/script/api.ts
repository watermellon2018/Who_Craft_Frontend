import api from '../../api/http';
import type {
  CompactCharactersResponse,
  Scene,
  SceneMutation,
  SceneOrderUpdate,
  ScenePatch,
  SceneReorderResponse,
  ScriptWorkspaceResponse,
} from './types';

const scenesUrl = (projectId: string) => `api/projects/${projectId}/scenes/`;

const unwrapScene = (data: Scene | {scene: Scene}) => ('scene' in data ? data.scene : data);

export const toSceneMutation = (scene: Scene): SceneMutation => ({
  title: scene.title,
  description: scene.description,
  script_text: scene.scriptBlocks.map((block) => block.text).filter(Boolean).join('\n\n')
    || scene.scriptText,
  script_blocks: scene.scriptBlocks,
  status: scene.status,
  order: scene.order,
  act: scene.act,
  duration_seconds: scene.durationSeconds,
  mood: scene.mood,
  scene_type: scene.sceneType,
  notes: scene.notes,
  character_ids: scene.characters.map((character) => character.id),
});

export const toScenePatch = (scene: Scene): ScenePatch => ({
  ...toSceneMutation(scene),
  version: scene.version,
});

export const scriptApi = {
  async getWorkspace(projectId: string) {
    const response = await api.get<ScriptWorkspaceResponse>(scenesUrl(projectId));
    return response.data;
  },

  async getCharacters(projectId: string) {
    const response = await api.get<CompactCharactersResponse>(
      `api/projects/${projectId}/characters/`,
    );
    return response.data.characters;
  },

  async createScene(projectId: string, scene: Scene) {
    const response = await api.post<Scene | {scene: Scene}>(
      scenesUrl(projectId),
      toSceneMutation(scene),
    );
    return unwrapScene(response.data);
  },

  async updateScene(projectId: string, scene: Scene) {
    const response = await api.patch<Scene | {scene: Scene}>(
      `${scenesUrl(projectId)}${scene.id}/`,
      toScenePatch(scene),
    );
    return unwrapScene(response.data);
  },

  async reorderScenes(projectId: string, scenes: SceneOrderUpdate[]) {
    const response = await api.patch<SceneReorderResponse>(
      `${scenesUrl(projectId)}reorder/`,
      {scenes},
    );
    return response.data.scenes;
  },

  async deleteScene(projectId: string, sceneId: number) {
    await api.delete(`${scenesUrl(projectId)}${sceneId}/`);
  },
};

export const sceneToPlainText = (scene: Scene) => {
  const body = scene.scriptBlocks
    .map((block) => `${block.type === 'scene_heading' ? '' : `${block.type.toUpperCase()}: `}${block.text}`)
    .join('\n\n');
  return `${scene.order}. ${scene.title}\n\n${body || scene.scriptText}`.trim();
};
