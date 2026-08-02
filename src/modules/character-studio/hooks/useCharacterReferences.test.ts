import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {message} from 'antd';
import {characterApi} from '../api/characterApi';
import type {ReferencesState} from '../types/character.types';
import {useCharacterReferences} from './useCharacterReferences';

jest.mock('antd', () => ({message: {error: jest.fn()}}));
jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
const mockedMessageError = message.error as jest.Mock;

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

function makeReferencesState(characterId: string): ReferencesState {
  return {
    character: {
      character_id: characterId,
      name: characterId,
      identity_locked: false,
    },
    references: [{
      reference_type: 'portrait',
      status: 'ready',
      asset_id: `${characterId}-asset`,
      image_url: `/${characterId}.png`,
      is_primary: true,
      version: 1,
      source: 'mock',
    }],
    primary_reference_id: `${characterId}-asset`,
    checklist: {
      appearance_stable: false,
      face_matches_base: false,
      outfit_readable: false,
      full_body_ready: false,
      front_side_back_ready: false,
      suitable_for_3d: false,
    },
    can_proceed_to_3d: false,
    proceed_blockers: [],
  };
}

beforeEach(() => {
  mockedApi.getReferences.mockImplementation((_projectId, characterId) =>
    Promise.resolve({data: makeReferencesState(characterId)}) as never,
  );
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('useCharacterReferences route ownership', () => {
  it('resets synchronously on A → B and discards the late A refresh', async () => {
    const requestA = deferred<unknown>();
    const requestB = deferred<unknown>();
    mockedApi.getReferences.mockImplementation((_projectId, characterId) =>
      (characterId === 'character-a' ? requestA.promise : requestB.promise) as never,
    );

    const {result, rerender} = renderHook(
      ({projectId, characterId}: {projectId: string; characterId: string}) =>
        useCharacterReferences(projectId, characterId),
      {initialProps: {projectId: 'project-a', characterId: 'character-a'}},
    );

    rerender({projectId: 'project-b', characterId: 'character-b'});
    expect(result.current.state).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      requestB.resolve({data: makeReferencesState('character-b')});
      await requestB.promise;
    });
    expect(result.current.state?.character.character_id).toBe('character-b');

    await act(async () => {
      requestA.resolve({data: makeReferencesState('character-a')});
      await requestA.promise;
    });
    expect(result.current.state?.character.character_id).toBe('character-b');
    expect(result.current.loading).toBe(false);
  });

  it('does not let a late generate mutation replace B state or jobs', async () => {
    const generateA = deferred<unknown>();
    mockedApi.generateReference.mockReturnValueOnce(generateA.promise as never);
    const {result, rerender} = renderHook(
      ({projectId, characterId}: {projectId: string; characterId: string}) =>
        useCharacterReferences(projectId, characterId),
      {initialProps: {projectId: 'project-a', characterId: 'character-a'}},
    );
    await waitFor(() => {
      expect(result.current.state?.character.character_id).toBe('character-a');
    });

    let generatePromise!: Promise<void>;
    act(() => {
      generatePromise = result.current.generate('portrait');
    });
    expect(result.current.state?.references[0].status).toBe('generating');

    rerender({projectId: 'project-b', characterId: 'character-b'});
    await waitFor(() => {
      expect(result.current.state?.character.character_id).toBe('character-b');
    });

    await act(async () => {
      generateA.resolve({
        data: {
          job_id: 'job-a',
          status: 'queued',
          references: makeReferencesState('character-a'),
        },
      });
      await generatePromise;
    });

    expect(result.current.state?.character.character_id).toBe('character-b');
    expect(result.current.activeJobs).toEqual({});
    expect(mockedMessageError).not.toHaveBeenCalled();
  });

  it('discards a late poll response owned by A after switching to B', async () => {
    jest.useFakeTimers();
    const pollA = deferred<unknown>();
    mockedApi.generateReference.mockResolvedValueOnce({
      data: {
        job_id: 'job-a',
        status: 'queued',
        references: makeReferencesState('character-a'),
      },
    } as never);
    mockedApi.getJob.mockReturnValueOnce(pollA.promise as never);

    const {result, rerender} = renderHook(
      ({projectId, characterId}: {projectId: string; characterId: string}) =>
        useCharacterReferences(projectId, characterId),
      {initialProps: {projectId: 'project-a', characterId: 'character-a'}},
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.generate('portrait');
    });
    expect(result.current.activeJobs.portrait).toBe('job-a');

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(mockedApi.getJob).toHaveBeenCalledWith('job-a');

    rerender({projectId: 'project-b', characterId: 'character-b'});
    expect(result.current.activeJobs).toEqual({});

    await act(async () => {
      pollA.resolve({
        data: {
          job_id: 'job-a',
          status: 'failed',
          error_message: 'late failure from A',
          variants: [],
        },
      });
      await pollA.promise;
      await Promise.resolve();
    });

    expect(result.current.state?.character.character_id).toBe('character-b');
    expect(result.current.activeJobs).toEqual({});
    expect(mockedMessageError).not.toHaveBeenCalled();
  });
});
