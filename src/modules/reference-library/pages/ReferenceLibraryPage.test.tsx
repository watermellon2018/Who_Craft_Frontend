import React, {useLayoutEffect} from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {message} from 'antd';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import i18n from '../../../i18n';
import {referenceApi} from '../api/referenceApi';
import type {ReferenceListItem} from '../types';
import ReferenceLibraryPage from './ReferenceLibraryPage';

jest.mock('../api/referenceApi');
jest.mock('../components/ReferenceLibraryShell', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

const mockedApi = referenceApi as jest.Mocked<typeof referenceApi>;
const translation = (key: string) => i18n.t(key) as string;
type ListApiResponse = Awaited<ReturnType<typeof referenceApi.list>>;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {promise, resolve};
}

function LocationCommitObserver({onCommit}: {onCommit: (search: string) => void}) {
  const {search} = useLocation();
  useLayoutEffect(() => onCommit(search), [onCommit, search]);
  return null;
}

const referenceItem = (overrides: Partial<ReferenceListItem> = {}): ReferenceListItem => ({
  activeVersion: {
    id: 'version-1',
    imageUrl: '/media/medallion.png',
    number: 1,
    thumbnailUrl: '/media/medallion-thumb.png',
  },
  category: 'prop',
  categoryLabel: 'Предмет',
  id: 'ref-1',
  status: 'draft',
  tags: ['магический'],
  title: 'Красный медальон',
  updatedAt: '2026-08-07T10:00:00Z',
  usage: {characters: [], sceneCount: 6},
  version: 1,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(message, 'error').mockImplementation(() => undefined as never);
  jest.spyOn(message, 'success').mockImplementation(() => undefined as never);
  mockedApi.archive.mockResolvedValue({data: {}} as never);
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
    items: [referenceItem()],
    page: 2,
    pageSize: 24,
    total: 25,
  }} as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('restores paginated filters from the URL and renders the compact gallery', async () => {
  const {container} = render(
    <MemoryRouter initialEntries={['/project/7/references?category=prop&page=2&search=медальон']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Красный медальон')).toBeInTheDocument();
  await waitFor(() => expect(mockedApi.list).toHaveBeenCalledWith(
    '7',
    {
      category: 'prop',
      page: 2,
      pageSize: 24,
      search: 'медальон',
    },
    expect.any(AbortSignal),
  ));
  const categorySelect = screen.getByRole('combobox', {
    name: translation('referenceLibrary.filters.categories'),
  });
  const searchInput = screen.getByPlaceholderText(translation('referenceLibrary.filters.search'));
  expect(categorySelect).toBeInTheDocument();
  expect(categorySelect.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const backButton = screen.getByRole('button', {name: translation('common.back')});
  expect(backButton).toBeInTheDocument();
  expect(screen.queryByText(translation('referenceLibrary.eyebrow'))).not.toBeInTheDocument();
  expect(screen.queryByText('6 сцен')).not.toBeInTheDocument();
  expect(screen.queryByText('Черновик')).not.toBeInTheDocument();
  expect(screen.queryByText('магический')).not.toBeInTheDocument();
  expect(screen.getByText('Красный медальон')).toHaveAttribute('title', 'Красный медальон');
  expect(screen.getByText('v1')).toBeInTheDocument();
  const createButtons = screen.getAllByRole('button', {
    name: new RegExp(translation('referenceLibrary.actions.create'), 'i'),
  });
  expect(createButtons).toHaveLength(1);
  expect(backButton).toHaveClass('craft-action-button', 'craft-action-button--secondary');
  expect(backButton).not.toHaveClass('ant-btn-text');
  expect(createButtons[0]).toHaveClass('craft-action-button');
  expect(createButtons[0]).toHaveClass('ant-btn-primary');
  expect(createButtons[0].parentElement).toBe(backButton.parentElement);
  expect(container.querySelector('.reference-create-card')).not.toBeInTheDocument();
  expect(container.querySelector('.ant-pagination')).toBeInTheDocument();
});

test('opens a reference card directly in the editor', async () => {
  render(
    <MemoryRouter initialEntries={['/project/7/references']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
        <Route
          path="/project/:projectId/references/:referenceId/edit"
          element={<output data-testid="editor-route">editor</output>}
        />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Красный медальон');
  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('referenceLibrary.card.open', {title: 'Красный медальон'}) as string,
  }));

  expect(await screen.findByTestId('editor-route')).toBeInTheDocument();
});

test('combines search with the selected category and resets pagination', async () => {
  mockedApi.list.mockImplementation(async (_projectId, params) => ({data: {
    items: params.category === 'vehicle'
      ? [
        referenceItem({title: 'Авто-медальон'}),
        referenceItem({category: 'vehicle', categoryLabel: 'Транспорт', id: 'ref-2', title: 'Ретро-автомобиль'}),
      ]
      : [referenceItem({title: 'Авто-медальон'})],
    page: 1,
    pageSize: 24,
    total: params.category === 'vehicle' ? 2 : 1,
  }} as never));

  render(
    <MemoryRouter initialEntries={['/project/7/references?page=2&search=авто']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Авто-медальон')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('combobox', {
    name: translation('referenceLibrary.filters.categories'),
  }));
  fireEvent.click(await screen.findByText(translation('referenceLibrary.category.vehicle')));

  expect(await screen.findByText('Ретро-автомобиль')).toBeInTheDocument();
  expect(screen.queryByText('Авто-медальон')).not.toBeInTheDocument();
  await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith(
    '7',
    expect.objectContaining({category: 'vehicle', page: 1, search: 'авто'}),
    expect.any(AbortSignal),
  ));
  expect(mockedApi.list).not.toHaveBeenCalledWith(
    '7',
    expect.objectContaining({category: 'vehicle', page: 2}),
    expect.any(AbortSignal),
  );
});

