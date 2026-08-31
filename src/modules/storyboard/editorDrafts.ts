import api, {getAuthGeneration} from '../../api/http';
import {isShotReady} from './model';
import type {GenerationReference, StoryboardKeyframe, StoryboardScene, StoryboardShot, StoryboardShotSource} from './model';
import {
  normalizeTemporaryShots,
  readTemporaryDraft,
  removeTemporaryDraft,
  writeTemporaryDraft,
} from './temporaryDraft';

export type EditorDraftStage = 'selection' | 'builder' | 'editor';
export type EditorSaveState = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict';

type StoredReference = Omit<GenerationReference, 'imageUrl'>;
type StoredKeyframe = Omit<StoryboardKeyframe, 'imageUrl' | 'generationReferences'> & {
  generationReferences?: StoredReference[];
};
type StoredShot = Omit<StoryboardShot, 'keyframes'> & {keyframes: StoredKeyframe[]};

export interface EditorDraftPayload {
  schemaVersion: 1;
  stage: EditorDraftStage;
  shots: StoredShot[];
}

export interface EditorDraftEntry {
  sceneId: number;
  revision: number;
  payload: EditorDraftPayload;
}

interface EditorDraftList {
  userId: number;
  canEdit: boolean;
  drafts: EditorDraftEntry[];
}

interface DraftMutation {
  expectedRevision: number;
  mutationId: string;
  payload: EditorDraftPayload;
}

interface PendingDraft {
  revision: number;
  payload: EditorDraftPayload;
  mutation?: DraftMutation;
  recoveredProposal?: EditorDraftPayload;
  state: EditorSaveState;
  sending: boolean;
  backupKey?: string;
  backupRaw?: string;
  restoredBackupKeys?: string[];
}

interface ProjectDrafts {
  userId: number;
  projectId: string;
  authGeneration: number;
  canEdit: boolean;
  scenes: Map<string, PendingDraft>;
}

const projects = new Map<string, ProjectDrafts>();
const retiredProjects = new Map<string, ProjectDrafts>();
const listeners = new Map<string, Set<() => void>>();
const MAX_OUTBOX_LENGTH = 8_000_000;
const referenceTypes = new Set(['character', 'location', 'object', 'clothing', 'other', 'previous-keyframe', 'previous-shot']);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStage(value: unknown): value is EditorDraftStage {
  return value === 'selection' || value === 'builder' || value === 'editor';
}

function currentSession(project: ProjectDrafts): boolean {
  return project.authGeneration === getAuthGeneration() && projects.get(project.projectId) === project;
}

function sceneProject(projectId: string, scene: StoryboardScene): ProjectDrafts | undefined {
  const current = projects.get(projectId);
  if (scene.draftAuthGeneration === undefined || current?.authGeneration === scene.draftAuthGeneration) return current;
  return retiredProjects.get(`${projectId}:${scene.draftAuthGeneration}`);
}

function outboxKey(project: Pick<ProjectDrafts, 'userId' | 'projectId'>): string {
  return `wcraft:storyboard-outbox:v1:${project.userId}:${encodeURIComponent(project.projectId)}`;
}

function backupPrefix(project: ProjectDrafts): string {
  return `${outboxKey(project)}:recovery:`;
}

