import api from '../../../api/http';
import {characterTreeApi} from './treeApi';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('characterTreeApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the project-scoped canonical tree endpoints', async () => {
    const folder = {
      id: 'folder/1',
      key: 'folder/1',
      name: 'Cast',
      is_folder: true,
      children: [],
    };
    mockedApi.get.mockResolvedValue({data: [folder]} as never);
    mockedApi.post.mockResolvedValue({data: folder} as never);
    mockedApi.patch.mockResolvedValue({data: {...folder, name: 'Main cast'}} as never);
    mockedApi.delete.mockResolvedValue({data: undefined} as never);

    await expect(characterTreeApi.list(42)).resolves.toEqual([folder]);
    await expect(characterTreeApi.create(42, {
      id: folder.id,
      name: folder.name,
      type: 'folder',
    })).resolves.toEqual(folder);
    await expect(characterTreeApi.rename(42, folder.id, 'Main cast')).resolves.toEqual({
      ...folder,
      name: 'Main cast',
    });
    await expect(characterTreeApi.delete(42, folder.id)).resolves.toBeUndefined();

    expect(mockedApi.get).toHaveBeenCalledWith('api/projects/42/character-tree/');
    expect(mockedApi.post).toHaveBeenCalledWith('api/projects/42/character-tree/nodes/', {
      id: 'folder/1',
      name: 'Cast',
      type: 'folder',
    });
    expect(mockedApi.patch).toHaveBeenCalledWith(
      'api/projects/42/character-tree/nodes/folder%2F1/',
      {name: 'Main cast'},
    );
    expect(mockedApi.delete).toHaveBeenCalledWith(
      'api/projects/42/character-tree/nodes/folder%2F1/',
    );
  });

  it('links a character without legacy fields', async () => {
    const node = {
      id: 'node-1',
      key: 'node-1',
      name: 'Hero',
      is_folder: false,
      character_id: 'character-1',
    };
    mockedApi.post.mockResolvedValue({data: node} as never);

    await characterTreeApi.create('project-1', {
      id: node.id,
      name: node.name,
      type: 'character',
      parent_id: 'folder-1',
      studio_character_id: 'character-1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      'api/projects/project-1/character-tree/nodes/',
      {
        id: 'node-1',
        name: 'Hero',
        type: 'character',
        parent_id: 'folder-1',
        studio_character_id: 'character-1',
      },
    );
    expect(mockedApi.post.mock.calls[0][1]).not.toHaveProperty('legacy_hero_id');
  });
});
