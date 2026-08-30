import {APP_ROUTES} from './App';
import PathConstants, {
  characterCreatePath,
  characterVariantsPath,
  isProjectEditPath,
  isScriptWorkspacePath,
  projectDashboardPath,
  projectEditPath,
  projectPosterPath,
  scriptScenePath,
  videoGenerationPath,
  videoPath,
  videoPreparationPath,
} from './routes/pathConstant';

test('defines character studio and project routes', () => {
  expect(PathConstants.CHARACTER_STUDIO).toBe('/project/:projectId/characters');
  expect(PathConstants.CHARACTER_STUDIO_CREATE).toBe('/project/:projectId/characters/create');
  expect(PathConstants.CHARACTER_STUDIO_DETAIL).toBe('/project/:projectId/characters/:characterId');
  expect(PathConstants.PROJECT_PAGE).toBe('/projects/:projectId');
  expect(projectDashboardPath(42)).toBe('/projects/42');
  expect(PathConstants.EDIT_PROJECT).toBe('/projects/:projectId/edit');
  expect(projectEditPath(42)).toBe('/projects/42/edit');
  expect(projectPosterPath(42)).toBe('/projects/42/poster');
  expect(characterCreatePath(42, {draftId: 'char-1', treeNodeId: 'tree-1'})).toBe(
    '/project/42/characters/create?draftId=char-1&treeNodeId=tree-1',
  );
  expect(characterVariantsPath(42, 'char-1', 'job 1', 'tree 1')).toBe(
    '/project/42/characters/char-1/variants?jobId=job%201&treeNodeId=tree%201',
  );
  expect(PathConstants.SCRIPT_PAGE).toBe('/project/:projectId/script');
  expect(PathConstants.CHARACTER_STUDIO_EDITOR).toBe('/project/:projectId/characters/:characterId/edit');
  expect(PathConstants.CREDITS).toBe('/credits');
  expect(PathConstants.PROFILE_SETTINGS).toBe('/profile/settings');
  expect(videoPath(42)).toBe('/project/42/video');
  expect(videoPreparationPath(42)).toBe('/project/42/video/preparation');
  expect(videoGenerationPath(42)).toBe('/project/42/video/generate');
  expect(scriptScenePath(42, 7)).toBe('/project/42/script?sceneId=7');
  expect(APP_ROUTES.some(({path}) => path === PathConstants.VIDEO)).toBe(true);
  expect(APP_ROUTES.some(({path}) => path === PathConstants.VIDEO_PREPARATION)).toBe(true);
  expect(APP_ROUTES.some(({path}) => path === PathConstants.VIDEO_GENERATE)).toBe(true);
  expect(APP_ROUTES.some(({path}) => path === PathConstants.CREDITS)).toBe(true);
  expect(APP_ROUTES.some(({path}) => path === PathConstants.PROFILE_SETTINGS)).toBe(true);
});

test('recognizes canonical project edit and script workspace paths', () => {
  expect(isProjectEditPath('/projects/42/edit')).toBe(true);
  expect(isProjectEditPath('/projects/42/edit/')).toBe(true);
  expect(isProjectEditPath('/projects/42/poster')).toBe(false);
  expect(isScriptWorkspacePath('/project/42/script')).toBe(true);
  expect(isScriptWorkspacePath('/project/42/script/')).toBe(true);
  expect(isScriptWorkspacePath('/project/script')).toBe(false);
  expect(isScriptWorkspacePath('/project/42/characters')).toBe(false);
});

test('does not register removed compatibility routes', () => {
  const registeredPaths = APP_ROUTES.map(({path}) => path);
  const removedPaths = [
    '/start',
    '/edit-project',
    '/project-list/project',
    '/create-project/gen-poster',
    '/project/script',
    '/project/:projectId/references/:referenceId',
  ];

  expect(registeredPaths).not.toEqual(expect.arrayContaining(removedPaths));
  expect(Object.values(PathConstants)).not.toEqual(expect.arrayContaining(removedPaths));
});
