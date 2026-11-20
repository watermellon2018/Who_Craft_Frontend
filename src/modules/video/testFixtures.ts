import type {VideoJob, VideoOptions, VideoSourceShot, VideoWorkspace} from './types';

export function makeVideoJob(overrides: Partial<VideoJob> = {}): VideoJob {
  return {
    id: 'video-job-1', videoShotId: 17, sceneId: 11, sourceKind: 'editor_draft', sourceShotId: 'shot-1',
    status: 'completed', stage: 'completed', modelId: 'veo-fast', modelLabel: 'Veo Fast', generationSource: 'personal',
    requestedDurationSeconds: 5, effectiveDurationSeconds: 6, motionPrompt: 'Камера плавно приближается',
    aspectRatio: '16:9', resolution: '720p', sourceFingerprint: 'source-current', stale: false, staleReasons: [],
    assetId: 201, videoUrl: '/media/video-1.mp4', error: null,
    createdAt: '2026-09-27T10:00:00Z', completedAt: '2026-09-27T10:01:00Z', pollAfterMs: 3000,
    ...overrides,
  };
}

export function makeVideoShot(overrides: Partial<VideoSourceShot> = {}): VideoSourceShot {
  return {
    sourceKind: 'editor_draft', sourceShotId: 'shot-1', sceneId: 11, title: 'Письмо на столе', order: 1,
    description: 'Анна открывает письмо у окна.', durationSeconds: 5, aspectRatio: '16:9',
    startFrame: {assetId: 101, imageUrl: '/media/start.jpg', label: 'Начало'},
    endFrame: {assetId: 102, imageUrl: '/media/end.jpg', label: 'Конец'},
    fingerprint: 'source-current', ready: true, blockers: [], videoShotId: 17, videoShotVersion: 1,
    motionPrompt: 'Камера плавно приближается', selectedJobId: null, jobs: [],
    ...overrides,
  };
}

export function makeVideoWorkspace(overrides: Partial<VideoWorkspace> = {}): VideoWorkspace {
  return {
    projectId: 42, projectTitle: 'Письмо',
    permissions: {canView: true, canEdit: true, canRunGeneration: true}, generationSource: 'personal',
    scenes: [{id: 11, title: 'Кухня утром', order: 1, ready: true, blockers: [], shots: [makeVideoShot()]}],
    archivedShots: [],
    ...overrides,
  };
}

export function makeVideoOptions(overrides: Partial<VideoOptions> = {}): VideoOptions {
  return {
    generationSource: 'personal', models: [{
      id: 'veo-fast', label: 'Veo Fast', provider: 'gemini', compatible: true, unavailableReason: '',
      durations: [4, 6, 8], aspectRatios: ['16:9', '9:16'], resolutions: ['720p'],
    }],
    selectedModelId: 'veo-fast', requestedDurationSeconds: 5, effectiveDurationSeconds: 6,
    durationAdjusted: true, canGenerate: true, blockers: [], preflightToken: 'preflight-approved', expiresInSeconds: 300,
    ...overrides,
  };
}
