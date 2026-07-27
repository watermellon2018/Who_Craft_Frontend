// Generated from openapi/w_craft.openapi.json. Do not edit manually.

import type {AxiosInstance} from 'axios';
import type {
  CharacterTreeCreateRequest,
  CharacterTreeDeleteRequest,
  CharacterTreeNode,
  CharacterTreeRenameRequest,
  CharacterTreeRenameResponse,
  DeleteResponse,
  ProjectId,
  ProjectInvitationRequest,
  ProjectInvitationResponse,
  ProjectMutationRequest,
  ProjectMutationResponse,
} from './contracts';

const projectPath = (template: string, projectId: ProjectId) =>
  template.replace('{projectId}', encodeURIComponent(String(projectId)));

export function createGeneratedApiClient(http: AxiosInstance) {
  return {
    async listCharacterTree(projectId: ProjectId): Promise<CharacterTreeNode[]> {
      const response = await http.get<CharacterTreeNode[]>('api/character/select/', {params: {projectId}});
      return response.data;
    },
    async createCharacterTreeNode(payload: CharacterTreeCreateRequest): Promise<void> {
      await http.post<void>('api/character/create/', payload);
    },
    async renameCharacterTreeNode(payload: CharacterTreeRenameRequest): Promise<CharacterTreeRenameResponse> {
      const response = await http.post<CharacterTreeRenameResponse>('api/character/rename/', payload);
      return response.data;
    },
    async deleteCharacterTreeNode(payload: CharacterTreeDeleteRequest): Promise<DeleteResponse> {
      const response = await http.post<DeleteResponse>('api/character/delete/', payload);
      return response.data;
    },
    async getProject(projectId: ProjectId): Promise<ProjectMutationResponse> {
      const response = await http.get<ProjectMutationResponse>(projectPath('api/projects/{projectId}/', projectId));
      return response.data;
    },
    async createProject(payload: ProjectMutationRequest): Promise<ProjectMutationResponse> {
      const response = await http.post<ProjectMutationResponse>('api/projects/', payload);
      return response.data;
    },
    async updateProject(projectId: ProjectId, payload: ProjectMutationRequest): Promise<ProjectMutationResponse> {
      const response = await http.patch<ProjectMutationResponse>(projectPath('api/projects/{projectId}/', projectId), payload);
      return response.data;
    },
    async createProjectInvitation(projectId: ProjectId, payload: ProjectInvitationRequest): Promise<ProjectInvitationResponse> {
      const response = await http.post<ProjectInvitationResponse>(projectPath('api/projects/{projectId}/team/invitations/', projectId), payload);
      return response.data;
    },
  };
}

export type GeneratedApiClient = ReturnType<typeof createGeneratedApiClient>;
