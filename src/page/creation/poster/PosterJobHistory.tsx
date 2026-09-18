import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

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
import {notifyCreditBalanceUpdated} from '../../../modules/credits/api/creditApi';
import GenerationBillingSummary from '../../../modules/credits/components/GenerationBillingSummary';
import {
    getPosterErrorTranslationKey,
    getPosterJobErrorTranslationKey,
} from './errorLocalization';

const POLL_INTERVAL_MS = 3000;

const STATUS_LABEL_KEYS: Record<PosterJobStatus, string> = {
    queued: 'poster.history.status.queued',
    processing: 'poster.history.status.processing',
    cancellation_requested: 'poster.history.status.cancellationRequested',
    completed: 'poster.history.status.completed',
    failed: 'poster.history.status.failed',
    cancelled: 'poster.history.status.cancelled',
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
    const {t} = useTranslation();
    const [jobs, setJobs] = useState<PosterJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionJobId, setActionJobId] = useState<number | null>(null);
    const [errorKey, setErrorKey] = useState<string | null>(null);
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
            setErrorKey(null);
            await publishLatestVariant(nextJobs, () => !isStale());
        } catch (loadError: unknown) {
            if (isStale()) return;
            setErrorKey(getPosterErrorTranslationKey(loadError, 'poster.history.errors.load'));
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
        setErrorKey(null);
        try {
            const response = await retryPosterJob(projectId, sourceJob.id);
            loadSequenceRef.current += 1;
            const nextJob = jobFromAction(response.data, sourceJob);
            setJobs((current) => upsertJob(current, nextJob));
            await load();
        } catch (actionError: unknown) {
            loadSequenceRef.current += 1;
            setErrorKey(getPosterErrorTranslationKey(actionError, 'poster.history.errors.retry'));
        } finally {
            setActionJobId(null);
        }
    };

    const requestCancellation = async (sourceJob: PosterJob) => {
        loadSequenceRef.current += 1;
        setActionJobId(sourceJob.id);
        setErrorKey(null);
        try {
            const response = await requestPosterJobCancellation(projectId, sourceJob.id);
            loadSequenceRef.current += 1;
            setJobs((current) => upsertJob(current, jobFromAction(response.data, sourceJob)));
            await load();
        } catch (actionError: unknown) {
            loadSequenceRef.current += 1;
            setJobs((current) => upsertJob(current, sourceJob));
            setErrorKey(getPosterErrorTranslationKey(actionError, 'poster.history.errors.cancel'));
        } finally {
            setActionJobId(null);
        }
    };

    if (loading && jobs.length === 0) {
        return <p style={{color: '#94A3B8', margin: 0}}>{t('poster.history.loading')}</p>;
    }

    return (
        <div style={{display: 'grid', gap: 10}}>
            {errorKey && <p role="alert" style={{color: '#EF4444', fontSize: 12, margin: 0}}>{t(errorKey)}</p>}
            {!loading && jobs.length === 0 && (
                <p style={{color: '#94A3B8', margin: 0}}>{t('poster.history.empty')}</p>
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
                                    {t(job.operation === 'edit'
                                        ? 'poster.history.operation.edit'
                                        : 'poster.history.operation.generate')}
                                </strong>
                                <span style={{color: '#FBBF24', fontSize: 11}}>{t(STATUS_LABEL_KEYS[job.status])}</span>
                            </div>
                            <div style={{display: 'flex', gap: 6}}>
                                {(job.status === 'failed' || job.status === 'cancelled') && (
                                    <button disabled={busy} onClick={() => void retry(job)} type="button">
                                        {t(busy ? 'poster.history.retrying' : 'common.retry')}
                                    </button>
                                )}
                                {job.status === 'queued' && (
                                    <button disabled={busy} onClick={() => void requestCancellation(job)} type="button">
                                        {t(busy ? 'poster.history.cancelling' : 'poster.history.cancel')}
                                    </button>
                                )}
                            </div>
                        </div>
                        {job.status === 'processing' && (
                            <p style={{color: '#94A3B8', fontSize: 11, lineHeight: 1.45, margin: 0}}>
                                {t('poster.history.processingHint')}
                            </p>
                        )}
                        {job.status === 'cancellation_requested' && (
                            <p style={{color: '#94A3B8', fontSize: 11, lineHeight: 1.45, margin: 0}}>
                                {t('poster.history.cancellationHint')}
                            </p>
                        )}
                        {job.status === 'failed' && (job.errorCode || job.errorMessage) && (
                            <p style={{color: '#EF4444', fontSize: 11, margin: 0}}>
                                {t(getPosterJobErrorTranslationKey(job.errorCode))}
                            </p>
                        )}
                        <GenerationBillingSummary billing={job.billing} compact />
                    </div>
                );
            })}
        </div>
    );
}
