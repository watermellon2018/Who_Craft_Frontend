import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation, useNavigate} from 'react-router-dom';

import i18n from '../../../i18n';
import {musicApi} from '../api/musicApi';
import {
  getLatestMusicUploadEditorDraft,
  removeMusicUploadEditorDraft,
} from '../editor/musicUploadDraftStore';
import {useMusicGenerationJob} from '../hooks/useMusicGenerationJob';
import {useUnsavedMusicGuard} from '../hooks/useUnsavedMusicGuard';
import type {
  MusicBrief,
  MusicCapabilities,
  MusicGenerationJob,
  MusicTrackDetail,
} from '../types';
import MusicStudioPage, {
  musicEnqueueIntentFingerprint,
  resetMusicCreateScroll,
} from './MusicStudioPage';

jest.mock('../hooks/useMusicGenerationJob');
jest.mock('../../credits/components/GenerationCostGuard', () => ({
  GenerationCostPreview: () => null,
  runGenerationWithCredits: (
    intent: {modelKey?: string},
    operation: (estimate: unknown) => unknown,
  ) => operation({modelKey: intent.modelKey ?? 'local', routingMode: 'manual'}),
}));
jest.mock('../hooks/useUnsavedMusicGuard', () => ({
  useUnsavedMusicGuard: jest.fn(),
}));

const mockedUseMusicGenerationJob = useMusicGenerationJob as jest.MockedFunction<
  typeof useMusicGenerationJob
>;
const mockedUseUnsavedMusicGuard = useUnsavedMusicGuard as jest.MockedFunction<
  typeof useUnsavedMusicGuard
>;

const brief: MusicBrief = {
  content: {mode: 'instrumental'},
  context: {type: 'project'},
  durationSeconds: 30,
  energyCurve: 'steady',
  exclude: [],
  genre: 'cinematic',
  instruments: ['piano'],
  loopable: false,
  moods: ['hopeful'],
  purpose: 'underscore',
  seed: 123,
  tempo: {mode: 'auto'},
  textRefinement: '',
  title: 'Existing theme',
};

const capabilities: MusicCapabilities = {
  audioReference: {
    formats: ['mp3'],
    maxBytes: 100,
    maxCount: 1,
    maxSeconds: 300,
    minSeconds: 10,
    supported: false,
  },
  briefFields: {
    energyCurves: ['steady'],
    genres: ['cinematic'],
    instruments: ['piano'],
    moods: ['hopeful'],
    purposes: ['underscore', 'song'],
    tempoModes: ['auto'],
    vocalStyles: {deliveries: ['soft'], timbres: ['warm']},
  },
  contentModes: ['instrumental', 'song'],
  duration: {defaultSeconds: 30, maxSeconds: 300, minSeconds: 3},
  lyrics: {
    languages: ['ru'],
    maxChars: 12000,
    sectionTypes: ['verse', 'chorus'],
    supported: true,
  },
  outputFormats: ['mp3'],
  providerDisplayName: 'Generator',
  supportsCancellation: true,
  supportsSeed: true,
  variantCounts: [1, 2],
};

const track: MusicTrackDetail = {
  activeVersion: {
    audioUrl: '/media/version-1.mp3',
    durationSeconds: 30,
    versionId: 'version-1',
    versionNumber: 1,
  },
  assignments: [],
  author: 'Craft AI',
  id: 12,
  permissions: {canEdit: true, canRunGeneration: true},
  source: 'generated',
  status: 'active',
  tags: ['cinematic'],
  title: 'Existing theme',
  updatedAt: '2026-08-02T08:00:00Z',
  usageCount: 0,
  version: 4,
  versions: [{
    audioUrl: '/media/version-1.mp3',
    brief,
    durationSeconds: 30,
    versionId: 'version-1',
    versionNumber: 1,
  }],
};

const referenceAsset = {
  assetId: 'reference-1',
  audioUrl: '/media/reference.mp3',
  audioUrlExpiresAt: null,
  durationSeconds: 12,
  localVerificationStatus: 'accepted' as const,
  mimeType: 'audio/mpeg',
  name: 'reference.mp3',
  providerModerationStatus: 'pending' as const,
};

