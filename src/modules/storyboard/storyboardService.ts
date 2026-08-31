import type {
  GenerationReference,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardShotListConfiguration,
  StoryboardShotListOptions,
  StoryboardShot,
  StoryboardSourceDocument,
} from './model';
import i18n from '../../i18n';
import {MOCK_STORYBOARD_SCENES} from './mockData';
import {storyboardApi} from './storyboardApi';
import {shotListJobService} from './shotListJobs';
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

export interface StoryboardFrontendService {
  shotListJobs?: ShotListJobService;
  generateFrame: (input: GenerateStoryboardFrameInput) => Promise<GenerateStoryboardFrameResult>;
  loadScenes: (projectId: string) => Promise<StoryboardScene[]>;
  loadShotListOptions: (
    scene: StoryboardScene,
    projectId: string,
  ) => Promise<StoryboardShotListOptions>;
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
  suggestShotList: async (scene) => createMockShotList(scene),
};

export const storyboardService: StoryboardFrontendService = {
  ...storyboardMockService,
  shotListJobs: shotListJobService,
  loadScenes: storyboardApi.loadScenes,
  loadShotListOptions: async (scene, projectId) => (
    storyboardApi.loadShotListOptions(projectId, scene.id,
      i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ru')
  ),
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
