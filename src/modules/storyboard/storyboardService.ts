import type {
  GenerationReference,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardShotListConfiguration,
  StoryboardShotListOptions,
  StoryboardShot,
} from './model';
import {MOCK_STORYBOARD_SCENES} from './mockData';
import {storyboardApi} from './storyboardApi';
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
  loadScenes: storyboardApi.loadScenes,
  loadShotListOptions: async (scene, projectId) => (
    storyboardApi.loadShotListOptions(projectId, scene.id)
  ),
  suggestShotList: async (scene, projectId, configuration) => {
    const proposal = await storyboardApi.suggestShotList(projectId, scene.id, configuration);
    return proposal.shots.map((shot, index) => createShot(scene, {
      characterIds: shot.suggested_characters,
      description: shot.description,
      locationId: shot.suggested_location ?? undefined,
      referenceIds: shot.suggested_assets,
      title: shot.title,
    }, index + 1));
  },
};
