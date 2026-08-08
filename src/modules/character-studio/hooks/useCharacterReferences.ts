import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {message} from 'antd';
import i18n from '../../../i18n';
import {characterApi} from '../api/characterApi';
import type {
  CharacterReference,
  GenerationJob,
  ReferencesChecklist,
  ReferencesState,
  ReferenceType,
} from '../types/character.types';

const tx = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;
const POLL_INTERVAL_MS = 3000;

type ActiveJobs = Record<string, string | undefined>;

interface ReferencesSnapshot {
  state: ReferencesState | null;
  loading: boolean;
  error: string | null;
  ownerKey: string;
}

interface ActiveJobsSnapshot {
  jobs: ActiveJobs;
  ownerKey: string;
}

// Pull a user-friendly message off whatever shape axios/server gave us.
// `unknown` instead of `any` keeps eslint happy without losing the
// real-world fact that we can't statically type the rejection value.
function readApiError(err: unknown, fallback: string): string {
  const candidate = err as {response?: {data?: {message?: unknown}}; message?: unknown} | null;
  if (candidate?.response?.data?.message && typeof candidate.response.data.message === 'string') {
    return candidate.response.data.message;
  }
  if (typeof candidate?.message === 'string') return candidate.message;
  return fallback;
}

function readApiBlockers(err: unknown): string[] | null {
  const candidate = err as {response?: {data?: {blockers?: unknown}}} | null;
  const blockers = candidate?.response?.data?.blockers;
  if (Array.isArray(blockers) && blockers.every((item) => typeof item === 'string')) {
    return blockers as string[];
  }
  return null;
}

interface UseCharacterReferencesResult {
  state: ReferencesState | null;
  loading: boolean;
  error: string | null;
  autoGenerationActive: boolean;
  refresh: () => Promise<void>;
  generate: (referenceType: ReferenceType, opts?: {correction_prompt?: string}) => Promise<void>;
  correct: (referenceId: string, correctionPrompt: string, referenceType: ReferenceType) => Promise<void>;
  upload: (referenceType: ReferenceType, file: File) => Promise<CharacterReference | null>;
  makePrimary: (referenceId: string) => Promise<void>;
  updateChecklist: (patch: Partial<ReferencesChecklist>) => Promise<void>;
  proceedTo3D: () => Promise<{next_url?: string; can_proceed: boolean; blockers?: string[]} | null>;
  activeJobs: Record<ReferenceType, string | undefined>;
}

/**
 * Loads the references board, owns generation jobs in flight, and exposes
 * mutation actions. Job polling reuses the same 3 s cadence as the rest of
 * the studio (`useGenerationJob`) but runs inline so we can flip many jobs
 * at once if the user kicks off generation for several reference types.
 */
