import {act, renderHook} from '@testing-library/react';

import {referenceApi} from '../api/referenceApi';
import type {ReferenceGenerationJob, ReferenceJobStatus} from '../types';
import {useReferenceGenerationJob} from './useReferenceGenerationJob';

jest.mock('../api/referenceApi');

const mockedApi = referenceApi as jest.Mocked<typeof referenceApi>;

function job(status: ReferenceJobStatus): ReferenceGenerationJob {
  return {
    attempts: 1,
    canCancel: status === 'processing',
    canRetry: status === 'failed',
    completedAt: status === 'completed' ? '2026-08-07T10:01:00Z' : null,
    createdAt: '2026-08-07T10:00:00Z',
    error: null,
    id: 'job-1',
    operation: 'generate',
    progress: status === 'completed' ? 100 : 0,
    referenceId: 'ref-1',
    stage: status === 'completed' ? 'finalized' : status === 'cancelled' ? 'cancelled' : 'generating',
    status,
    variantCount: 2,
    variants: [],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('keeps polling cancellation_requested until a terminal state', async () => {
  mockedApi.getJob
    .mockResolvedValueOnce({data: job('cancellation_requested')} as never)
    .mockResolvedValueOnce({data: job('cancelled')} as never);

  const {result, unmount} = renderHook(() => (
    useReferenceGenerationJob('7', 'ref-1', 'job-1')
  ));
  await act(async () => Promise.resolve());
  expect(result.current.job?.status).toBe('cancellation_requested');

  await act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });
  expect(result.current.job?.status).toBe('cancelled');
  expect(result.current.isTerminal).toBe(true);
  expect(mockedApi.getJob).toHaveBeenCalledTimes(2);
  unmount();
});

test('rejects a job returned for another reference', async () => {
  mockedApi.getJob.mockResolvedValue({data: {...job('completed'), referenceId: 'ref-2'}} as never);
  const {result} = renderHook(() => useReferenceGenerationJob('7', 'ref-1', 'job-1'));
  await act(async () => Promise.resolve());
  expect(result.current.job).toBeNull();
  expect(result.current.errorCode).toBe('REFERENCE_JOB_NOT_FOUND');
});