function clearAcknowledgedBackups(project: ProjectDrafts, sceneId: string, payload: EditorDraftPayload): void {
  try {
    for (const key of Object.keys(window.localStorage).filter((item) => item.startsWith(backupPrefix(project)))) {
      const raw = window.localStorage.getItem(key);
      if (!raw || raw.length > MAX_OUTBOX_LENGTH) continue;
      const value: unknown = JSON.parse(raw);
      if (!record(value) || value.userId !== project.userId || value.projectId !== project.projectId
        || !record(value.entries) || !record(value.entries[sceneId])) continue;
      const entry = value.entries[sceneId];
      if (!record(entry)) continue;
      const stored = normalizePayload(entry.payload, sceneId);
      if (stored && !entry.recoveredProposal && fingerprint(stored) === fingerprint(payload)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Cleanup is best effort and never changes the acknowledged server result.
  }
}

function emit(projectId: string): void {
  listeners.get(projectId)?.forEach((listener) => listener());
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort()
    .filter((key) => value[key] !== undefined).map((key) => [key, canonicalValue(value[key])]));
  return value;
}

function fingerprint(payload: EditorDraftPayload): string {
  return JSON.stringify(canonicalValue(payload));
}

function mutationId(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function editorPayload(scene: Pick<StoryboardScene, 'shots' | 'editorStage'>): EditorDraftPayload {
  return {
    schemaVersion: 1,
    stage: scene.editorStage ?? 'builder',
    // Persist text and camera settings only. Signed URLs and binary images are
    // deliberately excluded; available media comes from the authorized workspace.
    shots: scene.shots.map((shot) => ({
      characterIds: [...shot.characterIds],
      description: shot.description,
      duration: shot.duration,
      id: shot.id,
      keyframes: shot.keyframes.map((keyframe) => ({
        cameraIntent: {...keyframe.cameraIntent},
        generationReferences: keyframe.generationReferences?.map((reference) => ({
          id: reference.id,
          primary: reference.primary,
          sourceKeyframeId: reference.sourceKeyframeId,
          sourceShotId: reference.sourceShotId,
          title: reference.title,
          type: reference.type,
        })),
        generationStatus: keyframe.generationStatus === 'loading' ? 'idle' : keyframe.generationStatus,
        id: keyframe.id,
        position: keyframe.position,
        shotId: shot.id,
        type: keyframe.type,
      })),
      locationId: shot.locationId,
      order: shot.order,
      referenceIds: [...shot.referenceIds],
      sceneId: shot.sceneId,
      source: shot.source ? {
        document: {
          ...shot.source.document,
          segments: shot.source.document.segments.map((segment) => ({...segment})),
        },
        ranges: shot.source.ranges?.map((range) => ({...range})),
        origin: shot.source.origin,
        segmentIds: [...shot.source.segmentIds],
      } : undefined,
      title: shot.title,
      transitions: shot.transitions.map((transition) => ({...transition})),
    })),
  };
}

function normalizedReference(value: unknown): GenerationReference | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.title !== 'string'
    || typeof value.type !== 'string' || !referenceTypes.has(value.type)) return null;
  return {
    id: value.id,
    imageUrl: '',
    title: value.title,
    type: value.type as GenerationReference['type'],
    ...(typeof value.primary === 'boolean' ? {primary: value.primary} : {}),
    ...(typeof value.sourceKeyframeId === 'string' ? {sourceKeyframeId: value.sourceKeyframeId} : {}),
    ...(typeof value.sourceShotId === 'string' ? {sourceShotId: value.sourceShotId} : {}),
  };
}

function normalizeSource(value: unknown, sceneId: string): StoryboardShotSource | null {
  if (!record(value) || !record(value.document) || !Array.isArray(value.segmentIds)
    || value.segmentIds.length > 20000 || !value.segmentIds.every((id): id is string => typeof id === 'string')) return null;
  const document = value.document;
  if (typeof document.sceneId !== 'number' || String(document.sceneId) !== sceneId
    || typeof document.sceneVersion !== 'number' || !Number.isInteger(document.sceneVersion) || document.sceneVersion < 1
    || typeof document.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(document.contentHash)
    || typeof document.truncated !== 'boolean' || !Array.isArray(document.segments) || document.segments.length > 20000) return null;
  const segments: {id: string; text: string}[] = [];
  for (const segment of document.segments) {
    if (!record(segment) || typeof segment.id !== 'string' || typeof segment.text !== 'string'
      || Array.from(segment.text).length > 500000) return null;
    segments.push({id: segment.id, text: segment.text});
  }
  const ids = new Set(segments.map(({id}) => id));
  if (ids.size !== segments.length || new Set(value.segmentIds).size !== value.segmentIds.length
    || !value.segmentIds.every((id) => ids.has(id))) return null;
  let ranges: {start: number; end: number}[] | undefined;
  if (value.ranges !== undefined) {
    if (!Array.isArray(value.ranges) || value.ranges.length > 1000) return null;
    const length = segments.reduce((sum, {text}) => sum + Array.from(text).length, 0);
    ranges = [];
    for (const range of value.ranges) {
      if (!record(range) || typeof range.start !== 'number' || typeof range.end !== 'number'
        || !Number.isInteger(range.start) || !Number.isInteger(range.end)
        || range.start < 0 || range.end <= range.start || range.end > length) return null;
      ranges.push({start: range.start, end: range.end});
    }
  }
  if (value.origin !== undefined && value.origin !== 'ai' && value.origin !== 'manual') return null;
  return {
    document: {
      contentHash: document.contentHash, sceneId: document.sceneId, sceneVersion: document.sceneVersion,
      segments, truncated: document.truncated,
    },
    segmentIds: [...value.segmentIds],
    ...(ranges ? {ranges} : {}),
    ...(value.origin === 'ai' || value.origin === 'manual' ? {origin: value.origin} : {}),
  };
}

