import {
  audioEditorSaveAdapter,
  AudioEditSaveUnavailableError,
} from './audioEditorSaveAdapter';

test('does not pretend that an edited version was saved without a backend contract', async () => {
  expect(audioEditorSaveAdapter.available).toBe(false);
  await expect(audioEditorSaveAdapter.saveNewVersion({
    document: {segments: []},
    expectedTrackVersion: 3,
    makeActive: true,
    projectId: '7',
    sourceVersionId: 'version-2',
    trackId: 12,
  })).rejects.toBeInstanceOf(AudioEditSaveUnavailableError);
});
