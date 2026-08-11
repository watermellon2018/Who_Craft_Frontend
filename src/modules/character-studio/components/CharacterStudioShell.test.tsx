import React from 'react';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import CharacterStudioShell from './CharacterStudioShell';

jest.mock('../../profile/components/DashboardHeader', () => ({
  __esModule: true,
  default: ({breadcrumbItems}: {breadcrumbItems: Array<{label: string; to?: string}>}) => (
    <pre data-testid="breadcrumbs">{JSON.stringify(breadcrumbItems)}</pre>
  ),
}));
jest.mock('./CharacterTreeSidebar', () => () => null);
jest.mock('../hooks/useProjectIdFromRoute', () => ({
  useProjectIdFromRoute: () => 'project-1',
}));
jest.mock('../hooks/useCharacter', () => ({
  useCharacter: () => ({
    character: {
      character_id: 'draft-1',
      project_id: 1,
      name: 'Test 2',
      status: 'draft',
      identity_locked: false,
    },
  }),
}));
jest.mock('../../../api/projects/properties/project', () => ({
  fetch_project: () => new Promise(() => undefined),
}));

it('does not link a draft character breadcrumb to the editor from variants', () => {
  render(
    <MemoryRouter initialEntries={['/project/project-1/characters/draft-1/variants']}>
      <Routes>
        <Route
          path="/project/:projectId/characters/:characterId/variants"
          element={<CharacterStudioShell><div>Variants</div></CharacterStudioShell>}
        />
      </Routes>
    </MemoryRouter>,
  );

  const breadcrumbs = JSON.parse(screen.getByTestId('breadcrumbs').textContent ?? '[]');
  expect(breadcrumbs).toEqual(expect.arrayContaining([
    expect.objectContaining({label: 'Test 2'}),
    expect.objectContaining({label: 'Варианты'}),
  ]));
  expect(breadcrumbs.find((item: {label: string}) => item.label === 'Test 2')).not.toHaveProperty('to');
});
