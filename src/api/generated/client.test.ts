import type {AxiosInstance} from 'axios';

import {createGeneratedApiClient} from './client';

describe('generated API client', () => {
  it('uses canonical credit paths, query parameters and idempotency headers', async () => {
    const summary = {
      account: {availableBalance: '125.00', reservedBalance: '5.00', totalBalance: '130.00'},
      stats: {periodDays: 30, received: '150.00', sent: '20.00', spent: '5.00', refunded: '0.00'},
      capabilities: {demoTopUpEnabled: true, transfersEnabled: true},
    };
    const history = {items: [], total: 0, limit: 20, offset: 0, nextOffset: null};
    const http = {
      get: jest.fn()
        .mockResolvedValueOnce({data: summary})
        .mockResolvedValueOnce({data: history}),
      post: jest.fn()
        .mockResolvedValueOnce({data: {account: summary.account, transaction: {}, replayed: false}})
        .mockResolvedValueOnce({data: {account: summary.account, transfer: {}, replayed: false}}),
    } as unknown as AxiosInstance;
    const client = createGeneratedApiClient(http);

    await expect(client.getCreditSummary()).resolves.toEqual(summary);
    await expect(client.listCreditHistory({limit: 10, offset: 20, operationType: 'transfer_out'}))
      .resolves.toEqual(history);
    await client.createCreditDemoTopUp({amount: '100.00'}, 'topup-key-1');
    await client.createCreditTransfer({username: 'test', amount: '25.00'}, 'transfer-key-1');

    expect(http.get).toHaveBeenNthCalledWith(1, 'api/credits/summary/');
    expect(http.get).toHaveBeenNthCalledWith(2, 'api/credits/history/', {
      params: {limit: 10, offset: 20, operationType: 'transfer_out'},
    });
    expect(http.post).toHaveBeenNthCalledWith(1, 'api/credits/demo-top-up/', {amount: '100.00'}, {
      headers: {'Idempotency-Key': 'topup-key-1'},
    });
    expect(http.post).toHaveBeenNthCalledWith(2, 'api/credits/transfers/', {
      username: 'test',
      amount: '25.00',
    }, {
      headers: {'Idempotency-Key': 'transfer-key-1'},
    });
  });

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
