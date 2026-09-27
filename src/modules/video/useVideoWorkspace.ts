import {useCallback, useEffect, useRef, useState} from 'react';

import {getApiStatus} from '../../api/errors';
import {AUTH_EXPIRED_EVENT, getAuthGeneration} from '../../api/http';
import {PERSONAL_API_SETTINGS_CHANGED} from '../personal-api/api/personalApi';
import {fetchVideoWorkspace} from './api';
import {isActiveVideoJob} from './types';
import type {VideoWorkspace} from './types';

export function useVideoWorkspace(projectId: string) {
  const [data, setData] = useState<VideoWorkspace | null>(null);
  const [error, setError] = useState<'forbidden' | 'notFound' | 'unknown' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState(false);
  const refreshRef = useRef<() => void>(() => undefined);
  const retry = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let disposed = false;
    let request: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const authGeneration = getAuthGeneration();
    let hasData = false;
    setData(null);
    setLoading(true);
    setError(null);
    setRefreshError(false);

    const invalidate = () => {
      request?.abort();
      clearTimeout(timer);
      setData(null);
      setError('forbidden');
      setLoading(false);
    };
    const load = async () => {
      clearTimeout(timer);
      request?.abort();
      if (getAuthGeneration() !== authGeneration) {
        invalidate();
        return;
      }
      const controller = new AbortController();
      request = controller;
      let delay = 30000;
      try {
        const workspace = await fetchVideoWorkspace(projectId, controller.signal);
        if (disposed || controller.signal.aborted) return;
        if (getAuthGeneration() !== authGeneration) {
          invalidate();
          return;
        }
        hasData = true;
        setData(workspace);
        setError(null);
        setRefreshError(false);
        const jobs = [...workspace.scenes.flatMap((scene) => scene.shots), ...workspace.archivedShots]
          .flatMap((shot) => shot.jobs).filter(isActiveVideoJob);
        if (jobs.length) delay = Math.min(...jobs.map((job) => Math.max(2000, job.pollAfterMs || 3000)));
      } catch (failure: unknown) {
        if (disposed || controller.signal.aborted) return;
        const status = getApiStatus(failure);
        if (status === 401 || status === 403 || status === 404) {
          setData(null);
          setError(status === 404 ? 'notFound' : 'forbidden');
          return;
        }
        if (hasData) setRefreshError(true);
        else setError('unknown');
        delay = 5000;
      } finally {
        if (!disposed && !controller.signal.aborted) setLoading(false);
      }
      if (!disposed && !controller.signal.aborted) {
        timer = setTimeout(() => {
          if (document.visibilityState === 'hidden') timer = setTimeout(() => void load(), 30000);
          else void load();
        }, delay);
      }
    };
    const reload = () => void load();
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') reload();
    };
    refreshRef.current = reload;
    void load();
    window.addEventListener('focus', reload);
    window.addEventListener(PERSONAL_API_SETTINGS_CHANGED, reload);
    window.addEventListener(AUTH_EXPIRED_EVENT, invalidate);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      request?.abort();
      window.removeEventListener('focus', reload);
      window.removeEventListener(PERSONAL_API_SETTINGS_CHANGED, reload);
      window.removeEventListener(AUTH_EXPIRED_EVENT, invalidate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [projectId]);

  return {data, error, loading, refreshError, retry};
}
