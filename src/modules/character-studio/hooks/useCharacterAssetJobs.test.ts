import {act, renderHook} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';
import {useCharacterAssetJobs} from './useCharacterAssetJobs';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

const PROJECT_ID = 'project-1';
const CHARACTER_ID = 'char-abc';

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
  return {data: {job_id: jobId, status, progress: status === 'completed' ? 100 : 0, variants, error_message: undefined}};
}

function makeCompletedJobResponse(jobId = 'job-1', variantId = 'var-1') {
  return {
    data: {
      job_id: jobId,
      status: 'completed',
      progress: 100,
      variants: [{variant_id: variantId, image_url: 'http://example.com/img.png', variant_index: 0, region: 'body', status: 'generated'}],
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued') as never);
  mockedApi.getJob.mockResolvedValue(makeJobResponse('queued') as never);
  mockedApi.applyVariant.mockResolvedValue({data: {}} as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auto-launch behaviour
// ---------------------------------------------------------------------------

describe('useCharacterAssetJobs – auto-launch', () => {
  it('launches jobs for all secondary types when character has no images', async () => {
    const character = makeCharacter({images: {}});
    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(2);
    const calledTypes = mockedApi.generateEdit.mock.calls.map((c) => (c[2] as {image_type: string}).image_type);
    expect(calledTypes).toContain('full_body');
    expect(calledTypes).toContain('scene');
  });

  it('does NOT launch a job for a type that already has an image_url', async () => {
    const character = makeCharacter({
      images: {
        full_body: {
          image_id: 'img-1',
          image_type: 'full_body',
          image_url: 'http://example.com/fb.png',
          is_active: true,
        },
      },
    });
    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(1);
    const calledTypes = mockedApi.generateEdit.mock.calls.map((c) => (c[2] as {image_type: string}).image_type);
    expect(calledTypes).not.toContain('full_body');
    expect(calledTypes).toContain('scene');
  });

  it('does not launch any jobs when character is null', async () => {
    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, null));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.generateEdit).not.toHaveBeenCalled();
  });

  it('does not re-launch jobs on re-render with the same character_id', async () => {
    const character = makeCharacter();
    const {rerender} = renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character));
    await act(async () => {
      await Promise.resolve();
    });
    rerender();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(2); // 2 secondary types, not 4
  });

  it('does not launch jobs when character has no character_id', async () => {
    const character = makeCharacter({character_id: ''});
    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.generateEdit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Synchronous-completion bug fix
// The Django backend processes jobs synchronously: generateEdit often returns
// status='completed' immediately. The polling loop only covers queued/processing
// entries, so completion must also be handled directly in launchJob.
// ---------------------------------------------------------------------------

describe('useCharacterAssetJobs – synchronous backend completion', () => {
  it('calls onCompleted when generateEdit returns status=completed immediately', async () => {
    // Simulate synchronous backend: first type returns completed right away.
    mockedApi.generateEdit
      .mockResolvedValueOnce(makeCompletedJobResponse('job-sync', 'var-sync') as never)
      .mockResolvedValue(makeJobResponse('queued') as never);

    const onCompleted = jest.fn();
    renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );
    await act(async () => {
      // Let launchJob Promises settle (generateEdit + applyVariant)
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCompleted).toHaveBeenCalled();
  });

  it('calls applyVariant with the first variant when generateEdit returns completed', async () => {
    mockedApi.generateEdit
      .mockResolvedValueOnce(makeCompletedJobResponse('job-sync', 'var-sync') as never)
      .mockResolvedValue(makeJobResponse('queued') as never);

    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedApi.applyVariant).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'var-sync',
      expect.any(String),
      expect.any(String),
    );
  });

  it('calls onCompleted even when generateEdit returns completed with no variants', async () => {
    // Backend activates the image during job processing even if variants array is empty in response.
    mockedApi.generateEdit
      .mockResolvedValueOnce(makeJobResponse('completed', 'job-novar', []) as never)
      .mockResolvedValue(makeJobResponse('queued') as never);

    const onCompleted = jest.fn();
    renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCompleted).toHaveBeenCalled();
    expect(mockedApi.applyVariant).not.toHaveBeenCalled();
  });

  it('does not call onCompleted twice for the same completed job', async () => {
    mockedApi.generateEdit
      .mockResolvedValueOnce(makeCompletedJobResponse('job-once', 'var-once') as never)
      .mockResolvedValue(makeJobResponse('queued') as never);
    // getJob also returns completed — ensures the polling path won't double-fire.
    mockedApi.getJob.mockResolvedValue(makeCompletedJobResponse('job-once', 'var-once') as never);

    const onCompleted = jest.fn();
    renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // onCompleted should be called once per type that completes synchronously, not more.
    // The polling loop should not fire a second refresh for the same jobId.
    const syncCompletedCalls = onCompleted.mock.calls.length;
    expect(syncCompletedCalls).toBeGreaterThanOrEqual(1);
    // Advance time more to confirm no further calls.
    const callsSnapshot = onCompleted.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(onCompleted.mock.calls.length).toBe(callsSnapshot);
  });

  it('still calls onCompleted when applyVariant throws', async () => {
    mockedApi.generateEdit
      .mockResolvedValueOnce(makeCompletedJobResponse('job-err', 'var-err') as never)
      .mockResolvedValue(makeJobResponse('queued') as never);
    mockedApi.applyVariant.mockRejectedValue(new Error('apply failed'));

    const onCompleted = jest.fn();
    renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCompleted).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Polling behaviour (async backend path — job starts queued, transitions later)
// ---------------------------------------------------------------------------

describe('useCharacterAssetJobs – polling', () => {
  it('starts polling when a job has queued status', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-q') as never);
    mockedApi.getJob.mockResolvedValue(makeJobResponse('queued', 'job-q') as never);

    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockedApi.getJob).toHaveBeenCalledWith('job-q');
  });

  it('auto-applies the first variant when a job transitions to completed via polling', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-c') as never);
    mockedApi.getJob.mockResolvedValue(makeCompletedJobResponse('job-c', 'var-done') as never);

    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedApi.applyVariant).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'var-done',
      expect.any(String),
      expect.any(String),
    );
  });

  it('calls onCompleted when a polled job transitions to completed', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-poll') as never);
    mockedApi.getJob.mockResolvedValue(makeCompletedJobResponse('job-poll', 'var-poll') as never);

    const onCompleted = jest.fn();
    renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter(), onCompleted),
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCompleted).toHaveBeenCalled();
  });

  it('does not start polling when all image types are already present', async () => {
    const character = makeCharacter({
      images: {
        full_body: {image_id: 'i1', image_type: 'full_body', image_url: 'http://a.com/1.png', is_active: true},
        scene: {image_id: 'i2', image_type: 'scene', image_url: 'http://a.com/2.png', is_active: true},
      },
    });
    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character));
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(mockedApi.getJob).not.toHaveBeenCalled();
  });

  it('does not crash when getJob throws a network error', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-err') as never);
    mockedApi.getJob.mockRejectedValue(new Error('Network error'));

    const {result} = renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(result.current.jobs).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Retry behaviour
// ---------------------------------------------------------------------------

describe('useCharacterAssetJobs – retry', () => {
  it('re-launches the job for the given type after retry()', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued') as never);

    const {result} = renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
    });
    const callsBefore = mockedApi.generateEdit.mock.calls.length;

    act(() => {
      result.current.retry('full_body');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedApi.generateEdit.mock.calls.length).toBeGreaterThan(callsBefore);
    const lastCall = mockedApi.generateEdit.mock.calls.at(-1);
    expect((lastCall?.[2] as {image_type: string}).image_type).toBe('full_body');
  });

  it('does not launch jobs for other types when retrying full_body', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued') as never);

    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );
    await act(async () => {
      await Promise.resolve();
    });
    jest.clearAllMocks();

    act(() => {
      result.current.retry('full_body');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(1);
    expect((mockedApi.generateEdit.mock.calls[0][2] as {image_type: string}).image_type).toBe('full_body');
  });
});

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

describe('useCharacterAssetJobs – status after launch API error', () => {
  it('sets status to failed when generateEdit rejects', async () => {
    mockedApi.generateEdit.mockRejectedValue(new Error('Server error'));

    const {result} = renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
    });

    const failedStatuses = Object.values(result.current.jobs).filter((j) => j?.status === 'failed');
    expect(failedStatuses.length).toBeGreaterThan(0);
  });
});
