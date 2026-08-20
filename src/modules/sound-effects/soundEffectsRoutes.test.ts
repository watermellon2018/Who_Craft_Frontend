import {
  soundEffectCreatePath,
  soundEffectDetailPath,
  soundEffectJobPath,
  soundEffectsPath,
} from '../../routes/pathConstant';

test('builds project-scoped sound effect routes', () => {
  expect(soundEffectsPath(7)).toBe('/project/7/sound-effects');
  expect(soundEffectCreatePath(7, 42)).toBe('/project/7/sound-effects/create?sceneId=42');
  expect(soundEffectJobPath(7, 'job/id')).toBe('/project/7/sound-effects/jobs/job%2Fid');
  expect(soundEffectDetailPath(7, 19)).toBe('/project/7/sound-effects/effects/19');
});
