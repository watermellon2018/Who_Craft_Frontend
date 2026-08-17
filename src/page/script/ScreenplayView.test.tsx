import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';

import ScreenplayView from './ScreenplayView';
import type {CompactCharacter, Scene} from './types';

const scene: Scene = {
  id: 1,
  title: 'Анчоус на колесе',
  description: '',
  scriptText: 'ИНТ. КУХНЯ — ДЕНЬ',
  scriptBlocks: [{
    id: 'heading-1',
    type: 'scene_heading',
    text: 'ИНТ. КУХНЯ — ДЕНЬ',
  }],
  status: 'draft',
  order: 1,
  act: 1,
  durationSeconds: 60,
  mood: 'calm',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-08-17T00:00:00Z',
};

const characters: CompactCharacter[] = [{
  id: 'anchovy',
  name: 'Анчоус',
  role: 'lead',
  roleLabel: 'Главный герой',
  shortDescription: '',
  personality: {},
  backstory: '',
  speechStyle: '',
  imageUrl: '',
  sceneCount: 0,
  sceneIds: [],
}, {
  id: 'henry',
  name: 'Энтри Дог',
  role: 'support',
  roleLabel: 'Второстепенный герой',
  shortDescription: '',
  personality: {},
  backstory: '',
  speechStyle: '',
  imageUrl: '',
  sceneCount: 0,
  sceneIds: [],
}];

const renderView = (overrides: Partial<React.ComponentProps<typeof ScreenplayView>> = {}) => {
  const props: React.ComponentProps<typeof ScreenplayView> = {
    characters: [],
    selectedScene: scene,
    sceneCount: 2,
    scenePosition: 1,
    canEdit: true,
    dirtySceneIds: [],
    savingSceneIds: [],
    onChange: jest.fn(),
    onSave: jest.fn(),
    onAddScene: jest.fn(),
    onDeleteScene: jest.fn(),
    ...overrides,
  };
  render(<ScreenplayView {...props} />);
  return props;
};

const StatefulScreenplayView = ({
  initialScene,
  projectCharacters = [],
  onSceneChange,
}: {
  initialScene: Scene;
  projectCharacters?: CompactCharacter[];
  onSceneChange?: (scene: Scene) => void;
}) => {
  const [currentScene, setCurrentScene] = React.useState(initialScene);
  return <ScreenplayView
    characters={projectCharacters}
    selectedScene={currentScene}
    sceneCount={1}
    scenePosition={1}
    canEdit
    dirtySceneIds={[]}
    savingSceneIds={[]}
    onChange={(_sceneId, update) => {
      setCurrentScene((current) => {
        const next = {...current, ...update};
        onSceneChange?.(next);
        return next;
      });
    }}
    onSave={jest.fn()}
    onAddScene={jest.fn()}
    onDeleteScene={jest.fn()}
  />;
};

test('Enter splits a screenplay paragraph and infers the next format', () => {
  const props = renderView();
  const heading = screen.getByRole('textbox', {name: 'Заголовок сцены'}) as HTMLTextAreaElement;
  heading.setSelectionRange(5, 5);

  fireEvent.keyDown(heading, {key: 'Enter'});

  expect(props.onChange).toHaveBeenCalledWith(1, expect.objectContaining({
    scriptBlocks: [
      expect.objectContaining({type: 'scene_heading', text: 'ИНТ. '}),
      expect.objectContaining({type: 'action', text: 'КУХНЯ — ДЕНЬ'}),
    ],
  }));
});

test('Shift+Enter keeps a line break native and Tab changes the active format', () => {
  const props = renderView();
  const heading = screen.getByRole('textbox', {name: 'Заголовок сцены'});

  fireEvent.keyDown(heading, {key: 'Enter', shiftKey: true});
  expect(props.onChange).not.toHaveBeenCalled();

  fireEvent.keyDown(heading, {key: 'Tab'});
  expect(props.onChange).toHaveBeenCalledWith(1, expect.objectContaining({
    scriptBlocks: [expect.objectContaining({type: 'action'})],
  }));
});

