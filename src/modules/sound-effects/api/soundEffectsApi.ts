import {v4 as uuidv4} from 'uuid';

import api from '../../../api/http';
import type {
  SoundEffectAccepted,
  SoundEffectApplyResponse,
  SoundEffectCapabilities,
  SoundEffectCreateRequest,
  SoundEffectJob,
  SoundEffectJobPage,
  SoundEffectPage,
} from '../types';

type ProjectId = number | string;

const base = (projectId: ProjectId) => `api/projects/${projectId}/sound-effects`;

export function newSoundEffectIdempotencyKey(): string {
  return `sound-effect:${uuidv4()}`;
}

export const soundEffectsApi = {
  applyVariant(
    projectId: ProjectId,
    jobId: string,
    variantId: string,
    payload: {targetEffectId: number | null; title: string},
  ) {
    return api.post<SoundEffectApplyResponse>(
      `${base(projectId)}/generation-jobs/${jobId}/variants/${variantId}/apply/`,
      payload,
    );
  },
  cancelJob(projectId: ProjectId, jobId: string) {
    return api.post<SoundEffectJob>(
      `${base(projectId)}/generation-jobs/${jobId}/cancellation-request/`,
    );
  },
  enqueueJob(
    projectId: ProjectId,
    payload: SoundEffectCreateRequest,
    idempotencyKey: string,
  ) {
    return api.post<SoundEffectAccepted>(`${base(projectId)}/generation-jobs/`, payload, {
      headers: {'Idempotency-Key': idempotencyKey},
    });
  },
  getCapabilities(projectId: ProjectId, signal?: AbortSignal) {
    return api.get<SoundEffectCapabilities>(`${base(projectId)}/capabilities/`, {signal});
  },
  getJob(projectId: ProjectId, jobId: string, signal?: AbortSignal) {
    return api.get<SoundEffectJob>(`${base(projectId)}/generation-jobs/${jobId}/`, {signal});
  },
  listEffects(projectId: ProjectId, signal?: AbortSignal) {
    return api.get<SoundEffectPage>(`${base(projectId)}/`, {signal});
  },
  listJobs(projectId: ProjectId, signal?: AbortSignal) {
    return api.get<SoundEffectJobPage>(`${base(projectId)}/generation-jobs/`, {signal});
  },
  retryJob(projectId: ProjectId, jobId: string) {
    return api.post<SoundEffectAccepted | SoundEffectJob>(
      `${base(projectId)}/generation-jobs/${jobId}/retry/`,
    );
  },
};
