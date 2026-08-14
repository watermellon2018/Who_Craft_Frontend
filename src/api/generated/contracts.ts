// Generated from openapi/w_craft.openapi.json. Do not edit manually.

export type ProjectId = number | string;

export const API_CONSTRAINTS = {
  "posterPromptMaxLength": 1000,
  "projectAnnotationMaxLength": 800,
  "projectSynopsisMaxLength": 2000,
  "projectPosterMaxBytes": 5242880
} as const;

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
  code?: string;
  detail?: string;
  errors?: Record<string, unknown>;
}

export type CreditAmount = string;

export interface CreditAccount {
  availableBalance: CreditAmount;
  reservedBalance: CreditAmount;
  totalBalance: CreditAmount;
}

export interface CreditStatistics {
  periodDays: number;
  received: CreditAmount;
  sent: CreditAmount;
  spent: CreditAmount;
  refunded: CreditAmount;
}

export interface CreditCapabilities {
  demoTopUpEnabled: boolean;
  transfersEnabled: boolean;
}

export interface CreditSummary {
  account: CreditAccount;
  stats: CreditStatistics;
  capabilities: CreditCapabilities;
}

export type CreditOperationType = "demo_top_up" | "transfer_out" | "transfer_in" | "reserve" | "capture" | "release" | "refund" | "adjustment";

export interface CreditCounterparty {
  username: string;
  displayName: string;
}

export interface CreditLedgerEntry {
  id: string;
  operationType: CreditOperationType;
  availableDelta: CreditAmount;
  reservedDelta: CreditAmount;
  availableBalanceAfter: CreditAmount;
  reservedBalanceAfter: CreditAmount;
  correlationId: string;
  counterparty: CreditCounterparty | null;
  description: string;
  createdAt: string;
}

export interface CreditHistoryPage {
  items: Array<CreditLedgerEntry>;
  total: number;
  limit: number;
  offset: number;
  nextOffset: number | null;
}

export interface CreditDemoTopUpRequest {
  amount: string;
}

export interface CreditMutationResponse {
  account: CreditAccount;
  transaction: CreditLedgerEntry;
  replayed: boolean;
}

export interface CreditTransferRequest {
  username: string;
  amount: string;
  note?: string;
}

export interface CreditTransfer {
  id: string;
  amount: CreditAmount;
  recipient: CreditCounterparty;
  note: string;
  createdAt: string;
}

export interface CreditTransferResponse {
  account: CreditAccount;
  transfer: CreditTransfer;
  replayed: boolean;
}

export interface CharacterTreeNode {
  id: string;
  key: string;
  name: string;
  is_folder: boolean;
  character_id: string | null;
  children?: Array<CharacterTreeNode>;
}

export interface CharacterTreeCreateRequest {
  id: string;
  name: string;
  type: "folder" | "character";
  parent_id?: string | null;
  studio_character_id?: string | null;
}

export interface CharacterTreeUpdateRequest {
  name: string;
}

export interface PosterGenerateRequest {
  prompt: string;
  style: "cinematic" | "anime" | "dark_fantasy" | "realism";
  format: "vertical" | "square" | "horizontal";
  reference_image_url?: string;
  reference_image_asset_id?: number;
  image_model?: string;
}

export type PosterGenerateMultipartRequest = PosterGenerateRequest & { reference_image?: File; };

export interface PosterVariant {
  id: number;
  imageUrl: string;
}

export interface PosterOperationResponse {
  jobId?: number;
  status?: "queued" | "processing" | "completed" | "failed" | "cancelled";
  variants: Array<PosterVariant>;
}

export interface ProjectMutationRequest {
  title?: string;
  format?: "short_film" | "feature_film" | "series" | "clip" | "commercial" | "other";
  genre?: Array<string>;
  audience?: Array<string>;
  annotation?: string;
  synopsis?: string;
  status?: string;
  is_favorite?: boolean;
  poster_image_data?: string;
  poster_url?: string | null;
}

