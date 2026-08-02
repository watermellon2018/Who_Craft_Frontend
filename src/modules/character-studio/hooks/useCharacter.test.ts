import {act, cleanup, renderHook} from '@testing-library/react';
import {characterApi} from '../api/characterApi';
import type {StudioCharacter} from '../types/character.types';
import {useCharacter} from './useCharacter';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
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

describe('useCharacter route ownership', () => {
  it('exposes a blank state synchronously on A → B and discards the late A response', async () => {
    const requestA = deferred<unknown>();
    const requestB = deferred<unknown>();
    mockedApi.get.mockImplementation((projectId, characterId) => {
      return (characterId === 'character-a' ? requestA.promise : requestB.promise) as never;
    });

    const {result, rerender} = renderHook(
      ({projectId, characterId}: {projectId: string; characterId: string}) =>
        useCharacter(projectId, characterId),
      {initialProps: {projectId: 'project-a', characterId: 'character-a'}},
    );

    rerender({projectId: 'project-b', characterId: 'character-b'});

    expect(result.current.character).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      requestB.resolve({data: makeCharacter('character-b', 2)});
      await requestB.promise;
    });

    expect(result.current.character?.character_id).toBe('character-b');
    expect(result.current.loading).toBe(false);

    await act(async () => {
      requestA.resolve({data: makeCharacter('character-a', 1)});
      await requestA.promise;
    });

    expect(result.current.character?.character_id).toBe('character-b');
    expect(result.current.loading).toBe(false);
  });
});
