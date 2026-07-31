import {act, renderHook, waitFor} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import type {GenerationJob} from '../types/character.types';
import {useGenerationJob} from './useGenerationJob';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {promise, resolve};
}

function completedJob(jobId: string, projectId: number, characterId: string): GenerationJob {
  return {
    job_id: jobId,
    project_id: projectId,
    character_id: characterId,
    status: 'completed',
    progress: 100,
    variants: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('discards a late job response after the route owner changes from A to B', async () => {
  const jobA = deferred<{data: GenerationJob}>();
  const jobB = deferred<{data: GenerationJob}>();
  mockedApi.getJob.mockImplementation((jobId) => (
    jobId === 'job-a' ? jobA.promise : jobB.promise
  ) as never);

  const {result, rerender} = renderHook(
    ({jobId, projectId, characterId}) => useGenerationJob(jobId, projectId, characterId),
    {initialProps: {jobId: 'job-a', projectId: '1', characterId: 'char-a'}},
  );

  rerender({jobId: 'job-b', projectId: '2', characterId: 'char-b'});
  expect(result.current.job).toBeNull();
  expect(result.current.loading).toBe(true);

  await act(async () => {
    jobB.resolve({data: completedJob('job-b', 2, 'char-b')});
  });
  await waitFor(() => expect(result.current.job?.job_id).toBe('job-b'));

  await act(async () => {
    jobA.resolve({data: completedJob('job-a', 1, 'char-a')});
  });
  expect(result.current.job?.job_id).toBe('job-b');
});

test('does not expose a job that belongs to another character', async () => {
  mockedApi.getJob.mockResolvedValue({
    data: completedJob('job-a', 1, 'char-a'),
  } as never);

  const {result} = renderHook(() => useGenerationJob('job-a', '2', 'char-b'));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.job).toBeNull();
  expect(result.current.errorMessage).toContain('не принадлежит');
});
test('treats cancellation_requested as terminal and stops polling', async () => {
  jest.useFakeTimers();
  const cancellationRequested: GenerationJob = {
    job_id: 'job-a',
    project_id: 1,
    character_id: 'char-a',
    status: 'cancellation_requested',
    progress: 55,
    variants: [],
  };
  mockedApi.getJob.mockResolvedValue({data: cancellationRequested} as never);

  const {result, unmount} = renderHook(() => useGenerationJob('job-a', '1', 'char-a'));

  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.job?.status).toBe('cancellation_requested');
  expect(result.current.isActive).toBe(false);
  expect(result.current.isTerminal).toBe(true);

  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
  expect(mockedApi.getJob).toHaveBeenCalledTimes(1);

  unmount();
  jest.useRealTimers();
});
