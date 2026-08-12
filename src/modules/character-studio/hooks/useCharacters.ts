import {useCallback, useEffect, useRef, useState} from 'react';
import i18n from '../../../i18n';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';

interface CharactersSnapshot {
  characters: StudioCharacter[];
  error: string | null;
  loading: boolean;
  ownerKey: string;
}

export function useCharacters(projectId?: string | number, filters: Record<string, unknown> = {}) {
  const filtersKey = JSON.stringify(filters);
  const ownerKey = projectId ? `${projectId}:${filtersKey}` : '';
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const activeOwnerKeyRef = useRef(ownerKey);
  activeOwnerKeyRef.current = ownerKey;
  const [snapshot, setSnapshot] = useState<CharactersSnapshot>({
    characters: [],
    error: null,
    loading: Boolean(ownerKey),
    ownerKey,
  });

  const refresh = useCallback(async () => {
    const requestOwnerKey = ownerKey;
    const requestFilters = filtersRef.current;
    if (!projectId) {
      if (activeOwnerKeyRef.current === requestOwnerKey) {
        setSnapshot({characters: [], error: null, loading: false, ownerKey: requestOwnerKey});
      }
      return;
    }
    setSnapshot((current) => {
      if (activeOwnerKeyRef.current !== requestOwnerKey) return current;
      return {
        characters: current.ownerKey === requestOwnerKey ? current.characters : [],
        error: null,
        loading: true,
        ownerKey: requestOwnerKey,
      };
    });
    try {
      const response = await characterApi.list(projectId, requestFilters);
      if (activeOwnerKeyRef.current !== requestOwnerKey) return;
      setSnapshot({
        characters: response?.data || [],
        error: null,
        loading: false,
        ownerKey: requestOwnerKey,
      });
    } catch {
      if (activeOwnerKeyRef.current !== requestOwnerKey) return;
      setSnapshot({
        characters: [],
        error: i18n.t('characterStudio.errors.loadCharacters') as string,
        loading: false,
        ownerKey: requestOwnerKey,
      });
    }
  }, [ownerKey, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isCurrentOwner = snapshot.ownerKey === ownerKey;
  const characters = isCurrentOwner ? snapshot.characters : [];
  const error = isCurrentOwner ? snapshot.error : null;
  const loading = ownerKey ? (isCurrentOwner ? snapshot.loading : true) : false;

  return {characters, loading, error, refresh};
}
