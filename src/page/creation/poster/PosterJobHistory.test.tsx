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

test('shows cancellation requested while the provider may still be running', async () => {
    const processingJob: postersApi.PosterJob = {id: 9, status: 'processing'};
    mockedApi.listPosterJobs
        .mockResolvedValueOnce({data: {jobs: [processingJob]}} as never)
        .mockResolvedValue({data: {jobs: [{...processingJob, status: 'cancellation_requested'}]}} as never);
    mockedApi.requestPosterJobCancellation.mockResolvedValue({
        data: {...processingJob, status: 'cancellation_requested'},
    } as never);

    render(<PosterJobHistory projectId="42" onVariantReady={jest.fn()} />);

    fireEvent.click(await screen.findByRole('button', {name: 'Запросить отмену'}));

    await waitFor(() => expect(screen.getByText('Отмена запрошена')).toBeInTheDocument());
    expect(screen.getByText(/результат не будет применён/i)).toBeInTheDocument();
});
