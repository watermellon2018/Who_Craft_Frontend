import React from 'react';
import {render, screen} from '@testing-library/react';

import App from './App';

const mockCharacterStudioShellRender = jest.fn();

jest.mock('./modules/character-studio/components/CharacterStudioShell', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => {
    mockCharacterStudioShellRender();
    return <>{children}</>;
  },
}));

jest.mock('./page/logIn/login', () => ({
  __esModule: true,
  default: () => <div>Login page</div>,
}));

describe('Character Studio authentication gate', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockCharacterStudioShellRender.mockClear();
  });

  it('does not mount the API-owning shell for an unauthenticated deep link', async () => {
    window.history.pushState({}, '', '/project/42/characters/character-1/edit');

    render(<App />);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(mockCharacterStudioShellRender).not.toHaveBeenCalled();
  });
});
