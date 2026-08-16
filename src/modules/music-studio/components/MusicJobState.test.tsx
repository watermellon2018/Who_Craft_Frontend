import React from 'react';
import {render, screen} from '@testing-library/react';

import i18n from '../../../i18n';
import type {MusicBrief, MusicGenerationJob} from '../types';
import MusicJobState from './MusicJobState';

const brief: MusicBrief = {
  content: {mode: 'instrumental'},
  context: {type: 'project'},
  durationSeconds: 30,
  energyCurve: 'steady',
  exclude: [],
  genre: 'cinematic',
  instruments: [],
  loopable: false,
  moods: ['hopeful'],
  purpose: 'underscore',
  tempo: {mode: 'auto'},
  textRefinement: '',
  title: 'Theme',
};

const job: MusicGenerationJob = {
  attempts: 1,
  brief,
  canCancel: true,
  canRetry: true,
  completedAt: null,
  createdAt: '2026-08-02T08:00:00Z',
  error: null,
  jobId: 'job-1',
  permissions: {canEdit: true, canRunGeneration: true},
  referenceAsset: null,
  retryOf: null,
  stage: 'generating',
  status: 'processing',
  targetTrackId: null,
  variantCount: 2,
  variants: [],
};

const renderJob = (currentJob: MusicGenerationJob, canMutate: boolean) => render(
  <MusicJobState
    canMutate={canMutate}
    job={currentJob}
    onCancel={jest.fn()}
    onRetry={jest.fn()}
  />,
);

test('hides cancellation from viewers even when the job is cancellable', () => {
  renderJob(job, false);

  expect(screen.queryByRole('button', {
    name: i18n.t('musicStudio.job.cancel'),
  })).not.toBeInTheDocument();
});

test.each(['failed', 'cancelled'] as const)(
  'hides retry from viewers for a retryable %s job',
  (status) => {
    renderJob({
      ...job,
      error: status === 'failed'
        ? {code: 'MUSIC_PROVIDER_TIMEOUT', detail: 'Timed out', retryable: true}
        : null,
      status,
    }, false);

    expect(screen.queryByRole('button', {
      name: i18n.t('musicStudio.job.retry'),
    })).not.toBeInTheDocument();
  },
);

test('keeps available mutation actions visible to editors', () => {
  const queuedJob: MusicGenerationJob = {...job, stage: 'queued', status: 'queued'};
  const {rerender} = renderJob(queuedJob, true);
  expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.job.cancel'),
  })).toBeInTheDocument();

  rerender(
    <MusicJobState
      canMutate
      job={{
        ...job,
        error: {code: 'MUSIC_PROVIDER_TIMEOUT', detail: 'Timed out', retryable: true},
        status: 'failed',
      }}
      onCancel={jest.fn()}
      onRetry={jest.fn()}
    />,
  );
  expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.job.retry'),
  })).toBeInTheDocument();
});

test('hides cancellation after processing starts', () => {
  renderJob(job, true);

  expect(screen.queryByRole('button', {
    name: i18n.t('musicStudio.job.cancel'),
  })).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('musicStudio.job.cancelUnavailable'))).toBeInTheDocument();
});
