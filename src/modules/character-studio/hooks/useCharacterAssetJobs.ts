import {useCallback, useEffect, useRef, useState} from 'react';
import i18n from '../../../i18n';
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

const POLL_INTERVAL_MS = 2500;

const REGION_BY_TYPE: Record<CharacterImageType, string> = {
  portrait: 'face',
  full_body: 'body',
  scene: 'style',
};

/**
 * Dependent regeneration map. Editing one mode forces regeneration of all
 * downstream modes that derive identity/composition from it. Mirrors the
 * backend EDIT_DEPENDENCIES on CharacterGenerationService — the backend also
 * returns this list under `dependent_image_types` in the edit-variants
 * response, which should be preferred when present.
 */
export const EDIT_DEPENDENCIES: Record<CharacterImageType, CharacterImageType[]> = {
  portrait: ['portrait', 'full_body', 'scene'],
  full_body: ['full_body', 'scene'],
  scene: ['scene'],
};

export function dependentImageTypes(type: CharacterImageType): CharacterImageType[] {
  return EDIT_DEPENDENCIES[type] || [type];
}

function mapBackendStatus(status: GenerationJob['status']): AssetJobStatus {
  if (status === 'queued') return 'queued';
  if (status === 'processing') return 'processing';
  if (status === 'completed') return 'completed';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  return 'idle';
}

/**
 * Manages background generation of secondary assets (full_body, scene)
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
  disabled = false,
) {
  const [jobs, setJobs] = useState<AssetJobsMap>({});
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

      if (variants?.length) {
        try {
          await characterApi.applyVariant(
            projectId,
            characterId,
            variants[0].variant_id,
            `Автогенерация ${type}`,
            type,
          );
        } catch (_) {}
      }

      // Always refresh: the backend activates the image during job processing, so the
      // character payload contains the URL even if applyVariant above failed.
      onCompleted?.();
    },
    [characterId, projectId, onCompleted],
  );

  const launchJob = useCallback(
    async (type: CharacterImageType): Promise<string | undefined> => {
      if (!character) return undefined;
      const region = REGION_BY_TYPE[type];
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
        updateJob(type, {jobId, status: frontendStatus, errorMessage: response.data?.error_message});

        // The backend processes jobs synchronously: the response often arrives with
        // status already 'completed'. The polling effect only polls queued/processing
        // jobs, so it would never fire for this job. Handle completion here directly.
        if (frontendStatus === 'completed' && jobId) {
          await handleJobCompleted(type, jobId, response.data?.variants ?? []);
        }

        return jobId;
      } catch (_) {
        updateJob(type, {status: 'failed', errorMessage: i18n.t('characterStudio.errors.assetGenerationFailed') as string});
        return undefined;
      }
    },
    [character, projectId, updateJob, handleJobCompleted],
  );

  // Poll jobs that are still queued or processing (covers async/queued backends).
  useEffect(() => {
    if (disabled) return;
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
            updateJob(type, {
              status: nextStatus,
              progress: job.progress,
              errorMessage: job.error_message,
            });
            if (nextStatus === 'completed' && state.jobId) {
              await handleJobCompleted(type, state.jobId, job.variants);
            }
          } catch (_) {}
        }),
      );
    };

    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [disabled, jobs, handleJobCompleted, updateJob]);

  const retry = useCallback(
    (type: CharacterImageType) => {
      launchJob(type);
    },
    [launchJob],
  );

  const markPending = useCallback(
    (type: CharacterImageType) => {
      updateJob(type, {status: 'queued', errorMessage: undefined});
    },
    [updateJob],
  );

  const attachJob = useCallback(
    (type: CharacterImageType, jobId: string) => {
      updateJob(type, {jobId, status: 'queued', errorMessage: undefined});
    },
    [updateJob],
  );

  return {jobs, retry, launchJob, markPending, attachJob};
}
