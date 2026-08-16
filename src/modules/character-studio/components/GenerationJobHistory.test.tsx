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
const queuedJob: GenerationJob = {...processingJob, status: 'queued', progress: 0};

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: [processingJob]}} as never);
});

test('cancels a queued job immediately', async () => {
  mockedApi.requestGenerationJobCancellation.mockResolvedValue({
    data: {...queuedJob, status: 'cancelled'},
  } as never);
  mockedApi.listGenerationJobs
    .mockResolvedValueOnce({data: {jobs: [queuedJob]}} as never)
    .mockResolvedValue({
      data: {jobs: [{...queuedJob, status: 'cancelled'}]},
    } as never);

  render(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={queuedJob}
      currentJobId="job-1"
      projectId="project-1"
    />,
  );

  fireEvent.click(await screen.findByRole('button', {expanded: false}));
  fireEvent.click(await screen.findByRole('button', {name: 'Отменить генерацию'}));

  await waitFor(() => {
    expect(mockedApi.requestGenerationJobCancellation).toHaveBeenCalledWith('job-1');
    expect(screen.getByText('Отменено')).toBeInTheDocument();
  });
  expect(screen.queryByText('Отмена запрошена')).not.toBeInTheDocument();
});

test('does not offer cancellation after processing starts', async () => {
  render(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={processingJob}
      currentJobId="job-1"
      defaultOpen
      projectId="project-1"
    />,
  );

  expect(await screen.findByText('Генерация уже запущена, отменить её нельзя.')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Отменить генерацию'})).not.toBeInTheDocument();
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

test('keeps manually closed history closed while an active job updates', async () => {
  const view = render(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={processingJob}
      currentJobId="job-1"
      projectId="project-1"
    />,
  );
  const toggle = await screen.findByRole('button', {expanded: false});

  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  view.rerender(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={{...processingJob, progress: 60}}
      currentJobId="job-1"
      projectId="project-1"
    />,
  );

  await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

test('replaces technical reconstruction logs with a safe message', async () => {
  const failedJob: GenerationJob = {
    ...processingJob,
    job_type: 'model3d_reconstruction',
    status: 'failed',
    error_message: "Command ['C:\\Users\\stepa\\conda.exe'] returned non-zero exit status 1.",
  };
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: [failedJob]}} as never);

  render(
    <GenerationJobHistory
      characterId="char-1"
      currentJob={failedJob}
      currentJobId="job-1"
      defaultOpen
      projectId="project-1"
    />,
  );

  expect(await screen.findByText(
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c 3D-\u043c\u043e\u0434\u0435\u043b\u044c. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.',
  )).toBeInTheDocument();
  expect(screen.queryByText(/conda\.exe/i)).not.toBeInTheDocument();
});
