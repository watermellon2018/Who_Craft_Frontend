import {act, cleanup, renderHook} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import type {StudioCharacter} from '../types/character.types';
import {useCharacterAssetJobs} from './useCharacterAssetJobs';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
const PROJECT_ID = 'project-1';
const CHARACTER_ID = 'char-abc';
const REVISION_ID = 'revision-7';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}
function makeCharacter(overrides: Partial<StudioCharacter> = {}): StudioCharacter {
  return {
    character_id: CHARACTER_ID,
    project_id: 1,
    name: 'Mira',
    identity_locked: false,
    images: {},
    ...overrides,
  };
}

function makeJobResponse(status: string, jobId = 'job-1', variants: unknown[] = []) {
  return {
    data: {
      job_id: jobId,
      status,
      progress: status === 'completed' ? 100 : 0,
      variants,
      error_message: undefined,
    },
  };
}

function makeCompletedJobResponse(jobId = 'job-1', variantId = 'var-1') {
  return {
    data: {
      job_id: jobId,
      status: 'completed',
      progress: 100,
      variants: [{
        variant_id: variantId,
        image_url: 'http://example.com/img.png',
        variant_index: 0,
        region: 'body',
        status: 'generated',
      }],
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued') as never);
  mockedApi.getJob.mockResolvedValue(makeJobResponse('queued') as never);
  mockedApi.applyVariant.mockResolvedValue({data: {}} as never);
  mockedApi.retryGenerationJob.mockResolvedValue({
    data: {job_id: 'job-retry', status: 'queued'},
  } as never);
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('useCharacterAssetJobs - explicit launch only', () => {
  it('does not call generation when the editor opens or rerenders', async () => {
    const character = makeCharacter();
    const {rerender} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character),
    );

    await act(async () => {
      await Promise.resolve();
      rerender();
      await Promise.resolve();
    });

    expect(mockedApi.generateEdit).not.toHaveBeenCalled();
  });

  it('uses character:type:revision as the secondary idempotency key', async () => {
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );

    await act(async () => {
      await result.current.launchJob('full_body', REVISION_ID);
    });

    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(1);
    expect(mockedApi.generateEdit).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      expect.objectContaining({image_type: 'full_body'}),
      `${CHARACTER_ID}:full_body:${REVISION_ID}`,
    );
  });

  it('handles synchronous completion and refreshes once', async () => {
    mockedApi.generateEdit.mockResolvedValue(
      makeCompletedJobResponse('job-sync', 'var-sync') as never,
    );
    const onCompleted = jest.fn();
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );

    await act(async () => {
      await result.current.launchJob('full_body', REVISION_ID);
    });

    expect(mockedApi.applyVariant).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'var-sync',
      expect.any(String),
      'full_body',
      null,
    );
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('polls an explicitly queued job and reports completion', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-poll') as never);
    mockedApi.getJob.mockResolvedValue(
      makeCompletedJobResponse('job-poll', 'var-poll') as never,
    );
    const onCompleted = jest.fn();
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );

    await act(async () => {
      await result.current.launchJob('scene', REVISION_ID);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedApi.getJob).toHaveBeenCalledWith('job-poll');
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('retries a backend job by its job id', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('failed', 'job-original') as never);
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );

    await act(async () => {
      await result.current.launchJob('full_body', REVISION_ID);
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.retry('full_body');
    });

    expect(mockedApi.retryGenerationJob).toHaveBeenCalledWith('job-original');
    expect(result.current.jobs.full_body?.jobId).toBe('job-retry');
    expect(result.current.jobs.full_body?.status).toBe('queued');
  });

  it('relaunches by revision when a failed request never received a job id', async () => {
    mockedApi.generateEdit.mockRejectedValueOnce(new Error('Server error'));
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );

    await act(async () => {
      await result.current.launchJob('full_body', REVISION_ID);
    });
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-relaunch') as never);

    await act(async () => {
      await result.current.retry('full_body');
    });

    expect(mockedApi.retryGenerationJob).not.toHaveBeenCalled();
    expect(mockedApi.generateEdit).toHaveBeenLastCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      expect.objectContaining({image_type: 'full_body'}),
      `${CHARACTER_ID}:full_body:${REVISION_ID}`,
    );
  });

  it('marks an explicitly launched job failed when the API rejects', async () => {
    mockedApi.generateEdit.mockRejectedValue(new Error('Server error'));
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );

    await act(async () => {
      await result.current.launchJob('scene', REVISION_ID);
    });

    expect(result.current.jobs.scene?.status).toBe('failed');
  });
});

