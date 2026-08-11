import {act, cleanup, renderHook} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import type {StudioCharacter} from '../types/character.types';
import {useCharacters} from './useCharacters';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

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

function makeCharacter(characterId: string, projectId: number): StudioCharacter {
  return {
    character_id: characterId,
    project_id: projectId,
    name: characterId,
    identity_locked: false,
    images: {},
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('useCharacters loading state', () => {
  it('starts in loading state before the first list response arrives', async () => {
    const request = deferred<unknown>();
    mockedApi.list.mockReturnValue(request.promise as never);

    const {result} = renderHook(() => useCharacters('project-1', {search: ''}));

    expect(result.current.loading).toBe(true);
    expect(result.current.characters).toEqual([]);

    await act(async () => {
      request.resolve({data: [makeCharacter('character-1', 1)]});
      await request.promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.characters).toHaveLength(1);
  });

  it('does not expose stale results while a different project is loading', async () => {
    const requestA = deferred<unknown>();
    const requestB = deferred<unknown>();
    mockedApi.list.mockImplementation((projectId) => (
      projectId === 'project-a' ? requestA.promise : requestB.promise
    ) as never);

    const {result, rerender} = renderHook(
      ({projectId}: {projectId: string}) => useCharacters(projectId, {search: ''}),
      {initialProps: {projectId: 'project-a'}},
    );

    rerender({projectId: 'project-b'});

    expect(result.current.loading).toBe(true);
    expect(result.current.characters).toEqual([]);

    await act(async () => {
      requestB.resolve({data: [makeCharacter('character-b', 2)]});
      await requestB.promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.characters[0]?.character_id).toBe('character-b');

    await act(async () => {
      requestA.resolve({data: [makeCharacter('character-a', 1)]});
      await requestA.promise;
    });

    expect(result.current.characters[0]?.character_id).toBe('character-b');
  });
});
