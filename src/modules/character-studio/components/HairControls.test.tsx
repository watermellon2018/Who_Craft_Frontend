import {render, screen} from '@testing-library/react';
import React from 'react';

import HairControls from './HairControls';

test('does not select a replacement for an unknown hair length', () => {
  render(<HairControls value={{hair_length: 'buzz'}} onChange={jest.fn()} />);

  expect(screen.getByText('Выберите длину')).toBeInTheDocument();
  expect(screen.queryByText('Короткие')).not.toBeInTheDocument();
});

test('keeps a canonical hair length selected', () => {
  render(<HairControls value={{hair_length: 'short'}} onChange={jest.fn()} />);

  expect(screen.getByText('Короткие')).toBeInTheDocument();
});
