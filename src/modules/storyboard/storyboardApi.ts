import type {
  StoryboardCameraIntent as ApiCameraIntent,
  StoryboardKeyframe as ApiKeyframe,
  StoryboardMovement as ApiMovement,
  StoryboardSceneSummary,
  StoryboardShotProposal,
  StoryboardShot as ApiShot,
  StoryboardWorkspace as ApiWorkspace,
} from '../../api/generated/contracts';
import api, {backendAssetUrl} from '../../api/http';
import {scriptApi} from '../../page/script/api';
import type {Scene} from '../../page/script/types';
import {hydrateEditorDrafts, loadEditorDrafts} from './editorDrafts';
import type {
  CameraIntent,
  CameraMovementType,
  CompositionSubject,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardSceneEntity,
  StoryboardEntityType,
  StoryboardShotListConfiguration,
  StoryboardShotListOptions,
  StoryboardShot,
} from './model';

const DEFAULT_CAMERA_INTENT: CameraIntent = {
  azimuth: 'front',
  distance: 'medium',
  elevation: 'eye-level',
  framing: 'medium',
  lens: 50,
};

const MOVEMENT_MAP: Record<ApiMovement, CameraMovementType> = {
  crane_down: 'Crane Down',
  crane_up: 'Crane Up',
  custom: 'Custom',
  dolly_in: 'Dolly In',
  dolly_out: 'Dolly Out',
  follow: 'Follow',
  orbit_left: 'Orbit Left',
  orbit_right: 'Orbit Right',
  pan_left: 'Pan Left',
  pan_right: 'Pan Right',
  static: 'Static',
  tilt_down: 'Tilt Down',
  tilt_up: 'Tilt Up',
  truck_left: 'Truck Left',
  truck_right: 'Truck Right',
};

interface StoryboardContextItem {
  id: number | string;
  name?: string;
  title?: string;
}

interface StoryboardContext {
  characters?: StoryboardContextItem[];
  locations?: StoryboardContextItem[];
  scene?: {
    text?: string;
    title?: string;
  };
  visualAssets?: Array<StoryboardContextItem & {category?: string}>;
}

function storyboardPath(projectId: string) {
  return `api/projects/${encodeURIComponent(projectId)}/storyboard/scenes/`;
}

function sceneText(scene: Scene): string {
  if (scene.scriptText?.trim()) return scene.scriptText.trim();
  const blockText = scene.scriptBlocks
    .map(({text}) => text.trim())
    .join('\n').trim();
  return blockText || scene.description.trim() || scene.notes.trim();
}

function sceneHeading(scene: Scene): string | undefined {
  return scene.scriptBlocks
    .find(({type}) => type === 'scene_heading')
    ?.text.trim() || undefined;
}

function asContext(value: Record<string, unknown> | undefined): StoryboardContext {
  if (!value) return {};
  return value as StoryboardContext;
}

function contextEntity(
  item: StoryboardContextItem,
  type: StoryboardEntityType,
): StoryboardSceneEntity {
  return {
    id: String(item.id),
    title: item.name || item.title || String(item.id),
    type,
  };
}

function visualAssetType(category?: string): StoryboardEntityType {
  if (category === 'location') return 'location';
  if (category === 'wardrobe') return 'clothing';
  if (category === 'prop' || category === 'vehicle') return 'object';
  return 'other';
}

function mergeSceneEntities(scene: Scene, context: StoryboardContext): StoryboardSceneEntity[] {
  const entities = new Map<string, StoryboardSceneEntity>();
  scene.characters.forEach((character) => entities.set(character.id, {
    id: character.id,
    imageUrl: character.imageUrl || undefined,
    title: character.name,
    type: 'character',
  }));
  context.characters?.forEach((item) => {
    const id = String(item.id);
    if (!entities.has(id)) entities.set(id, contextEntity(item, 'character'));
  });
  context.locations?.forEach((item) => {
    const entity = contextEntity(item, 'location');
    entities.set(entity.id, entity);
  });
  context.visualAssets?.forEach((item) => {
    const entity = contextEntity(item, visualAssetType(item.category));
    entities.set(entity.id, entity);
  });
  return Array.from(entities.values());
}

function compositionSubjects(items: Array<Record<string, unknown>>): CompositionSubject[] | undefined {
  const subjects = items.flatMap((item) => {
    const subjectId = item.subjectId;
    const {height, width, x, y} = item;
    if (
      typeof subjectId !== 'string'
      || typeof height !== 'number'
      || typeof width !== 'number'
      || typeof x !== 'number'
      || typeof y !== 'number'
    ) return [];
    return [{height, subjectId, width, x, y}];
  });
  return subjects.length ? subjects : undefined;
}

function cameraIntent(intent: ApiCameraIntent | null): CameraIntent {
  if (!intent) return {...DEFAULT_CAMERA_INTENT};
  const targetIds = Array.isArray(intent.target.ids) ? intent.target.ids : [];
  const targetId = targetIds.find((id): id is string => typeof id === 'string');
  return {
    azimuth: intent.azimuth.replaceAll('_', '-') as CameraIntent['azimuth'],
    composition: compositionSubjects(intent.composition),
    distance: intent.distance,
    elevation: intent.elevation.replaceAll('_', '-') as CameraIntent['elevation'],
    framing: intent.framing.replaceAll('_', '-') as CameraIntent['framing'],
    lens: intent.lensMm ?? undefined,
    targetId,
  };
}

