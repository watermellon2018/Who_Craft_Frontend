import axios from 'axios';
import {useCallback, useEffect, useState} from 'react';

import {fetchVideoPreparation} from './api';
import type {VideoPreparationResponse} from './api';

interface VideoPreparationLoadState {
  data: VideoPreparationResponse | null;
  error: 'forbidden' | 'notFound' | 'unknown' | null;
  loading: boolean;
  retry: () => void;
}

export function useVideoPreparation(projectId: string): VideoPreparationLoadState {
  const [data, setData] = useState<VideoPreparationResponse | null>(null);
  const [error, setError] = useState<VideoPreparationLoadState['error']>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      setError('notFound');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setError(null);
    setLoading(true);
    fetchVideoPreparation(projectId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
          setError('forbidden');
        } else if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
          setError('notFound');
        } else {
          setError('unknown');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, revision]);

  const retry = useCallback(() => setRevision((current) => current + 1), []);

  return {data, error, loading, retry};
}
