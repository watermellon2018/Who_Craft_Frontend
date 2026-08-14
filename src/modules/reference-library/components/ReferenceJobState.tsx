import React from 'react';
import {Button, Progress, Result, Tag} from 'antd';
import {CloseOutlined, ReloadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {referenceJobErrorMessage} from '../errors';
import type {ReferenceGenerationJob} from '../types';
import GenerationBillingSummary from '../../credits/components/GenerationBillingSummary';

interface ReferenceJobStateProps {
  actionLoading?: boolean;
  job: ReferenceGenerationJob;
  onCancel: () => void;
  onRetry: () => void;
}

export default function ReferenceJobState({
  actionLoading = false,
  job,
  onCancel,
  onRetry,
}: ReferenceJobStateProps) {
  const {t} = useTranslation();
  const terminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
  if (job.status === 'failed') {
    return (
      <>
        <Result
          status="error"
          title={t('referenceLibrary.job.failed')}
          subTitle={referenceJobErrorMessage(job.error?.code)}
          extra={job.canRetry ? (
            <Button icon={<ReloadOutlined />} loading={actionLoading} onClick={onRetry}>
              {t('referenceLibrary.job.retry')}
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
        <Result status="warning" title={t('referenceLibrary.job.cancelled')} />
        <GenerationBillingSummary billing={job.billing} />
      </>
    );
  }
  return (
    <section className="reference-card-panel reference-job-state" aria-live="polite">
      <div className="reference-section-heading">
        <div>
          <span className="reference-eyebrow">{t('referenceLibrary.job.title')}</span>
          <h2>{t(`referenceLibrary.job.status.${job.status}`)}</h2>
          <p>{terminal ? t('referenceLibrary.job.completedHelper') : t('referenceLibrary.job.working')}</p>
        </div>
        <Tag color={terminal ? 'success' : 'processing'}>{t(`referenceLibrary.job.stage.${job.stage}`)}</Tag>
      </div>
      <Progress percent={Math.max(0, Math.min(100, job.progress))} status={terminal ? 'success' : 'active'} />
      <GenerationBillingSummary billing={job.billing} />
      {job.canCancel && (
        <Button danger icon={<CloseOutlined />} loading={actionLoading} onClick={onCancel}>
          {t('referenceLibrary.job.cancel')}
        </Button>
      )}
    </section>
  );
}
