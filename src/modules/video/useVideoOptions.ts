import {useCallback, useEffect, useState} from 'react';

import {getAuthGeneration} from '../../api/http';
import {PERSONAL_API_SETTINGS_CHANGED} from '../personal-api/api/personalApi';
import {fetchVideoOptions} from './api';
import type {VideoOptions, VideoOptionsInput} from './types';

export function useVideoOptions(projectId: string, input: VideoOptionsInput | null, fingerprint: string, generationSource: string) {
  const [result, setResult] = useState<{key: string; data: VideoOptions | null; failed: boolean} | null>(null);
  const [revision, setRevision] = useState(0);
  const inputJson = JSON.stringify(input);
  const key = `${projectId}:${inputJson}:${fingerprint}:${generationSource}:${revision}`;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    window.addEventListener(PERSONAL_API_SETTINGS_CHANGED, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(PERSONAL_API_SETTINGS_CHANGED, refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (inputJson === 'null') return;
    const controller = new AbortController();
    const authGeneration = getAuthGeneration();
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      try {
        const data = await fetchVideoOptions(projectId, JSON.parse(inputJson) as VideoOptionsInput, controller.signal);
        if (controller.signal.aborted || getAuthGeneration() !== authGeneration) return;
        setResult({key, data, failed: false});
        expiryTimer = setTimeout(refresh, Math.max(1000, (data.expiresInSeconds - 15) * 1000));
      } catch {
        if (!controller.signal.aborted && getAuthGeneration() === authGeneration) setResult({key, data: null, failed: true});
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(expiryTimer);
    };
  }, [projectId, inputJson, key, refresh]);

  const current = result?.key === key ? result : null;
  return {data: current?.data ?? null, failed: current?.failed ?? false, loading: Boolean(input) && !current, refresh};
}
