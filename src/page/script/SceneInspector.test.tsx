import React from 'react';
import {render, screen} from '@testing-library/react';

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

test('keeps screenplay metadata and notes without unrelated production actions', () => {
  render(
    <SceneInspector
      scene={scene}
      canEdit
      dirty={false}
      saving={false}
      onChange={jest.fn()}
      onDelete={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  expect(screen.getByText('Карточка сцены')).toBeInTheDocument();
  expect(screen.getByText('Описание')).toBeInTheDocument();
  expect(screen.getByText('Акт')).toBeInTheDocument();
  expect(screen.getByText('Хронометраж')).toBeInTheDocument();
  expect(screen.getByText('Драматическая функция')).toBeInTheDocument();
  expect(screen.getByText('Заметки')).toBeInTheDocument();
  expect(screen.queryByText('Участники')).not.toBeInTheDocument();
  expect(screen.queryByText('Настроение')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Новый трек/})).not.toBeInTheDocument();
});
