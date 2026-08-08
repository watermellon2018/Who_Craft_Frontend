import {useCallback, useEffect, useRef, useState} from 'react';

import {referenceApi} from '../api/referenceApi';
import {referenceErrorDescriptor} from '../errors';
import {isReferenceJobTerminal} from '../types';
import type {ReferenceGenerationJob} from '../types';

const DEFAULT_POLL_DELAY_MS = 2000;
const MAX_POLL_DELAY_MS = 5000;

interface PollState {
  errorCode: string | null;
  errorMessage: string | null;
  job: ReferenceGenerationJob | null;
  loading: boolean;
  requestKey: string;
}

function initialState(requestKey: string, jobId?: string): PollState {
  return {
    errorCode: null,
    errorMessage: null,
    job: null,
    loading: Boolean(jobId),
    requestKey,
  };
}

function pollDelay(progress: number): number {
  return Math.min(MAX_POLL_DELAY_MS, DEFAULT_POLL_DELAY_MS + Math.max(0, progress) * 30);
}

export function useReferenceGenerationJob(
  projectId?: string,
  referenceId?: string,
  jobId?: string,
) {
  const requestKey = `${projectId ?? ''}:${referenceId ?? ''}:${jobId ?? ''}`;
  const activeRequestRef = useRef(requestKey);
  activeRequestRef.current = requestKey;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState(() => initialState(requestKey, jobId));
  const visibleState = state.requestKey === requestKey ? state : initialState(requestKey, jobId);

  const refresh = useCallback(() => {
    setState(initialState(requestKey, jobId));
    setRevision((value) => value + 1);
  }, [jobId, requestKey]);

  useEffect(() => {
    if (!projectId || !referenceId || !jobId) {
      setState(initialState(requestKey));
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let controller: AbortController | undefined;
    setState(initialState(requestKey, jobId));

    const load = async () => {
      controller = new AbortController();
      try {
        const response = await referenceApi.getJob(
          projectId,
          referenceId,
          jobId,
          controller.signal,
        );
        if (cancelled || activeRequestRef.current !== requestKey) return;
        const job = response.data;
        if (job.id !== jobId || job.referenceId !== referenceId) {
          setState({
            ...initialState(requestKey),
            errorCode: 'REFERENCE_JOB_NOT_FOUND',
            errorMessage: referenceErrorDescriptor({
              code: 'REFERENCE_JOB_NOT_FOUND',
              detail: 'Job ownership mismatch',
            }).message,
          });
          return;
        }
        setState({...initialState(requestKey), job});
        if (!isReferenceJobTerminal(job.status)) {
          timeoutId = window.setTimeout(() => void load(), pollDelay(job.progress));
        }
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted || activeRequestRef.current !== requestKey) return;
        const descriptor = referenceErrorDescriptor(error);
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
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [jobId, projectId, referenceId, requestKey, revision]);

  return {
    errorCode: visibleState.errorCode,
    errorMessage: visibleState.errorMessage,
    isTerminal: visibleState.job ? isReferenceJobTerminal(visibleState.job.status) : false,
    job: visibleState.job,
    loading: visibleState.loading,
    refresh,
  };
}
