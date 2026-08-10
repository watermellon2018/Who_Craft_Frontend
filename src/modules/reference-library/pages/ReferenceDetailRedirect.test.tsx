import {render, screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import ReferenceDetailRedirect from './ReferenceDetailRedirect';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

test('redirects the removed reference detail route to the editor', async () => {
  render(
    <MemoryRouter initialEntries={['/project/7/references/ref-location']}>
      <Routes>
        <Route
          path="/project/:projectId/references/:referenceId"
          element={<ReferenceDetailRedirect />}
        />
        <Route
          path="/project/:projectId/references/:referenceId/edit"
          element={<LocationProbe />}
        />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByTestId('location')).toHaveTextContent(
    '/project/7/references/ref-location/edit',
  );
});
