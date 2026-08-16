import api from '../../../api/http';

export interface CharacterTreeNode {
  id: string;
  key: string;
  name: string;
  is_folder: boolean;
  character_id?: string | null;
  children?: CharacterTreeNode[];
}

export interface CreateCharacterTreeNodePayload {
  id: string;
  name: string;
  type: 'folder' | 'character';
  parent_id?: string;
  studio_character_id?: string;
}

const treeBase = (projectId: string | number) =>
  `api/projects/${projectId}/character-tree`;

export const characterTreeApi = {
  async list(projectId: string | number): Promise<CharacterTreeNode[]> {
    const response = await api.get<CharacterTreeNode[]>(`${treeBase(projectId)}/`);
    return response.data;
  },

  async create(
    projectId: string | number,
    payload: CreateCharacterTreeNodePayload,
  ): Promise<CharacterTreeNode> {
    const response = await api.post<CharacterTreeNode>(`${treeBase(projectId)}/nodes/`, payload);
    return response.data;
  },

  async rename(
    projectId: string | number,
    nodeId: string,
    name: string,
  ): Promise<CharacterTreeNode> {
    const response = await api.patch<CharacterTreeNode>(
      `${treeBase(projectId)}/nodes/${encodeURIComponent(nodeId)}/`,
      {name},
    );
    return response.data;
  },

  async delete(projectId: string | number, nodeId: string): Promise<void> {
    await api.delete(`${treeBase(projectId)}/nodes/${encodeURIComponent(nodeId)}/`);
  },
};
