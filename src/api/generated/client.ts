// Generated from openapi/w_craft.openapi.json. Do not edit manually.

import type {AxiosInstance} from 'axios';
import type {
  CharacterTreeCreateRequest,
  CharacterTreeNode,
  CharacterTreeUpdateRequest,
  CreditDemoTopUpRequest,
  CreditHistoryPage,
  CreditMutationResponse,
  CreditOperationType,
  CreditSummary,
  CreditTransferRequest,
  CreditTransferResponse,
  ProjectId,
  ProjectInvitationRequest,
  ProjectInvitationResponse,
  ProjectMutationRequest,
  ProjectMutationResponse,
} from './contracts';

const projectPath = (template: string, projectId: ProjectId) =>
  template.replace('{projectId}', encodeURIComponent(String(projectId)));

const treeNodePath = (template: string, projectId: ProjectId, nodeId: string) =>
  projectPath(template, projectId).replace('{nodeId}', encodeURIComponent(String(nodeId)));

export function createGeneratedApiClient(http: AxiosInstance) {
  return {
    async getCreditSummary(): Promise<CreditSummary> {
      const response = await http.get<CreditSummary>('api/credits/summary/');
      return response.data;
    },
    async listCreditHistory(params: {limit?: number; offset?: number; operationType?: CreditOperationType} = {}): Promise<CreditHistoryPage> {
      const response = await http.get<CreditHistoryPage>('api/credits/history/', {params});
      return response.data;
    },
    async createCreditDemoTopUp(payload: CreditDemoTopUpRequest, idempotencyKey: string): Promise<CreditMutationResponse> {
      const response = await http.post<CreditMutationResponse>('api/credits/demo-top-up/', payload, {
        headers: {'Idempotency-Key': idempotencyKey},
      });
      return response.data;
    },
    async createCreditTransfer(payload: CreditTransferRequest, idempotencyKey: string): Promise<CreditTransferResponse> {
      const response = await http.post<CreditTransferResponse>('api/credits/transfers/', payload, {
        headers: {'Idempotency-Key': idempotencyKey},
      });
      return response.data;
    },
    async listCharacterTree(projectId: ProjectId): Promise<CharacterTreeNode[]> {
      const response = await http.get<CharacterTreeNode[]>(projectPath('api/projects/{projectId}/character-tree/', projectId));
      return response.data;
    },
    async createCharacterTreeNode(projectId: ProjectId, payload: CharacterTreeCreateRequest): Promise<CharacterTreeNode> {
      const response = await http.post<CharacterTreeNode>(projectPath('api/projects/{projectId}/character-tree/nodes/', projectId), payload);
      return response.data;
    },
    async renameCharacterTreeNode(projectId: ProjectId, nodeId: string, payload: CharacterTreeUpdateRequest): Promise<CharacterTreeNode> {
      const response = await http.patch<CharacterTreeNode>(treeNodePath('api/projects/{projectId}/character-tree/nodes/{nodeId}/', projectId, nodeId), payload);
      return response.data;
    },
    async deleteCharacterTreeNode(projectId: ProjectId, nodeId: string): Promise<void> {
      await http.delete(treeNodePath('api/projects/{projectId}/character-tree/nodes/{nodeId}/', projectId, nodeId));
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
