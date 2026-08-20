import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import i18n from '../../../i18n';
import {fetch_project} from '../../../api/projects/properties/project';
import MusicStudioShell from './MusicStudioShell';

jest.mock('../../../api/projects/properties/project', () => ({
  fetch_project: jest.fn(),
}));

beforeEach(() => {
  (fetch_project as jest.MockedFunction<typeof fetch_project>)
    .mockResolvedValue({title: 'Project'} as never);
});
jest.mock('../../profile/components/DashboardHeader', () => ({
  __esModule: true,
  default: () => <header />,
}));

test('links music and sound effects within one project workspace', async () => {
  render(
    <MemoryRouter>
      <MusicStudioShell
        center={<div>center</div>}
        inspector={<div>inspector</div>}
        library={<div>library</div>}
        projectId="7"
        workspace="sound-effects"
      />
    </MemoryRouter>,
  );

  await waitFor(() => expect(fetch_project).toHaveBeenCalledWith('7'));

  expect(screen.getByRole('link', {name: i18n.t('soundEffects.navigation.music')}))
    .toHaveAttribute('href', '/project/7/music');
  expect(screen.getByRole('link', {name: i18n.t('soundEffects.navigation.effects')}))
    .toHaveAttribute('href', '/project/7/sound-effects');
  expect(screen.getByRole('link', {name: i18n.t('soundEffects.navigation.effects')}))
    .toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', {name: i18n.t('soundEffects.library.hide')}))
    .toBeInTheDocument();
});

test('removes the inspector column when no inspector content is provided', () => {
  const {container} = render(
    <MemoryRouter>
      <MusicStudioShell
        center={<div>center</div>}
        library={<div>library</div>}
        projectId="7"
      />
    </MemoryRouter>,
  );

  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(container.querySelector('.music-studio-shell'))
    .toHaveClass('music-studio-shell--inspector-closed');
});
