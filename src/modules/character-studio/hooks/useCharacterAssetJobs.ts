import {useCallback, useEffect, useRef, useState} from 'react';
import {characterApi} from '../api/characterApi';
import {CharacterImageType, GenerationJob, StudioCharacter} from '../types/character.types';

export type AssetJobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

export interface AssetJobState {
  jobId?: string;
  status: AssetJobStatus;
  errorMessage?: string;
  progress?: number;
}

export type AssetJobsMap = Partial<Record<CharacterImageType, AssetJobState>>;

const SECONDARY_TYPES: CharacterImageType[] = ['full_body', 'scene', 'reference_sheet'];
const POLL_INTERVAL_MS = 2500;

const REGION_BY_TYPE: Record<CharacterImageType, string> = {
  portrait: 'face',
  full_body: 'body',
  scene: 'style',
  reference_sheet: 'full_character',
};

function mapBackendStatus(status: GenerationJob['status']): AssetJobStatus {
  if (status === 'queued') return 'queued';
  if (status === 'processing') return 'processing';
  if (status === 'completed') return 'completed';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  return 'idle';
}

function debug(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[useCharacterAssetJobs]', ...args);
  }
}

/**
 * Manages background generation of secondary assets (full_body, scene, reference_sheet)
 * for the character editor. Auto-launches missing jobs once and polls active ones.
 *
 * Note: the Django backend processes jobs synchronously — generateEdit often returns
 * status='completed' immediately. In that case the polling effect never fires for that
 * job, so we must handle completion directly inside launchJob.
 */
export function useCharacterAssetJobs(
  projectId: string,
  characterId: string,
  character: StudioCharacter | null | undefined,
  onCompleted?: () => void,
) {
  const [jobs, setJobs] = useState<AssetJobsMap>({});
  const autostartedRef = useRef<Set<string>>(new Set());
  const completionNotifiedRef = useRef<Set<string>>(new Set());

  const updateJob = useCallback((type: CharacterImageType, patch: Partial<AssetJobState>) => {
    setJobs((prev) => ({...prev, [type]: {...(prev[type] || {status: 'idle'}), ...patch}}));
  }, []);

  /**
   * Shared completion handler used by both launchJob (synchronous backend completion)
   * and the polling loop (asynchronous completion).
   */
  const handleJobCompleted = useCallback(
    async (type: CharacterImageType, jobId: string, variants: GenerationJob['variants']) => {
      const completionKey = `${characterId}:${type}:${jobId}`;
      if (completionNotifiedRef.current.has(completionKey)) return;
      completionNotifiedRef.current.add(completionKey);

      debug('job completed', {type, jobId, variantCount: variants?.length ?? 0});

      if (variants?.length) {
        try {
          await characterApi.applyVariant(
            projectId,
            characterId,
            variants[0].variant_id,
            `Автогенерация ${type}`,
            type,
          );
          debug('auto-applied variant', {type, variantId: variants[0].variant_id});
        } catch (e) {
          debug('auto-apply failed', {type, error: e});
        }
      }

      // Always refresh: the backend activates the image during job processing, so the
      // character payload contains the URL even if applyVariant above failed.
      debug('refreshing character after job completion', {type});
      onCompleted?.();
    },
    [characterId, projectId, onCompleted],
  );

  const launchJob = useCallback(
    async (type: CharacterImageType): Promise<string | undefined> => {
      if (!character) return undefined;
      const region = REGION_BY_TYPE[type];
      debug('launching job', {characterId, type, region});
      updateJob(type, {status: 'queued', errorMessage: undefined});
      try {
        const response = await characterApi.generateEdit(projectId, character.character_id, {
          region: region as never,
          image_type: type,
          controls: {},
          preserve: {identity: true},
          variant_count: 1,
          current_image_url: character.images?.portrait?.image_url || null,
          current_asset_id: character.images?.portrait?.asset_id || null,
        } as never);
        const jobId = response.data?.job_id;
        const backendStatus = response.data?.status;
        const frontendStatus: AssetJobStatus =
          backendStatus === 'failed' ? 'failed' : mapBackendStatus(backendStatus) || 'queued';
        debug('job created', {type, jobId, backendStatus, frontendStatus});
        updateJob(type, {jobId, status: frontendStatus, errorMessage: response.data?.error_message});

        // The backend processes jobs synchronously: the response often arrives with
        // status already 'completed'. The polling effect only polls queued/processing
        // jobs, so it would never fire for this job. Handle completion here directly.
        if (frontendStatus === 'completed' && jobId) {
          await handleJobCompleted(type, jobId, response.data?.variants ?? []);
        }

        return jobId;
      } catch (e) {
        debug('job launch failed', {type, error: e});
        updateJob(type, {status: 'failed', errorMessage: 'Не удалось запустить генерацию'});
        return undefined;
      }
    },
    [character, characterId, projectId, updateJob, handleJobCompleted],
  );

  // Auto-launch secondary jobs once, when character is loaded and asset is missing.
  useEffect(() => {
    if (!character || !character.character_id) return;
    SECONDARY_TYPES.forEach((type) => {
      const key = `${character.character_id}:${type}`;
      if (autostartedRef.current.has(key)) return;
      const hasAsset = !!character.images?.[type]?.image_url;
      const currentJob = jobs[type];
      const hasActive = currentJob?.status === 'queued' || currentJob?.status === 'processing';
      if (hasAsset) {
        autostartedRef.current.add(key);
        updateJob(type, {status: 'completed'});
        return;
      }
      if (hasActive) return;
      autostartedRef.current.add(key);
      launchJob(type);
    });
  }, [character, jobs, launchJob, updateJob]);

  // Poll jobs that are still queued or processing (covers async/queued backends).
  useEffect(() => {
    const activeEntries = (Object.entries(jobs) as Array<[CharacterImageType, AssetJobState]>).filter(
      ([, state]) => state.jobId && (state.status === 'queued' || state.status === 'processing'),
    );
    if (activeEntries.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      await Promise.all(
        activeEntries.map(async ([type, state]) => {
          if (!state.jobId || cancelled) return;
          try {
            const response = await characterApi.getJob(state.jobId);
            const job = response.data as GenerationJob;
            if (cancelled) return;
            const nextStatus = mapBackendStatus(job.status);
            debug('poll response', {type, jobId: state.jobId, nextStatus, progress: job.progress});
            updateJob(type, {
              status: nextStatus,
              progress: job.progress,
              errorMessage: job.error_message,
            });
            if (nextStatus === 'completed' && state.jobId) {
              await handleJobCompleted(type, state.jobId, job.variants);
            }
            if (nextStatus === 'failed') {
              debug('job failed', {type, jobId: state.jobId, error: job.error_message});
            }
          } catch (e) {
            debug('poll error', {type, error: e});
          }
        }),
      );
    };

    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobs, handleJobCompleted, updateJob]);

  const retry = useCallback(
    (type: CharacterImageType) => {
      const key = `${characterId}:${type}`;
      autostartedRef.current.delete(key);
      launchJob(type);
    },
    [characterId, launchJob],
  );

  return {jobs, retry, launchJob};
}
