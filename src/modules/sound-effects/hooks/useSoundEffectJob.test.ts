import {act, renderHook, waitFor} from '@testing-library/react';

import {soundEffectsApi} from '../api/soundEffectsApi';
import type {SoundEffectJob, SoundEffectJobStatus} from '../types';
import {useSoundEffectJob} from './useSoundEffectJob';

jest.mock('../../credits/api/creditApi', () => ({
  notifyCreditBalanceUpdated: jest.fn(),
}));

function job(status: SoundEffectJobStatus): SoundEffectJob {
  return {
    canCancel: status === 'queued',
    canRetry: false,
    durationSeconds: null,
    jobId: 'job-1',
    loop: false,
    modelKey: 'elevenlabs-sfx-v2',
    permissions: {canEdit: true, canRunGeneration: true},
    pollAfterMs: 500,
    prompt: 'Door slam',
    promptInfluence: 0.3,
    stage: status === 'completed' ? 'finalized' : 'queued',
    status,
    variants: [],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('polls a durable job until it becomes terminal', async () => {
  const getJob = jest.spyOn(soundEffectsApi, 'getJob')
    .mockResolvedValueOnce({data: job('queued')} as never)
    .mockResolvedValueOnce({data: job('completed')} as never);
  const {result} = renderHook(() => useSoundEffectJob('7', 'job-1'));

  await waitFor(() => expect(result.current.job?.status).toBe('queued'));
  await act(async () => {
    jest.advanceTimersByTime(500);
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.job?.status).toBe('completed'));
  expect(getJob).toHaveBeenCalledTimes(2);
});
