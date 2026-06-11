import React from 'react';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders the query inside the message', () => {
    render(<EmptyState query="foobar" />);
    expect(screen.getByText('Каналы не найдены')).toBeInTheDocument();
    // After i18n migration the message is a single interpolated string —
    // match by substring so the test isn't coupled to JSX structure.
    expect(
      screen.getByText((_, node) => Boolean(node?.textContent?.includes('«foobar»'))),
    ).toBeInTheDocument();
  });

  it('renders without crashing on empty query', () => {
    render(<EmptyState query="" />);
    expect(screen.getByText('Каналы не найдены')).toBeInTheDocument();
  });
});