describe('useCharacterAssetJobs - stable polling scheduler', () => {
  it('does not restart polling after progress or a parent rerender', async () => {
    mockedApi.getJob.mockResolvedValue(makeJobResponse('queued', 'job-stable') as never);
    const {result, rerender} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );

    act(() => result.current.attachJob('full_body', 'job-stable'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockedApi.getJob).toHaveBeenCalledTimes(1);

    rerender();
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(2499);
    });
    expect(mockedApi.getJob).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockedApi.getJob).toHaveBeenCalledTimes(2);
  });
});

describe('useCharacterAssetJobs - route ownership', () => {
  it('discards a late launch response after A → B', async () => {
    const launchA = deferred<ReturnType<typeof makeCompletedJobResponse>>();
    mockedApi.generateEdit.mockReturnValueOnce(launchA.promise as never);
    const onCompleted = jest.fn();
    const {result, rerender} = renderHook(
      ({projectId, characterId, character}: {
        projectId: string;
        characterId: string;
        character: StudioCharacter;
      }) => useCharacterAssetJobs(projectId, characterId, character, onCompleted),
      {
        initialProps: {
          projectId: 'project-a',
          characterId: 'character-a',
          character: makeCharacter({character_id: 'character-a', project_id: 1}),
        },
      },
    );

    let launchPromise!: Promise<string | undefined>;
    act(() => {
      launchPromise = result.current.launchJob('full_body', REVISION_ID);
    });
    expect(result.current.jobs.full_body?.status).toBe('queued');

    rerender({
      projectId: 'project-b',
      characterId: 'character-b',
      character: makeCharacter({character_id: 'character-b', project_id: 2}),
    });
    expect(result.current.jobs).toEqual({});

    await act(async () => {
      launchA.resolve(makeCompletedJobResponse('job-a', 'variant-a'));
      await launchPromise;
    });

    expect(result.current.jobs).toEqual({});
    expect(mockedApi.applyVariant).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('does not apply or refresh B when polling for A completes late', async () => {
    const pollA = deferred<ReturnType<typeof makeCompletedJobResponse>>();
    mockedApi.getJob.mockReturnValueOnce(pollA.promise as never);
    const onCompleted = jest.fn();
    const {result, rerender} = renderHook(
      ({projectId, characterId, character}: {
        projectId: string;
        characterId: string;
        character: StudioCharacter;
      }) => useCharacterAssetJobs(projectId, characterId, character, onCompleted),
      {
        initialProps: {
          projectId: 'project-a',
          characterId: 'character-a',
          character: makeCharacter({character_id: 'character-a', project_id: 1}),
        },
      },
    );

    act(() => result.current.attachJob('scene', 'job-a'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.getJob).toHaveBeenCalledWith('job-a');

    rerender({
      projectId: 'project-b',
      characterId: 'character-b',
      character: makeCharacter({character_id: 'character-b', project_id: 2}),
    });
    expect(result.current.jobs).toEqual({});

    await act(async () => {
      pollA.resolve(makeCompletedJobResponse('job-a', 'variant-a'));
      await pollA.promise;
      await Promise.resolve();
    });

    expect(result.current.jobs).toEqual({});
    expect(mockedApi.applyVariant).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
