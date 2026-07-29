import {useEffect, useRef, useState} from 'react';
import {getApiErrorMessage, getApiStatus} from '../../../api/errors';
import {characterApi} from '../api/characterApi';
import type {GenerationJob} from '../types/character.types';

interface GenerationJobState {
  errorMessage: string | null;
  errorStatus: number | null;
  job: GenerationJob | null;
  loading: boolean;
  requestKey: string;
}

function initialState(requestKey: string, jobId?: string): GenerationJobState {
  return {
    errorMessage: null,
    errorStatus: null,
    job: null,
    loading: Boolean(jobId),
    requestKey,
  };
}

export function useGenerationJob(
  jobId?: string,
  projectId?: string | number,
  characterId?: string,
) {
  const requestKey = `${projectId ?? ''}:${characterId ?? ''}:${jobId ?? ''}`;
  const activeRequestRef = useRef(requestKey);
  activeRequestRef.current = requestKey;
  const [state, setState] = useState<GenerationJobState>(() => initialState(requestKey, jobId));
  const visibleState = state.requestKey === requestKey ? state : initialState(requestKey, jobId);

  useEffect(() => {
    if (!jobId) {
      setState(initialState(requestKey));
      return;
    }
    let cancelled = false;
    let intervalId: number | undefined;

    setState(initialState(requestKey, jobId));

    const stopPolling = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const load = async () => {
      try {
        const response = await characterApi.getJob(jobId);
        if (cancelled || activeRequestRef.current !== requestKey) return;
        const data: GenerationJob = response.data;
        const belongsToOwner =
          (!characterId || !data.character_id || String(data.character_id) === String(characterId)) &&
          (!projectId || !data.project_id || String(data.project_id) === String(projectId));
        if (!belongsToOwner) {
          setState({
            ...initialState(requestKey),
            errorMessage: 'Задание генерации не принадлежит текущему персонажу',
          });
          stopPolling();
          return;
        }
        setState({...initialState(requestKey), job: data});
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          stopPolling();
        }
      } catch (error: unknown) {
        if (cancelled || activeRequestRef.current !== requestKey) return;
        const status = getApiStatus(error);
        setState({
          ...initialState(requestKey),
          errorStatus: status,
          errorMessage: status === 403
            ? 'Нет доступа к заданию генерации'
            : status === 404
              ? 'Задание генерации не найдено'
              : getApiErrorMessage(error, 'Не удалось загрузить задание генерации'),
        });
        stopPolling();
      }
    };

    void load();
    intervalId = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [characterId, jobId, projectId, requestKey]);

  return {
    job: visibleState.job,
    loading: visibleState.loading,
    errorStatus: visibleState.errorStatus,
    errorMessage: visibleState.errorMessage,
  };
}