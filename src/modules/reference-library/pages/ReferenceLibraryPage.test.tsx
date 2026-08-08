import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import i18n from '../../../i18n';
import {referenceApi} from '../api/referenceApi';
import ReferenceLibraryPage from './ReferenceLibraryPage';

jest.mock('../api/referenceApi');
jest.mock('../components/ReferenceLibraryShell', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

const mockedApi = referenceApi as jest.Mocked<typeof referenceApi>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getCapabilities.mockResolvedValue({data: {
    categories: [{key: 'prop', label: 'Предмет'}],
    generation: {
      aspectRatios: ['1:1'], canEdit: true, canGenerate: true, configured: true,
      editVariantCounts: [1], effectiveModel: 'mock', generateVariantCounts: [1, 2, 4],
      providerMode: 'mock',
    },
    permissions: {canEdit: true, canRunGeneration: true, canView: true},
    upload: {
      maxBytes: 10_485_760, maxPixels: 20_000_000,
      mimeTypes: ['image/png'], rightsStatementVersion: 'reference-upload-v1',
    },
  }} as never);
  mockedApi.list.mockResolvedValue({data: {
    items: [{
      activeVersion: null,
      category: 'prop',
      categoryLabel: 'Предмет',
      id: 'ref-1',
      status: 'draft',
      tags: ['магический'],
      title: 'Красный медальон',
      updatedAt: '2026-08-07T10:00:00Z',
      usage: {characters: [], sceneCount: 0},
      version: 1,
    }],
    page: 2,
    pageSize: 24,
    total: 25,
  }} as never);
});

test('restores paginated filters from the URL and renders the gallery', async () => {
  render(
    <MemoryRouter initialEntries={['/project/7/references?category=prop&page=2&search=медальон']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Красный медальон')).toBeInTheDocument();
  await waitFor(() => expect(mockedApi.list).toHaveBeenCalledWith(
    '7',
    expect.objectContaining({
      category: 'prop',
      ordering: '-updatedAt',
      page: 2,
      pageSize: 24,
      search: 'медальон',
    }),
    expect.any(AbortSignal),
  ));
  expect(screen.getByRole('button', {
    name: new RegExp(i18n.t('referenceLibrary.actions.create') as string, 'i'),
  })).toBeInTheDocument();
});
