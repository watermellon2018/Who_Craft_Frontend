import React, {useCallback, useEffect, useRef, useState} from 'react';

import {
    getPosterJob,
    listPosterJobs,
    requestPosterJobCancellation,
    retryPosterJob,
} from '../../../api/posters';
import type {
    PosterJob,
    PosterJobStatus,
    PosterOperationResponse,
    PosterVariant,
} from '../../../api/posters';
import {getApiErrorMessage} from '../../../api/errors';
import {notifyCreditBalanceUpdated} from '../../../modules/credits/api/creditApi';
import GenerationBillingSummary from '../../../modules/credits/components/GenerationBillingSummary';

const POLL_INTERVAL_MS = 3000;

const STATUS_LABELS: Record<PosterJobStatus, string> = {
    queued: 'В очереди',
    processing: 'В работе',
    cancellation_requested: 'Отмена запрошена',
    completed: 'Готово',
    failed: 'Ошибка',
    cancelled: 'Отменено',
};

interface PosterJobHistoryProps {
    onVariantReady: (variant: PosterVariant) => void;
    projectId: number | string;
}

function upsertJob(jobs: PosterJob[], nextJob: PosterJob) {
    return [nextJob, ...jobs.filter((job) => job.id !== nextJob.id)];
}

function jobFromAction(
    payload: PosterJob | PosterOperationResponse,
    fallback: PosterJob,
): PosterJob {
    if ('job' in payload && payload.job) {
        return {...payload.job, variants: payload.variants ?? payload.job.variants};
    }
    if ('id' in payload) return payload;
    return {
        ...fallback,
        id: payload.jobId ?? payload.job_id ?? fallback.id,
        status: payload.status ?? fallback.status,
        variants: payload.variants,
    };
}