export interface ProjectMutationResponse {
  id: number;
  title: string;
  description?: string;
  status?: string;
  statusLabel?: string;
  coverImageUrl?: string | null;
  updatedAt?: string | null;
  updatedAtLabel?: string;
  isFavorite?: boolean;
  tags?: Array<string>;
  stats?: Record<string, unknown>;
  format?: "short_film" | "feature_film" | "series" | "clip" | "commercial" | "other";
  genre?: Array<string>;
  audience?: Array<string>;
  annotation?: string;
  synopsis?: string;
  posterUrl?: string | null;
  generationSettings?: Record<string, unknown>;
  createdAt?: string | null;
}

export interface ProjectInvitationRequest {
  invitation_type: "username" | "link";
  username?: string;
  access_role: "admin" | "editor" | "viewer";
  team_role?: string;
  custom_team_role?: string;
}

export interface ProjectInvitationResponse {
  id: number;
  invitationType: "username" | "link";
  accessRole: "admin" | "editor" | "viewer";
  accessRoleLabel?: string;
  teamRole?: string;
  teamRoleLabel?: string;
  status: string;
  invitedUsername?: string | null;
  invitedByUsername?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  inviteUrl?: string;
  token?: string;
}

export interface MusicErrorResponse {
  code: string;
  detail: string;
  retryable: boolean;
  errors?: Record<string, unknown>;
  currentVersion?: number;
}

export interface MusicPermissions {
  currentUserRole: string | null;
  canView: boolean;
  canEdit: boolean;
  canRunGeneration: boolean;
}

export interface MusicPage {
  limit: number;
  offset: number;
  total: number;
}

export interface MusicTrackVersion {
  versionId: string | null;
  versionNumber: number | null;
  durationSeconds: number | null;
  mimeType: string | null;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  brief?: Record<string, unknown>;
  lyrics?: Array<MusicLyricsSection>;
  referenceAssetId?: string | null;
  createdAt?: string | null;
  createdById?: number | null;
  provenance?: Record<string, unknown>;
}

export interface MusicTrackSummary {
  id: number;
  title: string;
  author: string;
  tags: Array<string>;
  status: "active" | "archived";
  source: "manual" | "generated";
  version: number;
  activeVersion: MusicTrackVersion | null;
  usageCount: number;
  updatedAt: string | null;
}

export interface DashboardMusicTrackVersion {
  versionId: string;
  versionNumber: number;
  durationSeconds: number;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
}

export interface DashboardMusicTrack {
  id: number;
  title: string;
  author: string;
  durationSeconds: number;
  durationLabel: string;
  tags: Array<string>;
  coverImageUrl: string | null;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  activeVersionId?: string | null;
  activeVersionNumber?: number | null;
  activeVersion: DashboardMusicTrackVersion | null;
  version: number;
  source: "manual" | "generated";
  usageCount: number;
  usageLabel: string;
}

export interface MusicTrackPage {
  items: Array<MusicTrackSummary>;
  page: MusicPage;
  permissions: MusicPermissions;
}

export type MusicTrackDetail = MusicTrackSummary & { versions: Array<MusicTrackVersion>; assignments: Array<MusicAssignment>; permissions: MusicPermissions; };

export interface MusicCapabilities {
  contentModes: Array<"instrumental" | "song">;
  variantCounts: Array<1 | 2>;
  duration: Record<string, unknown>;
  outputFormats: Array<string>;
  briefFields: Record<string, unknown>;
  lyrics: Record<string, unknown>;
  audioReference: Record<string, unknown>;
  supportsSeed?: boolean;
  supportsCancellation?: boolean;
  providerDisplayName: string;
  permissions: MusicPermissions;
}

export interface MusicSceneOption {
  sceneId: number;
  number: number;
  act: number;
  title: string;
  location: string;
  summary: string;
  mood: string;
  durationSeconds: number;
  characters: Array<string>;
}

export interface MusicSceneOptionPage {
  items: Array<MusicSceneOption>;
  nextCursor: string | null;
  permissions: MusicPermissions;
}

export interface MusicReferenceUploadRequest {
  file: File;
  rightsConfirmed: true;
  rightsStatementVersion: "music-reference-v1";
}

export interface MusicReferenceAsset {
  assetId: string;
  name: string;
  durationSeconds: number | null;
  mimeType: string | null;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  localVerificationStatus: "pending" | "accepted" | "rejected";
  providerModerationStatus: "not_required" | "pending" | "accepted" | "rejected";
  permissions?: MusicPermissions;
}

