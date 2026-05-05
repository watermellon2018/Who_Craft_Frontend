import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfileCompletion from './ProfileCompletion';
import { ProfileCompletion as ProfileCompletionType } from '../types';

function makeCompletion(overrides: Partial<ProfileCompletionType['items']> = {}, percent = 0): ProfileCompletionType {
  return {
    percent,
    items: {
      avatar: false,
      about: false,
      interests: false,
      socials: false,
      ...overrides,
    },
  };
}

describe('ProfileCompletion', () => {
  it('renders the percent value', () => {
    render(<ProfileCompletion completion={makeCompletion({}, 75)} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows all four checklist labels', () => {
    render(<ProfileCompletion completion={makeCompletion()} />);
    expect(screen.getByText(/аватар/i)).toBeInTheDocument();
    expect(screen.getByText(/о себе/i)).toBeInTheDocument();
    expect(screen.getByText(/интересы/i)).toBeInTheDocument();
    expect(screen.getByText(/соцсети/i)).toBeInTheDocument();
  });

  it('renders 0% when nothing is filled', () => {
    render(<ProfileCompletion completion={makeCompletion({}, 0)} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders 100% correctly', () => {
    render(<ProfileCompletion completion={makeCompletion({ avatar: true, about: true, interests: true, socials: true }, 100)} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows filled checkmark for completed items', () => {
    render(<ProfileCompletion completion={makeCompletion({ about: true }, 25)} />);
    const chips = screen.getAllByText(/✓/);
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });
});
