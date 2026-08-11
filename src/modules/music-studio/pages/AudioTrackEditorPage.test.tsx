import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryRouter, RouterProvider} from 'react-router-dom';

import i18n from '../../../i18n';
import PathConstants, {musicUploadDraftEditorPath} from '../../../routes/pathConstant';
import {audioEditorSaveAdapter} from '../api/audioEditorSaveAdapter';
import {musicApi} from '../api/musicApi';
import {
  getMusicUploadEditorDraft,
  saveMusicUploadEditorDraft,
} from '../editor/musicUploadDraftStore';
import * as audioEditRenderer from '../editor/renderAudioEditFile';
import type {AudioWaveformState} from '../hooks/useAudioWaveform';
import {useAudioWaveform} from '../hooks/useAudioWaveform';
import type {MusicTrackDetail} from '../types';
import AudioTrackEditorPage from './AudioTrackEditorPage';

jest.mock('../../profile/components/DashboardHeader', () => {
  const MockDashboardHeader = ({
    breadcrumbItems,
  }: {breadcrumbItems: {label: string}[]}) => (
    <nav aria-label="breadcrumbs">{breadcrumbItems.map(({label}) => label).join(' / ')}</nav>
  );
  MockDashboardHeader.displayName = 'MockDashboardHeader';
  return MockDashboardHeader;
});

jest.mock('../hooks/useAudioWaveform', () => ({
  useAudioWaveform: jest.fn(),
}));

jest.mock('../components/AudioWaveformTimeline', () => {
  const MockAudioWaveformTimeline = ({
    ariaLabel,
    onSelectionChange,
  }: {
    ariaLabel: string;
    onSelectionChange: (selection: {endSeconds: number; startSeconds: number}) => void;
  }) => (
    <button
      aria-label={ariaLabel}
      type="button"
      onClick={() => onSelectionChange({endSeconds: 7.8, startSeconds: 1.2})}
    >
      waveform
    </button>
  );
  MockAudioWaveformTimeline.displayName = 'MockAudioWaveformTimeline';
  return MockAudioWaveformTimeline;
});

const mockedUseAudioWaveform = useAudioWaveform as jest.MockedFunction<typeof useAudioWaveform>;

const waveform: AudioWaveformState = {
  duration: 12,
  error: null,
  loading: false,
  peaks: Array.from({length: 120}, (_, index) => ({
    max: index % 2 ? 0.7 : 0.35,
    min: index % 2 ? -0.5 : -0.2,
  })),
};

function createTrack(overrides: Partial<MusicTrackDetail> = {}): MusicTrackDetail {
  return {
    activeVersion: {
      audioUrl: '/media/track.mp3',
      durationSeconds: 12,
      provenance: {
        createdByAi: false,
        model: null,
        provider: null,
        providerRequestId: null,
      },
      versionId: 'version-1',
      versionNumber: 1,
    },
    assignments: [],
    author: 'Project team',
    id: 12,
    permissions: {canEdit: true, canRunGeneration: true},
    source: 'manual',
    status: 'active',
    tags: [],
    title: 'Forest ambience',
    updatedAt: '2026-08-10T10:00:00Z',
    usageCount: 0,
    version: 3,
    versions: [],
    ...overrides,
  };
}

function renderEditor(track: MusicTrackDetail) {
  jest.spyOn(musicApi, 'getTrack').mockResolvedValue({data: track} as never);
  const router = createMemoryRouter([
    {path: PathConstants.MUSIC_STUDIO_TRACK_EDITOR, element: <AudioTrackEditorPage />},
    {path: PathConstants.MUSIC_STUDIO_TRACK, element: <p>track detail</p>},
    {path: PathConstants.MUSIC_STUDIO, element: <p>music studio</p>},
  ], {
    initialEntries: [{
      pathname: '/project/7/music/tracks/12/edit',
      state: {returnTo: '/project/7/music/tracks/12'},
    }],
  });
  return render(<RouterProvider router={router} />);
}

function renderUploadDraftEditor() {
  const file = new File(['local music'], 'local-theme.mp3', {type: 'audio/mpeg'});
  const draft = saveMusicUploadEditorDraft('7', {
    aiDirty: true,
    brief: null,
    canEdit: true,
    creationMode: 'upload',
    reference: null,
    selectedScene: null,
    uploadDirty: true,
    uploadDraft: {
      description: 'Scene opening',
      durationSeconds: 12,
      file,
      status: 'ready',
      title: 'Local theme',
    },
    variantCount: 3,
  });
  const router = createMemoryRouter([
    {path: PathConstants.MUSIC_STUDIO_UPLOAD_DRAFT_EDITOR, element: <AudioTrackEditorPage />},
    {path: PathConstants.MUSIC_STUDIO_CREATE, element: <p>upload form</p>},
  ], {
    initialEntries: [{
      pathname: musicUploadDraftEditorPath(7, draft.draftId),
      state: {returnTo: `/project/7/music/create?uploadDraftId=${draft.draftId}`},
    }],
  });
  return {draft, ...render(<RouterProvider router={router} />)};
}

beforeEach(() => {
  mockedUseAudioWaveform.mockReturnValue(waveform);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:local-editor-audio'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test.each([
  ['manual', false, 'musicStudio.audioEditor.source.uploaded'],
  ['generated', true, 'musicStudio.audioEditor.source.ai'],
] as const)('uses one full-width editor for %s tracks', async (source, createdByAi, sourceKey) => {
  const baseTrack = createTrack();
  renderEditor(createTrack({
    activeVersion: baseTrack.activeVersion ? {
      ...baseTrack.activeVersion,
      provenance: {
        createdByAi,
        model: null,
        provider: null,
        providerRequestId: null,
      },
    } : null,
    source,
  }));

  expect(await screen.findByRole('heading', {name: 'Forest ambience'})).toBeInTheDocument();
  expect(screen.getByText(i18n.t(sourceKey))).toBeInTheDocument();
  expect(await screen.findByText('waveform')).toBeInTheDocument();
  expect(document.querySelector('.music-studio__library')).not.toBeInTheDocument();
});