function generationStatus(keyframe: ApiKeyframe): StoryboardKeyframe['generationStatus'] {
  const status = keyframe.activeGeneration?.status ?? keyframe.image.status;
  if (status === 'queued' || status === 'generating') return 'loading';
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function mapKeyframe(keyframe: ApiKeyframe, shotId: string): StoryboardKeyframe {
  return {
    cameraIntent: cameraIntent(keyframe.cameraIntent),
    generationStatus: generationStatus(keyframe),
    id: keyframe.id,
    imageUrl: keyframe.image.url ? backendAssetUrl(keyframe.image.url) : undefined,
    position: keyframe.position,
    shotId,
    type: keyframe.type,
  };
}

function mapShot(shot: ApiShot, sceneId: string): StoryboardShot {
  return {
    characterIds: shot.characters.flatMap(({id}) => id ? [id] : []),
    description: shot.description,
    duration: shot.durationSeconds ?? undefined,
    id: shot.id,
    keyframes: shot.keyframes.map((keyframe) => mapKeyframe(keyframe, shot.id)),
    locationId: shot.location ? String(shot.location.id) : undefined,
    order: shot.order,
    referenceIds: shot.visualReferences.flatMap(({id}) => id ? [id] : []),
    sceneId,
    title: shot.title,
    transitions: shot.transitions.map((transition) => ({
      fromKeyframeId: transition.fromKeyframeId,
      id: transition.id,
      movementOverride: transition.movementOverride
        ? MOVEMENT_MAP[transition.movementOverride]
        : undefined,
      toKeyframeId: transition.toKeyframeId,
    })),
  };
}

export function mapStoryboardScene(
  scene: Scene,
  summary?: StoryboardSceneSummary,
  workspace?: ApiWorkspace,
): StoryboardScene {
  const context = asContext(workspace?.context);
  const shots = workspace?.shots.map((shot) => mapShot(shot, String(scene.id))) ?? [];
  const entities = mergeSceneEntities(scene, context);
  return {
    entities,
    heading: sceneHeading(scene),
    id: String(scene.id),
    locationIds: entities.filter(({type}) => type === 'location').map(({id}) => id),
    order: scene.order,
    readyShotsCount: workspace?.readyShotsCount ?? summary?.readyShotsCount ?? 0,
    scriptBlocks: scene.scriptBlocks.map((block) => ({...block})),
    shots,
    shotsCount: workspace?.shotsCount ?? summary?.shotsCount ?? 0,
    status: workspace?.status ?? summary?.status ?? 'empty',
    subtitle: scene.title,
    text: sceneText(scene),
    title: context.scene?.title || scene.title,
    version: scene.version,
  };
}

export const storyboardApi = {
  async loadShotListOptions(
    projectId: string,
    sceneId: string,
    language?: 'ru' | 'en',
  ): Promise<StoryboardShotListOptions> {
    const path = `${storyboardPath(projectId)}${encodeURIComponent(sceneId)}/suggest-shots/`;
    if (language) {
      const response = await api.get<StoryboardShotListOptions>(path, {params: {language}});
      return response.data;
    }
    const response = await api.get<StoryboardShotListOptions>(
      path,
    );
    return response.data;
  },

  async loadScenes(projectId: string): Promise<StoryboardScene[]> {
    const [scriptWorkspace, summariesResponse, drafts] = await Promise.all([
      scriptApi.getWorkspace(projectId),
      api.get<StoryboardSceneSummary[]>(storyboardPath(projectId)),
      loadEditorDrafts(projectId),
    ]);
    const summaries = new Map(summariesResponse.data.map((item) => [item.id, item]));
    const workspaceEntries = await Promise.all(
      summariesResponse.data
        .filter(({shotsCount}) => shotsCount > 0)
        .map(async ({id}) => {
          const response = await api.get<ApiWorkspace>(`${storyboardPath(projectId)}${id}/`);
          return [id, response.data] as const;
        }),
    );
    const workspaces = new Map(workspaceEntries);
    const scenes = scriptWorkspace.scenes
      .map((scene) => mapStoryboardScene(scene, summaries.get(scene.id), workspaces.get(scene.id)))
      .sort((left, right) => left.order - right.order);
    return hydrateEditorDrafts(projectId, scenes, drafts);
  },

  async suggestShotList(
    projectId: string,
    sceneId: string,
    configuration: StoryboardShotListConfiguration,
    authGeneration?: number,
  ): Promise<StoryboardShotProposal> {
    const response = await api.post<StoryboardShotProposal>(
      `${storyboardPath(projectId)}${encodeURIComponent(sceneId)}/suggest-shots/`,
      configuration,
      {expectedAuthGeneration: authGeneration},
    );
    return response.data;
  },
};
