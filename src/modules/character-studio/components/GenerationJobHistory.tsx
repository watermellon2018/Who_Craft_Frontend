import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {getApiErrorMessage} from '../../../api/errors';
import GenerationBillingSummary from '../../credits/components/GenerationBillingSummary';
import {characterApi} from '../api/characterApi';
import {isGenerationJobActive} from '../types/character.types';
import type {GenerationJob} from '../types/character.types';

import './GenerationJobHistory.css';

const HISTORY_POLL_INTERVAL_MS = 3000;

const STATUS_LABELS: Record<GenerationJob['status'], string> = {
  queued: 'В очереди',
  processing: 'В работе',
  cancellation_requested: 'Отмена запрошена',
  completed: 'Готово',
  failed: 'Ошибка',
  cancelled: 'Отменено',
};

const TECHNICAL_ERROR_MARKERS = [
  'command [',
  'traceback',
  'returned non-zero exit status',
  ':\\users\\',
  '/users/',
  '/home/',
  'static\\media\\',
  'static/media/',
] as const;
const GENERATION_FAILURE_MESSAGE = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044e. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.';
const MODEL3D_FAILURE_MESSAGE = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c 3D-\u043c\u043e\u0434\u0435\u043b\u044c. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.';

function publicFailureMessage(job: GenerationJob): string {
  const message = job.error_message?.trim();
  if (job.job_type === 'model3d_reconstruction') {
    return MODEL3D_FAILURE_MESSAGE;
  }
  if (!message) return GENERATION_FAILURE_MESSAGE;
  const normalized = message.toLowerCase();
  if (TECHNICAL_ERROR_MARKERS.some((marker) => normalized.includes(marker))) {
    return GENERATION_FAILURE_MESSAGE;
  }
  return message;
}

interface GenerationJobHistoryProps {
  allowedJobTypes?: readonly string[];
  characterId: string;
  className?: string;
  currentJob?: GenerationJob | null;
  currentJobId?: string | null;
  defaultOpen?: boolean;
  onJobStarted?: (jobId: string, sourceJob: GenerationJob) => void;
  projectId: number | string;
}

function jobFromAction(
  payload: GenerationJob | {job?: GenerationJob; job_id: string; status: GenerationJob['status']},
  fallback: GenerationJob,
): GenerationJob {
  if ('job' in payload && payload.job) return payload.job;
  if ('variants' in payload) return payload;
  return {...fallback, job_id: payload.job_id, status: payload.status, progress: 0, variants: []};
}

function mergeJobs(jobs: GenerationJob[], currentJob?: GenerationJob | null, currentJobId?: string | null) {
  const merged = [...jobs];
  if (currentJob && !merged.some((job) => job.job_id === currentJob.job_id)) {
    merged.unshift(currentJob);
  } else if (currentJobId && !merged.some((job) => job.job_id === currentJobId)) {
    merged.unshift({job_id: currentJobId, status: 'queued', progress: 0, variants: []});
  }
  return merged.sort((left, right) => {
    const leftDate = left.created_at ? Date.parse(left.created_at) : 0;
    const rightDate = right.created_at ? Date.parse(right.created_at) : 0;
    return rightDate - leftDate;
  });
}

function upsertJob(jobs: GenerationJob[], updatedJob: GenerationJob) {
  const remaining = jobs.filter((job) => job.job_id !== updatedJob.job_id);
  return [updatedJob, ...remaining];
}