function completedTargetJob(): MusicGenerationJob {
  return {
    attempts: 1,
    brief,
    canCancel: false,
    canRetry: false,
    completedAt: '2026-08-02T10:01:00Z',
    createdAt: '2026-08-02T10:00:00Z',
    error: null,
    jobId: 'job-2',
    permissions: {canEdit: true, canRunGeneration: true},
    referenceAsset: null,
    retryOf: null,
    stage: 'finalized',
    status: 'completed',
    targetTrackId: 12,
    variantCount: 1,
    variants: [{
      appliedTrackVersionId: null,
      audioUrl: '/media/variant.mp3',
      audioUrlExpiresAt: null,
      durationSeconds: 30,
      index: 0,
      mimeType: 'audio/mpeg',
      seed: 123,
      status: 'generated',
      variantId: 'variant-2',
    }],
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function UploadDraftEditorProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as {returnTo?: string} | null)?.returnTo;
  return (
    <>
      <button type="button" onClick={() => returnTo && navigate(returnTo)}>
        return from editor
      </button>
      <button type="button" onClick={() => navigate(-1)}>browser back</button>
    </>
  );
}

function pageTree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/project/:projectId/music" element={<MusicStudioPage />} />
        <Route path="/project/:projectId/music/create" element={<MusicStudioPage />} />
        <Route path="/project/:projectId/music/jobs/:jobId" element={<MusicStudioPage />} />
        <Route path="/project/:projectId/music/tracks/:trackId" element={<MusicStudioPage />} />
        <Route
          path="/project/:projectId/music/upload-drafts/:draftId/edit"
          element={<UploadDraftEditorProbe />}
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderPage(path: string) {
  return render(pageTree(path));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'scrollTo').mockImplementation();
  jest.spyOn(musicApi, 'getCapabilities').mockResolvedValue({data: capabilities} as never);
  jest.spyOn(musicApi, 'getTrack').mockResolvedValue({data: track} as never);
  jest.spyOn(musicApi, 'listLibrary').mockResolvedValue({data: {
    items: [],
    page: {limit: 30, offset: 0, total: 0},
    permissions: {canEdit: true, canRunGeneration: true},
  }} as never);
  jest.spyOn(musicApi, 'listJobs').mockResolvedValue({data: {items: []}} as never);
  mockedUseMusicGenerationJob.mockReturnValue({
    errorCode: null,
    errorMessage: null,
    isTerminal: false,
    job: null,
    loading: false,
    refresh: jest.fn(),
  });
});

afterEach(() => {
  const latestUploadDraft = getLatestMusicUploadEditorDraft('7');
  if (latestUploadDraft) removeMusicUploadEditorDraft('7', latestUploadDraft.draftId);
  jest.restoreAllMocks();
});

test('fingerprints reference, target, expected version, and brief changes as new intents', () => {
  const payload = {
    brief,
    referenceAssetId: null,
    targetTrackId: null,
    variantCount: 2,
  };
  const original = musicEnqueueIntentFingerprint(payload, null);

  expect(musicEnqueueIntentFingerprint({
    ...payload,
    brief: {...brief, title: 'Changed intent'},
  }, null)).not.toBe(original);
  expect(musicEnqueueIntentFingerprint({
    ...payload,
    referenceAssetId: 'reference-2',
  }, null)).not.toBe(original);
  expect(musicEnqueueIntentFingerprint({
    ...payload,
    targetTrackId: 12,
  }, null)).not.toBe(original);
  expect(musicEnqueueIntentFingerprint(payload, 4)).not.toBe(original);
});

test('opens the create route at the top of the page', () => {
  resetMusicCreateScroll(true);
  expect(window.scrollTo).toHaveBeenCalledWith({behavior: 'auto', left: 0, top: 0});
});

test('loads only active tracks and toggles the library sidebar', async () => {
  const listLibrary = musicApi.listLibrary as jest.MockedFunction<typeof musicApi.listLibrary>;
  renderPage('/project/7/music/create');

  await waitFor(() => expect(listLibrary).toHaveBeenCalledWith(
    '7',
    expect.objectContaining({status: 'active'}),
    expect.any(AbortSignal),
  ));
  expect(document.querySelector('.music-library__status-filter')).toBeNull();

  const library = await screen.findByRole('complementary', {
    name: i18n.t('musicStudio.library.title'),
  });
  const region = library.closest('.music-studio-library-region');
  const content = library.closest('.music-studio-library-content');
  expect(region).toHaveClass('music-studio-library-region--open');
  expect(content).toHaveAttribute('aria-hidden', 'false');

  const libraryTrigger = screen.getByRole('button', {name: i18n.t('musicStudio.library.hide')});
  expect(libraryTrigger).toHaveClass('music-studio-library-trigger');
  expect(libraryTrigger.parentElement).toBe(region);

  fireEvent.click(libraryTrigger);
  expect(region).not.toHaveClass('music-studio-library-region--open');
  expect(content).toHaveAttribute('aria-hidden', 'true');

  const collapsedLibraryTrigger = screen.getByRole('button', {
    name: i18n.t('musicStudio.library.show'),
  });
  expect(collapsedLibraryTrigger).toBe(libraryTrigger);
  expect(collapsedLibraryTrigger.parentElement).toBe(region);

  fireEvent.click(collapsedLibraryTrigger);
  expect(region).toHaveClass('music-studio-library-region--open');
  expect(content).toHaveAttribute('aria-hidden', 'false');
});

