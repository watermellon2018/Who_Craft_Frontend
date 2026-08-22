import {render, waitFor} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

jest.mock('../../modules/profile/components/DashboardHeader', () =>
  function MockDashboardHeader() {
    return <header>Dashboard header</header>;
  },
);
jest.mock('../../modules/character-studio/hooks/useProjectIdFromRoute', () => ({
  useProjectIdFromRoute: () => '42',
}));
jest.mock('../../utils/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({allowNextNavigation: jest.fn()}),
}));
jest.mock('./useScriptWorkspace');
jest.mock('./ScreenplayView', () =>
  function MockScreenplayView() {
    return <div>Screenplay</div>;
  },
);
jest.mock('./SceneListPanel', () =>
  function MockSceneListPanel() {
    return <div>Scene list</div>;
  },
);
jest.mock('./CardsView', () =>
  function MockCardsView() {
    return <div>Cards</div>;
  },
);
jest.mock('./CharactersView', () =>
  function MockCharactersView() {
    return <div>Characters</div>;
  },
);
jest.mock('./MissingCharactersNotice', () =>
  function MockMissingCharactersNotice() {
    return null;
  },
);

import ScriptPage from './editor';
import {useScriptWorkspace} from './useScriptWorkspace';

const mockedUseScriptWorkspace = useScriptWorkspace as jest.MockedFunction<
  typeof useScriptWorkspace
>;

it('selects the requested screenplay scene from a durable sceneId query', async () => {
  const openSceneInScreenplay = jest.fn().mockResolvedValue(true);
  mockedUseScriptWorkspace.mockReturnValue({
    project: {id: 42, title: 'Анчоус Тим', permissions: {canEdit: true}},
    scenes: [
      {id: 1, title: 'Первая сцена'},
      {id: 17, title: 'Пустой павильон'},
    ],
    characters: [],
    missingCharacters: [],
    missingCharactersError: null,
    loading: false,
    error: null,
    mode: 'screenplay',
    selectedScene: {id: 1, title: 'Первая сцена'},
    dirtySceneIds: [],
    savingSceneIds: [],
    reordering: false,
    conflict: null,
    saveError: null,
    canEdit: true,
    stats: {sceneCount: 2, totalDurationSeconds: 0, acts: []},
    openSceneInScreenplay,
    saveSelectedScene: jest.fn().mockResolvedValue(true),
    refreshMissingCharacters: jest.fn(),
  } as unknown as ReturnType<typeof useScriptWorkspace>);

  render(
    <MemoryRouter initialEntries={['/project/42/script?sceneId=17']}>
      <ScriptPage />
    </MemoryRouter>,
  );

  await waitFor(() => expect(openSceneInScreenplay).toHaveBeenCalledWith(17));
});
