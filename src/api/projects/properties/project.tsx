import type {AxiosResponse} from 'axios';

import type {
  ProjectMutationRequest,
  ProjectMutationResponse,
} from '../../generated/contracts';
import {createGeneratedApiClient} from '../../generated/client';
import api from '../../http';

const projectApi = createGeneratedApiClient(api);

// Token is attached as X-User-Token by api/http.ts. Do not pass token_user
// in query params or body — query strings leak to logs/Referer.

interface ProjectListResponse {
  projects: ProjectMutationResponse[];
}

type ProjectEditPayload = ProjectMutationRequest;

// ---- New API (preferred) ----

async function fetch_project(
  projectId: string | number,
): Promise<ProjectMutationResponse> {
  return projectApi.getProject(projectId);
}

async function patch_project(
  projectId: string | number,
  payload: ProjectEditPayload,
): Promise<ProjectMutationResponse> {
  return projectApi.updateProject(projectId, payload);
}

async function create_project(
  payload: ProjectEditPayload,
): Promise<ProjectMutationResponse> {
  return projectApi.createProject(payload);
}

async function fetch_projects_list(): Promise<AxiosResponse<ProjectListResponse>> {
  return api.get<ProjectListResponse>('api/projects/');
}

async function delete_project(projectId: string | number): Promise<AxiosResponse<void>> {
  localStorage.removeItem(`treeLeaf_${projectId}`);
  return api.delete<void>(`api/projects/${projectId}/`);
}

export {
  fetch_project,
  patch_project,
  create_project,
  fetch_projects_list,
  delete_project,
};

export type {ProjectEditPayload, ProjectListResponse};
