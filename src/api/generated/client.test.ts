import type {AxiosInstance} from 'axios';

import {createGeneratedApiClient} from './client';

describe('generated API client', () => {
  it('expands canonical character-tree paths and uses REST methods', async () => {
    const node = {
      id: 'folder/1',
      key: 'folder/1',
      name: 'Cast',
      is_folder: true,
      character_id: null,
      children: [],
    };
    const http = {
      delete: jest.fn().mockResolvedValue({data: undefined}),
      get: jest.fn().mockResolvedValue({data: [node]}),
      patch: jest.fn().mockResolvedValue({data: {...node, name: 'Main cast'}}),
      post: jest.fn().mockResolvedValue({data: node}),
    } as unknown as AxiosInstance;
    const client = createGeneratedApiClient(http);

    await expect(client.listCharacterTree('project/1')).resolves.toEqual([node]);
    await expect(client.createCharacterTreeNode('project/1', {
      id: node.id,
      name: node.name,
      type: 'folder',
    })).resolves.toEqual(node);
    await expect(client.renameCharacterTreeNode('project/1', node.id, {
      name: 'Main cast',
    })).resolves.toEqual({...node, name: 'Main cast'});
    await expect(client.deleteCharacterTreeNode('project/1', node.id)).resolves.toBeUndefined();

    expect(http.get).toHaveBeenCalledWith('api/projects/project%2F1/character-tree/');
    expect(http.post).toHaveBeenCalledWith(
      'api/projects/project%2F1/character-tree/nodes/',
      {id: 'folder/1', name: 'Cast', type: 'folder'},
    );
    expect(http.patch).toHaveBeenCalledWith(
      'api/projects/project%2F1/character-tree/nodes/folder%2F1/',
      {name: 'Main cast'},
    );
    expect(http.delete).toHaveBeenCalledWith(
      'api/projects/project%2F1/character-tree/nodes/folder%2F1/',
    );
  });
});
