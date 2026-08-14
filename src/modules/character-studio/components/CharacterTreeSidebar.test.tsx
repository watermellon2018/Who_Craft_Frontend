import {characterApi} from '../api/characterApi';
import {characterTreeApi} from '../api/treeApi';
import type {StudioCharacter} from '../types/character.types';
import {
  collectTreeNodes,
  deleteSelectedTreeNodes,
  getDeleteConfirmationKind,
  mergeVisibleCharacters,
  renameTreeNode,
} from './CharacterTreeSidebar';
import type {CharacterTreeNode} from './CharacterTreeSidebar';

jest.mock('../api/characterApi', () => ({
  characterApi: {
    delete: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../api/treeApi', () => ({
  characterTreeApi: {
    delete: jest.fn(),
    rename: jest.fn(),
  },
}));

const mockedDeleteCharacter = characterApi.delete as jest.MockedFunction<typeof characterApi.delete>;
const mockedDeleteTreeNode = characterTreeApi.delete as jest.MockedFunction<typeof characterTreeApi.delete>;
const mockedRenameTreeNode = characterTreeApi.rename as jest.MockedFunction<typeof characterTreeApi.rename>;
const mockedUpdateCharacter = characterApi.update as jest.MockedFunction<typeof characterApi.update>;

const studioCharacter = (characterId: string, name: string): StudioCharacter => ({
  character_id: characterId,
  identity_locked: false,
  name,
  project_id: 1,
});

describe('character tree behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDeleteCharacter.mockResolvedValue({data: undefined} as never);
    mockedDeleteTreeNode.mockResolvedValue(undefined);
  });

  it('keeps visible unfiled characters as synthetic roots', () => {
    const nodes: CharacterTreeNode[] = [
      {
        id: 'folder-1',
        key: 'folder-1',
        name: 'Cast',
        is_folder: true,
        children: [{
          id: 'node-1',
          key: 'node-1',
          name: 'Hero',
          is_folder: false,
          character_id: 'character-1',
        }],
      },
      {
        id: 'duplicate-node',
        key: 'duplicate-node',
        name: 'Hero duplicate',
        is_folder: false,
        character_id: 'character-1',
      },
      {
        id: 'dangling-node',
        key: 'dangling-node',
        name: 'Deleted character',
        is_folder: false,
        character_id: 'character-3',
      },
    ];

    const result = mergeVisibleCharacters(nodes, [
      studioCharacter('character-1', 'Hero'),
      studioCharacter('character-2', 'Villain'),
    ]);

    expect(result).toEqual([
      nodes[0],
      {
        id: 'character-2',
        key: 'character-2',
        name: 'Villain',
        is_folder: false,
        character_id: 'character-2',
        __synthetic: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('legacy_hero_id');
  });

  it('deletes a folder placement while preserving all nested characters', async () => {
    const folder: CharacterTreeNode = {
      id: 'folder-1',
      key: 'folder-1',
      name: 'Cast',
      is_folder: true,
      children: [{
        id: 'node-1',
        key: 'node-1',
        name: 'Hero',
        is_folder: false,
        character_id: 'character-1',
      }],
    };

    await expect(deleteSelectedTreeNodes('project-1', [folder], new Set())).resolves.toEqual({
      deletedCharacterIds: [],
      deletedNodeIds: ['folder-1'],
      failed: false,
    });

    expect(mockedDeleteTreeNode).toHaveBeenCalledWith('project-1', 'folder-1');
    expect(mockedDeleteCharacter).not.toHaveBeenCalled();
  });

  it('deletes persisted and synthetic character leaves through characterApi', async () => {
    const persisted: CharacterTreeNode = {
      id: 'node-1',
      key: 'node-1',
      name: 'Hero',
      is_folder: false,
      character_id: 'character-1',
    };
    const synthetic: CharacterTreeNode = {
      id: 'character-2',
      key: 'character-2',
      name: 'Villain',
      is_folder: false,
      character_id: 'character-2',
      __synthetic: true,
    };

    await expect(
      deleteSelectedTreeNodes('project-1', [persisted, synthetic], new Set()),
    ).resolves.toEqual({
      deletedCharacterIds: ['character-1', 'character-2'],
      deletedNodeIds: ['node-1', 'character-2'],
      failed: false,
    });

    expect(mockedDeleteCharacter).toHaveBeenCalledWith('project-1', 'character-1');
    expect(mockedDeleteCharacter).toHaveBeenCalledWith('project-1', 'character-2');
    expect(mockedDeleteTreeNode).not.toHaveBeenCalled();
  });

  it('deletes an unlinked placeholder through the tree API', async () => {
    const placeholder: CharacterTreeNode = {
      id: 'node-1',
      key: 'node-1',
      name: 'New character',
      is_folder: false,
    };

    await deleteSelectedTreeNodes('project-1', [placeholder], new Set());

    expect(mockedDeleteTreeNode).toHaveBeenCalledWith('project-1', 'node-1');
    expect(mockedDeleteCharacter).not.toHaveBeenCalled();
  });

  it('uses an explicit warning for mixed folder and character deletion', () => {
    const folder: CharacterTreeNode = {
      id: 'folder-1',
      key: 'folder-1',
      name: 'Cast',
      is_folder: true,
    };
    const character: CharacterTreeNode = {
      id: 'node-1',
      key: 'node-1',
      name: 'Hero',
      is_folder: false,
      character_id: 'character-1',
    };

    expect(getDeleteConfirmationKind([folder, character])).toBe('mixed');
  });

  it('keeps an explicitly selected descendant when its folder is also selected', () => {
    const character: CharacterTreeNode = {
      id: 'node-1',
      key: 'node-1',
      name: 'Hero',
      is_folder: false,
      character_id: 'character-1',
    };
    const folder: CharacterTreeNode = {
      id: 'folder-1',
      key: 'folder-1',
      name: 'Cast',
      is_folder: true,
      children: [character],
    };

    expect(
      collectTreeNodes([folder], new Set(['folder-1', 'node-1'])),
    ).toEqual([folder, character]);
  });

  it('reports successful character deletion when another selected item fails', async () => {
    const folder: CharacterTreeNode = {
      id: 'folder-1',
      key: 'folder-1',
      name: 'Cast',
      is_folder: true,
    };
    const character: CharacterTreeNode = {
      id: 'node-1',
      key: 'node-1',
      name: 'Hero',
      is_folder: false,
      character_id: 'character-1',
    };
    mockedDeleteTreeNode.mockRejectedValueOnce(new Error('folder delete failed'));

    await expect(
      deleteSelectedTreeNodes('project-1', [folder, character], new Set()),
    ).resolves.toEqual({
      deletedCharacterIds: ['character-1'],
      deletedNodeIds: ['node-1'],
      failed: true,
    });
  });

  it('renames a synthetic root through the character API', async () => {
    const synthetic: CharacterTreeNode = {
      id: 'character-1',
      key: 'character-1',
      name: 'Old name',
      is_folder: false,
      character_id: 'character-1',
      __synthetic: true,
    };
    mockedUpdateCharacter.mockResolvedValue({data: {...synthetic, name: 'New name'}} as never);

    await expect(renameTreeNode('project-1', synthetic, 'New name')).resolves.toBe('character-1');

    expect(mockedUpdateCharacter).toHaveBeenCalledWith(
      'project-1',
      'character-1',
      {name: 'New name'},
    );
    expect(mockedRenameTreeNode).not.toHaveBeenCalled();
  });

  it('renames a persisted placement through the canonical tree API', async () => {
    const persisted: CharacterTreeNode = {
      id: 'node-1',
      key: 'character-1',
      name: 'Old name',
      is_folder: false,
      character_id: 'character-1',
    };
    mockedRenameTreeNode.mockResolvedValue({...persisted, name: 'New name'});

    await expect(renameTreeNode('project-1', persisted, 'New name')).resolves.toBe('character-1');

    expect(mockedRenameTreeNode).toHaveBeenCalledWith('project-1', 'node-1', 'New name');
    expect(mockedUpdateCharacter).not.toHaveBeenCalled();
  });
});