test('preserves AI and upload drafts while switching creation modes', async () => {
  const getCapabilities = musicApi.getCapabilities as jest.MockedFunction<
    typeof musicApi.getCapabilities
  >;
  getCapabilities.mockResolvedValue({data: {
    ...capabilities,
    audioReference: {...capabilities.audioReference, supported: true},
  }} as never);
  jest.spyOn(musicApi, 'uploadReference').mockResolvedValue({data: referenceAsset} as never);
  const pauseSpy = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:page-upload-preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
  renderPage('/project/7/music/create');

  const aiTitle = await screen.findByLabelText(i18n.t('musicStudio.brief.title'));
  await waitFor(() => expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.scene.choose'),
  })).not.toBeDisabled());
  fireEvent.change(aiTitle, {target: {value: 'Preserved AI draft'}});
  const songFormat = screen.getByRole('radio', {
    name: new RegExp(i18n.t('musicStudio.brief.mode.song')),
  });
  fireEvent.click(songFormat);
  expect(songFormat).toHaveAttribute('aria-checked', 'true');
  fireEvent.change(screen.getByLabelText(i18n.t('musicStudio.reference.choose')), {
    target: {files: [new File(['reference'], 'reference.mp3', {type: 'audio/mpeg'})]},
  });
  expect((await screen.findAllByText('reference.mp3')).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.upload')));
  expect(screen.queryByRole('heading', {name: i18n.t('musicStudio.format.title')}))
    .not.toBeInTheDocument();
  expect(screen.queryByRole('radio', {
    name: new RegExp(i18n.t('musicStudio.brief.mode.song')),
  })).not.toBeInTheDocument();

  const file = new File(['audio'], 'scene-theme.mp3', {type: 'audio/mpeg'});
  fireEvent.change(await screen.findByLabelText(i18n.t('musicStudio.upload.fileInputLabel')), {
    target: {files: [file]},
  });
  fireEvent.change(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')), {
    target: {value: 'Preserved upload draft'},
  });
  fireEvent.play(await screen.findByLabelText(i18n.t('musicStudio.upload.previewLabel')));

  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.ai')));
  expect(pauseSpy).toHaveBeenCalled();
  expect(await screen.findByLabelText(i18n.t('musicStudio.brief.title'))).toHaveValue(
    'Preserved AI draft',
  );
  expect(screen.getAllByText('reference.mp3').length).toBeGreaterThan(0);
  expect(screen.getByRole('radio', {
    name: new RegExp(i18n.t('musicStudio.brief.mode.song')),
  })).toHaveAttribute('aria-checked', 'true');

  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.upload')));
  expect((await screen.findAllByText('scene-theme.mp3')).length).toBeGreaterThan(0);
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder'))).toHaveValue(
    'Preserved upload draft',
  );
});

