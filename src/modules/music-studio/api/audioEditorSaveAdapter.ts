import type {AudioEditDocument} from '../editor/audioEditModel';

export interface SaveAudioEditInput {
  draftId?: string;
  document: AudioEditDocument;
  expectedTrackVersion: number | null;
  makeActive: true;
  projectId: string;
  sourceVersionId: string | null;
  trackId: number | null;
}

export class AudioEditSaveUnavailableError extends Error {
  constructor() {
    super('Audio edit rendering is not available on the backend yet.');
    this.name = 'AudioEditSaveUnavailableError';
  }
}

export const audioEditorSaveAdapter = {
  available: false,
  async saveNewVersion(_input: SaveAudioEditInput, signal?: AbortSignal): Promise<never> {
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');

    // TODO(audio-editor-backend): for a saved track, send sourceVersionId, trackId,
    // expectedTrackVersion, makeActive, and the ordered non-destructive segment document.
    // For a local upload draft, resolve draftId to its original File and upload the rendered
    // result once a dedicated endpoint can persist a new immutable track version.
    throw new AudioEditSaveUnavailableError();
  },
};
