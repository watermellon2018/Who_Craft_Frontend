import {act, renderHook} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';
import {useCharacterAssetJobs} from './useCharacterAssetJobs';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

// Minimal character fixture without any generated images
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

function makeJobResponse(status: string, jobId = 'job-1') {
  return {data: {job_id: jobId, status, progress: 0, variants: [], error_message: undefined}};
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
  it('launches jobs for all three secondary types when character has no images', async () => {
    const character = makeCharacter({images: {}});
    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, character));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(3);
    const calledTypes = mockedApi.generateEdit.mock.calls.map((c) => (c[2] as {image_type: string}).image_type);
    expect(calledTypes).toContain('full_body');
    expect(calledTypes).toContain('scene');
    expect(calledTypes).toContain('reference_sheet');
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
    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(2);
    const calledTypes = mockedApi.generateEdit.mock.calls.map((c) => (c[2] as {image_type: string}).image_type);
    expect(calledTypes).not.toContain('full_body');
    expect(calledTypes).toContain('scene');
    expect(calledTypes).toContain('reference_sheet');
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
    expect(mockedApi.generateEdit).toHaveBeenCalledTimes(3); // 3 types, not 6
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
// Polling behaviour
// ---------------------------------------------------------------------------

describe('useCharacterAssetJobs – polling', () => {
  it('starts polling when a job has queued status', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-q') as never);
    mockedApi.getJob.mockResolvedValue(makeJobResponse('queued', 'job-q') as never);

    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    // Let the launch effects resolve
    await act(async () => {
      await Promise.resolve();
    });
    // Advance past the poll interval
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockedApi.getJob).toHaveBeenCalledWith('job-q');
  });

  it('auto-applies the first variant when a job transitions to completed', async () => {
    mockedApi.generateEdit.mockResolvedValue(makeJobResponse('queued', 'job-c') as never);
    mockedApi.getJob.mockResolvedValue(makeCompletedJobResponse('job-c', 'var-done') as never);

    renderHook(() => useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
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

  it('does not start polling when all image types are already present', async () => {
    const character = makeCharacter({
      images: {
        full_body: {image_id: 'i1', image_type: 'full_body', image_url: 'http://a.com/1.png', is_active: true},
        scene: {image_id: 'i2', image_type: 'scene', image_url: 'http://a.com/2.png', is_active: true},
        reference_sheet: {image_id: 'i3', image_type: 'reference_sheet', image_url: 'http://a.com/3.png', is_active: true},
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
    // Should not throw even when polling fails
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    // Hook stays alive — jobs map is still accessible
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
