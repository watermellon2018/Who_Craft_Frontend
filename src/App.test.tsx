import PathConstants, {isScriptWorkspacePath} from './routes/pathConstant';

test('defines character studio routes', () => {
  expect(PathConstants.CHARACTER_STUDIO).toBe('/project/:projectId/characters');
  expect(PathConstants.CHARACTER_STUDIO_CREATE).toBe('/project/:projectId/characters/create');
  expect(PathConstants.CHARACTER_STUDIO_DETAIL).toBe('/project/:projectId/characters/:characterId');
  expect(PathConstants.SCRIPT_PAGE).toBe('/project/:projectId/script');
  expect(PathConstants.SCRIPT_PAGE_LEGACY).toBe('/project/script');
  expect(PathConstants.CHARACTER_STUDIO_EDITOR).toBe('/project/:projectId/characters/:characterId/edit');
});

test('recognizes canonical and legacy script workspace paths', () => {
  expect(isScriptWorkspacePath('/project/42/script')).toBe(true);
  expect(isScriptWorkspacePath('/project/42/script/')).toBe(true);
  expect(isScriptWorkspacePath(PathConstants.SCRIPT_PAGE_LEGACY)).toBe(true);
  expect(isScriptWorkspacePath('/project/42/characters')).toBe(false);
});