export interface MusicContext {
  type: "project" | "scene";
  sceneId?: number;
}

export interface MusicLyricsSection {
  type: "verse" | "chorus" | "bridge" | "outro";
  label?: string;
  text: string;
}

export interface MusicContent {
  mode: "instrumental" | "song";
  lyricsLanguage?: "ru" | "en";
  vocalStyle?: Record<string, unknown>;
  sections?: Array<MusicLyricsSection>;
}

export interface MusicTempo {
  mode: "auto" | "slow" | "medium" | "fast" | "bpm";
  bpm?: number;
}

export interface MusicBrief {
  context?: MusicContext;
  content: MusicContent;
  title: string;
  purpose: "underscore" | "ambience" | "transition" | "stinger" | "song";
  genre: "cinematic" | "cinematic_pop" | "ambient" | "electronic" | "orchestral" | "acoustic" | "experimental" | "pop";
  moods: Array<string>;
  durationSeconds: number;
  tempo: MusicTempo;
  energyCurve: "steady" | "build" | "peak" | "fade";
  instruments?: Array<string>;
  exclude?: Array<string>;
  loopable?: boolean;
  seed?: number | null;
  textRefinement?: string;
}

export interface MusicGenerationCreateRequest {
  targetTrackId?: number | null;
  referenceAssetId?: string | null;
  variantCount?: 1 | 2;
  brief: MusicBrief;
}

export interface MusicGenerationAccepted {
  jobId: string;
  status: string;
  stage: string;
  idempotentReplay: boolean;
  pollAfterMs: number;
  createdAt: string;
}

export interface MusicVariant {
  variantId: string;
  index: number;
  status: "generated" | "failed";
  durationSeconds: number | null;
  mimeType: string | null;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  seed: number | null;
  appliedTrackVersionId: string | null;
}

export interface MusicGenerationJob {
  jobId: string;
  status: "queued" | "processing" | "cancellation_requested" | "completed" | "failed" | "cancelled";
  stage: string;
  variantCount: 1 | 2;
  brief: MusicBrief;
  referenceAsset?: MusicReferenceAsset | null;
  targetTrackId: number | null;
  retryOf?: string | null;
  attempts: number;
  canCancel: boolean;
  canRetry: boolean;
  error?: MusicErrorResponse | null;
  createdAt: string;
  completedAt?: string | null;
  permissions: MusicPermissions;
  variants: Array<MusicVariant>;
}

export interface MusicJobPage {
  items: Array<MusicGenerationJob>;
  page: MusicPage;
  permissions: MusicPermissions;
}

export interface MusicVariantApplyRequest {
  targetTrackId?: number | null;
  expectedTrackVersion?: number | null;
  title: string;
  author?: string;
  tags?: Array<string>;
  makeActive?: boolean;
}

export interface MusicVariantApplyResponse {
  trackId: number;
  trackVersion: number;
  activeVersion: MusicTrackVersion | null;
  idempotentReplay: boolean;
}

export interface MusicTrackPatchRequest {
  expectedTrackVersion: number;
  title?: string;
  author?: string;
  durationSeconds?: number;
  tags?: Array<string>;
  activeVersionId?: string;
}

export interface MusicTrackArchiveRequest {
  expectedTrackVersion: number;
}

export interface MusicAssignment {
  sceneId: number;
  sceneNumber: number;
  sceneTitle: string;
  location: string;
  scene: MusicSceneOption;
  trackVersionId: string | null;
  trackVersionNumber: number | null;
  startTimeSeconds: number;
}

export interface MusicAssignmentRequest {
  sceneId: number;
  trackVersionId: string;
  startTimeSeconds?: number;
}

export interface MusicAssignments {
  trackId: number;
  trackVersion: number;
  items: Array<MusicAssignment>;
  permissions: MusicPermissions;
}

export interface MusicAssignmentsReplaceRequest {
  expectedTrackVersion: number;
  items: Array<MusicAssignmentRequest>;
}