function normalizePayload(value: unknown, sceneId: string): EditorDraftPayload | null {
  if (!record(value) || value.schemaVersion !== 1 || !isStage(value.stage) || !Array.isArray(value.shots)) return null;
  const shots = normalizeTemporaryShots(value.shots, sceneId);
  if (!shots) return null;
  const rawShots = value.shots;
  for (const [index, shot] of Array.from(shots.entries())) {
    const raw: unknown = rawShots[index];
    if (!record(raw)) return null;
    if (raw.source !== undefined) {
      const source = normalizeSource(raw.source, sceneId);
      if (!source) return null;
      shot.source = source;
    }
    if (Array.isArray(raw.keyframes)) {
      const frames = new Map(raw.keyframes.filter(record).map((frame) => [frame.id, frame]));
      for (const keyframe of shot.keyframes) {
        const rawFrame = frames.get(keyframe.id);
        const references = rawFrame?.generationReferences;
        keyframe.generationReferences = Array.isArray(references)
          ? references.map(normalizedReference).filter((item): item is GenerationReference => item !== null) : undefined;
        if (rawFrame?.generationStatus === 'ready') keyframe.generationStatus = 'ready';
      }
    }
  }
  return editorPayload({editorStage: value.stage, shots});
}

function restoreShots(payload: EditorDraftPayload, scene: StoryboardScene): StoryboardShot[] {
  const images = new Map(scene.shots.flatMap((shot) => shot.keyframes.map((frame) => [frame.id, frame.imageUrl] as const)));
  const entities = new Map(scene.entities.map((entity) => [entity.id, entity.imageUrl]));
  return payload.shots.map((shot) => ({
    ...shot,
    keyframes: shot.keyframes.map((frame) => ({
      ...frame,
      imageUrl: images.get(frame.id),
      generationReferences: frame.generationReferences?.map((reference) => ({
        ...reference,
        imageUrl: (reference.sourceKeyframeId ? images.get(reference.sourceKeyframeId) : entities.get(reference.id)) ?? '',
      })),
    })),
  }));
}

function writeOutbox(project: ProjectDrafts): boolean {
  try {
    // Keep entries for scenes that were not in the latest authorized response.
    // They may temporarily be unavailable; dropping them would lose offline work.
    let entries: Record<string, unknown> = {};
    const previous = window.localStorage.getItem(outboxKey(project));
    if (previous) {
      if (previous.length > MAX_OUTBOX_LENGTH) return false;
      const value: unknown = JSON.parse(previous);
      if (!record(value) || value.schemaVersion !== 1 || value.userId !== project.userId
        || value.projectId !== project.projectId || !record(value.entries)) return false;
      entries = {...value.entries};
    }
    for (const [sceneId, draft] of Array.from(project.scenes)) {
      if (draft.state === 'saved' && !draft.recoveredProposal) {
        delete entries[sceneId];
        if (draft.backupKey) window.localStorage.removeItem(draft.backupKey);
        for (const key of draft.restoredBackupKeys ?? []) window.localStorage.removeItem(key);
        draft.restoredBackupKeys = undefined;
        continue;
      }
      const entry = {
        revision: draft.revision,
        payload: draft.payload,
        mutation: draft.mutation,
        recoveredProposal: draft.recoveredProposal,
      };
      // Recovery keys are immutable. If another tab acknowledges snapshot P
      // while this tab advances to Q, cleanup of P can never delete Q's text.
      const backup = JSON.stringify({schemaVersion: 1, userId: project.userId, projectId: project.projectId, entries: {[sceneId]: entry}});
      if (backup.length > MAX_OUTBOX_LENGTH) return false;
      if (draft.backupRaw !== backup) {
        const previousKey = draft.backupKey;
        const nextKey = `${backupPrefix(project)}${encodeURIComponent(sceneId)}:${mutationId()}`;
        window.localStorage.setItem(nextKey, backup);
        draft.backupKey = nextKey;
        draft.backupRaw = backup;
        if (previousKey) window.localStorage.removeItem(previousKey);
      }
      // A restart may restore the shared entry before seeing its immutable
      // backup(s). Retire those consumed snapshots only after their replacement
      // was written, so an old P cannot reappear after the user advances to Q.
      for (const key of draft.restoredBackupKeys ?? []) {
        if (key !== draft.backupKey) window.localStorage.removeItem(key);
      }
      draft.restoredBackupKeys = undefined;
      entries[sceneId] = entry;
    }
    if (Object.keys(entries).length === 0) {
      window.localStorage.removeItem(outboxKey(project));
    } else {
      const raw = JSON.stringify({schemaVersion: 1, userId: project.userId, projectId: project.projectId, entries});
      if (raw.length > MAX_OUTBOX_LENGTH) return false;
      window.localStorage.setItem(outboxKey(project), raw);
    }
    return true;
  } catch {
    // The server save still runs if storage is blocked. beforeunload guards the
    // unsaved in-memory copy; never report a successful save before its response.
    return false;
  }
}

