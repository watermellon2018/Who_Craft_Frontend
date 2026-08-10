import api from '../../../api/http';
import {newReferenceIdempotencyKey, referenceApi} from './referenceApi';
import type {ReferenceEnqueueRequest} from '../types';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {get: jest.fn(), patch: jest.fn(), post: jest.fn()},
}));

const mockedGet = api.get as jest.Mock;
const mockedPost = api.post as jest.Mock;

const enqueuePayload: ReferenceEnqueueRequest = {
  brief: {
    aspectRatio: '1:1',
    description: 'Old red medallion',
    schemaVersion: 'reference_brief.v1',
  },
  expectedReferenceVersion: 3,
  imageModel: '',
  operation: 'generate',
  sourceVersionId: null,
  variantCount: 4,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({data: {}});
  mockedPost.mockResolvedValue({data: {}});
});

test('uses the project-scoped paginated list contract', async () => {
  const params = {category: 'prop' as const, ordering: '-updatedAt' as const, page: 2, pageSize: 24};
  await referenceApi.list('7', params);
  expect(mockedGet).toHaveBeenCalledWith(
    'api/projects/7/references/',
    {params, signal: undefined},
  );
});

test('loads project-scoped character and location link options', async () => {
  const controller = new AbortController();
  await referenceApi.getLinkOptions('7', controller.signal);

  expect(mockedGet).toHaveBeenCalledWith(
    'api/projects/7/references/link-options/',
    {signal: controller.signal},
  );
});

test('forwards a submit-scoped idempotency key to generation enqueue', async () => {
  await referenceApi.enqueueJob('7', 'ref-1', enqueuePayload, 'reference:submit-1');
  expect(mockedPost).toHaveBeenCalledWith(
    'api/projects/7/references/ref-1/generation-jobs/',
    enqueuePayload,
    {headers: {'Idempotency-Key': 'reference:submit-1'}},
  );
  expect(newReferenceIdempotencyKey()).not.toBe(newReferenceIdempotencyKey());
});

test('includes optimistic version and rights attestation in uploads', async () => {
  const file = new File(['image'], 'medallion.png', {type: 'image/png'});
  await referenceApi.uploadVersion('7', 'ref-1', file, 3, 'reference-upload-v1');

  const [, form] = mockedPost.mock.calls[0] as [string, FormData];
  expect(mockedPost.mock.calls[0][0]).toBe('api/projects/7/references/ref-1/versions/upload/');
  expect(form.get('file')).toBe(file);
  expect(form.get('expectedReferenceVersion')).toBe('3');
  expect(form.get('rightsConfirmed')).toBe('true');
  expect(form.get('rightsStatementVersion')).toBe('reference-upload-v1');
});

test('sends the optimistic version for archive and restore', async () => {
  await referenceApi.archive('7', 'ref-1', 3);
  await referenceApi.restore('7', 'ref-1', 4);

  expect(mockedPost).toHaveBeenNthCalledWith(
    1,
    'api/projects/7/references/ref-1/archive/',
    {expectedReferenceVersion: 3},
  );
  expect(mockedPost).toHaveBeenNthCalledWith(
    2,
    'api/projects/7/references/ref-1/restore/',
    {expectedReferenceVersion: 4},
  );
});
