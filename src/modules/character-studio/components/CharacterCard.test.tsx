import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import CharacterCard from './CharacterCard';
import {StudioCharacter} from '../types/character.types';

const character: StudioCharacter = {
  character_id: 'character-1',
  project_id: 1,
  name: 'Mira',
  role: 'lead',
  identity_locked: true,
  references: [{asset_id: 'asset-1', image_url: 'https://example.com/mira.png', asset_type: 'portrait'}],
};

test('renders character data and calls edit action', () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  render(<CharacterCard character={character} onEdit={onEdit} onDelete={onDelete} />);
  fireEvent.click(screen.getByRole('button', {name: /edit/i}));
  fireEvent.click(screen.getByRole('button', {name: /удалить персонажа/i}));

  expect(screen.getByText('Mira')).toBeInTheDocument();
  expect(screen.getByText('lead')).toBeInTheDocument();
  expect(screen.getByText('locked')).toBeInTheDocument();
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledTimes(1);
});