test('restores the complete local upload form after returning from the audio editor', async () => {
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:page-editor-draft'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
  renderPage('/project/7/music/create');

  const aiTitle = await screen.findByLabelText(i18n.t('musicStudio.brief.title'));
  fireEvent.change(aiTitle, {target: {value: 'Preserved AI context'}});
  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.upload')));
  fireEvent.change(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')), {
    target: {value: 'Local title'},
  });
  fireEvent.change(screen.getByPlaceholderText(
    i18n.t('musicStudio.upload.descriptionPlaceholder'),
  ), {target: {value: 'Local description'}});
  fireEvent.change(screen.getByLabelText(i18n.t('musicStudio.upload.fileInputLabel')), {
    target: {files: [new File(['audio'], 'local-theme.mp3', {type: 'audio/mpeg'})]},
  });
  const audio = screen.getByLabelText(i18n.t('musicStudio.upload.previewLabel'));
  Object.defineProperty(audio, 'duration', {configurable: true, value: 20});
  fireEvent.loadedMetadata(audio);

  const editButton = screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.editAria', {name: 'local-theme.mp3'}),
  });
  await waitFor(() => expect(editButton).toBeEnabled());
  const guardCallCount = mockedUseUnsavedMusicGuard.mock.calls.length;
  fireEvent.click(editButton);
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    /^\/project\/7\/music\/upload-drafts\/[^/]+\/edit$/,
  ));
  expect(mockedUseUnsavedMusicGuard.mock.calls.slice(guardCallCount))
    .toContainEqual([false]);
  const firstEditorPath = screen.getByTestId('location').textContent;

  fireEvent.click(screen.getByRole('button', {name: 'browser back'}));
  expect((await screen.findAllByText('local-theme.mp3')).length).toBeGreaterThan(0);
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')))
    .toHaveValue('Local title');
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.descriptionPlaceholder')))
    .toHaveValue('Local description');

  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.ai')));
  expect(await screen.findByLabelText(i18n.t('musicStudio.brief.title')))
    .toHaveValue('Preserved AI context');

  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.upload')));
  const repeatedEditButton = screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.editAria', {name: 'local-theme.mp3'}),
  });
  await waitFor(() => expect(repeatedEditButton).toBeEnabled());
  fireEvent.click(repeatedEditButton);
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    firstEditorPath ?? '',
  ));
  fireEvent.click(screen.getByRole('button', {name: 'return from editor'}));
  expect(await screen.findByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')))
    .toHaveValue('Local title');
});

test.each([
  {aiDisabled: false, canEdit: false, canRunGeneration: true, uploadDisabled: true},
  {aiDisabled: true, canEdit: true, canRunGeneration: false, uploadDisabled: false},
])('uses the matching permission for scene context %#', async ({
  aiDisabled,
  canEdit,
  canRunGeneration,
  uploadDisabled,
}) => {
  const listLibrary = musicApi.listLibrary as jest.MockedFunction<typeof musicApi.listLibrary>;
  listLibrary.mockResolvedValue({data: {
    items: [],
    page: {limit: 30, offset: 0, total: 0},
    permissions: {canEdit, canRunGeneration},
  }} as never);
  renderPage('/project/7/music/create');

  const sceneButtonName = i18n.t('musicStudio.scene.choose');
  await waitFor(() => {
    const button = screen.getByRole('button', {name: sceneButtonName});
    if (aiDisabled) expect(button).toBeDisabled();
    else expect(button).not.toBeDisabled();
  }, {timeout: 3000});

  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.upload')));
  await waitFor(() => {
    const button = screen.getByRole('button', {name: sceneButtonName});
    if (uploadDisabled) expect(button).toBeDisabled();
    else expect(button).not.toBeDisabled();
  }, {timeout: 3000});
});

test('confirms discarding an upload draft before starting AI generation', async () => {
  const enqueue = jest.spyOn(musicApi, 'enqueueJob').mockResolvedValue({data: {
    jobId: 'job-after-upload-draft',
  }} as never);
  renderPage('/project/7/music/create');

  fireEvent.click(await screen.findByText(i18n.t('musicStudio.create.mode.upload')));
  fireEvent.change(screen.getByLabelText(i18n.t('musicStudio.upload.fileInputLabel')), {
    target: {files: [new File(['audio'], 'local-draft.mp3', {type: 'audio/mpeg'})]},
  });
  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.ai')));
  fireEvent.change(screen.getByLabelText(i18n.t('musicStudio.brief.title')), {
    target: {value: 'AI generation after draft'},
  });

  const generate = screen.getByRole('button', {
    name: i18n.t('musicStudio.create.generate', {count: 2}),
  });
  await waitFor(() => expect(generate).not.toBeDisabled());
  fireEvent.click(generate);

  expect(enqueue).not.toHaveBeenCalled();
  expect(await screen.findByText(i18n.t('musicStudio.upload.discardDraftTitle')))
    .toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.discardDraftConfirm'),
  }));

  await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/music/jobs/job-after-upload-draft',
  ));
});

