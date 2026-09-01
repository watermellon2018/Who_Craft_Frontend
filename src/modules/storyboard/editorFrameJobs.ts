import api, {backendAssetUrl} from '../../api/http';
import type {StoryboardEditorFrameCreate, StoryboardEditorFrameJob, StoryboardEditorFrameModelOption, StoryboardEditorFrameOptions} from '../../api/generated/contracts';
import {characterApi} from '../character-studio/api/characterApi';
import type {StudioCharacter} from '../character-studio/types/character.types';
import {referenceApi} from '../reference-library/api/referenceApi';
import {isShotReady} from './model';
import type {StoryboardScene, StoryboardSceneEntity} from './model';

export type EditorFrameModel = StoryboardEditorFrameModelOption;
export type EditorFrameOptions = StoryboardEditorFrameOptions;
export type EditorFrameJob = StoryboardEditorFrameJob;
export type EditorFrameRequest = StoryboardEditorFrameCreate;
export interface EditorFrameService {
  options(projectId: string, sceneId: string, signal?: AbortSignal): Promise<EditorFrameOptions>;
  list(projectId: string, sceneId: string, signal?: AbortSignal): Promise<EditorFrameJob[]>;
  start(projectId: string, sceneId: string, request: EditorFrameRequest): Promise<EditorFrameJob>;
}
const base = (projectId: string, sceneId: string) =>
  `api/projects/${encodeURIComponent(projectId)}/storyboard/scenes/${encodeURIComponent(sceneId)}`;
export const editorFrameService: EditorFrameService = {
  async options(projectId, sceneId, signal) {
    return (await api.get<EditorFrameOptions>(`${base(projectId, sceneId)}/editor-frame-options/`, {signal})).data;
  },
  async list(projectId, sceneId, signal) {
    const response = await api.get<{jobs: EditorFrameJob[]}>(`${base(projectId, sceneId)}/editor-frame-jobs/`, {signal});
    return response.data.jobs.map((job) => ({...job, imageUrl: job.imageUrl ? backendAssetUrl(job.imageUrl) : null}));
  },
  async start(projectId, sceneId, request) {
    return (await api.post<EditorFrameJob>(`${base(projectId, sceneId)}/editor-frame-jobs/`, request)).data;
  },
};

/** Attach server-owned media without overwriting editable draft data or persisting signed URLs. */
export function applyEditorFrameJobs(scene: StoryboardScene, jobs: EditorFrameJob[], localChanges = false): StoryboardScene {
  const latest = new Map<string, EditorFrameJob>();
  for (const job of [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = `${job.shotId}/${job.keyframeId}`;
    if (String(job.sceneId) === scene.id && job.status === 'succeeded' && job.imageUrl && !latest.has(key)) latest.set(key, job);
  }
  if (!latest.size) return scene;
  const shots = scene.shots.map((shot) => ({...shot, keyframes: shot.keyframes.map((frame) => {
    const job = latest.get(`${shot.id}/${frame.id}`);
    return job ? {...frame, imageUrl: job.imageUrl ?? undefined,
      imageOutdated: localChanges || !job.matchesCurrentDraft, generationStatus: 'ready' as const} : frame;
  })}));
  const readyShotsCount = shots.filter(isShotReady).length;
  return {...scene, shots, readyShotsCount, status: !shots.length ? 'empty' : readyShotsCount === shots.length ? 'completed' : 'draft'};
}

export async function loadCanvasLibrary(projectId: string, signal?: AbortSignal): Promise<StoryboardSceneEntity[]> {
  const [characters, firstPage] = await Promise.all([
    characterApi.list(projectId), referenceApi.list(projectId, {page: 1, pageSize: 100, ordering: 'title'}, signal),
  ]);
  const list: StudioCharacter[] = Array.isArray(characters.data) ? characters.data : [];
  const entities: StoryboardSceneEntity[] = list.map((character) => {
    const canonical = character.references?.find((asset) => asset.is_canonical);
    const image = character.images?.full_body ?? character.images?.portrait;
    const imageUrl = canonical?.image_url ?? image?.image_url;
    return {id: character.character_id, title: character.name, type: 'character',
      imageUrl: imageUrl ? backendAssetUrl(imageUrl) : undefined,
      assetId: canonical?.asset_id ?? image?.asset_id ?? undefined};
  });
  const references = [...firstPage.data.items];
  for (let page = 2; references.length < firstPage.data.total; page += 1) {
    const response = await referenceApi.list(projectId, {page, pageSize: 100, ordering: 'title'}, signal);
    if (!response.data.items.length) break;
    references.push(...response.data.items);
  }
  for (const item of references) {
    if (item.status === 'archived') continue;
    entities.push({id: item.id, title: item.title,
      type: item.category === 'location' ? 'location' : item.category === 'wardrobe' ? 'clothing' : 'object',
      versionId: item.activeVersion?.id,
      imageUrl: item.activeVersion?.imageUrl ? backendAssetUrl(item.activeVersion.imageUrl) : undefined});
  }
  return entities;
}
