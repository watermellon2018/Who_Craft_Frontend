import {currentReturnTo, safeReturnTo} from './returnTo';

test('accepts only same-origin application return paths', () => {
  expect(safeReturnTo('/projects/42?tab=script')).toBe('/projects/42?tab=script');
  expect(safeReturnTo('//evil.example/path')).toBeNull();
  expect(safeReturnTo('https://evil.example/path')).toBeNull();
  expect(safeReturnTo('/login')).toBeNull();
});

test('preserves path, query, and hash for re-login', () => {
  expect(currentReturnTo({pathname: '/projects/42', search: '?tab=script', hash: '#scene-3'}))
    .toBe('/projects/42?tab=script#scene-3');
});