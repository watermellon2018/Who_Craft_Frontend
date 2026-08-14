import React from 'react';
import {Alert, Button, Progress, Result, Space, Spin} from 'antd';
import {useTranslation} from 'react-i18next';

import {musicJobErrorMessage} from '../errors';
import type {MusicGenerationJob} from '../types';
import GenerationBillingSummary from '../../credits/components/GenerationBillingSummary';

interface MusicJobStateProps {
  actionLoading?: boolean;
  canMutate: boolean;
  job: MusicGenerationJob;
  onCancel: () => void;
  onRetry: () => void;
}

export default function MusicJobState({
  actionLoading = false,
  canMutate,
  job,
  onCancel,
  onRetry,
}: MusicJobStateProps) {
  const {t} = useTranslation();

  if (job.status === 'failed') {
    return (
      <>
        <Result
          status="error"
          title={job.error?.retryable
            ? t('musicStudio.job.failed')
            : t('musicStudio.job.checkBrief')}
          subTitle={musicJobErrorMessage(job.error?.code)}
          extra={canMutate && job.canRetry ? (
            <Button type="primary" loading={actionLoading} onClick={onRetry}>
              {t('musicStudio.job.retry')}
            </Button>
          ) : undefined}
        />
        <GenerationBillingSummary billing={job.billing} />
      </>
    );
  }

  if (job.status === 'cancelled') {
    return (
      <>
        <Result
          status="info"
          title={t('musicStudio.job.cancelled')}
          extra={canMutate && job.canRetry ? (
            <Button type="primary" loading={actionLoading} onClick={onRetry}>
              {t('musicStudio.job.retry')}
            </Button>
          ) : undefined}
        />
        <GenerationBillingSummary billing={job.billing} />
      </>
    );
  }

  if (job.status === 'completed') {
    return (
      <>
        <Alert
          showIcon
          type="success"
          message={t('musicStudio.job.completed')}
          description={t('musicStudio.job.completedDescription', {count: job.variants.length})}
        />
        <GenerationBillingSummary billing={job.billing} />
      </>
    );
  }

  const cancellationRequested = job.status === 'cancellation_requested';
  return (
    <section className="music-job-progress" aria-live="polite">
      <Spin />
      <div>
        <h2>{cancellationRequested
          ? t('musicStudio.job.cancelling')
          : job.status === 'queued'
            ? t('musicStudio.job.queued')
            : t('musicStudio.job.processing', {count: job.variantCount})}</h2>
        <p>{t(`musicStudio.job.stage.${job.stage}`, {defaultValue: t('musicStudio.job.working')})}</p>
        <Progress percent={job.status === 'queued' ? 10 : 55} showInfo={false} status="active" />
        <GenerationBillingSummary billing={job.billing} />
        {!cancellationRequested && canMutate && job.canCancel && (
          <Space>
            <Button danger loading={actionLoading} onClick={onCancel}>
              {t('musicStudio.job.cancel')}
            </Button>
          </Space>
        )}
      </div>
    </section>
  );
}
