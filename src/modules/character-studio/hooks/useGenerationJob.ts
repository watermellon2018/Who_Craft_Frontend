import {useEffect, useState} from 'react';
import {getApiErrorMessage, getApiStatus} from '../../../api/errors';
import {characterApi} from '../api/characterApi';
import type {GenerationJob} from '../types/character.types';

export function useGenerationJob(jobId?: string) {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(Boolean(jobId));
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setErrorStatus(null);
      setErrorMessage(null);
      return;
    }
    let cancelled = false;
    let intervalId: number | undefined;

    setJob(null);
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    const load = async () => {
      try {
        const response = await characterApi.getJob(jobId);
        if (cancelled) return;
        const data: GenerationJob = response.data;
        setJob(data);
        setLoading(false);
        setErrorStatus(null);
        setErrorMessage(null);
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          if (intervalId !== undefined) {
            window.clearInterval(intervalId);
            intervalId = undefined;
          }
        }
      } catch (error: unknown) {
        if (cancelled) return;
        const status = getApiStatus(error);
        setJob(null);
        setLoading(false);
        setErrorStatus(status);
        setErrorMessage(status === 403
          ? 'Нет доступа к заданию генерации'
          : status === 404
            ? 'Задание генерации не найдено'
            : getApiErrorMessage(error, 'Не удалось загрузить задание генерации'));
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }
    };

    void load();
    intervalId = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [jobId]);

  return {job, loading, errorStatus, errorMessage};
}
