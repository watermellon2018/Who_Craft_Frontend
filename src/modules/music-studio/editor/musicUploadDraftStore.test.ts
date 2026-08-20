import {
  getMusicUploadEditorDraft,
  getLatestMusicUploadEditorDraft,
  removeMusicUploadEditorDraft,
  saveMusicUploadEditorDraft,
} from './musicUploadDraftStore';
import type {MusicUploadFormSnapshot} from './musicUploadDraftStore';

function createSnapshot(file: File): MusicUploadFormSnapshot {
  return {
    aiDirty: true,
    brief: null,
    canEdit: true,
    creationMode: 'upload',
    modelKey: 'lyria-3-pro',
    reference: null,
    selectedScene: null,
    uploadDirty: true,
    uploadDraft: {
      description: 'Opening scene',
      durationSeconds: 24,
      file,
      status: 'ready',
      title: 'Opening theme',
    },
    variantCount: 5,
  };
}

test('keeps the original File in memory and reuses one project-scoped draft id', () => {
  const file = new File(['audio'], 'opening.mp3', {type: 'audio/mpeg'});
  const first = saveMusicUploadEditorDraft('7', createSnapshot(file));
  const updatedSnapshot = {
    ...createSnapshot(file),
    uploadDraft: {...createSnapshot(file).uploadDraft, title: 'Updated title'},
  };
  const updated = saveMusicUploadEditorDraft('7', updatedSnapshot, first.draftId);

  expect(updated.draftId).toBe(first.draftId);
  expect(getMusicUploadEditorDraft('7', first.draftId)?.snapshot.uploadDraft.file).toBe(file);
  expect(getMusicUploadEditorDraft('7', first.draftId)?.snapshot.uploadDraft.title)
    .toBe('Updated title');
  expect(getMusicUploadEditorDraft('7', first.draftId)?.snapshot.modelKey).toBe('lyria-3-pro');
  expect(getMusicUploadEditorDraft('8', first.draftId)).toBeNull();
  expect(getLatestMusicUploadEditorDraft('7')?.draftId).toBe(first.draftId);

  removeMusicUploadEditorDraft('7', first.draftId);
  expect(getMusicUploadEditorDraft('7', first.draftId)).toBeNull();
  expect(getLatestMusicUploadEditorDraft('7')).toBeNull();
});
