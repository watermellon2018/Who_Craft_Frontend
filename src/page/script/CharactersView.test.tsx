import {render, screen} from '@testing-library/react';
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
  });

  it('renders the empty state when there are no characters', () => {
    render(<CharactersView characters={[]} />);

    expect(screen.getByRole('heading', {name: 'Граф пока пуст'})).toBeInTheDocument();
    expect(screen.queryAllByTestId('character-graph-node')).toHaveLength(0);
  });
});