export default function GenerationJobHistory({
  allowedJobTypes,
  characterId,
  className = '',
  currentJob,
  currentJobId,
  defaultOpen = false,
  onJobStarted,
  projectId,
}: GenerationJobHistoryProps) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);
  const [open, setOpen] = useState(defaultOpen);

  const visibleJobs = useMemo(() => {
    const merged = mergeJobs(jobs, currentJob, currentJobId);
    if (!allowedJobTypes) return merged;
    return merged.filter(
      (job) => !job.job_type || allowedJobTypes.includes(job.job_type),
    );
  }, [allowedJobTypes, currentJob, currentJobId, jobs]);

  const activeCount = visibleJobs.filter((job) => isGenerationJobActive(job.status)).length;
  const load = useCallback(async (alive?: () => boolean) => {
    const sequence = ++loadSequenceRef.current;
    const isStale = () => (
      (alive !== undefined && !alive()) || sequence !== loadSequenceRef.current
    );
    try {
      const response = await characterApi.listGenerationJobs(projectId, characterId);
      if (isStale()) return;
      setJobs(response.data.jobs ?? []);
      setError(null);
    } catch (loadError: unknown) {
      if (isStale()) return;
      setError(getApiErrorMessage(loadError, 'Не удалось загрузить историю генераций'));
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [characterId, projectId]);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    setLoading(true);
    const poll = async () => {
      await load(() => alive);
      if (alive && (open || activeCount > 0)) {
        timer = window.setTimeout(() => void poll(), HISTORY_POLL_INTERVAL_MS);
      }
    };
    void poll();
    return () => {
      loadSequenceRef.current += 1;
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeCount, load, open]);

  const retry = async (sourceJob: GenerationJob) => {
    loadSequenceRef.current += 1;
    setActionJobId(sourceJob.job_id);
    setError(null);
    try {
      const response = await characterApi.retryGenerationJob(sourceJob.job_id);
      loadSequenceRef.current += 1;
      const nextJob = jobFromAction(response.data, sourceJob);
      setJobs((current) => upsertJob(current, nextJob));
      onJobStarted?.(nextJob.job_id, sourceJob);
      await load();
    } catch (actionError: unknown) {
      setError(getApiErrorMessage(actionError, 'Не удалось повторить генерацию'));
      loadSequenceRef.current += 1;
    } finally {
      setActionJobId(null);
    }
  };

  const requestCancellation = async (sourceJob: GenerationJob) => {
    loadSequenceRef.current += 1;
    setActionJobId(sourceJob.job_id);
    setError(null);
    setJobs((current) => upsertJob(current, {...sourceJob, status: 'cancellation_requested'}));
    try {
      const response = await characterApi.requestGenerationJobCancellation(sourceJob.job_id);
      loadSequenceRef.current += 1;
      const updatedJob = jobFromAction(response.data, sourceJob);
      setJobs((current) => upsertJob(current, updatedJob));
      await load();
    } catch (actionError: unknown) {
      loadSequenceRef.current += 1;
      setJobs((current) => upsertJob(current, sourceJob));
      setError(getApiErrorMessage(actionError, 'Не удалось запросить отмену'));
    } finally {
      setActionJobId(null);
    }
  };

  return (
    <section className={`generation-history ${className}`.trim()}>
      <button
        aria-expanded={open}
        className="generation-history__toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>История генераций</span>
        <span className="generation-history__summary">
          {activeCount > 0 ? `Активных: ${activeCount}` : `${visibleJobs.length}`}
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </span>
      </button>
      {open && (
        <div className="generation-history__body">
          {error && <p className="generation-history__error" role="alert">{error}</p>}
          {loading && visibleJobs.length === 0 && <p className="generation-history__empty">Загружаем историю…</p>}
          {!loading && visibleJobs.length === 0 && <p className="generation-history__empty">Генераций пока нет</p>}
          {visibleJobs.slice(0, 8).map((job) => {
            const busy = actionJobId === job.job_id;
            return (
              <div className="generation-history__job" key={job.job_id}>
                <div className="generation-history__job-copy">
                  <span className={`generation-history__status generation-history__status--${job.status}`}>
                    {STATUS_LABELS[job.status]}
                  </span>
                  <span className="generation-history__job-type">
                    {job.job_type === 'model3d_reconstruction' ? '3D-реконструкция' : 'Генерация персонажа'}
                  </span>
                  {job.status === 'processing' && <span>{Math.max(0, Math.min(100, job.progress ?? 0))}%</span>}
                </div>
                <div className="generation-history__actions">
                  {(job.status === 'failed' || job.status === 'cancelled') && (
                    <button disabled={busy} onClick={() => void retry(job)} type="button">
                      {busy ? 'Запускаем…' : 'Повторить'}
                    </button>
                  )}
                  {(job.status === 'queued' || job.status === 'processing') && (
                    <button disabled={busy} onClick={() => void requestCancellation(job)} type="button">
                      {busy ? 'Запрашиваем…' : 'Запросить отмену'}
                    </button>
                  )}
                </div>
                {job.status === 'cancellation_requested' && (
                  <p className="generation-history__notice">
                    Уже начатая генерация может завершиться, но результат не будет применён.
                  </p>
                )}
                {job.status === 'failed' && (
                  <p className="generation-history__notice generation-history__notice--error">{publicFailureMessage(job)}</p>
                )}
                <GenerationBillingSummary billing={job.billing} compact />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
