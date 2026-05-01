import {useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import {GenerationJob} from '../types/character.types';

export function useGenerationJob(jobId?: string) {
  const [job, setJob] = useState<GenerationJob | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await characterApi.getJob(jobId);
        if (!cancelled) setJob(response.data);
      } catch {
        if (!cancelled) setJob(null);
      }
    };
    load();
    const id = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobId]);

  return {job};
}
