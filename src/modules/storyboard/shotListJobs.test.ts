jest.mock('../../api/http', () => ({
  __esModule: true, getAuthGeneration: jest.fn(() => 4), default: {get: jest.fn(), post: jest.fn()},
}));

import api, {getAuthGeneration} from '../../api/http';
import {shotListJobService} from './shotListJobs';

const get = api.get as jest.MockedFunction<typeof api.get>;
const post = api.post as jest.MockedFunction<typeof api.post>;
const auth = getAuthGeneration as jest.MockedFunction<typeof getAuthGeneration>;
const job = {jobId: 'saved-job', sceneId: 17, status: 'queued'};

beforeEach(() => {
  jest.clearAllMocks();
  auth.mockReturnValue(4);
});

test('enqueues with an idempotency key and restores jobs from the server rather than generating on load', async () => {
  post.mockResolvedValue({data: job});
  get.mockResolvedValue({data: {jobs: [job]}});
  const config = {model: 'openrouter/qwen/qwen3-235b-a22b-2507', maxShots: 16, language: 'ru' as const};
  await expect(shotListJobService.start('42', '17', config, 90, 'request-uuid', 4)).resolves.toEqual(job);
  expect(post).toHaveBeenCalledWith('api/projects/42/storyboard/scenes/17/shot-list-jobs/',
    {...config, estimatedSeconds: 90, requestId: 'request-uuid'}, {expectedAuthGeneration: 4});
  await expect(shotListJobService.list('42', 4)).resolves.toEqual([job]);
  expect(get).toHaveBeenCalledWith('api/projects/42/storyboard/shot-list-jobs/', {expectedAuthGeneration: 4});
  expect(post).toHaveBeenCalledTimes(1);
});

test('rejects late status data from a previous account', async () => {
  get.mockImplementation(async () => {
    auth.mockReturnValue(5);
    return {data: {jobs: [job]}};
  });
  await expect(shotListJobService.list('42', 4)).rejects.toThrow('Storyboard session changed');
});

test('explicit application carries the current revision and dismissal only records a decision', async () => {
  post.mockResolvedValue({data: job});
  await shotListJobService.apply('42', 'saved-job', 12, 4);
  expect(post).toHaveBeenCalledWith('api/projects/42/storyboard/shot-list-jobs/saved-job/apply/',
    {expectedRevision: 12, mutationId: expect.stringMatching(/^[a-f0-9-]{36}$/)}, {expectedAuthGeneration: 4});
  await shotListJobService.dismiss('42', 'saved-job', 4);
  expect(post).toHaveBeenLastCalledWith('api/projects/42/storyboard/shot-list-jobs/saved-job/dismiss/', {},
    {expectedAuthGeneration: 4});
});
