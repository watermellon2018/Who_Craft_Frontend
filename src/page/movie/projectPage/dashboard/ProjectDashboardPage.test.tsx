import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

jest.mock('../../../../modules/profile/components/DashboardHeader', () =>
  function MockDashboardHeader() {
    return <header>Dashboard header</header>;
  },
);
jest.mock('../../../../modules/profile/api/profileApi');
jest.mock('./api');

import {fetchDashboard} from '../../../../modules/profile/api/profileApi';
import {fetchProjectDashboard} from './api';
import {ProjectDashboardPage} from './ProjectDashboardPage';

const mockedFetchDashboard = fetchDashboard as jest.MockedFunction<typeof fetchDashboard>;
const mockedFetchProjectDashboard = fetchProjectDashboard as jest.MockedFunction<typeof fetchProjectDashboard>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedFetchDashboard.mockResolvedValue({user: null} as never);
});

it.each([
  [401, 'Требуется повторная авторизация'],
  [403, 'Нет доступа к проекту'],
  [404, 'Проект не найден'],
])('renders the %i dashboard API state for a canonical deep link', async (status, message) => {
  mockedFetchProjectDashboard.mockRejectedValue({response: {status}});

  render(
    <MemoryRouter initialEntries={['/projects/42']}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(mockedFetchProjectDashboard).toHaveBeenCalledWith('42');
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });
  expect(screen.queryByText('Cyber City Dawn')).not.toBeInTheDocument();
});