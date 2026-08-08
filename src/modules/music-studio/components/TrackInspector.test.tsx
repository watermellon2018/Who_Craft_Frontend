import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import i18n from '../../../i18n';
import {musicApi} from '../api/musicApi';
import type {MusicTrackDetail} from '../types';
import TrackInspector from './TrackInspector';

const track: MusicTrackDetail = {
  activeVersion: {
    audioUrl: '/media/v2.mp3',
    durationSeconds: 45,
    versionId: 'version-2',
    versionNumber: 2,
  },
  assignments: [],
  author: 'Project team',
  id: 12,
  status: 'active',
  tags: [],
  title: 'Heroine theme',
  updatedAt: '2026-08-02T08:00:00Z',
  usageCount: 0,
  version: 4,
  versions: [
    {
      audioUrl: '/media/v1.mp3',
      createdAt: '2026-08-01T08:00:00Z',
      durationSeconds: 45,
      lyrics: [
        {label: 'First verse', text: 'First line\nSecond line', type: 'verse'},
        {label: 'Following chorus', text: 'Keep this chorus', type: 'chorus'},
      ],
      versionId: 'version-1',
      versionNumber: 1,
    },
    {
      audioUrl: '/media/v2.mp3',
      createdAt: '2026-08-02T08:00:00Z',
      durationSeconds: 45,
      lyrics: [
        {label: 'Latest outro', text: 'Last words', type: 'outro'},
      ],
      versionId: 'version-2',
      versionNumber: 2,
    },
  ],
};

interface RenderInspectorOptions {
  canEdit?: boolean;
  currentTrack?: MusicTrackDetail;
  onChanged?: jest.Mock;
  onCreateVersion?: jest.Mock;
  onSignedUrlExpired?: jest.Mock;
}

function renderInspector({
  canEdit = true,
  currentTrack = track,
  onChanged = jest.fn(),
  onCreateVersion = jest.fn(),
  onSignedUrlExpired = jest.fn(),
}: RenderInspectorOptions = {}) {
  return {
    onChanged,
    onCreateVersion,
    onSignedUrlExpired,
    ...render(
      <TrackInspector
        canEdit={canEdit}
        projectId="project-1"
        track={currentTrack}
        onAudioPlay={jest.fn()}
        onChanged={onChanged}
        onCreateVersion={onCreateVersion}
        onSignedUrlExpired={onSignedUrlExpired}
      />,
    ),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('archives with the current track version before reporting the change', async () => {
  const archiveTrack = jest.spyOn(musicApi, 'archiveTrack').mockResolvedValue({} as never);
  const {onChanged} = renderInspector();
  const archiveLabel = i18n.t('musicStudio.track.archive');

  fireEvent.click(screen.getByRole('button', {name: new RegExp(archiveLabel)}));
  const confirmationButtons = await screen.findAllByRole('button', {name: new RegExp(archiveLabel)});
  fireEvent.click(confirmationButtons[confirmationButtons.length - 1]);

  await waitFor(() => expect(archiveTrack).toHaveBeenCalledWith('project-1', 12, 4));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
});

test('offers new-version generation only to editors', () => {
  const {onCreateVersion, unmount} = renderInspector();
  const newVersionLabel = i18n.t('musicStudio.job.newBrief');

  fireEvent.click(screen.getByText(newVersionLabel));
  expect(onCreateVersion).toHaveBeenCalledTimes(1);

  unmount();
  renderInspector({canEdit: false});
  expect(screen.queryByText(newVersionLabel)).not.toBeInTheDocument();
});

test('shows version lyrics in their source order without viewer mutation controls', () => {
  renderInspector({canEdit: false});

  const firstVerse = screen.getByText('First verse');
  const followingChorus = screen.getByText('Following chorus');
  const latestOutro = screen.getByText('Latest outro');
  expect(firstVerse.compareDocumentPosition(followingChorus) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
  expect(followingChorus.compareDocumentPosition(latestOutro) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
  expect(screen.getByText((_, element) => (
    element?.tagName === 'PRE'
      && element.textContent?.replace(/\s+/g, ' ') === 'First line Second line'
  ))).toBeInTheDocument();
  expect(screen.getByText('Keep this chorus')).toBeInTheDocument();
  expect(screen.getByText('Last words')).toBeInTheDocument();

  for (const label of [
    i18n.t('musicStudio.track.archive'),
    i18n.t('musicStudio.track.makeActive'),
    i18n.t('musicStudio.job.newBrief'),
    i18n.t('musicStudio.assignment.save'),
  ]) {
    expect(screen.queryByRole('button', {name: label})).not.toBeInTheDocument();
  }
});

test('requests one audio refresh per active version even when its signed URL changes', () => {
  const {onSignedUrlExpired, rerender} = renderInspector({canEdit: false});
  const currentActiveVersion = track.activeVersion;
  if (!currentActiveVersion) throw new Error('The fixture requires an active version');
  const audioLabel = i18n.t('musicStudio.player.track', {title: track.title});

  fireEvent.error(screen.getByLabelText(audioLabel));
  fireEvent.error(screen.getByLabelText(audioLabel));
  expect(onSignedUrlExpired).toHaveBeenCalledTimes(1);

  rerender(
    <TrackInspector
      canEdit={false}
      projectId="project-1"
      track={{
        ...track,
        activeVersion: {...currentActiveVersion, audioUrl: '/media/v2-renewed.mp3'},
      }}
      onAudioPlay={jest.fn()}
      onChanged={jest.fn()}
      onCreateVersion={jest.fn()}
      onSignedUrlExpired={onSignedUrlExpired}
    />,
  );
  fireEvent.error(screen.getByLabelText(audioLabel));
  expect(onSignedUrlExpired).toHaveBeenCalledTimes(1);

  rerender(
    <TrackInspector
      canEdit={false}
      projectId="project-1"
      track={{
        ...track,
        activeVersion: {
          ...currentActiveVersion,
          audioUrl: '/media/v3.mp3',
          versionId: 'version-3',
          versionNumber: 3,
        },
      }}
      onAudioPlay={jest.fn()}
      onChanged={jest.fn()}
      onCreateVersion={jest.fn()}
      onSignedUrlExpired={onSignedUrlExpired}
    />,
  );
  fireEvent.error(screen.getByLabelText(audioLabel));
  expect(onSignedUrlExpired).toHaveBeenCalledTimes(2);
});
