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

test('adds the selected image model to a reference multipart request', async () => {
  const referenceImage = new File(['image'], 'hero.png', {type: 'image/png'});

  await characterApi.createFromReference(42, {
    name: 'Hero',
    entityType: 'human',
    imageModel: 'openrouter-images:openai/gpt-image-1',
    referenceImage,
  });

  const form = mockedApi.post.mock.calls[0][1] as FormData;
  expect(form.get('image_model')).toBe('openrouter-images:openai/gpt-image-1');
});

test('requests the model catalog and optionally previews with an explicit model', async () => {
  await characterApi.getImageModelCatalog(42);
  await characterApi.getGenerationPreview(
    42,
    'char-1',
    ['portrait', 'full_body'],
    'openrouter-images:openai/gpt-image-1',
  );

  expect(mockedApi.get).toHaveBeenNthCalledWith(
    1,
    'api/profile/me/image-model/',
    {params: {project_id: 42}},
  );
  expect(mockedApi.get).toHaveBeenNthCalledWith(
    2,
    'api/projects/42/characters/char-1/generation-preview',
    {params: {
      image_types: 'portrait,full_body',
      image_model: 'openrouter-images:openai/gpt-image-1',
    }},
  );
});

test('quotes and atomically starts the selected secondary assets', async () => {
  const quotePayload = {
    variant_id: 'variant-1',
    image_types: ['full_body', 'scene'] as const,
    image_model: 'openrouter-images:openai/gpt-image-1',
    routing_mode: 'manual' as const,
  };

  await characterApi.quoteSecondaryAssets(42, 'char-1', {
    ...quotePayload,
    image_types: [...quotePayload.image_types],
  });
  await characterApi.generateSecondaryAssets(42, 'char-1', 'quote-1');

  expect(mockedApi.post).toHaveBeenNthCalledWith(
    1,
    'api/projects/42/characters/char-1/secondary-assets/quote',
    quotePayload,
  );
  expect(mockedApi.post).toHaveBeenNthCalledWith(
    2,
    'api/projects/42/characters/char-1/secondary-assets/generate',
    {quote_token: 'quote-1'},
    {headers: {'Idempotency-Key': expect.stringMatching(/^character:/)}},
  );
  const idempotencyKey = mockedApi.post.mock.calls[1][2]?.headers?.['Idempotency-Key'];
  expect(typeof idempotencyKey).toBe('string');
  expect(String(idempotencyKey).length).toBeLessThanOrEqual(128);
});
