import {useCallback, useEffect, useState} from 'react';
import i18n from '../../../i18n';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';

export function useCharacters(projectId?: string | number, filters: Record<string, unknown> = {}) {
  const [characters, setCharacters] = useState<StudioCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await characterApi.list(projectId, filters);
      setCharacters(response?.data || []);
    } catch {
      setCharacters([]);
      setError(i18n.t('characterStudio.errors.loadCharacters') as string);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {characters, loading, error, refresh};
}
