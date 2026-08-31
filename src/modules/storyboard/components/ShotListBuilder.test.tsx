import {fireEvent, render, screen, within} from '@testing-library/react';
import React, {useState} from 'react';

import {createInitialKeyframes} from '../model';
import type {StoryboardScene} from '../model';
import ShotListBuilder from './ShotListBuilder';

const longDescription = 'Анчоус выходит из магазина и останавливается у двери. '.repeat(5)
  + '\nОн замечает знакомого и машет ему рукой.';
const initialScene: StoryboardScene = {
  entities: [],
  id: 'scene-1',
  locationIds: [],
  order: 1,
  shots: [
    {
      characterIds: [],
      description: longDescription,
      id: 'shot-1',
      keyframes: createInitialKeyframes('shot-1'),
      order: 1,
      referenceIds: [],
      sceneId: 'scene-1',
      title: 'Встреча у магазина',
      transitions: [],
    },
    {
      characterIds: [],
      description: 'Продавец смотрит на гостей.',
      id: 'shot-2',
      keyframes: createInitialKeyframes('shot-2'),
      order: 2,
      referenceIds: [],
      sceneId: 'scene-1',
      title: 'Реакция продавца',
      transitions: [],
    },
  ],
  status: 'draft',
  text: 'Сценарий встречи.',
  title: 'Встреча',
};

function BuilderHarness() {
  const [scene, setScene] = useState(initialScene);
  return (
    <ShotListBuilder
      onAdd={jest.fn()}
      onConfirm={jest.fn()}
      onDelete={(shotId) => setScene((current) => ({
        ...current,
        shots: current.shots.filter((shot) => shot.id !== shotId),
      }))}
      onDuplicate={jest.fn()}
      onMove={(shotId, targetIndex) => setScene((current) => {
        const shots = [...current.shots];
        const [moved] = shots.splice(shots.findIndex((shot) => shot.id === shotId), 1);
        shots.splice(targetIndex, 0, moved);
        return {...current, shots};
      })}
      onUpdate={(shotId, patch) => setScene((current) => ({
        ...current,
        shots: current.shots.map((shot) => shot.id === shotId ? {...shot, ...patch} : shot),
      }))}
      scene={scene}
    />
  );
}

test('expands one shot at a time and retains multiline edits when collapsed', () => {
  render(<BuilderHarness />);
  expect(screen.getByRole('heading', {name: 'Кадры сцены · 2'})).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: /Встреча у магазина Развернуть/}));
  const description = screen.getByRole('textbox', {name: 'Описание кадра 1'});
  expect(description.tagName).toBe('TEXTAREA');
  expect(description).toHaveValue(longDescription);
  fireEvent.change(description, {target: {value: 'Первое действие.\nВторое действие.'}});
  fireEvent.change(screen.getByRole('textbox', {name: 'Название кадра 1'}), {
    target: {value: 'Новое название'},
  });
  fireEvent.click(screen.getByRole('button', {name: /Новое название Свернуть/}));

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByText('Первое действие. Второе действие.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: /Новое название Развернуть/}));
  expect(screen.getByRole('textbox', {name: 'Описание кадра 1'})).toHaveValue(
    'Первое действие.\nВторое действие.',
  );

  fireEvent.click(screen.getByRole('button', {name: /Реакция продавца Развернуть/}));
  expect(screen.queryByRole('textbox', {name: 'Описание кадра 1'})).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', {name: 'Описание кадра 2'})).toHaveValue(
    'Продавец смотрит на гостей.',
  );
});

test('keeps a shot expanded when reordering through the accessible menu', async () => {
  render(<BuilderHarness />);
  fireEvent.click(screen.getByRole('button', {name: /Реакция продавца Развернуть/}));
  expect(screen.getByRole('textbox', {name: 'Описание кадра 2'})).toHaveValue(
    'Продавец смотрит на гостей.',
  );

  fireEvent.click(screen.getByRole('button', {name: 'Действия с кадром 2'}));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Переместить выше'}));
  expect(screen.getAllByRole('button', {name: /Развернуть|Свернуть/})[0]).toHaveTextContent(
    'Реакция продавца',
  );
  expect(screen.getByRole('textbox', {name: 'Описание кадра 1'})).toHaveValue(
    'Продавец смотрит на гостей.',
  );
});

test('reorders from the drag handle without making the editable row draggable', () => {
  render(<BuilderHarness />);
  const summaries = screen.getAllByRole('button', {name: /Развернуть/});
  const sourceRow = summaries[0].closest('.storyboard-builder-shot') as HTMLElement;
  const targetRow = summaries[1].closest('.storyboard-builder-shot') as HTMLElement;
  expect(sourceRow).not.toHaveAttribute('draggable');
  const dataTransfer = {effectAllowed: '', setData: jest.fn()};
  fireEvent.dragStart(within(sourceRow).getByRole('button', {name: 'Перетащить кадр'}), {dataTransfer});
  fireEvent.dragOver(targetRow);
  fireEvent.drop(targetRow);
  expect(screen.getAllByRole('button', {name: /Развернуть/})[0]).toHaveTextContent(
    'Реакция продавца',
  );
});

test('collapses details when switching scenes, even if shot IDs are reused', () => {
  const props = {
    onAdd: jest.fn(),
    onConfirm: jest.fn(),
    onDelete: jest.fn(),
    onDuplicate: jest.fn(),
    onMove: jest.fn(),
    onUpdate: jest.fn(),
  };
  const {rerender} = render(<ShotListBuilder {...props} scene={initialScene} />);
  fireEvent.click(screen.getByRole('button', {name: /Встреча у магазина Развернуть/}));
  expect(screen.getByRole('textbox', {name: 'Описание кадра 1'})).toBeInTheDocument();

  rerender(<ShotListBuilder {...props} scene={{...initialScene, id: 'scene-2'}} />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Встреча у магазина Развернуть/})).toHaveAttribute(
    'aria-expanded', 'false',
  );
});
