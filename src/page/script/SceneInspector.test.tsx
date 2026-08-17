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

test('keeps act management and notes in the Cards inspector', () => {
  const onChange = jest.fn();
  render(
    <SceneInspector
      scene={scene}
      canEdit
      dirty={false}
      saving={false}
      onChange={onChange}
      onDelete={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  expect(screen.getByText('Структура')).toBeInTheDocument();
  const actSelect = screen.getByRole('combobox', {name: 'Акт'});
  expect(actSelect.closest('.ant-select')).toBeInTheDocument();
  expect(screen.getByText('Заметки')).toBeInTheDocument();
  expect(screen.queryByText('Описание')).not.toBeInTheDocument();
  expect(screen.queryByText('Хронометраж')).not.toBeInTheDocument();
  expect(screen.queryByText('Драматическая функция')).not.toBeInTheDocument();
  expect(screen.queryByText('Участники')).not.toBeInTheDocument();
  expect(screen.queryByText('Настроение')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Новый трек/})).not.toBeInTheDocument();

  fireEvent.mouseDown(actSelect);
  fireEvent.click(screen.getByText('Акт 2'));
  expect(onChange).toHaveBeenCalledWith(scene.id, {act: 2});
});

test('shows only private notes inside the screenplay drawer', () => {
  render(
    <SceneInspector
      scene={scene}
      canEdit
      dirty={false}
      saving={false}
      showSaveAction={false}
      showStructureFields={false}
      showTitleField={false}
      onChange={jest.fn()}
      onClose={jest.fn()}
      onDelete={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  expect(screen.getByText('Заметки')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Закрыть заметки сцены'})).toHaveFocus();
  expect(screen.queryByText('Структура')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', {name: 'Акт'})).not.toBeInTheDocument();
  expect(screen.queryByText('Заголовок')).not.toBeInTheDocument();
});
