import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import RevisionHistory from './RevisionHistory';
import {CharacterRevision} from '../types/character.types';

const revision: CharacterRevision = {
  revision_id: 'revision-1',
  revision_number: 3,
  change_type: 'manual_update',
  changed_region: 'hair',
  change_summary: 'Changed hair color',
  created_at: '2026-04-27T00:00:00Z',
};

test('renders revisions and restores selected revision', () => {
  const onRestore = jest.fn();

  render(<RevisionHistory revisions={[revision]} onRestore={onRestore} />);
  fireEvent.click(screen.getByRole('button', {name: /восстановить/i}));

  expect(screen.getByText('Версия 3')).toBeInTheDocument();
  expect(screen.getByText('manual_update')).toBeInTheDocument();
  expect(screen.getByText('Волосы')).toBeInTheDocument();
  expect(onRestore).toHaveBeenCalledWith(revision);
});
