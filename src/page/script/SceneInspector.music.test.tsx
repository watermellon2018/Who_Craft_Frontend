import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import SceneInspector from './SceneInspector';
import type {Scene} from './types';

const scene: Scene = {
  id: 17,
  title: 'Ночной рынок',
  description: '',
  scriptText: '',
  scriptBlocks: [],
  status: 'draft',
  order: 3,
  act: 1,
  durationSeconds: 90,
  mood: 'tense',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-08-02T00:00:00Z',
};

const renderInspector = (canRunGeneration: boolean, onCreateMusic = jest.fn()) => {
  render(
    <SceneInspector
      scene={scene}
      characters={[]}
      canEdit={canRunGeneration}
      canRunGeneration={canRunGeneration}
      dirty={false}
      saving={false}
      onChange={jest.fn()}
      onDelete={jest.fn()}
      onSave={jest.fn()}
      onCreateMusic={onCreateMusic}
    />,
  );
  return onCreateMusic;
};

test('offers scene-scoped music generation only to users with generation permission', () => {
  const onCreateMusic = renderInspector(true);

  fireEvent.click(screen.getByRole('button', {name: /Новый трек/}));
  expect(onCreateMusic).toHaveBeenCalledWith(17);
});

test('hides the music mutation from a viewer', () => {
  renderInspector(false);

  expect(screen.queryByRole('button', {name: /Новый трек/})).not.toBeInTheDocument();
});
