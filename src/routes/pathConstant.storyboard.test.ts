import PathConstants, {storyboardPath} from './pathConstant';

test('builds the canonical storyboard route', () => {
  expect(PathConstants.STORYBOARD).toBe('/project/:projectId/storyboard');
  expect(storyboardPath(7)).toBe('/project/7/storyboard');
});
