import {useCallback, useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import {CharacterRevision} from '../types/character.types';

export function useCharacterRevisions(projectId?: string | number, characterId?: string) {
  const [revisions, setRevisions] = useState<CharacterRevision[]>([]);
  const refresh = useCallback(async () => {
    if (!projectId || !characterId) return;
    try {
      const response = await characterApi.listRevisions(projectId, characterId);
      setRevisions(response.data || []);
    } catch {
      setRevisions([]);
    }
  }, [projectId, characterId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {revisions, refresh};
}
