import api from '../../api/http';

import {fetchVideoPreparation} from './api';

jest.mock('../../api/http', () => ({
  __esModule: true,
  default: {get: jest.fn()},
}));

const mockedGet = api.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('loads the canonical project-scoped preparation contract', async () => {
  const controller = new AbortController();
  const response = {ready: false, taskCount: 3};
  mockedGet.mockResolvedValue({data: response});

  await expect(fetchVideoPreparation('42', controller.signal)).resolves.toBe(response);
  expect(mockedGet).toHaveBeenCalledWith(
    'api/projects/42/video/preparation/',
    {signal: controller.signal},
  );
});
