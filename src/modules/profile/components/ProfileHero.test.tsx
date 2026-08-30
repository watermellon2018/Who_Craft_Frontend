import {render, screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import ProfileHero from './ProfileHero';
import type {ProfileUser} from '../types';

const user: ProfileUser = {
  avatar_url: null,
  bio: '',
  cover_url: null,
  display_name: 'Анна Кино',
  effective_username: 'anna_kino',
  id: 7,
  joined_at: '2024-01-01',
  location: '',
  subscribers_count: 21,
  tagline: '',
  username: 'anna-login',
};

describe('ProfileHero', () => {
  it('shows the public username, subscriber count, and full localized join date', () => {
    render(
      <MemoryRouter>
        <ProfileHero user={user} />
      </MemoryRouter>,
    );

    expect(screen.getByText('@anna_kino')).toBeInTheDocument();
    expect(screen.getByText('21 подписчик')).toBeInTheDocument();
    expect(screen.getByText(/На WCraft с 1 января 2024/)).toBeInTheDocument();
  });
});
