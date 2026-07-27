import type {
  CharacterTreeCreateRequest,
  CharacterTreeNode,
  DeleteResponse,
  ProjectId,
  CharacterTreeRenameResponse,
} from '../../generated/contracts';
import {createGeneratedApiClient} from '../../generated/client';
import api from '../../http';

const treeApi = createGeneratedApiClient(api);

async function get_all_character_for_project(projectId: ProjectId): Promise<CharacterTreeNode[]> {
  return treeApi.listCharacterTree(projectId);
}

async function deleteCharacterFromTree(id: string): Promise<DeleteResponse> {
  return treeApi.deleteCharacterTreeNode({id});
}

async function createCharacterFromTreeAPI(
  id: string,
  name: string,
  type: 'leaf' | 'node',
  projectId: ProjectId,
  parentId: string | null = null,
  heroID: number | null = null,
  studioCharacterId: string | null = null,
): Promise<void> {
  const payload: CharacterTreeCreateRequest = {
    heroID,
    id,
    name,
    type,
    parent: parentId,
    projectId,
    studioCharacterId,
  };
  await treeApi.createCharacterTreeNode(payload);
}

async function renameCharacterFromTree(
  id: string,
  name: string,
): Promise<CharacterTreeRenameResponse> {
  return treeApi.renameCharacterTreeNode({id, name});
}

export {
  get_all_character_for_project,
  deleteCharacterFromTree,
  createCharacterFromTreeAPI,
  renameCharacterFromTree,
};
