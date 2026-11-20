import api, {getAuthGeneration} from '../../api/http';
import type {VideoJobAccepted, VideoPreparationResponse, VideoShotMotionResponse, VideoShotSelectResponse} from '../../api/generated/contracts';
import type {VideoOptions, VideoOptionsInput, VideoWorkspace} from './types';

export type {
  MissingCharacter as VideoPreparationMissingCharacter,
  ProjectPermissionSummary as VideoPreparationPermissions,
  VideoPreparationEmptyScene,
  VideoPreparationResponse,
  VideoPreparationStoryboardScene,
} from '../../api/generated/contracts';

export async function fetchVideoPreparation(
  projectId: string | number,
  signal?: AbortSignal,
): Promise<VideoPreparationResponse> {
  const response = await api.get<VideoPreparationResponse>(
    `api/projects/${projectId}/video/preparation/`,
    {signal},
  );
  return response.data;
}

const videoBase = (projectId: string) => `api/projects/${encodeURIComponent(projectId)}/video/`;

export async function fetchVideoWorkspace(projectId: string, signal?: AbortSignal): Promise<VideoWorkspace> {
  const response = await api.get<VideoWorkspace>(`${videoBase(projectId)}workspace/`, {signal});
  return response.data;
}

export async function fetchVideoOptions(projectId: string, payload: VideoOptionsInput, signal?: AbortSignal): Promise<VideoOptions> {
  const response = await api.post<VideoOptions>(`${videoBase(projectId)}options/`, payload, {
    signal, expectedAuthGeneration: getAuthGeneration(),
  });
  return response.data;
}

export async function createVideoJob(projectId: string, preflightToken: string, clientRequestId: string) {
  const response = await api.post<VideoJobAccepted>(`${videoBase(projectId)}jobs/`, {
    preflightToken, clientRequestId,
  }, {expectedAuthGeneration: getAuthGeneration()});
  return response.data;
}

export async function selectVideoVersion(projectId: string, videoShotId: number, jobId: string, expectedVideoShotVersion: number) {
  const response = await api.post<VideoShotSelectResponse>(
    `${videoBase(projectId)}shots/${videoShotId}/select/`, {jobId, expectedVideoShotVersion},
    {expectedAuthGeneration: getAuthGeneration()},
  );
  return response.data;
}

export async function saveVideoMotion(projectId: string, videoShotId: number, motionPrompt: string, expectedVideoShotVersion: number) {
  const response = await api.patch<VideoShotMotionResponse>(
    `${videoBase(projectId)}shots/${videoShotId}/`, {motionPrompt, expectedVideoShotVersion},
    {expectedAuthGeneration: getAuthGeneration()},
  );
  return response.data;
}
