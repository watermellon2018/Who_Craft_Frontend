import {act, renderHook, waitFor} from '@testing-library/react';

jest.mock('../../api/http', () => ({getAuthGeneration: jest.fn(() => 0)}));

import {getAuthGeneration} from '../../api/http';
import type {ShotListJob, ShotListJobService} from './shotListJobs';
import {useShotListJobs} from './useShotListJobs';

const generation = getAuthGeneration as jest.MockedFunction<typeof getAuthGeneration>;
const running: ShotListJob = {
  jobId: 'f53a7c96-10d6-4505-aaf5-70b15a2b9041', sceneId: 17, status: 'running', resultState: 'pending',
  model: 'openrouter/qwen/qwen3-235b-a22b-2507', language: 'ru',
  createdAt: '2026-08-31T10:00:00Z', startedAt: '2026-08-31T10:00:01Z', finishedAt: null,
  estimatedSeconds: 90, expectedRevision: 2, result: null, appliedRevision: null, errorCode: null,
};
const completed: ShotListJob = {...running, status: 'succeeded', resultState: 'applied',
  finishedAt: '2026-08-31T10:01:00Z', result: {schemaVersion: 1, stage: 'builder', shots: []}, appliedRevision: 3};

function service() {
  return {
    list: jest.fn().mockResolvedValue([]), start: jest.fn().mockResolvedValue(running),
    apply: jest.fn().mockResolvedValue(completed), dismiss: jest.fn().mockResolvedValue({...completed, resultState: 'dismissed'}),
  } satisfies ShotListJobService;
}

beforeEach(() => generation.mockReturnValue(0));

test('restores running work, then loads the saved result after leaving and reopening without another generation', async () => {
  const api = service();
  const refresh = jest.fn().mockResolvedValue(undefined);
  api.list.mockResolvedValue([running]);
  const first = renderHook(() => useShotListJobs('42', api, true, refresh));
  await waitFor(() => expect(first.result.current.jobs[0]?.status).toBe('running'));
  expect(refresh).not.toHaveBeenCalled();
  first.unmount();

  // The backend worker finishes with no mounted page and writes the draft.
  api.list.mockResolvedValue([completed]);
  const second = renderHook(() => useShotListJobs('42', api, true, refresh));
  await waitFor(() => expect(second.result.current.jobs[0]?.status).toBe('succeeded'));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(api.start).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
  second.unmount();
});

test('keeps a conflicting server proposal separate until explicit application', async () => {
  const api = service();
  const refresh = jest.fn().mockResolvedValue(undefined);
  api.list.mockResolvedValue([{...completed, resultState: 'pending', appliedRevision: null}]);
  const hook = renderHook(() => useShotListJobs('42', api, true, refresh));
  await waitFor(() => expect(hook.result.current.jobs).toHaveLength(1));
  expect(refresh).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
  api.list.mockResolvedValue([completed]);
  await act(async () => hook.result.current.apply(completed.jobId, 8));
  expect(api.apply).toHaveBeenCalledWith('42', completed.jobId, 8, 0);
  expect(refresh).toHaveBeenCalled();
  hook.unmount();
});

test('uses the same request ID and estimate after an uncertain launch response', async () => {
  const api = service();
  const refresh = jest.fn().mockResolvedValue(undefined);
  api.start.mockRejectedValueOnce(new Error('Connection lost'));
  const hook = renderHook(() => useShotListJobs('42', api, true, refresh));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  const config = {model: running.model, maxShots: 16, language: 'ru' as const};
  await act(async () => {
    await expect(hook.result.current.start('17', config, 90)).rejects.toThrow('Connection lost');
  });
  api.list.mockResolvedValue([running]);
  await act(async () => hook.result.current.start('17', config, 110));
  expect(api.start.mock.calls[1]).toEqual(api.start.mock.calls[0]);
  expect(api.start.mock.calls[0][4]).toMatch(/^[0-9a-f-]{36}$/);
  hook.unmount();
});

test('does not expose a late result or save it after the account changes', async () => {
  const api = service();
  const refresh = jest.fn().mockResolvedValue(undefined);
  let resolve!: (jobs: ShotListJob[]) => void;
  api.list.mockReturnValue(new Promise<ShotListJob[]>((done) => { resolve = done; }));
  const hook = renderHook(() => useShotListJobs('42', api, true, refresh));
  generation.mockReturnValue(1);
  await act(async () => resolve([completed]));
  expect(hook.result.current.jobs).toEqual([]);
  expect(refresh).not.toHaveBeenCalled();
  await expect(hook.result.current.start('17', {model: running.model, maxShots: 16}, 90)).rejects.toThrow();
  expect(api.start).not.toHaveBeenCalled();
  hook.unmount();
});

test('failed status checks do not cancel a server task and can be retried', async () => {
  const api = service();
  api.list.mockRejectedValueOnce(new Error('Offline'));
  const refresh = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useShotListJobs('42', api, true, refresh));
  await waitFor(() => expect(hook.result.current.error).toBe(true));
  api.list.mockResolvedValue([running]);
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.jobs[0]?.status).toBe('running'));
  expect(hook.result.current.error).toBe(false);
  expect(api.start).not.toHaveBeenCalled();
  expect(api.dismiss).not.toHaveBeenCalled();
  hook.unmount();
});
