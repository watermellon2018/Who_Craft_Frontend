import React, {useEffect, useState} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryRouter, RouterProvider, useNavigate} from 'react-router-dom';
import {useUnsavedChangesGuard} from './useUnsavedChangesGuard';
import {AUTH_EXPIRED_EVENT} from '../api/http';

function GuardProbe() {
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const {allowNextNavigation} = useUnsavedChangesGuard(dirty);

  useEffect(() => {
    const redirectToLogin = () => navigate('/login');
    window.addEventListener(AUTH_EXPIRED_EVENT, redirectToLogin);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, redirectToLogin);
    };
  }, [navigate]);

  return (
    <div>
      <button type="button" onClick={() => setDirty(true)}>Edit</button>
      <button type="button" onClick={() => navigate('/next')}>Navigate</button>
      <button type="button" onClick={() => navigate('/login')}>Navigate to login</button>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))}>Expire auth</button>
      <button type="button" onClick={() => {
        allowNextNavigation();
        navigate('/next');
      }}>
        Save and navigate
      </button>
    </div>
  );
}

function renderGuard() {
  const router = createMemoryRouter([
    {path: '/', element: <GuardProbe />},
    {path: '/next', element: <div>Next page</div>},
    {path: '/login', element: <div>Login page</div>},
  ]);
  return {router, ...render(<RouterProvider router={router} />)};
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('keeps the user on the editor when dirty navigation is rejected', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  const {router} = renderGuard();

  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  fireEvent.click(screen.getByRole('button', {name: 'Navigate'}));

  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(router.state.location.pathname).toBe('/');
  expect(screen.queryByText('Next page')).not.toBeInTheDocument();
});

test('continues dirty navigation after confirmation', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  const {router} = renderGuard();

  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  fireEvent.click(screen.getByRole('button', {name: 'Navigate'}));

  await screen.findByText('Next page');
  expect(router.state.location.pathname).toBe('/next');
  expect(window.confirm).toHaveBeenCalledTimes(1);
});

test('allows an intentional post-save navigation without prompting', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  const {router} = renderGuard();

  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  fireEvent.click(screen.getByRole('button', {name: 'Save and navigate'}));

  await screen.findByText('Next page');
  expect(router.state.location.pathname).toBe('/next');
  expect(window.confirm).not.toHaveBeenCalled();
});

test('registers a native beforeunload guard only while dirty', () => {
  renderGuard();

  const cleanEvent = new Event('beforeunload', {cancelable: true});
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);

  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  const dirtyEvent = new Event('beforeunload', {cancelable: true});
  window.dispatchEvent(dirtyEvent);
  expect(dirtyEvent.defaultPrevented).toBe(true);
});

test('blocks an ordinary user navigation to login while dirty', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  const {router} = renderGuard();

  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  fireEvent.click(screen.getByRole('button', {name: 'Navigate to login'}));

  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(router.state.location.pathname).toBe('/');
  expect(screen.queryByText('Login page')).not.toBeInTheDocument();
});

test('does not block a forced authentication redirect', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  const {router} = renderGuard();

  fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
  fireEvent.click(screen.getByRole('button', {name: 'Expire auth'}));

  await screen.findByText('Login page');
  expect(router.state.location.pathname).toBe('/login');
  expect(window.confirm).not.toHaveBeenCalled();
});
