import React from 'react';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';

import i18n from '../../../i18n';
import {musicApi} from '../api/musicApi';
import type {MusicTrackDetail} from '../types';
import SceneAssignmentPanel from './SceneAssignmentPanel';

const nestedScene = {
  act: 2,
  characters: ['Anna'],
  durationSeconds: 45,
  location: 'Rooftop',
  mood: 'Tense',
  number: 7,
  sceneId: 42,
  summary: 'The heroine makes her decision.',
  title: 'Before dawn',
};

const secondScene = {
  ...nestedScene,
  act: 3,
  number: 9,
  sceneId: 43,
  summary: 'The team returns home.',
  title: 'Homecoming',
};

const track: MusicTrackDetail = {
  activeVersion: {
    audioUrl: '/media/v2.mp3',
    durationSeconds: 45,
    versionId: 'version-2',
    versionNumber: 2,
  },
  assignments: [
    {
      location: nestedScene.location,
      scene: nestedScene,
      sceneId: nestedScene.sceneId,
      sceneNumber: nestedScene.number,
      sceneTitle: nestedScene.title,
      startTimeSeconds: 3,
      trackVersionId: 'version-1',
      trackVersionNumber: 1,
    },
    {
      location: secondScene.location,
      scene: secondScene,
      sceneId: secondScene.sceneId,
      sceneNumber: secondScene.number,
      sceneTitle: secondScene.title,
      startTimeSeconds: 5,
      trackVersionId: 'version-2',
      trackVersionNumber: 2,
    },
  ],
  author: 'Project team',
  id: 12,
  source: 'manual',
  status: 'active',
  tags: [],
  title: 'Heroine theme',
  updatedAt: '2026-08-02T08:00:00Z',
  usageCount: 2,
  version: 4,
  versions: [
    {
      audioUrl: '/media/v1.mp3',
      durationSeconds: 45,
      versionId: 'version-1',
      versionNumber: 1,
    },
    {
      audioUrl: '/media/v2.mp3',
      durationSeconds: 45,
      versionId: 'version-2',
      versionNumber: 2,
    },
  ],
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('hydrates nested scenes and preserves mixed pinned versions when saving', async () => {
  const replaceAssignments = jest.spyOn(musicApi, 'replaceAssignments').mockResolvedValue({} as never);

  render(
    <SceneAssignmentPanel
      projectId="project-1"
      track={track}
      onSaved={() => undefined}
    />,
  );

  expect(await screen.findByText(nestedScene.summary)).toBeInTheDocument();
  expect(await screen.findByText(secondScene.summary)).toBeInTheDocument();
  const firstVersionSelect = screen
    .getByRole('combobox', {
      name: [i18n.t('musicStudio.assignment.pinnedVersion'), nestedScene.title].join(' '),
    })
    .closest('.ant-select');
  const secondVersionSelect = screen
    .getByRole('combobox', {
      name: [i18n.t('musicStudio.assignment.pinnedVersion'), secondScene.title].join(' '),
    })
    .closest('.ant-select');
  expect(firstVersionSelect).not.toBeNull();
  expect(secondVersionSelect).not.toBeNull();
  expect(within(firstVersionSelect as HTMLElement).getByText(
    i18n.t('musicStudio.track.version', {number: 1}),
  )).toBeInTheDocument();
  expect(within(secondVersionSelect as HTMLElement).getByText(
    i18n.t('musicStudio.track.version', {number: 2}),
  )).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('musicStudio.assignment.save'),
  }));

  await waitFor(() => expect(replaceAssignments).toHaveBeenCalledWith(
    'project-1',
    12,
    4,
    [
      {sceneId: 42, startTimeSeconds: 3, trackVersionId: 'version-1'},
      {sceneId: 43, startTimeSeconds: 5, trackVersionId: 'version-2'},
    ],
  ));
  expect(await screen.findByText(
    i18n.t('musicStudio.assignment.saved'),
  )).toBeInTheDocument();
});
