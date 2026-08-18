import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';

import SceneListPanel from './SceneListPanel';
import type {Scene} from './types';

const scenes: Scene[] = [{
  id: 1,
  title: 'Анчоус на колесе',
  description: '',
  scriptText: '',
  scriptBlocks: [],
  status: 'draft',
  order: 1,
  act: 1,
  durationSeconds: 0,
  mood: 'calm',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-08-17T00:00:00Z',
}, {
  id: 2,
  title: '',
  description: '',
  scriptText: '',
  scriptBlocks: [],
  status: 'draft',
  order: 2,
  act: 2,
  durationSeconds: 0,
  mood: 'calm',
  sceneType: 'development',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-08-17T00:00:00Z',
}];

const renderPanel = (collapsed = false) => {
  const props = {
    canEdit: true,
    collapsed,
    scenes,
    selectedSceneId: 1,
    onAdd: jest.fn(),
    onSelect: jest.fn(),
    onToggle: jest.fn(),
  };
  render(<SceneListPanel {...props} />);
  return props;
};

test('shows scene navigation in a separate right panel', () => {
  const props = renderPanel();
  const panel = screen.getByRole('complementary', {name: 'Список сцен'});

  expect(within(panel).getByText('СТРУКТУРА')).toBeInTheDocument();
  expect(within(panel).getByRole('heading', {name: 'Сцены'})).toBeInTheDocument();
  expect(within(panel).getByRole('button', {name: /Анчоус на колесе/}))
    .toHaveAttribute('aria-current', 'true');
  expect(within(panel).getByRole('button', {name: /Без названия/})).toBeInTheDocument();

  fireEvent.click(within(panel).getByRole('button', {name: /Без названия/}));
  fireEvent.click(within(panel).getByRole('button', {name: 'Добавить сцену'}));
  fireEvent.click(within(panel).getByRole('button', {name: 'Скрыть панель сцен'}));

  expect(props.onSelect).toHaveBeenCalledWith(2);
  expect(props.onAdd).toHaveBeenCalledTimes(1);
  expect(props.onToggle).toHaveBeenCalledTimes(1);
});

test('keeps only the restore control when the scene panel is collapsed', () => {
  renderPanel(true);
  const panel = screen.getByRole('complementary', {name: 'Список сцен'});

  expect(within(panel).queryByRole('heading', {name: 'Сцены'})).not.toBeInTheDocument();
  expect(within(panel).queryByText('Анчоус на колесе')).not.toBeInTheDocument();
  expect(within(panel).getByRole('button', {name: 'Открыть панель сцен'}))
    .toHaveAttribute('aria-expanded', 'false');
});
