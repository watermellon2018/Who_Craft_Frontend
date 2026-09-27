import api from './http';
import {
    generatePoster,
    editPoster,
    listPosterJobs,
    POSTER_CLIENT_ERROR_CODES,
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

test('forwards the approved personal source, actual model and signed route for JSON and multipart requests', async () => {
    mockedApi.post.mockResolvedValue({data: {status: 'completed', variants: [{id: 1, imageUrl: '/poster.png'}]}} as never);
    const approved = {imageModel: 'fallback-image-model', generationSource: 'personal' as const, generationAccessToken: 'signed-approved-route'};
    await generatePoster(42, 'poster', approved);
    expect(mockedApi.post.mock.calls[0][1]).toEqual(expect.objectContaining({image_model: approved.imageModel,
        generationSource: 'personal', generationAccessToken: approved.generationAccessToken}));
    await generatePoster(42, 'poster with reference', {...approved, referenceFile: new File(['image'], 'ref.png', {type: 'image/png'})});
    const multipart = mockedApi.post.mock.calls[1][1] as FormData;
    expect(multipart.get('generationSource')).toBe('personal');
    expect(multipart.get('generationAccessToken')).toBe(approved.generationAccessToken);
    expect(multipart.get('image_model')).toBe(approved.imageModel);
    await editPoster(42, {...approved, sourceVariantId: 1, instruction: 'Edit'});
    expect(mockedApi.post.mock.calls[2][1]).toEqual(expect.objectContaining({image_model: approved.imageModel,
        generationSource: 'personal', generationAccessToken: approved.generationAccessToken}));
});

test('stops hidden waiting when cancellation has been requested', async () => {
    mockedApi.post.mockResolvedValue({
        data: {
            jobId: 17,
            status: 'cancellation_requested',
            variants: [{id: 3, imageUrl: '/must-not-be-applied.png'}],
        },
    } as never);

    await expect(generatePoster(42, 'poster prompt')).rejects.toMatchObject({
        code: POSTER_CLIENT_ERROR_CODES.cancellationRequested,
    });
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
