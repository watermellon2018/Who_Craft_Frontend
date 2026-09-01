import {useCallback, useEffect, useRef, useState} from 'react';
import {v4 as uuid} from 'uuid';

import {getAuthGeneration} from '../../api/http';
import {isShotListJobActive} from './shotListJobs';
import type {ShotListJob, ShotListJobService} from './shotListJobs';
import type {StoryboardShotListConfiguration} from './model';

export function useShotListJobs(
  projectId: string,
  service: ShotListJobService | undefined,
  enabled: boolean,
  refreshDrafts: () => Promise<void>,
) {
  const [jobs, setJobs] = useState<ShotListJob[]>([]);
  const [loading, setLoading] = useState(Boolean(service));
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const scope = useRef({projectId, authGeneration: getAuthGeneration(), active: false});
  const syncRef = useRef(refreshDrafts);
  syncRef.current = refreshDrafts;
  // Keep the same request ID after an uncertain POST response. No automatic
  // retry can accidentally buy another generation after the first completed.
  const pendingStarts = useRef(new Map<string, {signature: string; requestId: string; estimatedSeconds: number}>());

  useEffect(() => {
    const session = {projectId, authGeneration: getAuthGeneration(), active: enabled};
    if (!enabled || scope.current.projectId !== projectId
      || scope.current.authGeneration !== session.authGeneration) setJobs([]);
    scope.current = session;
    setError(false);
    setLoading(Boolean(service && enabled));
    if (!service || !enabled) return () => { session.active = false; };
    let timer: number | undefined;
    const completed = new Set<string>();
    const current = () => session.active && session.authGeneration === getAuthGeneration();
    const poll = async () => {
      let nextDelay = 15000;
      try {
        const loaded = await service.list(projectId, session.authGeneration);
        if (!current()) return;
        const unseen = loaded.filter((job) => job.status === 'succeeded'
          && job.resultState === 'applied' && !completed.has(`${job.jobId}:${job.appliedRevision}`));
        if (unseen.length) {
          await syncRef.current();
          if (!current()) return;
          unseen.forEach((job) => completed.add(`${job.jobId}:${job.appliedRevision}`));
        }
        setJobs(loaded);
        setError(false);
        if (loaded.some(isShotListJobActive)) nextDelay = 2000;
      } catch {
        if (current()) setError(true);
        nextDelay = 5000;
      } finally {
        if (current()) {
          setLoading(false);
          timer = window.setTimeout(poll, nextDelay);
        }
      }
    };
    void poll();
    return () => {
      session.active = false;
      window.clearTimeout(timer);
    };
  }, [enabled, projectId, refreshKey, service]);

  const start = useCallback(async (sceneId: string, configuration: StoryboardShotListConfiguration,
    estimatedSeconds: number) => {
    const session = scope.current;
    if (!service || !session.active || session.authGeneration !== getAuthGeneration()) {
      throw new Error('Storyboard session changed');
    }
    const key = `${projectId}:${session.authGeneration}:${sceneId}`;
    const signature = JSON.stringify(configuration);
    let attempt = pendingStarts.current.get(key);
    if (!attempt || attempt.signature !== signature) {
      attempt = {signature, requestId: uuid(), estimatedSeconds};
      pendingStarts.current.set(key, attempt);
    }
    const job = await service.start(projectId, sceneId, configuration, attempt.estimatedSeconds,
      attempt.requestId, session.authGeneration);
    if (!session.active || session.authGeneration !== getAuthGeneration()) return;
    pendingStarts.current.delete(key);
    setJobs((current) => [...current.filter((item) => item.sceneId !== job.sceneId), job]);
    setRefreshKey((value) => value + 1);
    return job;
  }, [projectId, service]);

  const apply = useCallback(async (jobId: string, revision: number) => {
    const session = scope.current;
    if (!service || !session.active || session.authGeneration !== getAuthGeneration()) return;
    await service.apply(projectId, jobId, revision, session.authGeneration);
    if (!session.active || session.authGeneration !== getAuthGeneration()) return;
    await syncRef.current();
    if (session.active && session.authGeneration === getAuthGeneration()) setRefreshKey((value) => value + 1);
  }, [projectId, service]);

  const dismiss = useCallback(async (jobId: string) => {
    const session = scope.current;
    if (!service || !session.active || session.authGeneration !== getAuthGeneration()) return;
    await service.dismiss(projectId, jobId, session.authGeneration);
    if (session.active && session.authGeneration === getAuthGeneration()) setRefreshKey((value) => value + 1);
  }, [projectId, service]);

  return {jobs, loading, error, start, apply, dismiss,
    retry: () => setRefreshKey((value) => value + 1)};
}
