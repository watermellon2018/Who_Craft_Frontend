import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import CharacterCard from './CharacterCard';
import {StudioCharacter} from '../types/character.types';

const character: StudioCharacter = {
  character_id: 'character-1',
  project_id: 1,
  name: 'Mira',
  role: 'main',
  identity_locked: true,
  references: [{asset_id: 'asset-1', image_url: 'https://example.com/mira.png', asset_type: 'portrait'}],
};

test('opens editing from the whole card without rendering a separate Edit button', () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  render(<CharacterCard character={character} onEdit={onEdit} onDelete={onDelete} />);
  const card = screen.getByRole('button', {name: /редактировать персонажа/i});
  fireEvent.click(card);
  fireEvent.click(screen.getByRole('button', {name: /удалить персонажа/i}));

  expect(screen.getByText('Mira')).toBeInTheDocument();
  expect(screen.getByText('Главный герой')).toBeInTheDocument();
  expect(screen.getByText('locked')).toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test('uses a native keyboard-focusable control for editing', () => {
  const onEdit = jest.fn();

  render(<CharacterCard character={character} onEdit={onEdit} onDelete={jest.fn()} />);
  const editControl = screen.getByRole('button', {name: /редактировать персонажа/i});
  editControl.focus();
  fireEvent.click(editControl);

  expect(editControl.tagName).toBe('BUTTON');
  expect(editControl).toHaveFocus();
  expect(onEdit).toHaveBeenCalledTimes(1);
});
