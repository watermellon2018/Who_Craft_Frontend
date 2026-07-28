import {act, cleanup, renderHook} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import type {StudioCharacter} from '../types/character.types';
import {useCharacterAssetJobs} from './useCharacterAssetJobs';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
const PROJECT_ID = 'project-1';
const CHARACTER_ID = 'char-abc';
const REVISION_ID = 'revision-7';

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

  it('retry reuses the original revision and idempotency key', async () => {
    const {result} = renderHook(() =>
      useCharacterAssetJobs(PROJECT_ID, CHARACTER_ID, makeCharacter()),
    );

    await act(async () => {
      await result.current.launchJob('full_body', REVISION_ID);
      await Promise.resolve();
    });
    mockedApi.generateEdit.mockClear();

    await act(async () => {
      await result.current.retry('full_body');
    });

    expect(mockedApi.generateEdit).toHaveBeenCalledWith(
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