test('hides stale cards immediately and ignores stale category responses', async () => {
  const vehicleRequest = deferred<ListApiResponse>();
  const locationRequest = deferred<ListApiResponse>();
  const irrelevantCardsAtFilteredCommit: string[] = [];
  const captureFilteredCommit = (locationSearch: string) => {
    const selectedCategory = new URLSearchParams(locationSearch).get('category');
    const irrelevantTitles = selectedCategory === 'vehicle'
      ? ['Красный медальон', 'Старый город']
      : ['Красный медальон'];
    for (const title of irrelevantTitles) {
      if (document.body.textContent?.includes(title)) irrelevantCardsAtFilteredCommit.push(title);
    }
  };
  mockedApi.list.mockImplementation(async (_projectId, params) => {
    if (params.category === 'vehicle') return vehicleRequest.promise;
    if (params.category === 'location') return locationRequest.promise;
    return {data: {
      items: [
        referenceItem(),
        referenceItem({category: 'location', id: 'ref-2', title: 'Старый город'}),
      ],
      page: 1,
      pageSize: 24,
      total: 2,
    }} as ListApiResponse;
  });

  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={['/project/7/references']}>
        <LocationCommitObserver onCommit={captureFilteredCommit} />
        <Routes>
          <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );

  expect(await screen.findByText('Красный медальон')).toBeInTheDocument();
  expect(screen.getByText('Старый город')).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole('combobox', {
    name: translation('referenceLibrary.filters.categories'),
  }));
  fireEvent.click(await screen.findByText(translation('referenceLibrary.category.vehicle')));

  expect(screen.queryByText('Красный медальон')).not.toBeInTheDocument();
  expect(screen.queryByText('Старый город')).not.toBeInTheDocument();
  expect(screen.getByText(translation('referenceLibrary.empty.filtered'))).toBeInTheDocument();
  expect(screen.queryByLabelText(translation('referenceLibrary.loading'))).not.toBeInTheDocument();
  expect(irrelevantCardsAtFilteredCommit).toEqual([]);

  fireEvent.mouseDown(screen.getByRole('combobox', {
    name: translation('referenceLibrary.filters.categories'),
  }));
  fireEvent.click(await screen.findByText(translation('referenceLibrary.category.location')));

  expect(screen.getByText('Старый город')).toBeInTheDocument();
  expect(screen.queryByText('Красный медальон')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(translation('referenceLibrary.loading'))).not.toBeInTheDocument();
  expect(irrelevantCardsAtFilteredCommit).toEqual([]);

  await act(async () => {
    locationRequest.resolve({data: {
      items: [referenceItem({category: 'location', id: 'ref-4', title: 'Новый город'})],
      page: 1,
      pageSize: 24,
      total: 1,
    }} as ListApiResponse);
    await locationRequest.promise;
  });

  expect(await screen.findByText('Новый город')).toBeInTheDocument();

  await act(async () => {
    vehicleRequest.resolve({data: {
      items: [referenceItem({category: 'vehicle', id: 'ref-3', title: 'Ретро-автомобиль'})],
      page: 1,
      pageSize: 24,
      total: 1,
    }} as ListApiResponse);
    await vehicleRequest.promise;
  });

  expect(screen.getByText('Новый город')).toBeInTheDocument();
  expect(screen.queryByText('Ретро-автомобиль')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(translation('referenceLibrary.loading'))).not.toBeInTheDocument();
});