test('keeps scene parameters closed until the user asks for them', () => {
  renderView();

  expect(screen.queryByText('Карточка сцены')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Параметры сцены'}));
  expect(screen.getByText('Карточка сцены')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Закрыть параметры сцены'})).toHaveFocus();
  expect(screen.getByText('Заметки')).toBeInTheDocument();
  expect(screen.queryByText('Участники')).not.toBeInTheDocument();
  expect(screen.queryByText('Настроение')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Новый трек/})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /^Сохранить$/})).not.toBeInTheDocument();
});

test('deletes an accidentally added block from the page', () => {
  render(<StatefulScreenplayView initialScene={{
    ...scene,
    scriptBlocks: [{id: 'action-only', type: 'action', text: 'Лишнее действие'}],
  }} />);
  const action = screen.getByRole('textbox', {name: 'Действие'});
  fireEvent.focus(action);

  fireEvent.click(screen.getByRole('button', {name: 'Удалить абзац «Действие»'}));

  expect(screen.queryByRole('textbox', {name: 'Действие'})).not.toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: 'Начните со строки места и времени действия',
  })).toBeInTheDocument();
});

test('Backspace at the start removes an accidental paragraph and returns to the previous one', () => {
  render(<StatefulScreenplayView initialScene={{
    ...scene,
    scriptBlocks: [
      {id: 'character-1', type: 'character', text: 'АНЧОУС'},
      {id: 'accidental-action', type: 'action', text: ''},
    ],
  }} />);
  const action = screen.getByRole('textbox', {name: 'Действие'}) as HTMLTextAreaElement;
  fireEvent.focus(action);
  action.setSelectionRange(0, 0);

  fireEvent.keyDown(action, {key: 'Backspace'});

  expect(screen.queryByRole('textbox', {name: 'Действие'})).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', {name: 'Персонаж'})).toHaveFocus();
});

test('filters project characters on the page and links the selected character to the scene', () => {
  const onSceneChange = jest.fn();
  render(<StatefulScreenplayView
    initialScene={{
      ...scene,
      scriptBlocks: [{id: 'character-empty', type: 'character', text: ''}],
    }}
    projectCharacters={characters}
    onSceneChange={onSceneChange}
  />);
  const characterBlock = screen.getByRole('textbox', {name: 'Персонаж'});

  fireEvent.change(characterBlock, {target: {value: 'энт'}});

  expect(screen.getByRole('listbox', {name: 'Персонажи проекта'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: /Анчоус/})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', {name: /Энтри Дог/}));

  expect(characterBlock).toHaveValue('ЭНТРИ ДОГ');
  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [expect.objectContaining({id: 'henry'})],
    scriptBlocks: [expect.objectContaining({characterId: 'henry', text: 'ЭНТРИ ДОГ'})],
  }));

  fireEvent.change(characterBlock, {target: {value: 'Анчоус'}});
  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [expect.objectContaining({id: 'anchovy'})],
    scriptBlocks: [expect.objectContaining({characterId: 'anchovy'})],
  }));

  fireEvent.click(screen.getByRole('button', {name: 'Удалить абзац «Персонаж»'}));
  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [],
    scriptBlocks: [],
  }));
});

test('keeps dialogue character membership while typing and through undo', () => {
  const onSceneChange = jest.fn();
  render(<StatefulScreenplayView
    initialScene={{
      ...scene,
      scriptBlocks: [{id: 'dialogue-empty', type: 'dialogue', text: ''}],
    }}
    projectCharacters={characters}
    onSceneChange={onSceneChange}
  />);
  const dialogue = screen.getByRole('textbox', {name: 'Диалог'});
  fireEvent.focus(dialogue);

  fireEvent.change(screen.getByRole('combobox', {name: 'Персонаж реплики'}), {
    target: {value: 'henry'},
  });
  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [expect.objectContaining({id: 'henry'})],
  }));

  fireEvent.change(dialogue, {target: {value: 'Привет'}});
  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [expect.objectContaining({id: 'henry'})],
    scriptBlocks: [expect.objectContaining({characterId: 'henry', text: 'Привет'})],
  }));

  fireEvent.keyDown(dialogue, {key: 'z', ctrlKey: true});
  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [expect.objectContaining({id: 'henry'})],
    scriptBlocks: [expect.objectContaining({characterId: 'henry', text: ''})],
  }));

  fireEvent.keyDown(dialogue, {key: 'z', ctrlKey: true});
  const restoredScene = onSceneChange.mock.calls.at(-1)?.[0] as Scene;
  expect(restoredScene.characters).toEqual([]);
  expect(restoredScene.scriptBlocks[0]).not.toHaveProperty('characterId');
});

