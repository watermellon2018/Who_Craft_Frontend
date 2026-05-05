import {useCallback, useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';

export function useCharacter(projectId?: string | number, characterId?: string) {
  const [character, setCharacter] = useState<StudioCharacter | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId || !characterId) return;
    setLoading(true);
    try {
      const response = await characterApi.get(projectId, characterId);
      setCharacter(response?.data || null);
    } catch {
      setCharacter(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, characterId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {character, loading, refresh, setCharacter};
}
