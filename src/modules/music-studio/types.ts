export type MusicContentMode = 'instrumental' | 'song';
export type MusicJobStatus =
  | 'queued'
  | 'processing'
  | 'cancellation_requested'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MusicPermissions {
  canEdit: boolean;
  canRunGeneration: boolean;
  canView?: boolean;
  currentUserRole?: string | null;
}

export interface MusicCapabilities {
  audioReference: {
    formats: string[];
    maxBytes: number;
    maxCount: number;
    maxSeconds: number;
    minSeconds: number;
    supported: boolean;
  };
  briefFields: {
    energyCurves: string[];
    genres: string[];
    instruments: string[];
    moods: string[];
    purposes: string[];
    tempoModes: string[];
    vocalStyles: {
      deliveries: string[];
      densities?: string[];
      timbres: string[];
    };
  };
  contentModes: MusicContentMode[];
  duration: {
    defaultSeconds: number;
    maxSeconds: number;
    minSeconds: number;
  };
  lyrics: {
    languages: string[];
    maxChars: number;
    sectionTypes: MusicLyricsSectionType[];
    supported: boolean;
  };
  outputFormats: string[];
  providerDisplayName: string;
  supportsCancellation: boolean;
  supportsSeed: boolean;
  variantCounts: number[];
}

export interface MusicTrackVersionSummary {
  audioUrl: string | null;
  audioUrlExpiresAt?: string | null;
  createdAt?: string | null;
  durationSeconds: number | null;
  provenance?: MusicTrackVersionProvenance | null;
  versionId: string | null;
  versionNumber: number | null;
}

export interface MusicTrackVersionProvenance {
  createdByAi: boolean;
  model: string | null;
  provider: string | null;
  providerRequestId: string | null;
  [key: string]: unknown;
}

export interface MusicLibraryItem {
  activeVersion: MusicTrackVersionSummary | null;
  author: string;
  id: number;
  source: 'generated' | 'manual';
  status: 'active' | 'archived';
  tags: string[];
  title: string;
  updatedAt: string;
  usageCount: number;
  version: number;
}

export interface MusicLibraryResponse {
  items: MusicLibraryItem[];
  page: {
    limit: number;
    offset: number;
    total: number;
  };
  permissions: MusicPermissions;
}

export interface MusicSceneOption {
  act: number | null;
  characters: string[];
  durationSeconds: number | null;
  location: string;
  mood: string;
  number: number | null;
  sceneId: number;
  summary: string;
  title: string;
}

export interface MusicSceneOptionsResponse {
  items: MusicSceneOption[];
  nextCursor: string | null;
}

export interface MusicReferenceAsset {
  assetId: string;
  audioUrl: string;
  audioUrlExpiresAt: string | null;
  durationSeconds: number | null;
  localVerificationStatus: 'pending' | 'accepted' | 'rejected';
  mimeType: string;
  name: string;
  providerModerationStatus: 'pending' | 'accepted' | 'rejected';
}

export type MusicLyricsSectionType = 'verse' | 'chorus' | 'bridge' | 'outro';

export interface MusicLyricsSection {
  label: string;
  text: string;
  type: MusicLyricsSectionType;
}

export interface MusicVocalStyle {
  delivery: string;
  density?: string;
  timbre: string;
}

export type MusicBriefContent =
  | {mode: 'instrumental'}
  | {
      lyricsLanguage: string;
      mode: 'song';
      sections: MusicLyricsSection[];
      vocalStyle: MusicVocalStyle;
    };

export interface MusicBrief {
  content: MusicBriefContent;
  context: {type: 'project'} | {sceneId: number; type: 'scene'};
  durationSeconds: number;
  energyCurve: string;
  exclude: string[];
  genre: string;
  instruments: string[];
  loopable: boolean;
  moods: string[];
  purpose: string;
  seed?: number | null;
  tempo: {bpm?: number; mode: string};
  textRefinement: string;
  title: string;
}

export interface MusicEnqueueRequest {
  brief: MusicBrief;
  referenceAssetId: string | null;
  targetTrackId: number | null;
  variantCount: number;
}

export interface MusicEnqueueResponse {
  createdAt: string;
  idempotentReplay: boolean;
  jobId: string;
  pollAfterMs: number;
  stage: string;
  status: MusicJobStatus;
}

export interface MusicJobError {
  code: string;
  detail: string;
  retryable?: boolean;
}

export interface MusicVariant {
  appliedTrackVersionId: string | null;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  durationSeconds: number | null;
  index: number;
  mimeType: string | null;
  seed: number | null;
  status: 'generated' | 'failed';
  variantId: string;
}

export interface MusicGenerationJob {
  billing?: GenerationBilling | null;
  attempts: number;
  brief: MusicBrief;
  canCancel: boolean;
  canRetry: boolean;
  completedAt: string | null;
  createdAt: string;
  error: MusicJobError | null;
  jobId: string;
  permissions: MusicPermissions;
  pollAfterMs?: number;
  referenceAsset: MusicReferenceAsset | null;
  retryOf: string | null;
  stage: string;
  status: MusicJobStatus;
  targetTrackId: number | null;
  variantCount: number;
  variants: MusicVariant[];
}

export interface MusicJobHistoryResponse {
  items: MusicGenerationJob[];
  page?: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface MusicAssignment {
  location: string;
  scene: MusicSceneOption;
  sceneId: number;
  sceneNumber: number | null;
  sceneTitle: string;
  startTimeSeconds: number;
  trackVersionId: string | null;
  trackVersionNumber: number | null;
}

export interface MusicTrackVersion extends MusicTrackVersionSummary {
  brief?: MusicBrief | null;
  lyrics?: readonly MusicLyricsSection[];
  referenceAssetId?: string | null;
}

export interface MusicTrackDetail extends MusicLibraryItem {
  assignments: MusicAssignment[];
  permissions?: MusicPermissions;
  versions: MusicTrackVersion[];
}

export interface MusicApplyRequest {
  author: string;
  expectedTrackVersion: number | null;
  makeActive: boolean;
  tags: string[];
  targetTrackId: number | null;
  title: string;
}

export interface MusicApplyResponse {
  activeVersion: MusicTrackVersionSummary | null;
  idempotentReplay: boolean;
  trackId: number;
  trackVersion: number;
}

export interface MusicAssignmentWriteItem {
  sceneId: number;
  startTimeSeconds: number;
  trackVersionId: string;
}

export interface MusicAssignmentsResponse {
  items: MusicAssignment[];
  permissions: MusicPermissions;
  trackId: number;
  trackVersion: number;
}

export function isMusicJobTerminal(status: MusicJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
import type {GenerationBilling} from '../../api/generated/contracts';
