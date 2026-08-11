import React from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import i18n from '../../../i18n';
import {characterApi} from '../api/characterApi';
import CharacterGalleryPage from './CharacterGalleryPage';

jest.mock('../api/characterApi');
jest.mock('../hooks/useProjectIdFromRoute', () => ({
  useProjectIdFromRoute: () => 'project-1',
}));

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

it('shows the loading state instead of the empty gallery before the first response', async () => {
  const request = deferred<unknown>();
  mockedApi.list.mockReturnValue(request.promise as never);

  render(
    <MemoryRouter>
      <CharacterGalleryPage />
    </MemoryRouter>,
  );

  expect(screen.getByText(i18n.t('characterStudio.gallery.loadingTip'))).toBeInTheDocument();
  expect(screen.queryByText(i18n.t('characterStudio.gallery.emptyTitle'))).not.toBeInTheDocument();

  await act(async () => {
    request.resolve({data: []});
    await request.promise;
  });

  expect(screen.queryByText(i18n.t('characterStudio.gallery.loadingTip'))).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('characterStudio.gallery.emptyTitle'))).toBeInTheDocument();
  expect(mockedApi.list).toHaveBeenCalledWith('project-1', {
    include_drafts: true,
    search: '',
  });
});

it('shows an unfinished character and resumes its latest initial generation', async () => {
  mockedApi.list.mockResolvedValue({data: [{
    character_id: 'draft-1',
    project_id: 1,
    name: 'Test 2',
    status: 'draft',
    identity_locked: false,
    images: {},
  }]} as never);
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: [{
    job_id: 'job-1',
    project_id: 1,
    character_id: 'draft-1',
    job_type: 'initial_variants',
    status: 'completed',
    progress: 100,
    variants: [],
  }]}} as never);

  render(
    <MemoryRouter initialEntries={['/project/project-1/characters']}>
      <CharacterGalleryPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  expect(await screen.findByText(i18n.t('characterStudio.gallery.draftsTitle'))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('characterStudio.gallery.resumeDraftAria', {name: 'Test 2'}),
  }));

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/project-1/characters/draft-1/variants?jobId=job-1',
  ));
});
