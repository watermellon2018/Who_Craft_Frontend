import React from 'react';
import {act, render, screen} from '@testing-library/react';
import i18n from '../i18n';
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

test('renders the root fallback in English when English is selected', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await act(async () => {
    await i18n.changeLanguage('en');
  });

  render(
    <AppErrorBoundary>
      <BrokenPage />
    </AppErrorBoundary>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Could not open the page');
  expect(screen.getByRole('link', {name: 'Go to projects'})).toHaveAttribute('href', '/project-list');

  await act(async () => {
    await i18n.changeLanguage('ru');
  });
  consoleError.mockRestore();
});