function readOutbox(project: ProjectDrafts): Map<string, PendingDraft> {
  const result = new Map<string, PendingDraft>();
  try {
    const keys = [outboxKey(project), ...Object.keys(window.localStorage)
      .filter((key) => key.startsWith(backupPrefix(project)))];
    for (const key of keys) {
      let value: unknown;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw || raw.length > MAX_OUTBOX_LENGTH) continue;
        value = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!record(value) || value.schemaVersion !== 1 || value.userId !== project.userId
        || value.projectId !== project.projectId || !record(value.entries)) continue;
      for (const [sceneId, item] of Object.entries(value.entries)) {
        if (!record(item) || typeof item.revision !== 'number' || !Number.isInteger(item.revision) || item.revision < 0) continue;
        const payload = normalizePayload(item.payload, sceneId);
        if (!payload) continue;
        const recoveredProposal = normalizePayload(item.recoveredProposal, sceneId) ?? undefined;
        const existing = result.get(sceneId);
        const isBackup = key.startsWith(backupPrefix(project));
        if (existing) {
          if (isBackup && fingerprint(existing.payload) === fingerprint(payload)
            && JSON.stringify(canonicalValue(existing.recoveredProposal)) === JSON.stringify(canonicalValue(recoveredProposal))) {
            existing.restoredBackupKeys ??= [];
            existing.restoredBackupKeys.push(key);
          }
          continue;
        }
        let mutation: DraftMutation | undefined;
        if (record(item.mutation) && typeof item.mutation.mutationId === 'string'
          && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.mutation.mutationId)
          && item.mutation.expectedRevision === item.revision) {
          const sentPayload = normalizePayload(item.mutation.payload, sceneId);
          if (sentPayload) mutation = {expectedRevision: item.revision, mutationId: item.mutation.mutationId, payload: sentPayload};
        }
        result.set(sceneId, {
          revision: item.revision,
          payload,
          mutation,
          recoveredProposal,
          state: 'unsaved',
          sending: false,
          restoredBackupKeys: isBackup ? [key] : undefined,
        });
      }
    }
  } catch {
    // Keep unreadable data in place; a failed read must not delete the only copy.
  }
  return result;
}

function consumeTemporaryScene(project: ProjectDrafts, sceneId: string): void {
  try {
    const legacy = readTemporaryDraft(project.userId, project.projectId);
    if (!legacy || !Object.prototype.hasOwnProperty.call(legacy.scenes, sceneId)) return;
    delete legacy.scenes[sceneId];
    if (Object.keys(legacy.scenes).length === 0) removeTemporaryDraft(project.userId, project.projectId);
    else writeTemporaryDraft(legacy);
  } catch {
    // Retain the old copy if cleanup fails. Server persistence is already done.
  }
}

