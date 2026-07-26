import React from 'react';
import { render, screen } from '@testing-library/react';
import SubscriptionStats from './SubscriptionStats';

describe('SubscriptionStats', () => {
  it('renders total and favorites counts', () => {
    render(<SubscriptionStats total={42} favorites={7} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders zeros without crashing', () => {
    render(<SubscriptionStats total={0} favorites={0} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
