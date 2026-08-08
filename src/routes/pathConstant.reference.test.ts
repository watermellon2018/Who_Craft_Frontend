import {
  referenceCreatePath,
  referenceDetailPath,
  referenceEditPath,
  referenceJobPath,
  referenceLibraryPath,
} from './pathConstant';

test('builds canonical Reference Library routes', () => {
  expect(referenceLibraryPath(7)).toBe('/project/7/references');
  expect(referenceCreatePath(7)).toBe('/project/7/references/create');
  expect(referenceDetailPath(7, 'ref/a')).toBe('/project/7/references/ref%2Fa');
  expect(referenceEditPath(7, 'ref/a')).toBe('/project/7/references/ref%2Fa/edit');
  expect(referenceJobPath(7, 'ref/a', 'job/a')).toBe(
    '/project/7/references/ref%2Fa/jobs/job%2Fa',
  );
});