async function pump(project: ProjectDrafts, sceneId: string, draft: PendingDraft): Promise<void> {
  if (draft.sending || draft.state === 'saved' || draft.state === 'conflict' || !project.canEdit) return;
  if (!currentSession(project)) {
    draft.state = 'error';
    emit(project.projectId);
    return;
  }
  try {
    draft.mutation ??= {expectedRevision: draft.revision, mutationId: mutationId(), payload: draft.payload};
  } catch {
    draft.state = 'error';
    emit(project.projectId);
    return;
  }
  const sent = draft.mutation;
  draft.sending = true;
  draft.state = 'saving';
  writeOutbox(project);
  emit(project.projectId);
  try {
    const response = await api.put<EditorDraftEntry>(
      `api/projects/${encodeURIComponent(project.projectId)}/storyboard/scenes/${encodeURIComponent(sceneId)}/editor-draft/`,
      sent,
      {expectedAuthGeneration: project.authGeneration},
    );
    if (!currentSession(project)) {
      draft.state = 'error';
      return;
    }
    draft.revision = response.data.revision;
    draft.mutation = undefined;
    draft.state = fingerprint(draft.payload) === fingerprint(sent.payload) ? 'saved' : 'unsaved';
    if (draft.state === 'saved') clearAcknowledgedBackups(project, sceneId, sent.payload);
    consumeTemporaryScene(project, sceneId);
  } catch (error: unknown) {
    const status = record(error) && record(error.response) ? error.response.status : undefined;
    draft.state = status === 409 ? 'conflict' : 'error';
  } finally {
    draft.sending = false;
    if (currentSession(project)) writeOutbox(project);
    emit(project.projectId);
  }
  if (draft.state === 'unsaved') void pump(project, sceneId, draft);
}

export async function loadEditorDrafts(projectId: string): Promise<{data: EditorDraftList; authGeneration: number}> {
  const authGeneration = getAuthGeneration();
  const response = await api.get<EditorDraftList>(
    `api/projects/${encodeURIComponent(projectId)}/storyboard/editor-drafts/`,
    {expectedAuthGeneration: authGeneration},
  );
  if (authGeneration !== getAuthGeneration()) throw new Error('Authentication changed while loading storyboard');
  return {data: response.data, authGeneration};
}

export function hydrateEditorDrafts(
  projectId: string,
  scenes: StoryboardScene[],
  loaded: {data: EditorDraftList; authGeneration: number},
): StoryboardScene[] {
  if (loaded.authGeneration !== getAuthGeneration()) throw new Error('Authentication changed while loading storyboard');
  const existing = projects.get(projectId);
  const project: ProjectDrafts = existing?.userId === loaded.data.userId && existing.authGeneration === loaded.authGeneration
    ? existing : {userId: loaded.data.userId, projectId, authGeneration: loaded.authGeneration, canEdit: loaded.data.canEdit, scenes: new Map()};
  project.canEdit = loaded.data.canEdit;
  if (existing && existing !== project) retiredProjects.set(`${projectId}:${existing.authGeneration}`, existing);
  projects.set(projectId, project);
  const outbox = readOutbox(project);
  const server = new Map(loaded.data.drafts.map((draft) => [String(draft.sceneId), draft]));
  let legacy: ReturnType<typeof readTemporaryDraft> = null;
  try {
    legacy = readTemporaryDraft(project.userId, projectId);
  } catch {
    // Invalid or unavailable legacy storage must not block the server workspace.
  }
  for (const scene of scenes) {
    const remote = server.get(scene.id);
    const remotePayload = remote ? normalizePayload(remote.payload, scene.id) : null;
    if (remote && !remotePayload) throw new Error('Invalid saved storyboard draft');
    let draft = project.scenes.get(scene.id) ?? outbox.get(scene.id);
    if (draft && draft.state !== 'saved') {
      if (!draft.sending && remotePayload && fingerprint(remotePayload) === fingerprint(draft.payload)) {
        draft.revision = remote?.revision ?? draft.revision;
        draft.mutation = undefined;
        draft.state = 'saved';
      } else if (!draft.sending && remotePayload && draft.mutation
        && fingerprint(remotePayload) === fingerprint(draft.mutation.payload)) {
        draft.revision = remote?.revision ?? draft.revision;
        draft.mutation = undefined;
        draft.state = 'unsaved';
      } else if (!draft.sending && (remote?.revision ?? 0) !== draft.revision) {
        draft.state = 'conflict';
      }
    } else if (remotePayload) {
      draft = {revision: remote?.revision ?? 0, payload: remotePayload, recoveredProposal: draft?.recoveredProposal, state: 'saved', sending: false};
    } else if (project.canEdit && legacy && Object.prototype.hasOwnProperty.call(legacy.scenes, scene.id)) {
      draft = {revision: 0, payload: editorPayload({editorStage: 'builder', shots: legacy.scenes[scene.id]}), state: 'unsaved', sending: false};
    } else {
      draft = {revision: 0, payload: editorPayload(scene), recoveredProposal: draft?.recoveredProposal, state: 'saved', sending: false};
    }
    project.scenes.set(scene.id, draft);
    if (remotePayload) consumeTemporaryScene(project, scene.id);
  }
  // Do not dispatch work for a scene that is no longer in this authorized list.
  const sceneIds = new Set(scenes.map(({id}) => id));
  for (const id of Array.from(project.scenes.keys())) if (!sceneIds.has(id)) project.scenes.delete(id);
  writeOutbox(project);
  for (const [sceneId, draft] of Array.from(project.scenes)) {
    if (draft.state === 'unsaved') void pump(project, sceneId, draft);
  }
  emit(projectId);
  return scenes.map((scene) => restoreEditorScene(projectId, scene));
}

