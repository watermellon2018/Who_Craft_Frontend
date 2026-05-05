import {useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import {GenerationJob} from '../types/character.types';

export function useGenerationJob(jobId?: string) {
  const [job, setJob] = useState<GenerationJob | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let intervalId: number | undefined;

    const load = async () => {
      try {
        const response = await characterApi.getJob(jobId);
        if (cancelled) return;
        const data: GenerationJob = response.data;
        setJob(data);
        // Stop polling once the job reaches a terminal state.
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          if (intervalId !== undefined) {
            window.clearInterval(intervalId);
            intervalId = undefined;
          }
        }
      } catch {
        if (!cancelled) setJob(null);
      }
    };

    load();
    intervalId = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [jobId]);

  return {job};
}
