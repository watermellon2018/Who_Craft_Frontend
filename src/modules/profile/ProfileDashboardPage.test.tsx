import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileDashboardPage from './ProfileDashboardPage';
import type { DashboardData } from './types';

// `ProfileSidebar` transitively imports `api/http`, which imports the
// ESM-only `axios` package. Jest's default transformer skips node_modules
// and barfs on the bare `import` statement. Stub the http module here so
// the test never touches axios at all.
jest.mock('../../api/http', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn()},
  getStoredUserToken: jest.fn(() => null),
  setStoredUserTokens: jest.fn(),
  clearStoredUserToken: jest.fn(),
  backendAssetUrl: (p: string) => p,
  logout: jest.fn(async () => undefined),
}));

const mockFetchDashboard = jest.fn();
jest.mock('./api/profileApi', () => ({
  fetchDashboard: () => mockFetchDashboard(),
  updateSettings: jest.fn(),
}));

// recharts uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function makeDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    user: {
      id: 1,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      cover_url: null,
      tagline: 'Тестовый тэглайн',
      bio: 'Текст о себе',
      location: 'Moscow',
      joined_at: '2024-01-01',
    },
    profile_completion: {
      percent: 50,
      items: { avatar: false, about: true, interests: true, socials: false },
    },
    stats: {
      new_messages: 2,
      subscriptions_count: 10,
      watch_history_count: 50,
      total_views: 1000,
      recommendations_count: 5,
      completed_lessons: 3,
    },
    awards: [
      { code: 'first_step', title: 'Первый шаг', description: '1 видео', unlocked: true },
    ],
    interests: ['Кино', 'ИИ'],
    favorite_genres: ['Фэнтези', 'Триллер'],
    views_analytics: {
      period: '30d',
      points: [{ date: '2026-04-01', views: 100 }],
      summary: {
        views: 1000,
        views_delta_percent: 10,
        unique_viewers: 800,
        unique_viewers_delta_percent: 5,
        average_watch_time: '3:00',
        average_watch_time_delta_percent: 2,
      },
    },
    recent_activity: [
      { type: 'subscription', text: 'Вы подписались на автора', created_at: '2026-05-01T10:00:00Z' },
    ],
    favorite_authors: [
      { id: 1, name: 'Visual Alchemist', avatar_url: null, subscribers_count: 10000, is_subscribed: true },
    ],
    continue_watching: [
      { id: 1, title: 'Тест видео', thumbnail_url: null, duration: '05:00', progress_percent: 40, continue_from: '02:00' },
    ],
    settings: { language: 'ru', private_account: false, notifications_enabled: true },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfileDashboardPage />
    </MemoryRouter>
  );
}

describe('ProfileDashboardPage', () => {
  beforeEach(() => {
    mockFetchDashboard.mockReset();
  });

  it('shows skeleton while loading', () => {
    mockFetchDashboard.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders user display name after successful load', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard());
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });
  });

  it('shows error card when API fails', async () => {
    mockFetchDashboard.mockRejectedValueOnce(new Error('500'));
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getByText(/не удалось загрузить/i)).toBeInTheDocument();
    });
  });

  it('retry button calls fetchDashboard again', async () => {
    mockFetchDashboard
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeDashboard());

    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText(/повторить/i));

    await act(async () => { fireEvent.click(screen.getByText(/повторить/i)); });

    await waitFor(() => {
      expect(mockFetchDashboard).toHaveBeenCalledTimes(2);
    });
  });

  it('renders quick stats after load', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard());
    await act(async () => { renderPage(); });
    await waitFor(() => {
      // Text appears in both sidebar and stats grid
      expect(screen.getAllByText('Сообщения').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Подписки').length).toBeGreaterThan(0);
    });
  });

  it('renders awards card', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard());
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getByText('Первый шаг')).toBeInTheDocument();
    });
  });

  it('renders interests in about card', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard());
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getByText('Кино')).toBeInTheDocument();
      expect(screen.getByText('ИИ')).toBeInTheDocument();
    });
  });

  it('renders continue watching video title', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard());
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getByText('Тест видео')).toBeInTheDocument();
    });
  });

  it('hides continue watching when the list is empty', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard({ continue_watching: [] }));
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Тест видео')).not.toBeInTheDocument();
  });

  it('hides awards when the list is empty', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard({ awards: [] }));
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Первый шаг')).not.toBeInTheDocument();
  });

  it('hides unavailable stats and analytics while keeping core cards', async () => {
    const dashboard = makeDashboard();
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard({
      stats: {...dashboard.stats, available: false},
      views_analytics: {...dashboard.views_analytics, available: false},
    }));

    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('1.0K')).not.toBeInTheDocument();
    expect(screen.queryByText('Статистика просмотров')).not.toBeInTheDocument();
    expect(screen.getByText('Текст о себе')).toBeInTheDocument();
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
  });

  it('hides every optional collection card when its array is empty', async () => {
    mockFetchDashboard.mockResolvedValueOnce(makeDashboard({
      awards: [],
      continue_watching: [],
      favorite_authors: [],
      favorite_genres: [],
      recent_activity: [],
    }));

    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Первый шаг')).not.toBeInTheDocument();
    expect(screen.queryByText('Фэнтези')).not.toBeInTheDocument();
    expect(screen.queryByText('Тест видео')).not.toBeInTheDocument();
    expect(screen.queryByText('Вы подписались на автора')).not.toBeInTheDocument();
    expect(screen.queryByText('Visual Alchemist')).not.toBeInTheDocument();
  });
});
