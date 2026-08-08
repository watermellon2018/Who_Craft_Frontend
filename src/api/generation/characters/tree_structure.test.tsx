import api from '../../http';
import {
  createCharacterFromTreeAPI,
  deleteCharacterFromTree,
  get_all_character_for_project,
  renameCharacterFromTree,
} from './tree_structure';

jest.mock('../../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('character tree API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates with header authentication only and returns after persistence', async () => {
    mockedApi.post.mockResolvedValue({data: undefined} as never);

    await createCharacterFromTreeAPI(
      '7b20f636-40d4-41f6-a88d-c4753e9d6545',
      'Hero',
      'leaf',
      42,
      null,
      null,
      'f6622251-bf84-4513-8350-997ef3de6ca7',
    );

    const [, payload] = mockedApi.post.mock.calls[0];
    expect(payload).toEqual({
      heroID: null,
      id: '7b20f636-40d4-41f6-a88d-c4753e9d6545',
      name: 'Hero',
      type: 'leaf',
      parent: null,
      projectId: 42,
      studioCharacterId: 'f6622251-bf84-4513-8350-997ef3de6ca7',
    });
    expect(payload).not.toHaveProperty('token_user');
  });

  it('propagates create failures instead of returning undefined', async () => {
    mockedApi.post.mockRejectedValue(new Error('network'));

    await expect(createCharacterFromTreeAPI(
      '7b20f636-40d4-41f6-a88d-c4753e9d6545',
      'Hero',
      'leaf',
      42,
    )).rejects.toThrow('network');
  });

  it('unwraps typed tree responses', async () => {
    const nodes = [{
      id: '7b20f636-40d4-41f6-a88d-c4753e9d6545',
      key: 'root',
      name: 'Root',
      is_folder: true,
    }];
    mockedApi.get.mockResolvedValue({data: nodes} as never);
    mockedApi.post
      .mockResolvedValueOnce({data: {id: nodes[0].id, name: 'Renamed'}} as never)
      .mockResolvedValueOnce({data: {message: 'deleted'}} as never);

    await expect(get_all_character_for_project(42)).resolves.toEqual(nodes);
    await expect(renameCharacterFromTree(nodes[0].id, 'Renamed')).resolves.toEqual({
      id: nodes[0].id,
      name: 'Renamed',
    });
    await expect(deleteCharacterFromTree(nodes[0].id)).resolves.toEqual({message: 'deleted'});
  });
});
