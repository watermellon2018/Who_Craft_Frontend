import {render, screen} from '@testing-library/react';
import React from 'react';

import i18n from '../../../i18n';
import type {ReferenceGenerationJob} from '../types';
import ReferenceJobState from './ReferenceJobState';

const job: ReferenceGenerationJob = {
  attempts: 1,
  canCancel: true,
  canRetry: false,
  completedAt: null,
  createdAt: '2026-08-16T08:00:00Z',
  error: null,
  id: 'job-1',
  operation: 'generate',
  progress: 30,
  referenceId: 'reference-1',
  stage: 'generating',
  status: 'processing',
  variantCount: 1,
  variants: [],
};

test('hides cancellation after reference processing starts', () => {
  render(
    <ReferenceJobState
      job={job}
      onCancel={jest.fn()}
      onRetry={jest.fn()}
    />,
  );

  expect(screen.queryByRole('button', {
    name: new RegExp(i18n.t('referenceLibrary.job.cancel')),
  })).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('referenceLibrary.job.cancelUnavailable'))).toBeInTheDocument();
});

test('keeps cancellation available while a reference is queued', () => {
  render(
    <ReferenceJobState
      job={{...job, progress: 0, stage: 'queued', status: 'queued'}}
      onCancel={jest.fn()}
      onRetry={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', {
    name: new RegExp(i18n.t('referenceLibrary.job.cancel')),
  })).toBeInTheDocument();
});
