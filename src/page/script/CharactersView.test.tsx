import {fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';

import CharactersView from './CharactersView';
import type {CompactCharacter, Scene, ScriptBlock} from './types';

const makeCharacter = (id: string, name: string): CompactCharacter => ({
  id,
  name,
  role: 'main',
  roleLabel: 'Главная роль',
  shortDescription: '',
  personality: {},
  backstory: '',
  speechStyle: '',
  imageUrl: '',
  sceneCount: 0,
  sceneIds: [],
});

const makeScene = (
  id: number,
  act: number,
  title: string,
  scriptBlocks: ScriptBlock[],
): Scene => ({
  id,
  title,
  description: '',
  scriptText: '',
  scriptBlocks,
  status: 'draft',
  order: id,
  act,
  durationSeconds: 0,
  mood: '',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-08-17T00:00:00Z',
});

const characterBlock = (id: string, characterId: string, text: string): ScriptBlock => ({
  id,
  type: 'character',
  characterId,
  text,
});

const dialogueBlock = (id: string, characterId: string, text: string): ScriptBlock => ({
  id,
  type: 'dialogue',
  characterId,
  text,
});

const characters = [
  makeCharacter('anna', 'Анна'),
  makeCharacter('max', 'Максим'),
  makeCharacter('elena', 'Елена'),
];

const scenes = [
  makeScene(1, 1, 'Встреча', [
    characterBlock('anna-1', 'anna', 'АННА'),
    dialogueBlock('anna-line-1', 'anna', 'Привет, Максим'),
    characterBlock('max-1', 'max', 'МАКСИМ'),
    dialogueBlock('max-line-1', 'max', 'Привет'),
    characterBlock('anna-2', 'anna', 'АННА'),
    dialogueBlock('anna-line-2', 'anna', 'Как дела?'),
  ]),
  makeScene(2, 2, 'Разговор', [
    characterBlock('max-2', 'max', 'МАКСИМ'),
    dialogueBlock('max-line-2', 'max', 'Ты пришла'),
    characterBlock('elena-1', 'elena', 'ЕЛЕНА'),
    dialogueBlock('elena-line-1', 'elena', 'Да'),
  ]),
];

describe('CharactersView', () => {
  it('builds an objective graph from linked dialogue turns and opens relationship details', () => {
    render(<CharactersView characters={characters} scenes={scenes} />);

    expect(screen.getAllByTestId('character-graph-node')).toHaveLength(3);
    expect(screen.getAllByRole('button', {name: /^Связь /})).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', {name: 'Связь Анна — Максим: 2 обмена'}));

    const details = screen.getByRole('complementary', {name: 'Детали анализа'});
    expect(within(details).getByRole('heading', {name: 'Анна — Максим'})).toBeInTheDocument();
    expect(within(details).getByText('Обмены').nextSibling).toHaveTextContent('2');
    expect(within(details).getByText('Общие сцены', {selector: 'dt'}).nextSibling).toHaveTextContent('1');
    expect(within(details).getByText('Акт 1 · 2 обмена')).toBeInTheDocument();
    expect(within(details).getByText('Встреча')).toBeInTheDocument();
  });

  it('opens character facts from the graph with the keyboard', () => {
    render(<CharactersView characters={characters} scenes={scenes} />);
    const annaNode = screen.getByRole('button', {name: 'Анна: 2 реплики'});

    fireEvent.keyDown(annaNode, {key: 'Enter'});

    const details = screen.getByRole('complementary', {name: 'Детали анализа'});
    expect(within(details).getByRole('heading', {name: 'Анна'})).toBeInTheDocument();
    expect(within(details).getByText('Реплики').nextSibling).toHaveTextContent('2');
    expect(within(details).getByText('Слова').nextSibling).toHaveTextContent('4');
    expect(within(details).getByText('Максим')).toBeInTheDocument();
  });

  it('recalculates the graph for an act', () => {
    render(<CharactersView characters={characters} scenes={scenes} />);

    fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Период анализа'}));
    fireEvent.click(screen.getByText('Акт 2'));

    expect(screen.getAllByTestId('character-graph-node')).toHaveLength(2);
    expect(screen.getByRole('button', {name: 'Связь Елена — Максим: 1 обмен'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /^Анна:/})).not.toBeInTheDocument();
  });

  it('lets the user choose N characters and then show everyone', () => {
    render(<CharactersView characters={characters} scenes={scenes} />);
    const limitInput = screen.getByRole('spinbutton', {name: 'Персонажей на графе'});

    fireEvent.change(limitInput, {target: {value: '2'}});

    expect(screen.getAllByTestId('character-graph-node')).toHaveLength(2);
    expect(screen.getByText(/Показано 2 из 3 персонажей/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Показать всех персонажей'}));

    expect(screen.getAllByTestId('character-graph-node')).toHaveLength(3);
    expect(screen.getByRole('button', {name: 'Показать всех персонажей'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains when project characters are not linked in the screenplay', () => {
    render(<CharactersView
      characters={[makeCharacter('anna', 'Анна')]}
      scenes={[makeScene(1, 1, 'Пустая сцена', [{id: 'action', type: 'action', text: 'Тишина'}])]}
    />);

    expect(screen.getByRole('heading', {name: 'Нет привязанных персонажей'})).toBeInTheDocument();
    expect(screen.queryAllByTestId('character-graph-node')).toHaveLength(0);
  });

  it('renders the empty state when there are no project characters', () => {
    render(<CharactersView characters={[]} scenes={[]} />);

    expect(screen.getByRole('heading', {name: 'Персонажи пока не добавлены'})).toBeInTheDocument();
    expect(screen.queryAllByTestId('character-graph-node')).toHaveLength(0);
  });

  it('zooms with the mouse wheel and pans an enlarged graph by dragging', () => {
    render(<CharactersView characters={characters} scenes={scenes} />);
    const graph = screen.getByRole('group', {name: /Граф связей: 3 персонажей/});
    const viewport = screen.getByRole('region', {name: 'Навигация по графу'});
    jest.spyOn(graph, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 500,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const initialViewBox = graph.getAttribute('viewBox');
    fireEvent.wheel(viewport, {clientX: 500, clientY: 250, deltaY: -100});

    expect(graph.getAttribute('viewBox')).not.toBe(initialViewBox);
    expect(screen.getByText('110%')).toBeInTheDocument();

    const zoomedViewBox = graph.getAttribute('viewBox');
    const pointerEvent = (type: string, clientX: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX,
        clientY: 250,
      });
      Object.defineProperties(event, {
        isPrimary: {value: true},
        pointerId: {value: 1},
      });
      return event;
    };
    fireEvent(graph, pointerEvent('pointerdown', 500));
    fireEvent(graph, pointerEvent('pointermove', 400));
    fireEvent(graph, pointerEvent('pointerup', 400));

    expect(graph.getAttribute('viewBox')).not.toBe(zoomedViewBox);
    expect(screen.queryByRole('combobox', {name: 'Масштаб графа'})).not.toBeInTheDocument();

    fireEvent.keyDown(viewport, {key: '0'});
    expect(graph).toHaveAttribute('viewBox', '0 0 1200 640');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('lets the user hide and restore the analysis details sidebar', () => {
    const {container} = render(<CharactersView characters={characters} scenes={scenes} />);
    const hideDetails = screen.getByRole('button', {name: 'Скрыть панель деталей'});

    expect(hideDetails).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('complementary', {name: 'Детали анализа'})).toBeInTheDocument();

    fireEvent.click(hideDetails);

    expect(screen.queryByRole('complementary', {name: 'Детали анализа'})).not.toBeInTheDocument();
    expect(container.querySelector('.character-analysis__body')).toHaveClass('is-details-collapsed');
    const showDetails = screen.getByRole('button', {name: 'Показать панель деталей'});
    expect(showDetails).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(showDetails);

    expect(screen.getByRole('complementary', {name: 'Детали анализа'})).toBeInTheDocument();
  });
});