export default function PosterJobHistory({onVariantReady, projectId}: PosterJobHistoryProps) {
    const [jobs, setJobs] = useState<PosterJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionJobId, setActionJobId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const previewedJobIds = useRef(new Set<number>());
    const settledCreditJobIds = useRef(new Set<number>());
    const loadSequenceRef = useRef(0);

    const publishLatestVariant = useCallback(async (nextJobs: PosterJob[], alive?: () => boolean) => {
        const unpreviewed = nextJobs.filter((job) => (
            job.status === 'completed' && !previewedJobIds.current.has(job.id)
        ));
        const completed = unpreviewed[0];
        if (!completed) return;
        // Never replay older completed jobs over the newest preview on later polling ticks.
        for (const oldJob of unpreviewed.slice(1)) previewedJobIds.current.add(oldJob.id);
        try {
            const embeddedVariant = completed.variants?.[0];
            const variant = embeddedVariant ?? (await getPosterJob(projectId, completed.id)).data.variants?.[0];
            if (alive && !alive()) return;
            previewedJobIds.current.add(completed.id);
            if (variant) onVariantReady(variant);
        } catch {
            // The list remains useful if a completed job detail is temporarily unavailable.
        }
    }, [onVariantReady, projectId]);

    const load = useCallback(async (alive?: () => boolean) => {
        const sequence = ++loadSequenceRef.current;
        const isStale = () => (
            (alive !== undefined && !alive()) || sequence !== loadSequenceRef.current
        );
        try {
            const response = await listPosterJobs(projectId);
            if (isStale()) return;
            const nextJobs = response.data.jobs ?? [];
            let hasNewSettlement = false;
            nextJobs.forEach((job) => {
                if (
                    ['completed', 'failed', 'cancelled'].includes(job.status)
                    && !settledCreditJobIds.current.has(job.id)
                ) {
                    settledCreditJobIds.current.add(job.id);
                    hasNewSettlement = true;
                }
            });
            if (hasNewSettlement) notifyCreditBalanceUpdated();
            setJobs(nextJobs);
            setError(null);
            await publishLatestVariant(nextJobs, () => !isStale());
        } catch (loadError: unknown) {
            if (isStale()) return;
            setError(getApiErrorMessage(loadError, 'Не удалось загрузить историю генераций'));
        } finally {
            if (!isStale()) setLoading(false);
        }
    }, [projectId, publishLatestVariant]);

    useEffect(() => {
        let alive = true;
        let timer: number | undefined;
        setLoading(true);
        const poll = async () => {
            await load(() => alive);
            if (alive) {
                timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
            }
        };
        void poll();
        return () => {
            loadSequenceRef.current += 1;
            alive = false;
            if (timer !== undefined) window.clearTimeout(timer);
        };
    }, [load]);

    const retry = async (sourceJob: PosterJob) => {
        loadSequenceRef.current += 1;
        setActionJobId(sourceJob.id);
        setError(null);
        try {
            const response = await retryPosterJob(projectId, sourceJob.id);
            loadSequenceRef.current += 1;
            const nextJob = jobFromAction(response.data, sourceJob);
            setJobs((current) => upsertJob(current, nextJob));
            await load();
        } catch (actionError: unknown) {
            loadSequenceRef.current += 1;
            setError(getApiErrorMessage(actionError, 'Не удалось повторить генерацию'));
        } finally {
            setActionJobId(null);
        }
    };

    const requestCancellation = async (sourceJob: PosterJob) => {
        loadSequenceRef.current += 1;
        setActionJobId(sourceJob.id);
        setError(null);
        setJobs((current) => upsertJob(current, {...sourceJob, status: 'cancellation_requested'}));
        try {
            const response = await requestPosterJobCancellation(projectId, sourceJob.id);
            loadSequenceRef.current += 1;
            setJobs((current) => upsertJob(current, jobFromAction(response.data, sourceJob)));
            await load();
        } catch (actionError: unknown) {
            loadSequenceRef.current += 1;
            setJobs((current) => upsertJob(current, sourceJob));
            setError(getApiErrorMessage(actionError, 'Не удалось запросить отмену'));
        } finally {
            setActionJobId(null);
        }
    };

    if (loading && jobs.length === 0) {
        return <p style={{color: '#94A3B8', margin: 0}}>Загружаем историю…</p>;
    }

    return (
        <div style={{display: 'grid', gap: 10}}>
            {error && <p role="alert" style={{color: '#EF4444', fontSize: 12, margin: 0}}>{error}</p>}
            {!loading && jobs.length === 0 && (
                <p style={{color: '#94A3B8', margin: 0}}>Генераций пока нет</p>
            )}
            {jobs.slice(0, 8).map((job) => {
                const busy = actionJobId === job.id;
                return (
                    <div
                        key={job.id}
                        style={{
                            display: 'grid',
                            gap: 8,
                            padding: 10,
                            border: '1px solid rgba(148, 163, 184, 0.18)',
                            borderRadius: 10,
                            background: '#0F172A',
                        }}
                    >
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 8, minWidth: 0}}>
                                <strong style={{color: '#F8FAFC', fontSize: 12}}>
                                    {job.operation === 'edit' ? 'Правка постера' : 'Генерация постера'}
                                </strong>
                                <span style={{color: '#FBBF24', fontSize: 11}}>{STATUS_LABELS[job.status]}</span>
                            </div>
                            <div style={{display: 'flex', gap: 6}}>
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
                        </div>
                        {job.status === 'cancellation_requested' && (
                            <p style={{color: '#94A3B8', fontSize: 11, lineHeight: 1.45, margin: 0}}>
                                Уже начатая генерация может завершиться, но результат не будет применён.
                            </p>
                        )}
                        {job.status === 'failed' && job.errorMessage && (
                            <p style={{color: '#EF4444', fontSize: 11, margin: 0}}>{job.errorMessage}</p>
                        )}
                        <GenerationBillingSummary billing={job.billing} compact />
                    </div>
                );
            })}
        </div>
    );
}
