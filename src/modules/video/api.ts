import api from '../../api/http';
import type {VideoPreparationResponse} from '../../api/generated/contracts';

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
