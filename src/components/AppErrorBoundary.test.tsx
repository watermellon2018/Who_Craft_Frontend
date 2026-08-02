import React from 'react';
import {render, screen} from '@testing-library/react';
import AppErrorBoundary from './AppErrorBoundary';

function BrokenPage(): React.ReactElement {
  throw new Error('render failed');
}

test('renders a recoverable root fallback when a child crashes', () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <AppErrorBoundary>
      <BrokenPage />
    </AppErrorBoundary>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось открыть страницу');
  expect(screen.getByRole('link', {name: 'К проектам'})).toHaveAttribute('href', '/project-list');
  consoleError.mockRestore();
});