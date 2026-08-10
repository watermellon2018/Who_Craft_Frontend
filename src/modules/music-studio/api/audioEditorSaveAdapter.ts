import type {AudioEditDocument} from '../editor/audioEditModel';

export interface SaveAudioEditInput {
  document: AudioEditDocument;
  expectedTrackVersion: number;
  makeActive: true;
  projectId: string;
  sourceVersionId: string | null;
  trackId: number;
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

    // TODO(audio-editor-backend): send sourceVersionId, expectedTrackVersion, makeActive,
    // and the ordered non-destructive segment document to an endpoint that renders and
    // persists a new immutable track version, then returns the updated track/version.
    throw new AudioEditSaveUnavailableError();
  },
};
