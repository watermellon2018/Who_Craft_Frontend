import {act, renderHook} from '@testing-library/react';

import {musicApi} from '../api/musicApi';
import type {MusicGenerationJob, MusicJobStatus} from '../types';
import {useMusicGenerationJob} from './useMusicGenerationJob';

jest.mock('../api/musicApi');

const mockedApi = musicApi as jest.Mocked<typeof musicApi>;

function job(status: MusicJobStatus): MusicGenerationJob {
  return {
    attempts: 1,
    brief: {
      content: {mode: 'instrumental'},
      context: {type: 'project'},
      durationSeconds: 30,
      energyCurve: 'steady',
      exclude: [],
      genre: 'cinematic',
      instruments: [],
      loopable: false,
      moods: ['hopeful'],
      purpose: 'underscore',
      tempo: {mode: 'auto'},
      textRefinement: '',
      title: 'Theme',
    },
    canCancel: status === 'processing',
    canRetry: false,
    completedAt: status === 'completed' ? '2026-08-02T10:01:00Z' : null,
    createdAt: '2026-08-02T10:00:00Z',
    error: null,
    jobId: 'job-1',
    permissions: {canEdit: true, canRunGeneration: true},
    pollAfterMs: 500,
    referenceAsset: null,
    retryOf: null,
    stage: status,
    status,
    targetTrackId: null,
    variantCount: 2,
    variants: [],
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {promise, resolve};
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('keeps polling cancellation_requested until a terminal status', async () => {
  mockedApi.getJob
    .mockResolvedValueOnce({data: job('cancellation_requested')} as never)
    .mockResolvedValueOnce({data: job('cancelled')} as never);

  const {result, unmount} = renderHook(() => useMusicGenerationJob('7', 'job-1'));
  await act(async () => Promise.resolve());
  expect(result.current.job?.status).toBe('cancellation_requested');

  await act(async () => {
    jest.advanceTimersByTime(500);
    await Promise.resolve();
  });
  expect(result.current.job?.status).toBe('cancelled');
  expect(result.current.isTerminal).toBe(true);
  expect(mockedApi.getJob).toHaveBeenCalledTimes(2);
  unmount();
});

test('starts the next poll only after the previous request resolves', async () => {
  const pending = deferred<{data: MusicGenerationJob}>();
  mockedApi.getJob
    .mockResolvedValueOnce({data: job('processing')} as never)
    .mockImplementationOnce(() => pending.promise as never);

  const {unmount} = renderHook(() => useMusicGenerationJob('7', 'job-1'));
  await act(async () => Promise.resolve());
  await act(async () => {
    jest.advanceTimersByTime(500);
    await Promise.resolve();
  });
  expect(mockedApi.getJob).toHaveBeenCalledTimes(2);

  await act(async () => {
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
  });
  expect(mockedApi.getJob).toHaveBeenCalledTimes(2);

  await act(async () => pending.resolve({data: job('completed')}));
  unmount();
});