test('preserves participants from older scenes while editing unrelated text', () => {
  const onSceneChange = jest.fn();
  render(<StatefulScreenplayView
    initialScene={{
      ...scene,
      characters: [characters[0]],
      scriptBlocks: [{id: 'legacy-action', type: 'action', text: 'Колесо вращается'}],
    }}
    projectCharacters={characters}
    onSceneChange={onSceneChange}
  />);

  fireEvent.change(screen.getByRole('textbox', {name: 'Действие'}), {
    target: {value: 'Колесо медленно вращается'},
  });

  expect(onSceneChange).toHaveBeenLastCalledWith(expect.objectContaining({
    characters: [expect.objectContaining({id: 'anchovy'})],
  }));
});

test('restores legacy scene participants when undoing a dialogue assignment', () => {
  const onSceneChange = jest.fn();
  render(<StatefulScreenplayView
    initialScene={{
      ...scene,
      characters: [characters[1]],
      scriptBlocks: [{id: 'legacy-dialogue', type: 'dialogue', text: ''}],
    }}
    projectCharacters={characters}
    onSceneChange={onSceneChange}
  />);
  const dialogue = screen.getByRole('textbox', {name: 'Диалог'});
  fireEvent.focus(dialogue);

  fireEvent.change(screen.getByRole('combobox', {name: 'Персонаж реплики'}), {
    target: {value: 'henry'},
  });
  fireEvent.keyDown(dialogue, {key: 'z', ctrlKey: true});

  const restoredScene = onSceneChange.mock.calls.at(-1)?.[0] as Scene;
  expect(restoredScene.characters).toEqual([expect.objectContaining({id: 'henry'})]);
  expect(restoredScene.scriptBlocks[0]).not.toHaveProperty('characterId');
});

test('clears a hidden character link when changing to an unrelated paragraph type', () => {
  const onSceneChange = jest.fn();
  render(<StatefulScreenplayView
    initialScene={{
      ...scene,
      characters: [characters[1]],
      scriptBlocks: [{
        id: 'linked-character',
        type: 'character',
        text: 'ЭНТРИ ДОГ',
        characterId: 'henry',
      }],
    }}
    projectCharacters={characters}
    onSceneChange={onSceneChange}
  />);
  fireEvent.focus(screen.getByRole('textbox', {name: 'Персонаж'}));

  fireEvent.change(screen.getByRole('combobox', {name: 'Тип абзаца'}), {
    target: {value: 'action'},
  });

  const changedScene = onSceneChange.mock.calls.at(-1)?.[0] as Scene;
  expect(changedScene.characters).toEqual([]);
  expect(changedScene.scriptBlocks[0]).not.toHaveProperty('characterId');
});

test('opens character suggestions with slash inside a character paragraph', () => {
  render(<StatefulScreenplayView
    initialScene={{
      ...scene,
      scriptBlocks: [{id: 'character-empty', type: 'character', text: ''}],
    }}
    projectCharacters={characters}
  />);
  const characterBlock = screen.getByRole('textbox', {name: 'Персонаж'});
  fireEvent.blur(characterBlock);

  fireEvent.keyDown(characterBlock, {key: '/'});

  const listbox = screen.getByRole('listbox', {name: 'Персонажи проекта'});
  expect(listbox).toBeInTheDocument();
  expect(within(listbox).getAllByRole('option')).toHaveLength(2);

  fireEvent.keyDown(characterBlock, {key: 'ArrowDown'});
  fireEvent.keyDown(characterBlock, {key: 'Enter'});
  expect(characterBlock).toHaveValue('ЭНТРИ ДОГ');
});

test('opens the slash command menu for an empty screenplay paragraph', () => {
  renderView({
    selectedScene: {
      ...scene,
      scriptBlocks: [{id: 'empty-action', type: 'action', text: ''}],
      scriptText: '',
    },
  });
  const action = screen.getByRole('textbox', {name: 'Действие'});

  fireEvent.keyDown(action, {key: '/'});

  const formatList = screen.getByRole('listbox', {name: 'Формат абзаца'});
  expect(within(formatList).getByRole('option', {name: 'Персонаж'})).toBeInTheDocument();
});
