import type {ComponentType} from 'react';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import type {ProjectListItem} from '../../../../api/projects/projectList';
import {fetchProjectList} from '../../../../api/projects/projectList';
import {ProjectListPage} from './list';

jest.mock('../../../../utils/auth/check_auth', () => ({
  __esModule: true,
  default: (Component: ComponentType) => Component,
}));

jest.mock('../../../../modules/profile/components/DashboardHeader', () => ({
  __esModule: true,
  default: () => <div>Dashboard header</div>,
}));

jest.mock('./InvitationsBlock', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./ProjectCardBadges', () => ({
  __esModule: true,
  default: () => <div>Project badges</div>,
}));

jest.mock('../../../../api/http', () => ({
  backendAssetUrl: (path: string) => `https://backend.test${path}`,
}));

jest.mock('../../../../api/projects/projectList', () => ({
  deleteProjectById: jest.fn(),
  fetchProjectList: jest.fn(),
}));

const mockFetchProjectList = fetchProjectList as jest.MockedFunction<typeof fetchProjectList>;

const project: ProjectListItem = {
  id: 7,
  title: 'Проект без обложки',
  description: '',
  status: 'draft',
  statusLabel: 'Черновик',
  coverImageUrl: null,
  updatedAt: null,
  updatedAtLabel: '',
  isFavorite: false,
  tags: [],
  stats: {charactersTotal: 0, scenesTotal: 0},
  currentUserRole: 'owner',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );
}

describe('ProjectListPage', () => {
  beforeEach(() => {
    mockFetchProjectList.mockReset();
  });

  it('shows an explicit loading state', () => {
    mockFetchProjectList.mockReturnValueOnce(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Загружаем проекты');
  });

  it('shows an error state and retries the request', async () => {
    mockFetchProjectList
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить проекты');
    fireEvent.click(screen.getByRole('button', {name: 'Повторить'}));

    expect(await screen.findByText('У вас пока нет проектов')).toBeInTheDocument();
    expect(mockFetchProjectList).toHaveBeenCalledTimes(2);
  });

  it('shows an explicit empty state', async () => {
    mockFetchProjectList.mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText('У вас пока нет проектов')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the local CSS placeholder when a project has no cover', async () => {
    mockFetchProjectList.mockResolvedValueOnce([project]);

    renderPage();

    const coverButton = await screen.findByRole('button', {
      name: 'Открыть проект «Проект без обложки»',
    });
    expect(coverButton).toHaveClass('project-card-placeholder');
    expect(document.querySelector('.project-card-cover-image')).not.toBeInTheDocument();
  });
});
