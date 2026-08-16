import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import * as postersApi from '../../../api/posters';
import PosterJobHistory from './PosterJobHistory';

jest.mock('../../../api/posters');

const mockedApi = postersApi as jest.Mocked<typeof postersApi>;

beforeEach(() => {
    jest.clearAllMocks();
});

test('restores the preview from the latest completed job detail', async () => {
    const onVariantReady = jest.fn();
    mockedApi.listPosterJobs.mockResolvedValue({
        data: {jobs: [{id: 7, status: 'completed'}]},
    } as never);
    mockedApi.getPosterJob.mockResolvedValue({
        data: {job: {id: 7, status: 'completed'}, variants: [{id: 11, imageUrl: '/poster.png'}]},
    } as never);

    render(<PosterJobHistory projectId="42" onVariantReady={onVariantReady} />);

    await waitFor(() => {
        expect(onVariantReady).toHaveBeenCalledWith({id: 11, imageUrl: '/poster.png'});
    });
});

test('cancels queued work before the provider starts', async () => {
    const queuedJob: postersApi.PosterJob = {id: 9, status: 'queued'};
    mockedApi.listPosterJobs
        .mockResolvedValueOnce({data: {jobs: [queuedJob]}} as never)
        .mockResolvedValue({data: {jobs: [{...queuedJob, status: 'cancelled'}]}} as never);
    mockedApi.requestPosterJobCancellation.mockResolvedValue({
        data: {...queuedJob, status: 'cancelled'},
    } as never);

    render(<PosterJobHistory projectId="42" onVariantReady={jest.fn()} />);

    fireEvent.click(await screen.findByRole('button', {name: 'Отменить генерацию'}));

    await waitFor(() => expect(screen.getByText('Отменено')).toBeInTheDocument());
});

test('does not offer cancellation after poster processing starts', async () => {
    mockedApi.listPosterJobs.mockResolvedValue({
        data: {jobs: [{id: 9, status: 'processing'}]},
    } as never);

    render(<PosterJobHistory projectId="42" onVariantReady={jest.fn()} />);

    expect(await screen.findByText('Генерация уже запущена, отменить её нельзя.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Отменить генерацию'})).not.toBeInTheDocument();
});
