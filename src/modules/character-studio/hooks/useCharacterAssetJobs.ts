import {useCallback, useEffect, useRef, useState} from 'react';
import i18n from '../../../i18n';
import {characterApi} from '../api/characterApi';
import type {CharacterImageType, GenerationJob, StudioCharacter} from '../types/character.types';

export type AssetJobStatus = 'idle' | 'queued' | 'processing' | 'cancellation_requested' | 'completed' | 'failed';

export interface AssetJobState {
  jobId?: string;
  revisionId?: string;
  status: AssetJobStatus;
  errorMessage?: string;
  progress?: number;
  ownerKey?: string;
}

export type AssetJobsMap = Partial<Record<CharacterImageType, AssetJobState>>;

interface AssetJobsSnapshot {
  jobs: AssetJobsMap;
  ownerKey: string;
}

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
  if (status === 'cancellation_requested') return 'cancellation_requested';
  if (status === 'completed') return 'completed';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  return 'idle';
}

/**
 * Manages background generation of secondary assets (full_body, scene)
 * for the character editor. Jobs only start after an explicit launch and active ones are polled.
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
  const ownerKey = projectId && characterId ? `${projectId}:${characterId}` : '';
  const activeOwnerKeyRef = useRef(ownerKey);
  activeOwnerKeyRef.current = ownerKey;
  const [snapshot, setSnapshot] = useState<AssetJobsSnapshot>({jobs: {}, ownerKey});
  const completionNotifiedRef = useRef<Set<string>>(new Set());
  const jobsRef = useRef<AssetJobsSnapshot>({jobs: {}, ownerKey});

  const jobs = snapshot.ownerKey === ownerKey ? snapshot.jobs : {};
  if (jobsRef.current.ownerKey !== ownerKey) {
    jobsRef.current = {jobs: {}, ownerKey};
  } else {
    jobsRef.current = {jobs, ownerKey};
  }

  useEffect(() => {
    completionNotifiedRef.current = new Set();
    setSnapshot((current) =>
      current.ownerKey === ownerKey ? current : {jobs: {}, ownerKey},
    );
  }, [ownerKey]);

  const updateJob = useCallback(
    (
      type: CharacterImageType,
      patch: Partial<AssetJobState>,
      requestOwnerKey = ownerKey,
    ) => {
      if (activeOwnerKeyRef.current !== requestOwnerKey) return false;
      const currentJobs =
        jobsRef.current.ownerKey === requestOwnerKey ? jobsRef.current.jobs : {};
      const nextJobs = {
        ...currentJobs,
        [type]: {
          ...(currentJobs[type] || {status: 'idle'}),
          ...patch,
          ownerKey: requestOwnerKey,
        },
      };
      jobsRef.current = {jobs: nextJobs, ownerKey: requestOwnerKey};
      setSnapshot({jobs: nextJobs, ownerKey: requestOwnerKey});
      return true;
    },
    [ownerKey],
  );

  /**
   * Shared completion handler used by both launchJob (synchronous backend completion)
   * and the polling loop (asynchronous completion).
   */
  const handleJobCompleted = useCallback(
    async (
      type: CharacterImageType,
      jobId: string,
      variants: GenerationJob['variants'],
      requestOwnerKey: string,
    ) => {
      const currentJob = jobsRef.current.jobs[type];
      if (
        activeOwnerKeyRef.current !== requestOwnerKey ||
        jobsRef.current.ownerKey !== requestOwnerKey ||
        currentJob?.ownerKey !== requestOwnerKey ||
        currentJob.jobId !== jobId
      ) {
        return;
      }

      const completionKey = `${requestOwnerKey}:${type}:${jobId}`;
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
            null,
          );
        } catch (_) {}
      }

      if (
        activeOwnerKeyRef.current !== requestOwnerKey ||
        jobsRef.current.ownerKey !== requestOwnerKey ||
        jobsRef.current.jobs[type]?.jobId !== jobId
      ) {
        return;
      }

      // Always refresh: the backend activates the image during job processing, so the
      // character payload contains the URL even if applyVariant above failed.
      onCompleted?.();
    },
    [characterId, onCompleted, projectId],
  );

  const launchJob = useCallback(
    async (type: CharacterImageType, revisionId: string): Promise<string | undefined> => {
      const requestOwnerKey = ownerKey;
      if (
        !character ||
        character.character_id !== characterId ||
        activeOwnerKeyRef.current !== requestOwnerKey
      ) {
        return undefined;
      }
      const region = REGION_BY_TYPE[type];
      updateJob(type, {revisionId, status: 'queued', errorMessage: undefined}, requestOwnerKey);
      try {
        const response = await characterApi.generateEdit(projectId, character.character_id, {
          region: region as never,
          image_type: type,
          controls: {},
          preserve: {identity: true},
          variant_count: 1,
          current_image_url: character.images?.portrait?.image_url || null,
          current_asset_id: character.images?.portrait?.asset_id || null,
        } as never,
        `${character.character_id}:${type}:${revisionId}`);
        if (activeOwnerKeyRef.current !== requestOwnerKey) return undefined;

        const jobId = response.data?.job_id;
        const backendStatus = response.data?.status;
        const frontendStatus: AssetJobStatus =
          backendStatus === 'failed' ? 'failed' : mapBackendStatus(backendStatus) || 'queued';
        updateJob(
          type,
          {jobId, status: frontendStatus, errorMessage: response.data?.error_message},
          requestOwnerKey,
        );

        // The backend processes jobs synchronously: the response often arrives with
        // status already 'completed'. The polling effect only polls queued/processing
        // jobs, so it would never fire for this job. Handle completion here directly.
        if (frontendStatus === 'completed' && jobId) {
          await handleJobCompleted(type, jobId, response.data?.variants ?? [], requestOwnerKey);
        }

        return activeOwnerKeyRef.current === requestOwnerKey ? jobId : undefined;
      } catch (_) {
        updateJob(
          type,
          {
            status: 'failed',
            errorMessage: i18n.t('characterStudio.errors.assetGenerationFailed') as string,
          },
          requestOwnerKey,
        );
        return undefined;
      }
    },
    [character, characterId, handleJobCompleted, ownerKey, projectId, updateJob],
  );

  // Poll jobs that are still queued or processing (covers async/queued backends).
  // The dependency key changes only when the active job set changes. Progress
  // updates therefore do not tear down and immediately restart the scheduler.
  const activeJobsKey = (Object.entries(jobs) as Array<[CharacterImageType, AssetJobState]>)
    .filter(([, state]) => state.jobId && (state.status === 'queued' || state.status === 'processing'))
    .map(([type, state]) => `${type}:${state.jobId}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (disabled || !activeJobsKey) return;
    const pollingOwnerKey = ownerKey;
    const activeEntries = (Object.entries(jobsRef.current.jobs) as Array<[CharacterImageType, AssetJobState]>).filter(
      ([, state]) =>
        state.ownerKey === pollingOwnerKey &&
        state.jobId &&
        (state.status === 'queued' || state.status === 'processing'),
    );

    let cancelled = false;
    let timeoutId: number | undefined;
    const poll = async () => {
      await Promise.all(
        activeEntries.map(async ([type, state]) => {
          if (!state.jobId || cancelled) return;
          try {
            const response = await characterApi.getJob(state.jobId);
            const job = response.data as GenerationJob;
            if (
              cancelled ||
              activeOwnerKeyRef.current !== pollingOwnerKey ||
              jobsRef.current.ownerKey !== pollingOwnerKey ||
              jobsRef.current.jobs[type]?.jobId !== state.jobId
            ) {
              return;
            }
            const nextStatus = mapBackendStatus(job.status);
            updateJob(type, {
              status: nextStatus,
              progress: job.progress,
              errorMessage: job.error_message,
            }, pollingOwnerKey);
            if (nextStatus === 'completed') {
              await handleJobCompleted(type, state.jobId, job.variants, pollingOwnerKey);
            }
          } catch (_) {}
        }),
      );
      if (!cancelled && activeOwnerKeyRef.current === pollingOwnerKey) {
        timeoutId = window.setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [activeJobsKey, disabled, handleJobCompleted, ownerKey, updateJob]);

  const retry = useCallback(
    async (type: CharacterImageType): Promise<string | undefined> => {
      const requestOwnerKey = ownerKey;
      const currentJob =
        jobsRef.current.ownerKey === requestOwnerKey
          ? jobsRef.current.jobs[type]
          : undefined;
      if (currentJob?.jobId) {
        updateJob(
          type,
          {status: 'queued', progress: 0, errorMessage: undefined},
          requestOwnerKey,
        );
        try {
          const response = await characterApi.retryGenerationJob(currentJob.jobId);
          if (activeOwnerKeyRef.current !== requestOwnerKey) return undefined;
          const retryJobId = response.data.job_id;
          updateJob(
            type,
            {
              jobId: retryJobId,
              status: mapBackendStatus(response.data.status),
              progress: 0,
              errorMessage: undefined,
            },
            requestOwnerKey,
          );
          return retryJobId;
        } catch (_) {
          updateJob(
            type,
            {
              status: 'failed',
              errorMessage: i18n.t('characterStudio.errors.assetGenerationFailed') as string,
            },
            requestOwnerKey,
          );
          return undefined;
        }
      }
      return currentJob?.revisionId
        ? launchJob(type, currentJob.revisionId)
        : undefined;
    },
    [launchJob, ownerKey, updateJob],
  );

  const markPending = useCallback(
    (type: CharacterImageType) => {
      updateJob(type, {status: 'queued', errorMessage: undefined}, ownerKey);
    },
    [ownerKey, updateJob],
  );

  const attachJob = useCallback(
    (type: CharacterImageType, jobId: string) => {
      updateJob(type, {jobId, status: 'queued', errorMessage: undefined}, ownerKey);
    },
    [ownerKey, updateJob],
  );

  return {jobs, retry, launchJob, markPending, attachJob};
}
