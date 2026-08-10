import {v4 as uuidv4} from 'uuid';

import api from '../../../api/http';
import type {
  ReferenceApplyResponse,
  ReferenceCapabilities,
  ReferenceCreateRequest,
  ReferenceCreateResponse,
  ReferenceDetail,
  ReferenceEnqueueRequest,
  ReferenceGenerationJob,
  ReferenceLinkOptions,
  ReferenceListParams,
  ReferenceListResponse,
  ReferenceUpdateRequest,
  ReferenceUploadResponse,
  ReferenceVersionsResponse,
} from '../types';

type ProjectId = number | string;

const base = (projectId: ProjectId) => `api/projects/${projectId}/references`;
const referenceBase = (projectId: ProjectId, referenceId: string) => (
  `${base(projectId)}/${encodeURIComponent(referenceId)}`
);

export function newReferenceIdempotencyKey(): string {
  return `reference:${uuidv4()}`;
}

export const referenceApi = {
  applyVariant(
    projectId: ProjectId,
    referenceId: string,
    jobId: string,
    variantId: string,
    expectedReferenceVersion: number,
  ) {
    return api.post<ReferenceApplyResponse>(
      `${referenceBase(projectId, referenceId)}/generation-jobs/${encodeURIComponent(jobId)}/variants/${encodeURIComponent(variantId)}/apply/`,
      {expectedReferenceVersion},
    );
  },
  archive(projectId: ProjectId, referenceId: string, expectedReferenceVersion: number) {
    return api.post<ReferenceDetail>(
      `${referenceBase(projectId, referenceId)}/archive/`,
      {expectedReferenceVersion},
    );
  },
  cancelJob(projectId: ProjectId, referenceId: string, jobId: string) {
    return api.post<ReferenceGenerationJob>(
      `${referenceBase(projectId, referenceId)}/generation-jobs/${encodeURIComponent(jobId)}/cancellation-request/`,
    );
  },
  create(projectId: ProjectId, payload: ReferenceCreateRequest) {
    return api.post<ReferenceCreateResponse>(`${base(projectId)}/`, payload);
  },
  enqueueJob(
    projectId: ProjectId,
    referenceId: string,
    payload: ReferenceEnqueueRequest,
    idempotencyKey: string,
  ) {
    return api.post<ReferenceGenerationJob>(
      `${referenceBase(projectId, referenceId)}/generation-jobs/`,
      payload,
      {headers: {'Idempotency-Key': idempotencyKey}},
    );
  },
  getCapabilities(projectId: ProjectId, signal?: AbortSignal) {
    return api.get<ReferenceCapabilities>(`${base(projectId)}/capabilities/`, {signal});
  },
  getJob(
    projectId: ProjectId,
    referenceId: string,
    jobId: string,
    signal?: AbortSignal,
  ) {
    return api.get<ReferenceGenerationJob>(
      `${referenceBase(projectId, referenceId)}/generation-jobs/${encodeURIComponent(jobId)}/`,
      {signal},
    );
  },
  getLinkOptions(projectId: ProjectId, signal?: AbortSignal) {
    return api.get<ReferenceLinkOptions>(`${base(projectId)}/link-options/`, {signal});
  },
  getReference(projectId: ProjectId, referenceId: string, signal?: AbortSignal) {
    return api.get<ReferenceDetail>(`${referenceBase(projectId, referenceId)}/`, {signal});
  },
  list(projectId: ProjectId, params: ReferenceListParams, signal?: AbortSignal) {
    return api.get<ReferenceListResponse>(`${base(projectId)}/`, {params, signal});
  },
  listVersions(projectId: ProjectId, referenceId: string, signal?: AbortSignal) {
    return api.get<ReferenceVersionsResponse>(
      `${referenceBase(projectId, referenceId)}/versions/`,
      {signal},
    );
  },
  restore(projectId: ProjectId, referenceId: string, expectedReferenceVersion: number) {
    return api.post<ReferenceDetail>(
      `${referenceBase(projectId, referenceId)}/restore/`,
      {expectedReferenceVersion},
    );
  },
  retryJob(projectId: ProjectId, referenceId: string, jobId: string) {
    return api.post<ReferenceGenerationJob>(
      `${referenceBase(projectId, referenceId)}/generation-jobs/${encodeURIComponent(jobId)}/retry/`,
    );
  },
  update(projectId: ProjectId, referenceId: string, payload: ReferenceUpdateRequest) {
    return api.patch<ReferenceDetail>(`${referenceBase(projectId, referenceId)}/`, payload);
  },
  uploadVersion(
    projectId: ProjectId,
    referenceId: string,
    file: File,
    expectedReferenceVersion: number,
    rightsStatementVersion: string,
    signal?: AbortSignal,
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append('expectedReferenceVersion', String(expectedReferenceVersion));
    form.append('rightsConfirmed', 'true');
    form.append('rightsStatementVersion', rightsStatementVersion);
    return api.post<ReferenceUploadResponse>(
      `${referenceBase(projectId, referenceId)}/versions/upload/`,
      form,
      {signal},
    );
  },
};
