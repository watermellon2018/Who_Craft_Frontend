import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import CharactersView from './CharactersView';
import type {CompactCharacter} from './types';

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

describe('CharactersView', () => {
  it('renders exactly one disconnected graph node per character', () => {
    const {container} = render(<CharactersView characters={[
      makeCharacter('anna', 'Анна'),
      makeCharacter('max', 'Максим'),
      makeCharacter('elena', 'Елена'),
    ]} />);

    expect(screen.getAllByTestId('character-graph-node')).toHaveLength(3);
    expect(container.querySelectorAll('line')).toHaveLength(0);
    expect(screen.queryByText('Персонажи истории')).not.toBeInTheDocument();
  });

  it('allows a graph node to be moved with the pointer', () => {
    render(<CharactersView characters={[makeCharacter('anna', 'Анна')]} />);
    const node = screen.getByTestId('character-graph-node');
    const graph = screen.getByRole('img', {name: 'Несвязный граф: 1 персонажей'});
    const initialTransform = node.getAttribute('transform');

    fireEvent(node, new MouseEvent('pointerdown', {bubbles: true, button: 0, clientX: 100, clientY: 100}));
    fireEvent(graph, new MouseEvent('pointermove', {bubbles: true, clientX: 180, clientY: 150}));
    fireEvent(graph, new MouseEvent('pointerup', {bubbles: true}));

    expect(node).not.toHaveAttribute('transform', initialTransform);
  });

  it('renders the empty state when there are no characters', () => {
    render(<CharactersView characters={[]} />);

    expect(screen.getByRole('heading', {name: 'Граф пока пуст'})).toBeInTheDocument();
    expect(screen.queryAllByTestId('character-graph-node')).toHaveLength(0);
  });
});