test('does not treat visiting upload mode as an upload-file draft', async () => {
  const enqueue = jest.spyOn(musicApi, 'enqueueJob').mockResolvedValue({data: {
    jobId: 'job-after-format-change',
  }} as never);
  renderPage('/project/7/music/create');

  fireEvent.click(await screen.findByText(i18n.t('musicStudio.create.mode.upload')));
  expect(screen.queryByRole('heading', {name: i18n.t('musicStudio.format.title')}))
    .not.toBeInTheDocument();
  fireEvent.click(screen.getByText(i18n.t('musicStudio.create.mode.ai')));
  fireEvent.change(screen.getByLabelText(i18n.t('musicStudio.brief.title')), {
    target: {value: 'AI generation after format change'},
  });

  const generate = screen.getByRole('button', {
    name: i18n.t('musicStudio.create.generate', {count: 2}),
  });
  await waitFor(() => expect(generate).not.toBeDisabled());
  fireEvent.click(generate);

  await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(i18n.t('musicStudio.upload.discardDraftTitle')))
    .not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/music/jobs/job-after-format-change',
  ));
});

test('starts a new-version job from track detail with the exact target snapshot', async () => {
  const getTrack = musicApi.getTrack as jest.MockedFunction<typeof musicApi.getTrack>;
  getTrack
    .mockResolvedValueOnce({data: track} as never)
    .mockResolvedValue({data: {...track, version: 5}} as never);
  const enqueue = jest.spyOn(musicApi, 'enqueueJob').mockResolvedValue({data: {
    jobId: 'job-new-version',
  }} as never);
  renderPage('/project/7/music/tracks/12');

  await waitFor(() => expect(musicApi.getTrack).toHaveBeenCalled());
  expect(await screen.findByText('Existing theme')).toBeInTheDocument();
  fireEvent.click(await screen.findByText(i18n.t('musicStudio.job.newBrief')));

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/music/create?expectedTrackVersion=4&targetTrackId=12',
  ));
  await waitFor(() => expect(musicApi.getTrack).toHaveBeenCalledWith(
    '7',
    12,
    expect.any(AbortSignal),
  ));
  await waitFor(() => expect(screen.getByLabelText(i18n.t('musicStudio.brief.title'))).toHaveValue(
    'Existing theme',
  ));

  const generate = await screen.findByRole('button', {
    name: i18n.t('musicStudio.create.generate', {count: 2}),
  });
  await waitFor(() => expect(generate).not.toBeDisabled());
  fireEvent.click(generate);

  await waitFor(() => expect(enqueue).toHaveBeenCalled());
  expect(enqueue.mock.calls[0][1]).toEqual(expect.objectContaining({
    targetTrackId: 12,
    brief: expect.objectContaining({seed: 123, title: 'Existing theme'}),
  }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/music/jobs/job-new-version?expectedTrackVersion=4',
  ));
});

test('hydrates an existing target without a saved brief when detail resolves first', async () => {
  let resolveCapabilities: ((value: unknown) => void) | undefined;
  const pendingCapabilities = new Promise((resolve) => {
    resolveCapabilities = resolve;
  });
  const getCapabilities = musicApi.getCapabilities as jest.MockedFunction<
    typeof musicApi.getCapabilities
  >;
  getCapabilities.mockReturnValue(pendingCapabilities as never);
  const getTrack = musicApi.getTrack as jest.MockedFunction<typeof musicApi.getTrack>;
  getTrack.mockResolvedValue({
    data: {
      ...track,
      versions: track.versions.map((version) => ({...version, brief: null})),
    },
  } as never);

  renderPage('/project/7/music/create?expectedTrackVersion=4&targetTrackId=12');
  await waitFor(() => expect(getTrack).toHaveBeenCalledTimes(1));
  await act(async () => {
    resolveCapabilities?.({data: capabilities});
    await pendingCapabilities;
  });

  await waitFor(() => expect(
    screen.getByLabelText(i18n.t('musicStudio.brief.title')),
  ).toHaveValue(track.title));
});
test('guards track signed-URL refreshes across detail remounts', async () => {
  const getTrack = musicApi.getTrack as jest.MockedFunction<typeof musicApi.getTrack>;
  renderPage('/project/7/music/tracks/12');

  await waitFor(() => expect(getTrack).toHaveBeenCalledTimes(1));
  const audioLabel = i18n.t('musicStudio.player.track', {title: track.title});
  fireEvent.error(await screen.findByLabelText(audioLabel));
  await waitFor(() => expect(getTrack).toHaveBeenCalledTimes(2));

  fireEvent.error(await screen.findByLabelText(audioLabel));
  expect(getTrack).toHaveBeenCalledTimes(2);
});