export function restoreEditorScene(projectId: string, scene: StoryboardScene): StoryboardScene {
  const project = projects.get(projectId);
  if (scene.draftAuthGeneration !== undefined && scene.draftAuthGeneration !== project?.authGeneration) return scene;
  const draft = currentSessionOrNull(project)?.scenes.get(scene.id);
  if (!draft || !project) return scene;
  const hasDraft = draft.revision > 0 || draft.state !== 'saved';
  const shots = restoreShots(draft.payload, scene);
  return {
    ...scene,
    canEdit: project.canEdit,
    draftAuthGeneration: project.authGeneration,
    draftRevision: draft.revision,
    editorStage: hasDraft
      ? !shots.length && draft.payload.stage === 'editor' ? 'selection' : draft.payload.stage
      : scene.editorStage,
    readyShotsCount: shots.filter(isShotReady).length,
    shots,
    shotsCount: shots.length,
    status: shots.length ? shots.every(isShotReady) ? 'completed' : 'draft' : 'empty',
  };
}

function currentSessionOrNull(project: ProjectDrafts | undefined): ProjectDrafts | null {
  return project && currentSession(project) ? project : null;
}

export function saveEditorScene(projectId: string, scene: StoryboardScene): void {
  const project = sceneProject(projectId, scene);
  const draft = project?.scenes.get(scene.id);
  if (!project || !draft || !project.canEdit) {
    emit(projectId);
    return;
  }
  const payload = editorPayload(scene);
  if (fingerprint(payload) === fingerprint(draft.payload)) return;
  draft.payload = payload;
  if (!currentSession(project)) {
    draft.state = 'error';
    writeOutbox(project);
    emit(projectId);
    return;
  }
  if (draft.state !== 'error' && draft.state !== 'conflict') draft.state = 'unsaved';
  writeOutbox(project);
  emit(projectId);
  if (draft.state === 'unsaved') void pump(project, scene.id, draft);
}

export function persistAIProposal(projectId: string, scene: StoryboardScene, shots: StoryboardShot[]): boolean {
  const project = sceneProject(projectId, scene);
  const draft = project?.scenes.get(scene.id);
  if (!project || !draft || !project.canEdit) return false;
  const payload = editorPayload({...scene, editorStage: 'builder', shots});
  if (!currentSession(project)
    || fingerprint({...draft.payload, stage: 'builder'}) !== fingerprint({...editorPayload(scene), stage: 'builder'})) {
    draft.recoveredProposal = payload;
    writeOutbox(project);
    emit(projectId);
    return false;
  }
  saveEditorScene(projectId, {...scene, editorStage: 'builder', shots});
  return true;
}

export function recoveredAIProposal(projectId: string, scene: StoryboardScene): StoryboardShot[] | null {
  const draft = currentSessionOrNull(projects.get(projectId))?.scenes.get(scene.id);
  return draft?.recoveredProposal ? restoreShots(draft.recoveredProposal, scene) : null;
}

