import {v4 as uuidv4} from 'uuid';

import type {AudioUploadDraft} from '../components/AudioUploadForm';
import type {
  MusicBrief,
  MusicReferenceAsset,
  MusicSceneOption,
} from '../types';

export interface MusicUploadFormSnapshot {
  aiDirty: boolean;
  brief: MusicBrief | null;
  canEdit: boolean;
  creationMode: 'ai' | 'upload';
  reference: MusicReferenceAsset | null;
  selectedScene: MusicSceneOption | null;
  uploadDirty: boolean;
  uploadDraft: AudioUploadDraft;
  variantCount: number;
}

export interface MusicUploadEditorDraft {
  draftId: string;
  projectId: string;
  snapshot: MusicUploadFormSnapshot;
  updatedAt: number;
}

const drafts = new Map<string, MusicUploadEditorDraft>();
const latestDraftIdsByProject = new Map<string, string>();

export function saveMusicUploadEditorDraft(
  projectId: string,
  snapshot: MusicUploadFormSnapshot,
  preferredDraftId?: string | null,
): MusicUploadEditorDraft {
  const existingDraftId = preferredDraftId ?? latestDraftIdsByProject.get(projectId);
  const existing = existingDraftId ? drafts.get(existingDraftId) : null;
  const draftId = existing?.projectId === projectId ? existing.draftId : uuidv4();
  const draft = {
    draftId,
    projectId,
    snapshot,
    updatedAt: Date.now(),
  };
  drafts.set(draftId, draft);
  latestDraftIdsByProject.set(projectId, draftId);
  return draft;
}

export function getMusicUploadEditorDraft(
  projectId: string,
  draftId: string | null | undefined,
): MusicUploadEditorDraft | null {
  if (!draftId) return null;
  const draft = drafts.get(draftId);
  return draft?.projectId === projectId ? draft : null;
}

export function getLatestMusicUploadEditorDraft(
  projectId: string,
): MusicUploadEditorDraft | null {
  return getMusicUploadEditorDraft(projectId, latestDraftIdsByProject.get(projectId));
}

export function removeMusicUploadEditorDraft(projectId: string, draftId: string) {
  const draft = drafts.get(draftId);
  if (draft?.projectId !== projectId) return;
  drafts.delete(draftId);
  if (latestDraftIdsByProject.get(projectId) === draftId) {
    latestDraftIdsByProject.delete(projectId);
  }
}
