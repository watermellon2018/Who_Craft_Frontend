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

interface ProjectI {
  genre: string[];
  format: string;
  title: string;
  desc: string;
  annot: string;
  audience: string[];
  image: string;
}

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

// ---- Legacy wrappers (typed during the compatibility migration) ----

async function create_new_project(data: ProjectI): Promise<AxiosResponse<unknown>> {
  return api.post<unknown>('api/projects/create/', {data});
}

async function get_all_list_projects(): Promise<AxiosResponse<unknown>> {
  return api.get<unknown>('api/projects/get-list-projects/');
}

async function delete_project_by_id(id: string): Promise<AxiosResponse<unknown>> {
  localStorage.removeItem(`treeLeaf_${id}`);
  return api.delete<unknown>('api/projects/delete-project-by-id/', {params: {id}});
}

async function get_info_project(id: string): Promise<AxiosResponse<unknown>> {
  return api.get<unknown>('api/projects/select-project-by-id/', {params: {id}});
}

async function update_info_project(
  data: ProjectI,
  id: string,
): Promise<AxiosResponse<unknown>> {
  return api.post<unknown>('api/projects/update-project-by-id/', {
    data: {...data, id},
  });
}

export {
  fetch_project,
  patch_project,
  create_project,
  fetch_projects_list,
  delete_project,
  create_new_project,
  get_all_list_projects,
  delete_project_by_id,
  get_info_project,
  update_info_project,
};

export type {ProjectI, ProjectEditPayload, ProjectListResponse};
