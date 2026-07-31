import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import {characterApi} from '../api/characterApi';
import type {GenerationJob} from '../types/character.types';
import GenerationJobHistory from './GenerationJobHistory';

jest.mock('../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

const processingJob: GenerationJob = {
  job_id: 'job-1',
  status: 'processing',
  progress: 35,
  variants: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: [processingJob]}} as never);
});

test('requests cancellation without presenting the job as already cancelled', async () => {
  mockedApi.requestGenerationJobCancellation.mockResolvedValue({
    data: {...processingJob, status: 'cancellation_requested'},
  } as never);
  mockedApi.listGenerationJobs
    .mockResolvedValueOnce({data: {jobs: [processingJob]}} as never)
    .mockResolvedValue({
      data: {jobs: [{...processingJob, status: 'cancellation_requested'}]},
    } as never);

  render(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={processingJob}
      currentJobId="job-1"
      projectId="project-1"
    />,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Запросить отмену'}));

  await waitFor(() => {
    expect(mockedApi.requestGenerationJobCancellation).toHaveBeenCalledWith('job-1');
    expect(screen.getByText('Отмена запрошена')).toBeInTheDocument();
  });
  expect(screen.queryByText('Отменено')).not.toBeInTheDocument();
  expect(screen.getByText(/результат не будет применён/i)).toBeInTheDocument();
});

test('retries a failed job and reports the new job id', async () => {
  const failedJob: GenerationJob = {...processingJob, status: 'failed', error_message: 'provider error'};
  const onJobStarted = jest.fn();
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: [failedJob]}} as never);
  mockedApi.retryGenerationJob.mockResolvedValue({
    data: {job_id: 'job-2', status: 'queued'},
  } as never);

  render(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={failedJob}
      currentJobId="job-1"
      defaultOpen
      onJobStarted={onJobStarted}
      projectId="project-1"
    />,
  );

  fireEvent.click(await screen.findByRole('button', {name: 'Повторить'}));

  await waitFor(() => expect(onJobStarted).toHaveBeenCalledWith('job-2', failedJob));
});
