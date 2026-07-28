import {useCallback, useEffect, useRef, useState} from 'react';
import {message} from 'antd';
import i18n from '../../../i18n';
import {characterApi} from '../api/characterApi';

const tx = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;
import {
  CharacterReference,
  GenerationJob,
  ReferencesChecklist,
  ReferencesState,
  ReferenceType,
} from '../types/character.types';

const POLL_INTERVAL_MS = 3000;

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
  const [state, setState] = useState<ReferencesState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<Record<string, string | undefined>>({});
  const autoGenerationActive = false;
  const isMountedRef = useRef(true);

  // React 18 StrictMode runs effects twice in dev (mount → cleanup → mount).
  // The earlier "set false on cleanup only" pattern left the ref stuck at
  // `false` after the first cycle, which silently swallowed every setState
  // that happened after an `await` — making the page look frozen even though
  // network requests succeeded. Re-set to true on every mount so the second
  // mount's promises are allowed to commit.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!projectId || !characterId) return;
    try {
      const response = await characterApi.getReferences(projectId, characterId);
      if (!isMountedRef.current) return;
      setState(response.data as ReferencesState);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(readApiError(err, tx('characterStudio.errors.loadReferences')));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [projectId, characterId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);


  // Poll active generation jobs. Once a job hits a terminal state we drop it
  // from `activeJobs` and refresh the board so the new asset shows up without
  // a manual reload.
  useEffect(() => {
    const entries = Object.entries(activeJobs).filter(([, jobId]) => Boolean(jobId)) as [ReferenceType, string][];
    if (entries.length === 0) return;
    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      const completedTypes: ReferenceType[] = [];
      const failedJobs: {referenceType: ReferenceType; reason: string}[] = [];
      await Promise.all(entries.map(async ([referenceType, jobId]) => {
        try {
          const response = await characterApi.getJob(jobId);
          const job: GenerationJob = response.data;
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            if (job.status === 'failed') {
              failedJobs.push({referenceType, reason: job.error_message || 'Ошибка генерации.'});
            }
            completedTypes.push(referenceType);
          }
        } catch {
          // Treat polling errors as transient — leave the job in place.
        }
      }));
      if (cancelled) return;
      if (completedTypes.length > 0) {
        setActiveJobs((prev) => {
          const next = {...prev};
          for (const type of completedTypes) delete next[type];
          return next;
        });
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
  }, [activeJobs, refresh]);

  const startJob = useCallback((referenceType: ReferenceType, jobId: string, status: GenerationJob['status']) => {
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      // Mock provider runs synchronously — the job finished before the
      // request returned. No polling needed; the response already carries
      // the updated board.
      return;
    }
    setActiveJobs((prev) => ({...prev, [referenceType]: jobId}));
  }, []);

  const generate = useCallback(
    async (referenceType: ReferenceType, opts?: {correction_prompt?: string}) => {
      if (!projectId || !characterId) return;
      // Optimistic flip to `generating`. The mock provider returns the final
      // `ready` row in a single response and the network round-trip is
      // already short, so without this the user clicks the button and the
      // preview sits silent for a beat — looks broken. The real response
      // (success or failure) overwrites this row a moment later.
      setState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          references: prev.references.map((row) =>
            row.reference_type === referenceType
              ? {...row, status: 'generating' as const, error_message: ''}
              : row,
          ),
        };
        return next;
      });
      try {
        const response = await characterApi.generateReference(projectId, characterId, {
          reference_type: referenceType,
          correction_prompt: opts?.correction_prompt,
          preserve_identity: true,
        });
        const data = response.data as {job_id: string; status: GenerationJob['status']; references: ReferencesState};
        if (isMountedRef.current && data.references) {
          setState(data.references);
        }
        startJob(referenceType, data.job_id, data.status);
      } catch (err) {
        // Roll back the optimistic generating flag so the user can retry.
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            references: prev.references.map((row) =>
              row.reference_type === referenceType && row.status === 'generating'
                ? {...row, status: 'failed' as const, error_message: readApiError(err, tx('characterStudio.errors.generationLaunchFailed'))}
                : row,
            ),
          };
        });
        message.error(readApiError(err, tx('characterStudio.errors.generationLaunchFailed')));
      }
    },
    [projectId, characterId, startJob],
  );

  const correct = useCallback(
    async (referenceId: string, correctionPrompt: string, referenceType: ReferenceType) => {
      if (!projectId || !characterId) return;
      try {
        const response = await characterApi.correctReference(projectId, characterId, referenceId, {
          correction_prompt: correctionPrompt,
          preserve_identity: true,
        });
        const data = response.data as {job_id: string; status: GenerationJob['status']; references: ReferencesState};
        if (isMountedRef.current && data.references) {
          setState(data.references);
        }
        startJob(referenceType, data.job_id, data.status);
      } catch (err) {
        message.error(readApiError(err, tx('characterStudio.errors.correctionFailed')));
      }
    },
    [projectId, characterId, startJob],
  );

  const upload = useCallback(
    async (referenceType: ReferenceType, file: File) => {
      if (!projectId || !characterId) return null;
      try {
        const response = await characterApi.uploadReference(projectId, characterId, referenceType, file, true);
        await refresh();
        return response.data as CharacterReference;
      } catch (err) {
        message.error(readApiError(err, tx('characterStudio.errors.uploadFailed')));
        return null;
      }
    },
    [projectId, characterId, refresh],
  );

  const makePrimary = useCallback(
    async (referenceId: string) => {
      if (!projectId || !characterId) return;
      try {
        const response = await characterApi.makePrimaryReference(projectId, characterId, referenceId);
        if (isMountedRef.current && response.data) {
          setState(response.data as ReferencesState);
        }
      } catch (err) {
        message.error(readApiError(err, tx('characterStudio.errors.primaryFailed')));
      }
    },
    [projectId, characterId],
  );

  const updateChecklist = useCallback(
    async (patch: Partial<ReferencesChecklist>) => {
      if (!projectId || !characterId) return;
      try {
        await characterApi.updateReferencesChecklist(projectId, characterId, patch);
        await refresh();
      } catch (err) {
        message.error(readApiError(err, tx('characterStudio.errors.checklistSaveFailed')));
      }
    },
    [projectId, characterId, refresh],
  );

  const proceedTo3D = useCallback(async () => {
    if (!projectId || !characterId) return null;
    try {
      const response = await characterApi.proceedReferencesTo3D(projectId, characterId);
      return response.data as {next_url?: string; can_proceed: boolean; blockers?: string[]};
    } catch (err) {
      const blockers = readApiBlockers(err);
      if (blockers) {
        return {can_proceed: false, blockers};
      }
      message.error(readApiError(err, tx('characterStudio.errors.proceedFailed')));
      return null;
    }
  }, [projectId, characterId]);

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