export function acceptRecoveredAIProposal(projectId: string, scene: StoryboardScene): StoryboardShot[] | null {
  const project = currentSessionOrNull(projects.get(projectId));
  const draft = project?.scenes.get(scene.id);
  if (!project || !draft?.recoveredProposal) return null;
  const shots = restoreShots(draft.recoveredProposal, scene);
  draft.recoveredProposal = undefined;
  saveEditorScene(projectId, {...scene, editorStage: 'builder', shots});
  writeOutbox(project);
  return shots;
}

export function editorSessionExpired(projectId: string, authGeneration?: number): boolean {
  const project = projects.get(projectId);
  return Boolean(project && (authGeneration ?? project.authGeneration) !== getAuthGeneration());
}

export function getEditorSaveState(projectId: string, authGeneration?: number): EditorSaveState {
  const current = projects.get(projectId);
  const project = authGeneration !== undefined && current?.authGeneration !== authGeneration
    ? retiredProjects.get(`${projectId}:${authGeneration}`) : current;
  if (!project) return 'saved';
  if (!currentSession(project)) return 'error';
  const states = Array.from(project.scenes.values(), ({state}) => state);
  if (states.every((state) => state === 'saved')) return 'saved';
  for (const state of ['conflict', 'error', 'unsaved', 'saving'] as const) {
    if (states.includes(state)) return state;
  }
  return 'saved';
}

export function retryEditorSave(projectId: string): void {
  const project = currentSessionOrNull(projects.get(projectId));
  if (!project) return;
  for (const [sceneId, draft] of Array.from(project.scenes)) {
    if (draft.state === 'error' || draft.state === 'unsaved') void pump(project, sceneId, draft);
  }
}

// This is an explicit user choice after a conflict, never an automatic retry.
// Fetch the latest revision first; another intervening write will still get 409.
export async function keepLocalEditorDrafts(projectId: string): Promise<void> {
  const project = currentSessionOrNull(projects.get(projectId));
  if (!project) return;
  try {
    const loaded = await loadEditorDrafts(projectId);
    if (!currentSession(project) || loaded.data.userId !== project.userId || !loaded.data.canEdit) return;
    const revisions = new Map(loaded.data.drafts.map((entry) => [String(entry.sceneId), entry.revision]));
    for (const [sceneId, draft] of Array.from(project.scenes)) {
      if (draft.state !== 'conflict') continue;
      draft.revision = revisions.get(sceneId) ?? 0;
      draft.mutation = undefined;
      draft.state = 'unsaved';
      void pump(project, sceneId, draft);
    }
  } catch {
    // Preserve conflict state and its payload so the user can try this choice again.
    emit(projectId);
  }
}

export async function chooseSavedEditorDrafts(projectId: string): Promise<void> {
  const project = currentSessionOrNull(projects.get(projectId));
  if (!project) return;
  try {
    const loaded = await loadEditorDrafts(projectId);
    if (!currentSession(project) || loaded.data.userId !== project.userId) return;
    const remote = new Map(loaded.data.drafts.map((entry) => [String(entry.sceneId), entry]));
    for (const [sceneId, draft] of Array.from(project.scenes)) {
      if (draft.state !== 'conflict') continue;
      const saved = remote.get(sceneId);
      const payload = saved ? normalizePayload(saved.payload, sceneId) : null;
      if (!payload || !saved) continue;
      clearAcknowledgedBackups(project, sceneId, draft.payload);
      draft.revision = saved.revision;
      draft.payload = payload;
      draft.mutation = undefined;
      draft.state = 'saved';
    }
    writeOutbox(project);
    emit(projectId);
  } catch {
    emit(projectId);
  }
}

export function subscribeEditorDrafts(projectId: string, listener: () => void): () => void {
  let projectListeners = listeners.get(projectId);
  if (!projectListeners) {
    projectListeners = new Set();
    listeners.set(projectId, projectListeners);
  }
  projectListeners.add(listener);
  return () => {
    projectListeners?.delete(listener);
    if (projectListeners?.size === 0) listeners.delete(projectId);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!Array.from(projects.values()).some((project) => currentSession(project)
      && Array.from(project.scenes.values()).some((draft) => draft.state !== 'saved'))) return;
    event.preventDefault();
    event.returnValue = '';
  });
}
