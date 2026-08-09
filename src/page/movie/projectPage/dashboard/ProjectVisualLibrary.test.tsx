import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import {referenceApi} from '../../../../modules/reference-library/api/referenceApi';
import type {ReferenceListItem} from '../../../../modules/reference-library/types';
import ProjectVisualLibrary from './ProjectVisualLibrary';

jest.mock('../../../../modules/reference-library/api/referenceApi');

const mockedReferenceApi = referenceApi as jest.Mocked<typeof referenceApi>;

const readyReference: ReferenceListItem = {
  activeVersion: {
    id: 'version-1',
    imageUrl: '/media/references/market.png',
    number: 2,
    thumbnailUrl: '/media/references/market-thumb.png',
  },
  category: 'location',
  categoryLabel: 'Локация',
  id: 'reference-1',
  status: 'ready',
  tags: ['неон'],
  title: 'Ночной рынок',
  updatedAt: '2026-08-09T10:00:00Z',
  usage: {characters: [], sceneCount: 3},
  version: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedReferenceApi.list.mockResolvedValue({data: {
    items: [readyReference],
    page: 1,
    pageSize: 4,
    total: 1,
  }} as never);
});

it('shows the latest ready images and opens the library or a reference', async () => {
  const onOpenLibrary = jest.fn();
  const onOpenReference = jest.fn();

  render(
    <ProjectVisualLibrary
      projectId="42"
      onOpenLibrary={onOpenLibrary}
      onOpenReference={onOpenReference}
    />,
  );

  expect(await screen.findByText('Ночной рынок')).toBeInTheDocument();
  await waitFor(() => expect(mockedReferenceApi.list).toHaveBeenCalledWith(
    '42',
    {
      ordering: '-updatedAt',
      page: 1,
      pageSize: 4,
      status: 'ready',
    },
    expect.any(AbortSignal),
  ));
  expect(screen.getByRole('img', {name: /Ночной рынок/})).toHaveAttribute(
    'src',
    expect.stringContaining('market-thumb.png'),
  );

  fireEvent.click(screen.getByRole('button', {name: 'Смотреть все'}));
  expect(onOpenLibrary).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', {name: /Открыть опору «Ночной рынок»/}));
  expect(onOpenReference).toHaveBeenCalledWith('reference-1');
});

it('shows a compact empty state when there are no ready images', async () => {
  mockedReferenceApi.list.mockResolvedValue({data: {
    items: [],
    page: 1,
    pageSize: 4,
    total: 0,
  }} as never);

  render(
    <ProjectVisualLibrary
      projectId="42"
      onOpenLibrary={jest.fn()}
      onOpenReference={jest.fn()}
    />,
  );

  expect(await screen.findByText('В библиотеке пока нет готовых изображений')).toBeInTheDocument();
});
