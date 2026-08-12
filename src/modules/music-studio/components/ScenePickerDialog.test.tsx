import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

import i18n from '../../../i18n';
import {musicApi} from '../api/musicApi';
import type {MusicSceneOption} from '../types';
import ScenePickerDialog from './ScenePickerDialog';

const scene: MusicSceneOption = {
  act: 1,
  characters: ['Анна'],
  durationSeconds: 42,
  location: 'Крыша',
  mood: 'Тревога',
  number: 3,
  sceneId: 17,
  summary: 'Героиня принимает решение.',
  title: 'Перед рассветом',
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the scene picker and its mask in locally scoped modal roots', async () => {
  jest.spyOn(musicApi, 'listSceneOptions').mockResolvedValue({
    data: {items: [], nextCursor: null},
  } as never);

  render(
    <ScenePickerDialog
      open
      projectId="project-1"
      selected={[]}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />,
  );

  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveClass('music-scene-picker');
  expect(document.querySelector('.music-scene-picker-root > .ant-modal-mask')).toBeInTheDocument();
  expect(dialog.querySelector('.ant-modal-content')).toBeInTheDocument();
  expect(await screen.findByText(i18n.t('musicStudio.scene.empty'))).toBeInTheDocument();
});

test('keeps scene selection, confirmation and every close control working', async () => {
  jest.spyOn(musicApi, 'listSceneOptions').mockResolvedValue({
    data: {items: [scene], nextCursor: null},
  } as never);
  const onClose = jest.fn();
  const onConfirm = jest.fn();

  render(
    <ScenePickerDialog
      open
      projectId="project-1"
      selected={[]}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );

  fireEvent.click(await screen.findByText(scene.summary));
  fireEvent.click(screen.getByRole('button', {
    name: i18n.t('musicStudio.scene.confirm'),
  }));
  expect(onConfirm).toHaveBeenCalledWith([scene]);

  fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement);
  fireEvent.click(screen.getByRole('button', {name: i18n.t('common.cancel')}));
  fireEvent.keyDown(document.querySelector('.ant-modal-wrap') as HTMLElement, {
    key: 'Escape',
    keyCode: 27,
  });

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(3));
});
