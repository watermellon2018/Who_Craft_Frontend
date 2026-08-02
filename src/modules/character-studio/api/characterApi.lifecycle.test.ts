import api from '../../../api/http';
import {characterApi} from './characterApi';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.get.mockResolvedValue({data: {jobs: []}} as never);
  mockedApi.post.mockResolvedValue({data: {job_id: 'next', status: 'queued'}} as never);
});

test('uses character generation history, retry, and cancellation-request routes', async () => {
  await characterApi.listGenerationJobs(42, 'char-1');
  await characterApi.retryGenerationJob('job-1');
  await characterApi.requestGenerationJobCancellation('job-2');

  expect(mockedApi.get).toHaveBeenCalledWith(
    'api/projects/42/characters/char-1/generation-jobs',
  );
  expect(mockedApi.post).toHaveBeenNthCalledWith(1, 'api/generation-jobs/job-1/retry');
  expect(mockedApi.post).toHaveBeenNthCalledWith(
    2,
    'api/generation-jobs/job-2/cancellation-request',
  );
});
