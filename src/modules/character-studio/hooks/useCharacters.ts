import {useCallback, useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';

export function useCharacters(projectId?: string | number, filters: Record<string, unknown> = {}) {
  const [characters, setCharacters] = useState<StudioCharacter[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await characterApi.list(projectId, filters);
      setCharacters(response?.data || []);
    } catch {
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {characters, loading, refresh};
}
