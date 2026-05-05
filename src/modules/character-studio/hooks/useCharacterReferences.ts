import {useCallback, useEffect, useRef, useState} from 'react';
import {message} from 'antd';
import {characterApi} from '../api/characterApi';
import {
  CharacterReference,
  GenerationJob,
  ReferencesChecklist,
  ReferencesState,
  ReferenceType,
} from '../types/character.types';

const POLL_INTERVAL_MS = 3000;

// Required reference views auto-generated on first page open. The
// "side" requirement is satisfied by EITHER profile OR three_quarter, but
// we trigger both so the user gets the richer set automatically. Optional
// types (emotions / poses / outfit_details / character_sheet) stay manual.
export const AUTO_GENERATE_REFERENCE_TYPES: ReferenceType[] = [
  'portrait',
  'full_body',
  'three_quarter',
  'profile',
  'back_view',
];

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
  const [autoGenerationActive, setAutoGenerationActive] = useState(false);
  const isMountedRef = useRef(true);
  // Latches so the auto-generation effect runs at most once per page mount.
  // We also flip the latch BEFORE the network call so a fast re-render
  // between fetch-resolve and state-commit can't trigger a second batch.
  const autoTriggeredRef = useRef(false);
  const characterKeyRef = useRef<string>('');

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
      setError(readApiError(err, 'Не удалось загрузить референсы.'));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [projectId, characterId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Reset the auto-trigger latch when the user navigates between characters.
  // Without this the latch from /characters/A/references would suppress
  // auto-generation on /characters/B/references in the same tab session.
  useEffect(() => {
    const key = `${projectId}:${characterId}`;
    if (characterKeyRef.current !== key) {
      characterKeyRef.current = key;
      autoTriggeredRef.current = false;
    }
  }, [projectId, characterId]);

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
          message.error(`Не удалось обновить «${failed.referenceType}»: ${failed.reason}`);
        }
        await refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobs, refresh]);

  // ---------------------------------------------------------------------
  // Auto-generation: on first page open, trigger missing required refs.
  //
  // Guards (also reinforced server-side by the batch endpoint's
  // idempotency rules):
  //   1. autoTriggeredRef latches so the effect runs at most once per mount.
  //   2. We only fire when at least one REQUIRED type is in `missing`.
  //      Ready / generating / failed required types are NOT re-triggered
  //      (failed needs an explicit "Retry" click — spec section 11).
  //   3. The latch is set BEFORE the network call so a fast re-render
  //      between resolve and commit cannot fire a second batch.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!state || autoTriggeredRef.current) return;
    const missing = AUTO_GENERATE_REFERENCE_TYPES.filter((type) => {
      const row = state.references.find((r) => r.reference_type === type);
      return !row || row.status === 'missing';
    });
    if (missing.length === 0) return;

    autoTriggeredRef.current = true;
    setAutoGenerationActive(true);
    (async () => {
      try {
        const response = await characterApi.generateMissingReferences(projectId, characterId, {
          reference_types: missing,
          only_missing: true,
          preserve_identity: true,
        });
        const data = response.data as {
          created_jobs: {reference_type: ReferenceType; job_id: string}[];
          skipped: {reference_type: ReferenceType; reason: string}[];
          references: ReferencesState;
        };
        if (!isMountedRef.current) return;
        if (data.references) setState(data.references);
        if (data.created_jobs?.length) {
          setActiveJobs((prev) => {
            const next = {...prev};
            for (const job of data.created_jobs) next[job.reference_type] = job.job_id;
            return next;
          });
        } else if (!data.skipped?.length) {
          // Nothing was created AND nothing was skipped — that means the
          // backend accepted the request but did neither. Reset the latch so
          // a manual click on a card can retry; surface the situation so
          // the user isn't stuck staring at a frozen "0 / 4" board.
          autoTriggeredRef.current = false;
          message.warning('Не удалось запустить автоматическую генерацию референсов. Попробуйте сгенерировать вручную.');
        }
      } catch (err) {
        // Real failure (network, auth, validation). Reset the latch so a
        // page revisit retries; show the message regardless of whether the
        // backend included a body.
        autoTriggeredRef.current = false;
        const apiError = readApiError(err, 'Не удалось автоматически запустить генерацию референсов.');
        message.error(apiError);
        // eslint-disable-next-line no-console
        console.error('[references] auto-generation failed', err);
      } finally {
        if (isMountedRef.current) setAutoGenerationActive(false);
      }
    })();
  }, [state, projectId, characterId]);

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
                ? {...row, status: 'failed' as const, error_message: readApiError(err, 'Не удалось запустить генерацию.')}
                : row,
            ),
          };
        });
        message.error(readApiError(err, 'Не удалось запустить генерацию.'));
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
        message.error(readApiError(err, 'Не удалось применить исправление.'));
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
        message.error(readApiError(err, 'Не удалось загрузить файл.'));
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
        message.error(readApiError(err, 'Не удалось пометить как основной.'));
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
        message.error(readApiError(err, 'Не удалось сохранить чеклист.'));
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
      message.error(readApiError(err, 'Не удалось перейти к 3D модели.'));
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
