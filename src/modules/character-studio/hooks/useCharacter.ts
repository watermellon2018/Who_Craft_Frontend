import {useCallback, useEffect, useRef, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {characterApi} from '../api/characterApi';
import type {StudioCharacter} from '../types/character.types';

interface CharacterSnapshot {
  character: StudioCharacter | null;
  loading: boolean;
  ownerKey: string;
}

export function useCharacter(projectId?: string | number, characterId?: string) {
  const ownerKey = projectId && characterId ? `${projectId}:${characterId}` : '';
  const activeOwnerKeyRef = useRef(ownerKey);
  activeOwnerKeyRef.current = ownerKey;
  const [snapshot, setSnapshot] = useState<CharacterSnapshot>({
    character: null,
    loading: Boolean(ownerKey),
    ownerKey,
  });

  const refresh = useCallback(async () => {
    const requestOwnerKey = ownerKey;
    if (!projectId || !characterId) {
      if (activeOwnerKeyRef.current === requestOwnerKey) {
        setSnapshot({character: null, loading: false, ownerKey: requestOwnerKey});
      }
      return;
    }
    setSnapshot((current) => {
      if (activeOwnerKeyRef.current !== requestOwnerKey) return current;
      return {
        character: current.ownerKey === requestOwnerKey ? current.character : null,
        loading: true,
        ownerKey: requestOwnerKey,
      };
    });
    try {
      const response = await characterApi.get(projectId, characterId);
      if (activeOwnerKeyRef.current !== requestOwnerKey) return;
      setSnapshot({
        character: response?.data || null,
        loading: false,
        ownerKey: requestOwnerKey,
      });
    } catch {
      if (activeOwnerKeyRef.current !== requestOwnerKey) return;
      setSnapshot({character: null, loading: false, ownerKey: requestOwnerKey});
    }
  }, [characterId, ownerKey, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCharacter = useCallback<Dispatch<SetStateAction<StudioCharacter | null>>>(
    (nextCharacter) => {
      setSnapshot((current) => {
        if (activeOwnerKeyRef.current !== ownerKey) return current;
        const currentCharacter = current.ownerKey === ownerKey ? current.character : null;
        return {
          character:
            typeof nextCharacter === 'function'
              ? nextCharacter(currentCharacter)
              : nextCharacter,
          loading: false,
          ownerKey,
        };
      });
    },
    [ownerKey],
  );

  const isCurrentOwner = snapshot.ownerKey === ownerKey;
  const character = isCurrentOwner ? snapshot.character : null;
  const loading = ownerKey ? (isCurrentOwner ? snapshot.loading : true) : false;

  return {character, loading, refresh, setCharacter};
}
