import {canBypassUnsavedChangesAfterSelectedSceneSave} from './navigation';

test('allows bypass when only the selected scene was dirty', () => {
  expect(canBypassUnsavedChangesAfterSelectedSceneSave([7], 7)).toBe(true);
});

test('keeps the guard active when another dirty scene remains', () => {
  expect(canBypassUnsavedChangesAfterSelectedSceneSave([7, 9], 7)).toBe(false);
});

test('keeps the guard active when the dirty scene is not selected', () => {
  expect(canBypassUnsavedChangesAfterSelectedSceneSave([9], 7)).toBe(false);
});

test('allows bypass when there were no unsaved scenes', () => {
  expect(canBypassUnsavedChangesAfterSelectedSceneSave([], undefined)).toBe(true);
});
