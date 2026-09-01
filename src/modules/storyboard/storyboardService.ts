import type {
  GenerationReference,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardShotListConfiguration,
  StoryboardShotListOptions,
  StoryboardShot,
  StoryboardSourceDocument,
} from './model';
import type {StoryboardShotMetadataRequest} from '../../api/generated/contracts';
import i18n from '../../i18n';
import {MOCK_STORYBOARD_SCENES} from './mockData';
import {storyboardApi} from './storyboardApi';
import {shotListJobService} from './shotListJobs';
import {editorFrameService, loadCanvasLibrary} from './editorFrameJobs';
import type {EditorFrameService} from './editorFrameJobs';
import type {StoryboardSceneEntity} from './model';
import type {ShotListJobService} from './shotListJobs';
import {createMockShotList, createShot} from './useStoryboardWorkspace';

export interface GenerateStoryboardFrameInput {
  keyframe: StoryboardKeyframe;
  references: GenerationReference[];
  shot: StoryboardShot;
}

export interface GenerateStoryboardFrameResult {
  imageUrl: string;
}

export type StoryboardShotMetadataField = StoryboardShotMetadataRequest['field'];
export type StoryboardShotMetadataRange = StoryboardShotMetadataRequest['range'];

export interface StoryboardFrontendService {
  editorFrames?: EditorFrameService;
  loadCanvasLibrary?: (projectId: string, signal?: AbortSignal) => Promise<StoryboardSceneEntity[]>;
  shotListJobs?: ShotListJobService;
  generateFrame: (input: GenerateStoryboardFrameInput) => Promise<GenerateStoryboardFrameResult>;
  loadScenes: (projectId: string) => Promise<StoryboardScene[]>;
  loadShotListOptions: (
    scene: StoryboardScene,
    projectId: string,
  ) => Promise<StoryboardShotListOptions>;
  suggestShotMetadata: (
    scene: StoryboardScene,
    projectId: string,
    field: StoryboardShotMetadataField,
    range: StoryboardShotMetadataRange,
  ) => Promise<string>;
  suggestShotList: (
    scene: StoryboardScene,
    projectId: string,
    configuration: StoryboardShotListConfiguration,
  ) => Promise<StoryboardShot[]>;
}

export const storyboardMockService: StoryboardFrontendService = {
  generateFrame: async ({keyframe}) => ({
    imageUrl: `mock://storyboard/generated/${keyframe.id}/${Date.now()}`,
  }),
  loadScenes: async () => MOCK_STORYBOARD_SCENES.map((scene) => ({
    ...scene,
    entities: scene.entities.map((entity) => ({...entity})),
    locationIds: [...scene.locationIds],
    shots: scene.shots.map((shot) => ({
      ...shot,
      characterIds: [...shot.characterIds],
      keyframes: shot.keyframes.map((keyframe) => ({
        ...keyframe,
        cameraIntent: {...keyframe.cameraIntent},
        generationReferences: keyframe.generationReferences?.map((reference) => ({...reference})),
      })),
      referenceIds: [...shot.referenceIds],
      transitions: shot.transitions.map((transition) => ({...transition})),
    })),
  })),
  loadShotListOptions: async (scene) => ({
    context: {
      characters: scene.entities
        .filter(({type}) => type === 'character')
        .map(({title}) => title),
      locations: scene.entities
        .filter(({type}) => type === 'location')
        .map(({title}) => title),
      sceneTitle: scene.heading || scene.title,
    },
    defaultModel: 'mock/storyboard-director',
    maxShots: 16,
    models: [{
      available: true,
      estimatedCostUsd: '0.001200',
      estimatedInputTokens: 800,
      estimatedOutputTokens: 2880,
      id: 'mock/storyboard-director',
      label: 'Storyboard Director · Mock',
      provider: 'Mock',
      unavailableReason: null,
    }],
  }),
  suggestShotMetadata: async (scene, _projectId, field, range) => {
    const selection = Array.from(scene.text).slice(range.start, range.end).join('').trim();
    if (field === 'description') return selection;
    return selection.split(/\s+/u).slice(0, 8).join(' ');
  },
  suggestShotList: async (scene) => createMockShotList(scene),
};

export const storyboardService: StoryboardFrontendService = {
  generateFrame: async () => {throw new Error('Use the durable editor-frame-jobs endpoint.');},
  editorFrames: editorFrameService,
  loadCanvasLibrary,
  shotListJobs: shotListJobService,
  loadScenes: storyboardApi.loadScenes,
  loadShotListOptions: async (scene, projectId) => (
    storyboardApi.loadShotListOptions(projectId, scene.id,
      i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ru')
  ),
  suggestShotMetadata: async (scene, projectId, field, range) => {
    const suggestion = await storyboardApi.suggestShotMetadata(
      projectId,
      scene.id,
      {
        field,
        language: i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ru',
        range,
        sceneVersion: scene.version ?? 1,
      },
      scene.draftAuthGeneration,
    );
    return suggestion.value;
  },
  suggestShotList: async (scene, projectId, configuration) => {
    const proposal = await storyboardApi.suggestShotList(
      projectId, scene.id, configuration, scene.draftAuthGeneration,
    );
    const document: StoryboardSourceDocument | undefined = proposal.source ? {
      contentHash: proposal.source.content_hash,
      sceneId: proposal.source.scene_id,
      sceneVersion: proposal.source.scene_version,
      segments: proposal.source.segments.map((segment) => ({...segment})),
      truncated: proposal.source.truncated,
    } : undefined;
    return proposal.shots.map((shot, index) => createShot(scene, {
      characterIds: shot.suggested_characters,
      description: shot.description,
      locationId: shot.suggested_location ?? undefined,
      referenceIds: shot.suggested_assets,
      source: document ? {document, segmentIds: [...(shot.source_segment_ids ?? [])], origin: 'ai'} : undefined,
      title: shot.title,
    }, index + 1));
  },
};
