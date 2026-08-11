import {
  musicJobPath,
  musicStudioCreatePath,
  musicStudioPath,
  musicStudioUploadCreatePath,
  musicTrackEditorPath,
  musicTrackPath,
  musicUploadDraftEditorPath,
} from './pathConstant';

test('builds canonical Music Studio routes', () => {
  expect(musicStudioPath(7)).toBe('/project/7/music');
  expect(musicStudioCreatePath(7, 42)).toBe('/project/7/music/create?sceneId=42');
  expect(musicStudioUploadCreatePath(7)).toBe('/project/7/music/create?mode=upload');
  expect(musicJobPath(7, 'job/a')).toBe('/project/7/music/jobs/job%2Fa');
  expect(musicTrackPath(7, 18)).toBe('/project/7/music/tracks/18');
  expect(musicTrackEditorPath(7, 18)).toBe('/project/7/music/tracks/18/edit');
  expect(musicUploadDraftEditorPath(7, 'draft/a')).toBe('/project/7/music/upload-drafts/draft%2Fa/edit');
});