test('guards variant signed-URL refreshes across job-state remounts', async () => {
  const route = '/project/7/music/jobs/job-2';
  const refresh = jest.fn();
  const job = {...completedTargetJob(), targetTrackId: null};
  const completedState = {
    errorCode: null,
    errorMessage: null,
    isTerminal: true,
    job,
    loading: false,
    refresh,
  };
  mockedUseMusicGenerationJob.mockReturnValue(completedState);
  const view = renderPage(route);
  const audioLabel = i18n.t('musicStudio.player.variant', {letter: 'A'});

  fireEvent.error(await screen.findByLabelText(audioLabel));
  expect(refresh).toHaveBeenCalledTimes(1);

  mockedUseMusicGenerationJob.mockReturnValue({...completedState, job: null, loading: true});
  view.rerender(pageTree(route));
  expect(screen.queryByLabelText(audioLabel)).not.toBeInTheDocument();

  mockedUseMusicGenerationJob.mockReturnValue(completedState);
  view.rerender(pageTree(route));
  fireEvent.error(await screen.findByLabelText(audioLabel));
  expect(refresh).toHaveBeenCalledTimes(1);
});
test('fetches a target detail outside the library page and applies version two optimistically', async () => {
  const job = completedTargetJob();
  mockedUseMusicGenerationJob.mockReturnValue({
    errorCode: null,
    errorMessage: null,
    isTerminal: true,
    job,
    loading: false,
    refresh: jest.fn(),
  });
  const apply = jest.spyOn(musicApi, 'applyVariant').mockResolvedValue({data: {
    activeVersion: {
      audioUrl: '/media/version-2.mp3',
      durationSeconds: 30,
      versionId: 'version-2',
      versionNumber: 2,
    },
    idempotentReplay: false,
    trackId: 12,
    trackVersion: 5,
  }} as never);
  renderPage('/project/7/music/jobs/job-2?expectedTrackVersion=4');

  const choose = await screen.findByRole('button', {
    name: i18n.t('musicStudio.player.choose'),
  });
  await waitFor(() => expect(choose).not.toBeDisabled());
  fireEvent.click(choose);

  await waitFor(() => expect(apply).toHaveBeenCalledWith(
    '7',
    'job-2',
    'variant-2',
    expect.objectContaining({expectedTrackVersion: 4, targetTrackId: 12}),
  ));
  expect(musicApi.getTrack).toHaveBeenCalledWith('7', 12, expect.any(AbortSignal));
  expect(await screen.findByText(i18n.t('musicStudio.apply.saved'))).toBeInTheDocument();
  await waitFor(() => expect(musicApi.getTrack).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.player.choose'),
  })).not.toBeDisabled());
});

test('reuses an idempotency key after an ambiguous failure until the brief changes', async () => {
  const rejectors: Array<(reason?: unknown) => void> = [];
  const enqueue = jest.spyOn(musicApi, 'enqueueJob').mockImplementation(() => (
    new Promise((_resolve, reject) => rejectors.push(reject)) as never
  ));
  const failAttempt = async (index: number) => {
    await act(async () => {
      rejectors[index]?.(new Error('Network lost'));
      await Promise.resolve();
    });
  };
  renderPage('/project/7/music/create');

  const title = await screen.findByLabelText(i18n.t('musicStudio.brief.title'));
  fireEvent.change(title, {target: {value: 'First intent'}});
  const generateButton = () => screen.getByRole('button', {
    name: i18n.t('musicStudio.create.generate', {count: 2}),
  });
  await waitFor(() => expect(generateButton()).not.toBeDisabled(), {timeout: 3000});

  fireEvent.click(generateButton());
  await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
  await failAttempt(0);
  expect(await screen.findByText(i18n.t('musicStudio.errors.generic'))).toBeInTheDocument();
  await waitFor(() => expect(generateButton()).not.toBeDisabled());

  fireEvent.click(generateButton());
  await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
  expect(enqueue.mock.calls[1][2]).toBe(enqueue.mock.calls[0][2]);
  await failAttempt(1);
  await waitFor(() => expect(generateButton()).not.toBeDisabled());

  fireEvent.change(title, {target: {value: 'Changed intent'}});
  fireEvent.click(generateButton());
  await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(3));
  expect(enqueue.mock.calls[2][2]).not.toBe(enqueue.mock.calls[0][2]);
  await failAttempt(2);
}, 15_000);
