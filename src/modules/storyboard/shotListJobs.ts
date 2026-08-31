import {v4 as uuid} from 'uuid';

import api, {getAuthGeneration} from '../../api/http';
import type {EditorDraftPayload} from './editorDrafts';
import type {StoryboardShotListConfiguration} from './model';

export interface ShotListJob {
  jobId: string;
  sceneId: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  resultState: 'pending' | 'applied' | 'dismissed';
  model: string;
  language: 'ru' | 'en';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  estimatedSeconds: number;
  expectedRevision: number;
  result: EditorDraftPayload | null;
  appliedRevision: number | null;
  errorCode: string | null;
}

export interface ShotListJobService {
  list: (projectId: string, authGeneration: number) => Promise<ShotListJob[]>;
  start: (projectId: string, sceneId: string, configuration: StoryboardShotListConfiguration,
    estimatedSeconds: number, requestId: string, authGeneration: number) => Promise<ShotListJob>;
  apply: (projectId: string, jobId: string, expectedRevision: number, authGeneration: number) => Promise<ShotListJob>;
  dismiss: (projectId: string, jobId: string, authGeneration: number) => Promise<ShotListJob>;
}

const base = (projectId: string) => `api/projects/${encodeURIComponent(projectId)}/storyboard/`;

function currentResponse<T>(value: T, authGeneration: number): T {
  if (authGeneration !== getAuthGeneration()) throw new Error('Storyboard session changed');
  return value;
}

export function isShotListJobActive(job?: ShotListJob): boolean {
  return job?.status === 'queued' || job?.status === 'running';
}

export const shotListJobService: ShotListJobService = {
  list: async (projectId, authGeneration) => {
    const response = await api.get<{jobs: ShotListJob[]}>(`${base(projectId)}shot-list-jobs/`,
      {expectedAuthGeneration: authGeneration});
    return currentResponse(response.data.jobs, authGeneration);
  },
  start: async (projectId, sceneId, configuration, estimatedSeconds, requestId, authGeneration) => {
    const response = await api.post<ShotListJob>(
      `${base(projectId)}scenes/${encodeURIComponent(sceneId)}/shot-list-jobs/`,
      {...configuration, estimatedSeconds, requestId}, {expectedAuthGeneration: authGeneration},
    );
    return currentResponse(response.data, authGeneration);
  },
  apply: async (projectId, jobId, expectedRevision, authGeneration) => {
    const response = await api.post<ShotListJob>(
      `${base(projectId)}shot-list-jobs/${encodeURIComponent(jobId)}/apply/`,
      {expectedRevision, mutationId: uuid()}, {expectedAuthGeneration: authGeneration},
    );
    return currentResponse(response.data, authGeneration);
  },
  dismiss: async (projectId, jobId, authGeneration) => {
    const response = await api.post<ShotListJob>(
      `${base(projectId)}shot-list-jobs/${encodeURIComponent(jobId)}/dismiss/`, {},
      {expectedAuthGeneration: authGeneration},
    );
    return currentResponse(response.data, authGeneration);
  },
};