test('shows all category options and clears the category filter', async () => {
  render(
    <MemoryRouter initialEntries={['/project/7/references?category=prop']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Красный медальон');
  fireEvent.mouseDown(screen.getByRole('combobox', {
    name: translation('referenceLibrary.filters.categories'),
  }));

  for (const key of ['location', 'prop', 'wardrobe', 'vehicle', 'symbol', 'other']) {
    expect((await screen.findAllByText(
      translation(`referenceLibrary.category.${key}`),
    )).length).toBeGreaterThan(0);
  }

  fireEvent.click(screen.getByText(translation('referenceLibrary.filters.all')));
  await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith(
    '7',
    expect.objectContaining({category: undefined, page: 1}),
    expect.any(AbortSignal),
  ));
  await waitFor(() => expect(screen.queryByLabelText(
    translation('referenceLibrary.loading'),
  )).not.toBeInTheDocument());
});

test('hides pagination when all filtered results fit on one page', async () => {
  mockedApi.list.mockResolvedValue({data: {
    items: [referenceItem()],
    page: 1,
    pageSize: 24,
    total: 24,
  }} as never);

  const {container} = render(
    <MemoryRouter initialEntries={['/project/7/references?category=prop']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Красный медальон');
  expect(container.querySelector('.ant-pagination')).not.toBeInTheDocument();
});

test('deletes a reference only after confirmation', async () => {
  mockedApi.list.mockImplementation(async () => ({data: mockedApi.archive.mock.calls.length > 0
    ? {
      items: [referenceItem({id: 'ref-2', title: 'Серебряный медальон'})],
      page: 1,
      pageSize: 24,
      total: 24,
    }
    : {
      items: [referenceItem()],
      page: 1,
      pageSize: 24,
      total: 25,
    }} as never));
  render(
    <MemoryRouter initialEntries={['/project/7/references']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Красный медальон')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('referenceLibrary.card.delete', {title: 'Красный медальон'}) as string,
  }));

  expect(await screen.findByText('Удалить «Красный медальон»?')).toBeInTheDocument();
  expect(mockedApi.archive).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: translation('common.delete')}));
    await Promise.resolve();
  });

  await waitFor(() => expect(mockedApi.archive).toHaveBeenCalledWith('7', 'ref-1', 1));
  await waitFor(() => expect(screen.queryByText('Красный медальон')).not.toBeInTheDocument());
  expect(await screen.findByText('Серебряный медальон')).toBeInTheDocument();
  expect(mockedApi.list).toHaveBeenCalledTimes(2);
});

test('keeps the reference visible when deletion fails', async () => {
  mockedApi.archive.mockRejectedValueOnce(new Error('archive failed'));
  render(
    <MemoryRouter initialEntries={['/project/7/references']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText('Красный медальон')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('referenceLibrary.card.delete', {title: 'Красный медальон'}) as string,
  }));
  await screen.findByText('Удалить «Красный медальон»?');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: translation('common.delete')}));
    await Promise.resolve();
  });

  await waitFor(() => expect(message.error).toHaveBeenCalled());
  expect(screen.getByText('Красный медальон')).toBeInTheDocument();
});

test('does not show card actions to a read-only viewer', async () => {
  mockedApi.getCapabilities.mockResolvedValue({data: {
    categories: [],
    generation: {
      aspectRatios: ['1:1'], canEdit: false, canGenerate: false, configured: false,
      editVariantCounts: [], effectiveModel: '', generateVariantCounts: [], providerMode: 'mock',
    },
    permissions: {canEdit: false, canRunGeneration: false, canView: true},
    upload: {
      maxBytes: 10_485_760, maxPixels: 20_000_000,
      mimeTypes: ['image/png'], rightsStatementVersion: 'reference-upload-v1',
    },
  }} as never);

  render(
    <MemoryRouter initialEntries={['/project/7/references']}>
      <Routes>
        <Route path="/project/:projectId/references" element={<ReferenceLibraryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Красный медальон');
  await screen.findByText(translation('referenceLibrary.readOnly'));
  expect(screen.queryByRole('button', {
    name: i18n.t('referenceLibrary.card.delete', {title: 'Красный медальон'}) as string,
  })).not.toBeInTheDocument();
});