test('opens the same editor for a validated local upload without fetching or copying it', async () => {
  const getTrack = jest.spyOn(musicApi, 'getTrack');
  renderUploadDraftEditor();

  expect(await screen.findByRole('heading', {name: 'Local theme'})).toBeInTheDocument();
  expect(screen.getByText(i18n.t('musicStudio.audioEditor.source.localDraft')))
    .toBeInTheDocument();
  expect(screen.getByText('waveform')).toBeInTheDocument();
  expect(getTrack).not.toHaveBeenCalled();
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});

test('renders a local edit, updates the upload draft, and returns to the form', async () => {
  const editedFile = new File(['rendered audio'], 'local-theme-edited.wav', {type: 'audio/wav'});
  const renderAudioEditFile = jest.spyOn(audioEditRenderer, 'renderAudioEditFile')
    .mockResolvedValue({durationSeconds: 7.8, file: editedFile});
  const saveNewVersion = jest.spyOn(audioEditorSaveAdapter, 'saveNewVersion');
  const {draft} = renderUploadDraftEditor();
  const timeline = await screen.findByText('waveform');

  fireEvent.click(timeline);
  fireEvent.click(screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.tools.trim')),
  }));
  fireEvent.click(screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.save')),
  }));

  expect(await screen.findByText('upload form')).toBeInTheDocument();
  const updated = getMusicUploadEditorDraft('7', draft.draftId)?.snapshot.uploadDraft;
  expect(renderAudioEditFile).toHaveBeenCalledWith(
    draft.snapshot.uploadDraft.file,
    expect.any(Object),
    expect.any(AbortSignal),
  );
  expect(saveNewVersion).not.toHaveBeenCalled();
  expect(updated).toMatchObject({
    durationSeconds: 7.8,
    edited: true,
    file: editedFile,
    originalFile: draft.snapshot.uploadDraft.file,
    status: 'ready',
  });
});

test('explains how to recover when an in-memory upload draft is lost after refresh', async () => {
  const router = createMemoryRouter([
    {path: PathConstants.MUSIC_STUDIO_UPLOAD_DRAFT_EDITOR, element: <AudioTrackEditorPage />},
    {path: PathConstants.MUSIC_STUDIO_CREATE, element: <p>upload form</p>},
  ], {initialEntries: ['/project/7/music/upload-drafts/missing/edit']});
  render(<RouterProvider router={router} />);

  expect(await screen.findByText(
    i18n.t('musicStudio.audioEditor.errors.draftMissingTitle'),
  )).toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.audioEditor.errors.returnUpload'),
  })).toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('enables range edits and undo without faking a saved backend version', async () => {
  const saveNewVersion = jest.spyOn(audioEditorSaveAdapter, 'saveNewVersion');
  renderEditor(createTrack());
  const timeline = await screen.findByText('waveform');

  const trimButton = screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.tools.trim')),
  });
  expect(trimButton).toBeDisabled();

  fireEvent.click(timeline);
  await waitFor(() => expect(trimButton).toBeEnabled());

  fireEvent.click(trimButton);
  const undoButton = screen.getByRole('button', {name: i18n.t('musicStudio.audioEditor.undo')});
  const saveButton = screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.save')),
  });
  expect(undoButton).toBeEnabled();
  expect(saveButton).toBeEnabled();

  fireEvent.click(saveButton);
  await waitFor(() => expect(saveNewVersion).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(i18n.t('musicStudio.apply.saved'))).not.toBeInTheDocument();

  fireEvent.click(undoButton);
  await waitFor(() => expect(saveButton).toBeDisabled());
});

test('lets keyboard users create the first editable selection from the Select tool', async () => {
  renderEditor(createTrack());
  await screen.findByText('waveform');
  const selectButton = screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.tools.select')),
  });
  const trimButton = screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.tools.trim')),
  });

  expect(trimButton).toBeDisabled();
  fireEvent.click(selectButton);
  await waitFor(() => expect(trimButton).toBeEnabled());
});

test('keeps editing controls disabled in view-only mode', async () => {
  renderEditor(createTrack({permissions: {canEdit: false, canRunGeneration: false}}));

  expect(await screen.findByText(i18n.t('musicStudio.audioEditor.status.readOnly'))).toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.tools.delete')),
  })).toBeDisabled();
  expect(screen.getByRole('button', {
    name: new RegExp(i18n.t('musicStudio.audioEditor.save')),
  })).toBeDisabled();
});

test('shows a retryable empty state when the active version has no audio', async () => {
  renderEditor(createTrack({activeVersion: null}));

  expect(await screen.findByText(i18n.t('musicStudio.audioEditor.errors.noAudioTitle'))).toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.audioEditor.errors.returnStudio'),
  })).toBeInTheDocument();
});

test('does not leave the editor loading forever for empty decoded audio', async () => {
  mockedUseAudioWaveform.mockReturnValue({
    duration: 0,
    error: null,
    loading: false,
    peaks: [],
  });
  renderEditor(createTrack());

  expect(await screen.findByText(i18n.t('musicStudio.audioEditor.errors.noAudioTitle'))).toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.audioEditor.errors.retry'),
  })).toBeInTheDocument();
});