export interface ReferenceErrorResponse {
  error: ApiErrorDetail;
  code: "AUTH_REQUIRED" | "PROJECT_ACCESS_DENIED" | "REFERENCE_EDIT_FORBIDDEN" | "REFERENCE_GENERATION_FORBIDDEN" | "REFERENCE_NOT_FOUND" | "REFERENCE_VERSION_NOT_FOUND" | "REFERENCE_JOB_NOT_FOUND" | "REFERENCE_VARIANT_NOT_FOUND" | "REFERENCE_CROSS_PROJECT_LINK" | "REFERENCE_INVALID_CATEGORY" | "REFERENCE_INVALID_BRIEF" | "REFERENCE_LOCATION_CATEGORY_REQUIRED" | "REFERENCE_UPLOAD_RIGHTS_REQUIRED" | "MEDIA_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "INVALID_IMAGE" | "REFERENCE_VERSION_CONFLICT" | "REFERENCE_IDEMPOTENCY_MISMATCH" | "REFERENCE_JOB_ALREADY_ACTIVE" | "REFERENCE_JOB_NOT_CANCELLABLE" | "REFERENCE_JOB_NOT_RETRYABLE" | "REFERENCE_JOB_NOT_COMPLETED" | "REFERENCE_VARIANT_ALREADY_APPLIED" | "REFERENCE_ARCHIVED" | "REFERENCE_ASSET_IN_USE" | "REFERENCE_MAX_ATTEMPTS_EXCEEDED" | "REFERENCE_STORAGE_FAILED" | "IMAGE_MODEL_UNKNOWN" | "IMAGE_PROVIDER_EDIT_NOT_SUPPORTED" | "IMAGE_PROVIDER_NOT_CONFIGURED" | "IMAGE_PROVIDER_FORBIDDEN" | "IMAGE_PROVIDER_UNAVAILABLE" | "IMAGE_PROVIDER_BLOCKED" | "IMAGE_PROVIDER_BAD_RESPONSE" | "IMAGE_PROVIDER_ERROR" | "REFERENCE_INTERNAL_ERROR";
  detail: string;
  retryable: boolean;
  errors?: Record<string, unknown>;
  currentVersion?: number;
}

export type ReferenceCategory = "location" | "prop" | "wardrobe" | "vehicle" | "symbol" | "other";

export type ReferenceComputedStatus = "draft" | "generating" | "ready" | "failed" | "archived";

export type ReferenceCharacterRelation = "owns" | "wears" | "carries" | "uses" | "important" | "associated";

export interface ReferenceBrief {
  schemaVersion?: "reference_brief.v1";
  aspectRatio?: "1:1" | "4:3" | "3:2" | "16:9" | "2:3";
  description?: string;
  condition?: string;
  era?: string;
  style?: string;
  view?: string;
  dimensions?: string;
  continuityNotes?: string;
  negativePrompt?: string;
  materials?: Array<string>;
  palette?: Array<string>;
  distinctiveFeatures?: Array<string>;
  continuityProperties?: Array<string>;
  markings?: Array<string>;
}

export interface ReferenceCharacterLinkRequest {
  characterId: string;
  relation: ReferenceCharacterRelation;
  note?: string;
}

export interface ReferenceCharacterLink {
  characterId: string;
  name: string;
  relation: ReferenceCharacterRelation;
  note: string;
}

export interface ReferenceVersion {
  id: string;
  number: number;
  origin: "upload" | "generated" | "edit";
  imageUrl: string | null;
  thumbnailUrl: string | null;
  provider: string | null;
  modelName: string | null;
  createdById: number | null;
  createdAt: string;
}

export interface ReferenceJobWarning {
  code: string;
  detail: string;
  retryable: boolean;
}

export interface ReferenceUsageSummary {
  sceneCount: number;
  characters: Array<ReferenceCharacterLink>;
}

export interface ReferenceSummary {
  id: string;
  title: string;
  category: ReferenceCategory;
  categoryLabel: string;
  status: ReferenceComputedStatus;
  activeVersion: ReferenceVersion | null | null;
  tags: Array<string>;
  usage: ReferenceUsageSummary;
  lastJobWarning: ReferenceJobWarning | null | null;
  version: number;
  archivedAt: string | null;
  updatedAt: string;
}

export type ReferenceDetail = ReferenceSummary & { description: string; brief: ReferenceBrief; locationId: number | null; characterLinks: Array<ReferenceCharacterLink>; createdAt: string; };

export interface ReferencePage {
  items: Array<ReferenceSummary>;
  page: number;
  pageSize: number;
  total: number;
}

