import type {VideoJob, VideoSourceShot} from '../../api/generated/contracts';

export type {
  GenerationSource as VideoGenerationSource,
  VideoBlocker,
  VideoFrame,
  VideoJob,
  VideoModelOption,
  VideoOptions,
  VideoOptionsRequest as VideoOptionsInput,
  VideoScene,
  VideoSourceShot,
  VideoWorkspace,
} from '../../api/generated/contracts';

export type VideoSourceKind = VideoSourceShot['sourceKind'];

export function videoShotKey(shot: Pick<VideoSourceShot, 'sceneId' | 'sourceKind' | 'sourceShotId'>) {
  return `${shot.sceneId}:${shot.sourceKind}:${shot.sourceShotId}`;
}

export function isActiveVideoJob(job: VideoJob) {
  return job.status === 'queued' || job.status === 'processing';
}
