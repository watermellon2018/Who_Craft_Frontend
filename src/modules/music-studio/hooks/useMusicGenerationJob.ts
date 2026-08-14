import {useCallback, useEffect, useRef, useState} from 'react';

import {notifyCreditBalanceUpdated} from '../../credits/api/creditApi';
import {musicApi} from '../api/musicApi';
import {musicErrorDescriptor} from '../errors';
import {isMusicJobTerminal} from '../types';
import type {MusicGenerationJob} from '../types';

const DEFAULT_POLL_DELAY_MS = 3000;
const MIN_POLL_DELAY_MS = 500;
const MAX_POLL_DELAY_MS = 15_000;

interface MusicGenerationJobState {
  errorCode: string | null;
  errorMessage: string | null;
  job: MusicGenerationJob | null;
  loading: boolean;
  requestKey: string;
}

function initialState(requestKey: string, jobId?: string): MusicGenerationJobState {
  return {
    errorCode: null,
    errorMessage: null,
    job: null,
    loading: Boolean(jobId),
    requestKey,
  };
}

function pollDelay(job: MusicGenerationJob): number {
  const delay = job.pollAfterMs ?? DEFAULT_POLL_DELAY_MS;
  return Math.min(MAX_POLL_DELAY_MS, Math.max(MIN_POLL_DELAY_MS, delay));
}

export function useMusicGenerationJob(projectId?: string, jobId?: string) {
  const requestKey = `${projectId ?? ''}:${jobId ?? ''}`;
  const activeRequestRef = useRef(requestKey);
  activeRequestRef.current = requestKey;
  const [state, setState] = useState(() => initialState(requestKey, jobId));
  const [refreshRevision, setRefreshRevision] = useState(0);
  const visibleState = state.requestKey === requestKey ? state : initialState(requestKey, jobId);

  const refresh = useCallback(() => {
    setState(initialState(requestKey, jobId));
    setRefreshRevision((revision) => revision + 1);
  }, [jobId, requestKey]);

  useEffect(() => {
    if (!projectId || !jobId) {
      setState(initialState(requestKey));
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let controller: AbortController | undefined;
    setState(initialState(requestKey, jobId));

    const stop = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      controller?.abort();
    };

    const load = async () => {
      controller = new AbortController();
      try {
        const response = await musicApi.getJob(projectId, jobId, controller.signal);
        if (cancelled || activeRequestRef.current !== requestKey) return;
        const job = response.data;
        if (job.jobId !== jobId) {
          setState({
            ...initialState(requestKey),
            errorMessage: musicErrorDescriptor({
              code: 'MUSIC_JOB_NOT_FOUND',
              detail: 'Job ownership mismatch',
            }).message,
          });
          return;
        }
        setState({...initialState(requestKey), job});
        if (isMusicJobTerminal(job.status)) {
          notifyCreditBalanceUpdated();
        } else {
          timeoutId = window.setTimeout(() => void load(), pollDelay(job));
        }
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted || activeRequestRef.current !== requestKey) return;
        const descriptor = musicErrorDescriptor(error);
        setState({
          ...initialState(requestKey),
          errorCode: descriptor.code,
          errorMessage: descriptor.message,
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
      stop();
    };
  }, [jobId, projectId, refreshRevision, requestKey]);

  return {
    errorCode: visibleState.errorCode,
    errorMessage: visibleState.errorMessage,
    isTerminal: visibleState.job ? isMusicJobTerminal(visibleState.job.status) : false,
    job: visibleState.job,
    loading: visibleState.loading,
    refresh,
  };
}
