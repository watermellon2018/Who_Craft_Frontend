import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import type {ComponentProps} from 'react';

import CardsView from './CardsView';
import type {Scene} from './types';

jest.mock('./SceneInspector', () => {
  const MockSceneInspector = (props: {onActChange?: (sceneId: number, act: number) => void}) => <aside data-testid="scene-inspector">
    <button type="button" onClick={() => props.onActChange?.(1, 2)}>Сменить акт выбранной сцены</button>
  </aside>;
  MockSceneInspector.displayName = 'MockSceneInspector';
  return MockSceneInspector;
});

const makeScene = (overrides: Partial<Scene> = {}): Scene => ({
  id: 1,
  title: 'Опасный разговор',
  description: '',
  scriptText: '',
  scriptBlocks: [
    {id: 'heading', type: 'scene_heading', text: 'ИНТ. КАФЕ — НОЧЬ'},
    {id: 'action', type: 'action', text: 'Анна входит.'},
  ],
  status: 'draft',
  order: 1,
  act: 1,
  durationSeconds: 0,
  mood: 'calm',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '',
  ...overrides,
});

const characters = ['Анна', 'Борис', 'Вера', 'Глеб'].map((name, index) => ({
  id: `character-${index}`,
  name,
  role: 'supporting',
  roleLabel: 'Второстепенная роль',
  imageUrl: '',
}));

const scenes = [
  makeScene({characters}),
  makeScene({
    id: 2,
    title: 'Пустой черновик',
    order: 2,
    scriptBlocks: [{id: 'heading-2', type: 'scene_heading', text: 'ИНТ. ЛОКАЦИЯ — ДЕНЬ'}],
  }),
];

const renderView = (overrides: Partial<ComponentProps<typeof CardsView>> = {}) => {
  const props: ComponentProps<typeof CardsView> = {
    scenes,
    selectedScene: scenes[0],
    characterFilter: null,
    canEdit: true,
    dirtySceneIds: [2],
    savingSceneIds: [],
    reordering: false,
    onSelect: jest.fn(),
    onChange: jest.fn(),
    onSave: jest.fn(),
    onAdd: jest.fn(),
    onDelete: jest.fn(),
    onOpenScreenplay: jest.fn(),
    onReorder: jest.fn(() => new Promise<boolean>(() => undefined)),
    onClearFilter: jest.fn(),
    ...overrides,
  };
  const view = render(<CardsView {...props} />);
  return {props, ...view};
};

describe('CardsView structure board', () => {
  it('shows compact scene facts and visible empty and unsaved states', () => {
    renderView();

    expect(screen.getByRole('main', {name: 'Структура сценария'})).toBeInTheDocument();
    expect(screen.getByText('ИНТ. КАФЕ — НОЧЬ')).toBeInTheDocument();
    expect(screen.getByText('КАФЕ')).toBeInTheDocument();
    expect(screen.getByText('Анна · Борис · Вера · +1')).toBeInTheDocument();
    expect(screen.getByText('≈ < 1 мин')).toBeInTheDocument();
    expect(screen.getByText('Не сохранено')).toBeInTheDocument();
    expect(screen.getByText('Пустая')).toBeInTheDocument();
  });

  it('opens the chosen scene in the editor on double click', () => {
    const {props} = renderView();
    const cardContent = screen.getByRole('button', {
      name: 'Опасный разговор',
    });

    fireEvent.doubleClick(cardContent);

    expect(props.onOpenScreenplay).toHaveBeenCalledWith(1);
  });

  it('moves a scene to another act with drag and drop', () => {
    const {props} = renderView();
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      setData: jest.fn(),
    };

    fireEvent.dragStart(screen.getByTestId('scene-card-1'), {dataTransfer});
    fireEvent.dragOver(screen.getByTestId('act-drop-2'), {dataTransfer});
    fireEvent.drop(screen.getByTestId('act-drop-2'), {dataTransfer});

    expect(props.onReorder).toHaveBeenCalledWith([
      {id: 2, order: 1, act: 1},
      {id: 1, order: 2, act: 2},
    ]);
  });

  it('offers keyboard-operable movement controls', () => {
    const {props} = renderView();

    fireEvent.click(screen.getByRole('button', {name: 'Переместить сцену 1 в следующий акт'}));

    expect(props.onReorder).toHaveBeenCalledWith([
      {id: 2, order: 1, act: 1},
      {id: 1, order: 2, act: 2},
    ]);
  });

  it('keeps continuous ordering when the act changes in the inspector', () => {
    const {props} = renderView();

    fireEvent.click(screen.getByRole('button', {name: 'Сменить акт выбранной сцены'}));

    expect(props.onChange).not.toHaveBeenCalledWith(1, expect.objectContaining({act: 2}));
    expect(props.onReorder).toHaveBeenCalledWith([
      {id: 2, order: 1, act: 1},
      {id: 1, order: 2, act: 2},
    ]);
  });

  it('keeps movement controls mounted and restores focus after saving the order', () => {
    const focusScenes = [
      makeScene({id: 2, order: 1, title: 'Первая сцена', act: 1}),
      makeScene({id: 1, order: 2, act: 2}),
    ];
    const movedScenes = [focusScenes[0], {...focusScenes[1], act: 3}];
    const {props, rerender} = renderView({
      scenes: focusScenes,
      selectedScene: focusScenes[1],
    });
    const moveButton = screen.getByRole('button', {name: 'Переместить сцену 2 в следующий акт'});
    moveButton.focus();
    fireEvent.click(moveButton);

    rerender(<CardsView {...props} scenes={movedScenes} selectedScene={movedScenes[1]} reordering />);
    expect(screen.getByRole('button', {name: 'Переместить сцену 2 в следующий акт'})).toBeDisabled();

    rerender(<CardsView {...props} scenes={movedScenes} selectedScene={movedScenes[1]} reordering={false} />);
    expect(screen.getByRole('button', {name: 'Опасный разговор'})).toHaveFocus();
  });

  it('announces a move only after the new order is saved', async () => {
    const onReorder = jest.fn().mockResolvedValue(false);
    renderView({onReorder});

    fireEvent.click(screen.getByRole('button', {name: 'Переместить сцену 1 в следующий акт'}));

    expect(await screen.findByText('Не удалось переместить сцену «Опасный разговор». Порядок не изменён.')).toBeInTheDocument();
    expect(screen.queryByText('Сцена «Опасный разговор» перемещена в акт 2.')).not.toBeInTheDocument();
  });

  it('includes compact scene facts in the card accessible description', () => {
    renderView();

    expect(screen.getByRole('button', {name: 'Опасный разговор'})).toHaveAccessibleDescription(
      expect.stringContaining('Место: КАФЕ'),
    );
    expect(screen.getByRole('button', {name: 'Опасный разговор'})).toHaveAccessibleDescription(
      expect.stringContaining('Персонажи: Анна · Борис · Вера · +1'),
    );
  });
});
