import api from './http';
import {
    generatePoster,
    listPosterJobs,
    requestPosterJobCancellation,
    retryPosterJob,
} from './posters';

jest.mock('./http', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
    },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
    jest.clearAllMocks();
});

test('stops hidden waiting when cancellation has been requested', async () => {
    mockedApi.post.mockResolvedValue({
        data: {
            jobId: 17,
            status: 'cancellation_requested',
            variants: [{id: 3, imageUrl: '/must-not-be-applied.png'}],
        },
    } as never);

    await expect(generatePoster(42, 'poster prompt')).rejects.toThrow('Отмена запрошена');
    expect(mockedApi.get).not.toHaveBeenCalled();
});

test('uses the manual lifecycle routes', async () => {
    mockedApi.get.mockResolvedValue({data: {jobs: []}} as never);
    mockedApi.post.mockResolvedValue({data: {id: 1, status: 'queued'}} as never);

    await listPosterJobs(42);
    await retryPosterJob(42, 7);
    await requestPosterJobCancellation(42, 8);

    expect(mockedApi.get).toHaveBeenCalledWith('api/projects/42/poster/jobs/');
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, 'api/projects/42/poster/jobs/7/retry/');
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, 'api/projects/42/poster/jobs/8/cancellation-request/');
});
