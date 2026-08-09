import {
  referenceWorkspaceCreateCategory,
  referenceWorkspaceRouteMode,
} from './ReferenceWorkspacePage';

test.each([
  ['/project/7/references/create', 'create'],
  ['/project/7/references/create/', 'create'],
  ['/project/7/references/ref-1/edit/', 'edit'],
  ['/project/7/references/ref-1/', 'detail'],
])('derives workspace mode for canonical and trailing-slash routes', (pathname, mode) => {
  expect(referenceWorkspaceRouteMode(pathname)).toBe(mode);
});

test.each([
  ['?category=location', 'location'],
  ['?category=vehicle', 'vehicle'],
  ['?category=unknown', 'prop'],
  ['', 'prop'],
])('derives the create category from %s', (search, category) => {
  expect(referenceWorkspaceCreateCategory(search)).toBe(category);
});
