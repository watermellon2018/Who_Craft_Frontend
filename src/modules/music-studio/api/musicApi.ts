import {v4 as uuidv4} from 'uuid';

import api from '../../../api/http';
import type {
  MusicApplyRequest,
  MusicApplyResponse,
  MusicAssignmentsResponse,
  MusicAssignmentWriteItem,
  MusicCapabilities,
  MusicEnqueueRequest,
  MusicEnqueueResponse,
  MusicGenerationJob,
  MusicJobHistoryResponse,
  MusicLibraryResponse,
  MusicReferenceAsset,
  MusicSceneOptionsResponse,
  MusicTrackDetail,
  MusicTrackVersionSummary,
} from '../types';

type ProjectId = number | string;

const base = (projectId: ProjectId) => `api/projects/${projectId}/music`;

export function newMusicIdempotencyKey(): string {
  return `music:${uuidv4()}`;
}

export const musicApi = {
  applyVariant(
    projectId: ProjectId,
    jobId: string,
    variantId: string,
    payload: MusicApplyRequest,
  ) {
    return api.post<MusicApplyResponse>(
      `${base(projectId)}/generation-jobs/${jobId}/variants/${variantId}/apply/`,
      payload,
    );
  },
  archiveTrack(projectId: ProjectId, trackId: number, expectedTrackVersion: number) {
    return api.post<MusicTrackDetail>(
      `${base(projectId)}/${trackId}/archive/`,
      {expectedTrackVersion},
    );
  },
  cancelJob(projectId: ProjectId, jobId: string) {
    return api.post<MusicGenerationJob>(
      `${base(projectId)}/generation-jobs/${jobId}/cancellation-request/`,
    );
  },
  deleteReference(projectId: ProjectId, assetId: string) {
    return api.delete(`${base(projectId)}/reference-assets/${assetId}/`);
  },
  enqueueJob(projectId: ProjectId, payload: MusicEnqueueRequest, idempotencyKey: string) {
    return api.post<MusicEnqueueResponse>(
      `${base(projectId)}/generation-jobs/`,
      payload,
      {headers: {'Idempotency-Key': idempotencyKey}},
    );
  },
  getCapabilities(projectId: ProjectId, signal?: AbortSignal) {
    return api.get<MusicCapabilities>(`${base(projectId)}/capabilities/`, {signal});
  },
  getJob(projectId: ProjectId, jobId: string, signal?: AbortSignal) {
    return api.get<MusicGenerationJob>(
      `${base(projectId)}/generation-jobs/${jobId}/`,
      {signal},
    );
  },
  getTrack(projectId: ProjectId, trackId: number, signal?: AbortSignal) {
    return api.get<MusicTrackDetail>(`${base(projectId)}/${trackId}/`, {signal});
  },
  listAssignments(projectId: ProjectId, trackId: number, signal?: AbortSignal) {
    return api.get<MusicAssignmentsResponse>(
      `${base(projectId)}/${trackId}/assignments/`,
      {signal},
    );
  },
  listJobs(
    projectId: ProjectId,
    params: {limit?: number; offset?: number} = {},
    signal?: AbortSignal,
  ) {
    return api.get<MusicJobHistoryResponse>(`${base(projectId)}/generation-jobs/`, {
      params,
      signal,
    });
  },
  listLibrary(
    projectId: ProjectId,
    params: {limit?: number; offset?: number; q?: string; status?: 'active' | 'archived'},
    signal?: AbortSignal,
  ) {
    return api.get<MusicLibraryResponse>(`${base(projectId)}/`, {params, signal});
  },
  listSceneOptions(
    projectId: ProjectId,
    params: {act?: number; limit?: number; q?: string; sceneId?: number},
    signal?: AbortSignal,
  ) {
    return api.get<MusicSceneOptionsResponse>(`${base(projectId)}/scene-options/`, {
      params,
      signal,
    });
  },
  replaceAssignments(
    projectId: ProjectId,
    trackId: number,
    expectedTrackVersion: number,
    items: MusicAssignmentWriteItem[],
  ) {
    return api.put<MusicAssignmentsResponse>(`${base(projectId)}/${trackId}/assignments/`, {
      expectedTrackVersion,
      items,
    });
  },
  retryJob(projectId: ProjectId, jobId: string) {
    return api.post<MusicEnqueueResponse | MusicGenerationJob>(
      `${base(projectId)}/generation-jobs/${jobId}/retry/`,
    );
  },
  setActiveVersion(
    projectId: ProjectId,
    trackId: number,
    expectedTrackVersion: number,
    activeVersionId: string,
  ) {
    return api.patch<MusicTrackDetail>(`${base(projectId)}/${trackId}/`, {
      activeVersionId,
      expectedTrackVersion,
    });
  },
  updateTrack(
    projectId: ProjectId,
    trackId: number,
    payload: {
      author?: string;
      durationSeconds?: number;
      expectedTrackVersion: number;
      tags?: string[];
      title?: string;
    },
  ) {
    return api.patch<MusicTrackDetail>(`${base(projectId)}/${trackId}/`, payload);
  },
  uploadReference(projectId: ProjectId, file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.append('file', file);
    form.append('rightsConfirmed', 'true');
    form.append('rightsStatementVersion', 'music-reference-v1');
    return api.post<MusicReferenceAsset>(`${base(projectId)}/reference-assets/`, form, {signal});
  },
};

export interface AppliedTrackContext {
  activeVersion: MusicTrackVersionSummary | null;
  trackId: number;
  trackVersion: number;
}
