import PathConstants from './routes/pathConstant';

test('defines character studio routes', () => {
  expect(PathConstants.CHARACTER_STUDIO).toBe('/project/:projectId/characters');
  expect(PathConstants.CHARACTER_STUDIO_CREATE).toBe('/project/:projectId/characters/create');
  expect(PathConstants.CHARACTER_STUDIO_DETAIL).toBe('/project/:projectId/characters/:characterId');
  expect(PathConstants.CHARACTER_STUDIO_EDITOR).toBe('/project/:projectId/characters/:characterId/edit');
});
