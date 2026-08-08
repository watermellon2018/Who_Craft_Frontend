import {
  musicJobPath,
  musicStudioCreatePath,
  musicStudioPath,
  musicTrackPath,
} from './pathConstant';

test('builds canonical Music Studio routes', () => {
  expect(musicStudioPath(7)).toBe('/project/7/music');
  expect(musicStudioCreatePath(7, 42)).toBe('/project/7/music/create?sceneId=42');
  expect(musicJobPath(7, 'job/a')).toBe('/project/7/music/jobs/job%2Fa');
  expect(musicTrackPath(7, 18)).toBe('/project/7/music/tracks/18');
});
