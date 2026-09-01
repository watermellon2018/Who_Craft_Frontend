import {useCallback, useEffect, useRef, useState} from 'react';

import {getApiErrorMessage} from '../../../api/errors';
import {notifyCreditBalanceUpdated} from '../../credits/api/creditApi';
import {soundEffectsApi} from '../api/soundEffectsApi';
import {isSoundEffectJobTerminal} from '../types';
import type {SoundEffectJob} from '../types';

const DEFAULT_POLL_DELAY_MS = 3000;

export function useSoundEffectJob(projectId?: string, jobId?: string) {
  const requestKey = `${projectId ?? ''}:${jobId ?? ''}`;
  const activeRequestRef = useRef(requestKey);
  activeRequestRef.current = requestKey;
  const [job, setJob] = useState<SoundEffectJob | null>(null);
  const [loading, setLoading] = useState(Boolean(jobId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    if (!projectId || !jobId) {
      setJob(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let timeoutId: number | undefined;
    let controller: AbortController | undefined;
    setLoading(true);
    setErrorMessage(null);

    const load = async () => {
      controller = new AbortController();
      try {
        const response = await soundEffectsApi.getJob(projectId, jobId, controller.signal);
        if (cancelled || activeRequestRef.current !== requestKey) return;
        setJob(response.data);
        setLoading(false);
        if (isSoundEffectJobTerminal(response.data.status)) {
          notifyCreditBalanceUpdated();
          return;
        }
        const delay = Math.min(15_000, Math.max(500, response.data.pollAfterMs ?? DEFAULT_POLL_DELAY_MS));
        timeoutId = window.setTimeout(() => void load(), delay);
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted || activeRequestRef.current !== requestKey) return;
        setErrorMessage(getApiErrorMessage(error, 'Could not load generation job.'));
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [jobId, projectId, requestKey, revision]);

  return {errorMessage, job, loading, refresh};
}