export interface ReferenceLinkOptions {
  characters: Array<{ id: string; name: string; }>;
  locations: Array<{ id: number; name: string; }>;
}

export interface ReferenceCreateRequest {
  title: string;
  category: ReferenceCategory;
  description?: string;
  brief?: ReferenceBrief;
  tags?: Array<string>;
  locationId?: number | null;
  characterLinks?: Array<ReferenceCharacterLinkRequest>;
}

export interface ReferencePatchRequest {
  version: number;
  title?: string;
  category?: ReferenceCategory;
  description?: string;
  brief?: ReferenceBrief;
  tags?: Array<string>;
  locationId?: number | null;
  characterLinks?: Array<ReferenceCharacterLinkRequest>;
}

export interface ExpectedReferenceVersionRequest {
  expectedReferenceVersion: number;
}

export interface ReferenceUploadRequest {
  file: File;
  expectedReferenceVersion: number;
  rightsConfirmed: true;
  rightsStatementVersion: "reference-upload-v1";
}

export interface ReferenceCapabilities {
  permissions: { canView: boolean; canEdit: boolean; canRunGeneration: boolean; };
  categories: Array<{ key: ReferenceCategory; label: string; }>;
  generation: { configured: boolean; providerMode: "mock" | "registry"; effectiveModel: string | null; canGenerate: boolean; canEdit: boolean; generateVariantCounts: Array<1 | 2 | 4>; editVariantCounts: Array<1>; aspectRatios: Array<"1:1" | "4:3" | "3:2" | "16:9" | "2:3">; };
  upload: { maxBytes: number; maxPixels: number; mimeTypes: Array<"image/jpeg" | "image/png" | "image/webp">; rightsStatementVersion: "reference-upload-v1"; };
}

export interface ReferenceVersionPage {
  items: Array<ReferenceVersion>;
  activeVersionId: string | null;
}

export interface ReferenceVersionMutationResponse {
  referenceId: string;
  referenceVersion: number;
  activeVersion: ReferenceVersion;
}

export interface ReferenceGenerationCreateRequest {
  expectedReferenceVersion: number;
  operation: "generate" | "edit";
  sourceVersionId?: string | null;
  variantCount: 1 | 2 | 4;
  imageModel?: string;
  brief?: ReferenceBrief;
  editInstruction?: string;
}

export interface ReferenceGenerationError {
  code: string;
  detail: string;
  retryable: boolean;
}

export interface ReferenceVariant {
  id: string;
  index: number;
  status: "generated" | "applied" | "discarded";
  imageUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

export interface ReferenceGenerationJobSummary {
  id: string;
  referenceId: string;
  operation: "generate" | "edit";
  status: "queued" | "processing" | "cancellation_requested" | "completed" | "failed" | "cancelled";
  stage: "queued" | "compiling" | "generating" | "validating" | "storing" | "finalized" | "failed" | "cancelled";
  progress: number;
  variantCount: 1 | 2 | 4;
  attempts: number;
  canCancel: boolean;
  canRetry: boolean;
  error: ReferenceGenerationError | null | null;
  createdAt: string;
  completedAt: string | null;
}

export type ReferenceGenerationJob = ReferenceGenerationJobSummary & { variants: Array<ReferenceVariant>; };

export interface ReferenceJobPage {
  items: Array<ReferenceGenerationJobSummary>;
}

export type SceneReferenceUsage = "environment" | "hero_prop" | "set_dressing" | "wardrobe" | "vehicle" | "symbol" | "other";

export interface SceneReferenceRequest {
  referenceId: string;
  versionId: string;
  usage: SceneReferenceUsage;
  note?: string;
}

export interface SceneReference {
  referenceId: string;
  title: string;
  category: ReferenceCategory;
  versionId: string;
  versionNumber: number;
  usage: SceneReferenceUsage;
  note: string;
  thumbnailUrl: string | null;
  updateAvailable: boolean;
  activeVersionId: string | null;
}

export interface SceneReferences {
  sceneId: number;
  sceneVersion: number;
  items: Array<SceneReference>;
}

export interface SceneReferencesReplaceRequest {
  expectedSceneVersion: number;
  items: Array<SceneReferenceRequest>;
}