export function useCharacterReferences(projectId: string | number, characterId: string): UseCharacterReferencesResult {
  const ownerKey = projectId && characterId ? `${projectId}:${characterId}` : '';
  const activeOwnerKeyRef = useRef(ownerKey);
  activeOwnerKeyRef.current = ownerKey;
  const [snapshot, setSnapshot] = useState<ReferencesSnapshot>({
    state: null,
    loading: Boolean(ownerKey),
    error: null,
    ownerKey,
  });
  const [activeJobsSnapshot, setActiveJobsSnapshot] = useState<ActiveJobsSnapshot>({
    jobs: {},
    ownerKey,
  });
  const activeJobsRef = useRef<ActiveJobsSnapshot>({jobs: {}, ownerKey});
  const autoGenerationActive = false;
  const isMountedRef = useRef(true);

  const state = snapshot.ownerKey === ownerKey ? snapshot.state : null;
  const loading = ownerKey
    ? snapshot.ownerKey === ownerKey
      ? snapshot.loading
      : true
    : false;
  const error = snapshot.ownerKey === ownerKey ? snapshot.error : null;
  const activeJobs = useMemo(
    () => activeJobsSnapshot.ownerKey === ownerKey ? activeJobsSnapshot.jobs : {},
    [activeJobsSnapshot, ownerKey],
  );

  if (activeJobsRef.current.ownerKey !== ownerKey) {
    activeJobsRef.current = {jobs: {}, ownerKey};
  } else {
    activeJobsRef.current = {jobs: activeJobs, ownerKey};
  }

  const isCurrentOwner = useCallback(
    (requestOwnerKey: string) =>
      isMountedRef.current && activeOwnerKeyRef.current === requestOwnerKey,
    [],
  );

  const updateActiveJobs = useCallback(
    (updater: (current: ActiveJobs) => ActiveJobs, requestOwnerKey: string) => {
      if (!isCurrentOwner(requestOwnerKey)) return;
      const currentJobs =
        activeJobsRef.current.ownerKey === requestOwnerKey
          ? activeJobsRef.current.jobs
          : {};
      const nextJobs = updater(currentJobs);
      activeJobsRef.current = {jobs: nextJobs, ownerKey: requestOwnerKey};
      setActiveJobsSnapshot({jobs: nextJobs, ownerKey: requestOwnerKey});
    },
    [isCurrentOwner],
  );

  // React 18 StrictMode runs effects twice in dev (mount → cleanup → mount).
  // Re-set to true on every mount so the second mount's promises may commit.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestOwnerKey = ownerKey;
    if (!projectId || !characterId) {
      if (isCurrentOwner(requestOwnerKey)) {
        setSnapshot({state: null, loading: false, error: null, ownerKey: requestOwnerKey});
      }
      return;
    }

    if (isCurrentOwner(requestOwnerKey)) {
      setSnapshot((current) => ({
        state: current.ownerKey === requestOwnerKey ? current.state : null,
        loading: true,
        error: current.ownerKey === requestOwnerKey ? current.error : null,
        ownerKey: requestOwnerKey,
      }));
    }

    try {
      const response = await characterApi.getReferences(projectId, characterId);
      if (!isCurrentOwner(requestOwnerKey)) return;
      setSnapshot({
        state: response.data as ReferencesState,
        loading: false,
        error: null,
        ownerKey: requestOwnerKey,
      });
    } catch (err) {
      if (!isCurrentOwner(requestOwnerKey)) return;
      setSnapshot({
        state: null,
        loading: false,
        error: readApiError(err, tx('characterStudio.errors.loadReferences')),
        ownerKey: requestOwnerKey,
      });
    }
  }, [characterId, isCurrentOwner, ownerKey, projectId]);

  useEffect(() => {
    activeJobsRef.current = {jobs: {}, ownerKey};
    setActiveJobsSnapshot({jobs: {}, ownerKey});
    setSnapshot({state: null, loading: Boolean(ownerKey), error: null, ownerKey});
    void refresh();
  }, [ownerKey, refresh]);

  // Poll active generation jobs. Once a job hits a terminal state we drop it
  // from `activeJobs` and refresh the board so the new asset shows up without
  // a manual reload.
  useEffect(() => {
    const pollingOwnerKey = ownerKey;
    const entries = Object.entries(activeJobs).filter(([, jobId]) => Boolean(jobId)) as [ReferenceType, string][];
    if (entries.length === 0) return;
    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      const completedJobs: Array<{referenceType: ReferenceType; jobId: string}> = [];
      const failedJobs: {referenceType: ReferenceType; reason: string}[] = [];
      await Promise.all(entries.map(async ([referenceType, jobId]) => {
        try {
          const response = await characterApi.getJob(jobId);
          const job: GenerationJob = response.data;
          if (
            cancelled ||
            !isCurrentOwner(pollingOwnerKey) ||
            activeJobsRef.current.ownerKey !== pollingOwnerKey ||
            activeJobsRef.current.jobs[referenceType] !== jobId
          ) {
            return;
          }
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            if (job.status === 'failed') {
              failedJobs.push({referenceType, reason: job.error_message || 'Ошибка генерации.'});
            }
            completedJobs.push({referenceType, jobId});
          }
        } catch {
          // Treat polling errors as transient — leave the job in place.
        }
      }));
      if (cancelled || !isCurrentOwner(pollingOwnerKey)) return;
      if (completedJobs.length > 0) {
        updateActiveJobs((current) => {
          const next = {...current};
          for (const {referenceType, jobId} of completedJobs) {
            if (next[referenceType] === jobId) delete next[referenceType];
          }
          return next;
        }, pollingOwnerKey);
        for (const failed of failedJobs) {
          message.error(tx('characterStudio.errors.referenceFailed', {type: failed.referenceType, reason: failed.reason}));
        }
        await refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobs, isCurrentOwner, ownerKey, refresh, updateActiveJobs]);

  const startJob = useCallback((
    referenceType: ReferenceType,
    jobId: string,
    status: GenerationJob['status'],
    requestOwnerKey: string,
  ) => {
    if (!isCurrentOwner(requestOwnerKey)) return;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      // Mock provider runs synchronously — the response already carries the updated board.
      return;
    }
    updateActiveJobs(
      (current) => ({...current, [referenceType]: jobId}),
      requestOwnerKey,
    );
  }, [isCurrentOwner, updateActiveJobs]);

  const generate = useCallback(
    async (referenceType: ReferenceType, opts?: {correction_prompt?: string}) => {
      const requestOwnerKey = ownerKey;
      if (!projectId || !characterId || !isCurrentOwner(requestOwnerKey)) return;
      // Optimistic flip to `generating`; the real response overwrites it.
      setSnapshot((current) => {
        if (!isCurrentOwner(requestOwnerKey) || current.ownerKey !== requestOwnerKey || !current.state) {
          return current;
        }
        return {
          ...current,
          state: {
            ...current.state,
            references: current.state.references.map((row) =>
              row.reference_type === referenceType
                ? {...row, status: 'generating' as const, error_message: ''}
                : row,
            ),
          },
        };
      });
      try {
        const response = await characterApi.generateReference(projectId, characterId, {
          reference_type: referenceType,
          correction_prompt: opts?.correction_prompt,
          preserve_identity: true,
        });
        if (!isCurrentOwner(requestOwnerKey)) return;
        const data = response.data as {job_id: string; status: GenerationJob['status']; references: ReferencesState};
        if (data.references) {
          setSnapshot({state: data.references, loading: false, error: null, ownerKey: requestOwnerKey});
        }
        startJob(referenceType, data.job_id, data.status, requestOwnerKey);
      } catch (err) {
        if (!isCurrentOwner(requestOwnerKey)) return;
        // Roll back the optimistic generating flag so the user can retry.
        setSnapshot((current) => {
          if (current.ownerKey !== requestOwnerKey || !current.state) return current;
          return {
            ...current,
            state: {
              ...current.state,
              references: current.state.references.map((row) =>
                row.reference_type === referenceType && row.status === 'generating'
                  ? {...row, status: 'failed' as const, error_message: readApiError(err, tx('characterStudio.errors.generationLaunchFailed'))}
                  : row,
              ),
            },
          };
        });
        message.error(readApiError(err, tx('characterStudio.errors.generationLaunchFailed')));
      }
    },
    [characterId, isCurrentOwner, ownerKey, projectId, startJob],
  );

  const correct = useCallback(
    async (referenceId: string, correctionPrompt: string, referenceType: ReferenceType) => {
      const requestOwnerKey = ownerKey;
      if (!projectId || !characterId || !isCurrentOwner(requestOwnerKey)) return;
      try {
        const response = await characterApi.correctReference(projectId, characterId, referenceId, {
          correction_prompt: correctionPrompt,
          preserve_identity: true,
        });
        if (!isCurrentOwner(requestOwnerKey)) return;
        const data = response.data as {job_id: string; status: GenerationJob['status']; references: ReferencesState};
        if (data.references) {
          setSnapshot({state: data.references, loading: false, error: null, ownerKey: requestOwnerKey});
        }
        startJob(referenceType, data.job_id, data.status, requestOwnerKey);
      } catch (err) {
        if (isCurrentOwner(requestOwnerKey)) {
          message.error(readApiError(err, tx('characterStudio.errors.correctionFailed')));
        }
      }
    },
    [characterId, isCurrentOwner, ownerKey, projectId, startJob],
  );

  const upload = useCallback(
    async (referenceType: ReferenceType, file: File) => {
      const requestOwnerKey = ownerKey;
      if (!projectId || !characterId || !isCurrentOwner(requestOwnerKey)) return null;
      try {
        const response = await characterApi.uploadReference(projectId, characterId, referenceType, file, true);
        if (!isCurrentOwner(requestOwnerKey)) return null;
        await refresh();
        return isCurrentOwner(requestOwnerKey)
          ? response.data as CharacterReference
          : null;
      } catch (err) {
        if (isCurrentOwner(requestOwnerKey)) {
          message.error(readApiError(err, tx('characterStudio.errors.uploadFailed')));
        }
        return null;
      }
    },
    [characterId, isCurrentOwner, ownerKey, projectId, refresh],
  );

  const makePrimary = useCallback(
    async (referenceId: string) => {
      const requestOwnerKey = ownerKey;
      if (!projectId || !characterId || !isCurrentOwner(requestOwnerKey)) return;
      try {
        const response = await characterApi.makePrimaryReference(projectId, characterId, referenceId);
        if (isCurrentOwner(requestOwnerKey) && response.data) {
          setSnapshot({
            state: response.data as ReferencesState,
            loading: false,
            error: null,
            ownerKey: requestOwnerKey,
          });
        }
      } catch (err) {
        if (isCurrentOwner(requestOwnerKey)) {
          message.error(readApiError(err, tx('characterStudio.errors.primaryFailed')));
        }
      }
    },
    [characterId, isCurrentOwner, ownerKey, projectId],
  );

  const updateChecklist = useCallback(
    async (patch: Partial<ReferencesChecklist>) => {
      const requestOwnerKey = ownerKey;
      if (!projectId || !characterId || !isCurrentOwner(requestOwnerKey)) return;
      try {
        await characterApi.updateReferencesChecklist(projectId, characterId, patch);
        if (!isCurrentOwner(requestOwnerKey)) return;
        await refresh();
      } catch (err) {
        if (isCurrentOwner(requestOwnerKey)) {
          message.error(readApiError(err, tx('characterStudio.errors.checklistSaveFailed')));
        }
      }
    },
    [characterId, isCurrentOwner, ownerKey, projectId, refresh],
  );

  const proceedTo3D = useCallback(async () => {
    const requestOwnerKey = ownerKey;
    if (!projectId || !characterId || !isCurrentOwner(requestOwnerKey)) return null;
    try {
      const response = await characterApi.proceedReferencesTo3D(projectId, characterId);
      return isCurrentOwner(requestOwnerKey)
        ? response.data as {next_url?: string; can_proceed: boolean; blockers?: string[]}
        : null;
    } catch (err) {
      if (!isCurrentOwner(requestOwnerKey)) return null;
      const blockers = readApiBlockers(err);
      if (blockers) {
        return {can_proceed: false, blockers};
      }
      message.error(readApiError(err, tx('characterStudio.errors.proceedFailed')));
      return null;
    }
  }, [characterId, isCurrentOwner, ownerKey, projectId]);

  return {
    state,
    loading,
    error,
    autoGenerationActive,
    refresh,
    generate,
    correct,
    upload,
    makePrimary,
    updateChecklist,
    proceedTo3D,
    activeJobs: activeJobs as Record<ReferenceType, string | undefined>,
  };
}
