// Generated from openapi/w_craft.openapi.json. Do not edit manually.

export type ProjectId = number | string;

export const API_CONSTRAINTS = {
  "posterPromptMaxLength": 1000,
  "projectAnnotationMaxLength": 800,
  "projectSynopsisMaxLength": 2000,
  "projectPosterMaxBytes": 5242880
} as const;

export interface ProfileSettings {
  language: "ru" | "en";
  content_language: "ru" | "en";
  private_account: boolean;
  notifications_in_app: boolean;
  notifications_email: boolean;
  comment_permission: "everyone" | "followers" | "nobody";
}

export interface ProfileSettingsPatch {
  language?: "ru" | "en";
  content_language?: "ru" | "en";
  private_account?: boolean;
  notifications_in_app?: boolean;
  notifications_email?: boolean;
  comment_permission?: "everyone" | "followers" | "nobody";
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  target_url: string;
  entity_type: string;
  entity_id: string;
}

export interface NotificationList {
  results: Array<Notification>;
  unread_count: number;
}

export interface NotificationReadAllResult {
  unread_count: 0;
  updated: number;
}

export interface VideoShotCommentAuthor {
  id: number;
  username: string;
}

export interface VideoShotComment {
  id: number;
  author: VideoShotCommentAuthor;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface VideoShotCommentCreate {
  body: string;
}

export interface VideoShotCommentList {
  can_comment: boolean;
  comment_block_reason: "COMMENTS_DISABLED" | "COMMENTS_FOLLOWERS_ONLY" | null;
  comments: Array<VideoShotComment>;
}

export interface MissingCharacter {
  name: string;
  dialogueCount: number;
  sceneCount: number;
}

export interface MissingCharactersResponse {
  characters: Array<MissingCharacter>;
}

export interface ProjectPermissionSummary {
  currentUserRole: string | null;
  canView: boolean;
  canEdit: boolean;
  canRunGeneration: boolean;
  canEditSettings: boolean;
  canPublish: boolean;
  canManageTeam: boolean;
  canTransferOwnership: boolean;
  canDeleteProject: boolean;
  canLeaveProject: boolean;
}

export interface VideoPreparationCompact {
  ready: boolean;
  taskCount: number;
}

export interface VideoPreparationProject {
  id: number;
  title: string;
  permissions: ProjectPermissionSummary;
}

export interface VideoPreparationEmptyScene {
  sceneId: number;
  title: string;
  order: number;
}

export interface VideoPreparationStoryboardScene {
  sceneId: number;
  title: string;
  order: number;
  status: "missing" | "stale";
  currentVersion: number;
  acceptedVersion: number | null;
}

export interface VideoPreparationStoryboard {
  ready: boolean;
  progress: number;
  readyCount: number;
  totalCount: number;
  missingCount: number;
  staleCount: number;
  scenes: Array<VideoPreparationStoryboardScene>;
}

export interface VideoPreparationResponse {
  project: VideoPreparationProject;
  ready: boolean;
  taskCount: number;
  missingCharacters: Array<MissingCharacter>;
  emptyScenes: Array<VideoPreparationEmptyScene>;
  storyboard: VideoPreparationStoryboard;
}

export type CharacterSecondaryAssetType = "full_body" | "scene";

export interface CharacterSecondaryAssetsQuoteRequest {
  variant_id: string;
  image_types: Array<CharacterSecondaryAssetType>;
  image_model?: string | null;
  routing_mode?: "manual" | "economy" | "fast" | "balanced" | "quality";
}

export interface CharacterSecondaryAssetQuoteItem {
  image_type: CharacterSecondaryAssetType;
  estimated_cost: CreditAmount;
  reservation_amount: CreditAmount;
  provider: string;
  model_key: string;
  model_name: string;
  routing_mode: string;
}

export interface CharacterSecondaryAssetsQuote {
  quote_token: string;
  expires_in_seconds: number;
  items: Array<CharacterSecondaryAssetQuoteItem>;
  totals: { estimated_cost: CreditAmount; reservation_amount: CreditAmount; };
  available_balance: CreditAmount;
  sufficient_balance: boolean;
  account_frozen: boolean;
}

export interface CharacterSecondaryAssetsGenerateRequest {
  quote_token: string;
}

export interface CharacterSecondaryAssetJob {
  job_id: string;
  status: string;
  image_type: CharacterSecondaryAssetType;
  error_code: string;
  error_message: string;
}

export interface CharacterSecondaryAssetsGenerateResponse {
  jobs: Array<CharacterSecondaryAssetJob>;
  total_reservation_amount: CreditAmount;
}

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

export interface AccountDeleteRequest {
  current_password: string;
}

export interface AccountDeleteOwnedProjectsError {
  error: ApiErrorDetail;
  code: "ACCOUNT_HAS_OWNED_PROJECTS";
  detail: string;
  ownedProjectCount: number;
}

export type CreditAmount = string;

export interface CreditAccount {
  availableBalance: CreditAmount;
  reservedBalance: CreditAmount;
  totalBalance: CreditAmount;
  isFrozen: boolean;
  freezeReason: string;
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
  adminWalletManagement: boolean;
}

export interface CreditAlerts {
  lowBalance: boolean;
  lowBalanceThreshold: CreditAmount;
}

export interface CreditTransferLimits {
  perTransfer: CreditAmount;
  rollingDay: CreditAmount;
  rollingDayCount: number;
}

export interface CreditSummary {
  account: CreditAccount;
  stats: CreditStatistics;
  capabilities: CreditCapabilities;
  alerts: CreditAlerts;
  transferLimits: CreditTransferLimits;
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
  senderUsername: string;
  recipientUsername: string;
  amount: string;
  reason: string;
}

export interface CreditTransfer {
  id: string;
  amount: CreditAmount;
  sender: string;
  recipient: CreditCounterparty;
  note: string;
  createdAt: string;
}

export interface CreditTransferResponse {
  account: CreditAccount;
  transfer: CreditTransfer;
  auditEvent: CreditAdminAuditEvent;
  replayed: boolean;
}

export interface ProjectCreditBudget {
  projectId: number;
  projectTitle: string;
  limit: CreditAmount | null;
  spent: CreditAmount;
  reserved: CreditAmount;
  remaining: CreditAmount | null;
  overLimit: boolean;
}

export interface ProjectCreditBudgetList {
  items: Array<ProjectCreditBudget>;
}

export interface ProjectCreditBudgetUpdateRequest {
  limit: CreditAmount | null;
}

export interface CreditSpendingGroup {
  domain?: string;
  projectId?: number | null;
  projectTitle?: string;
  date?: string;
  charged: CreditAmount;
  jobCount: number;
}

export interface CreditSpendingStatistics {
  periodDays: number;
  totalCharged: CreditAmount;
  jobCount: number;
  byDomain: Array<CreditSpendingGroup>;
  byProject: Array<CreditSpendingGroup>;
  timeline: Array<CreditSpendingGroup>;
}

export interface CreditAdminOperationRequest {
  action: "freeze" | "unfreeze";
  reason: string;
}

export interface CreditAdminAuditEvent {
  id: string;
  eventType: "adjustment" | "refund" | "freeze" | "unfreeze" | "transfer";
  amount: CreditAmount | null;
  reason: string;
  actor: string | null;
  createdAt: string;
}

export interface CreditAdminOperationResponse {
  account: CreditAccount;
  auditEvent: CreditAdminAuditEvent;
  replayed: boolean;
}

export interface CreditAdminAudit {
  username: string;
  account: CreditAccount;
  items: Array<CreditAdminAuditEvent>;
}

export type GenerationRoutingMode = "manual" | "economy" | "fast" | "balanced" | "quality";

export interface GenerationRouteCandidate {
  modelKey: string;
  modelName: string;
  provider: string;
  estimatedCost: CreditAmount;
}

export interface GenerationCostEstimateRequest {
  domain: "character" | "poster" | "reference" | "music" | "sound_effect" | "model3d";
  operation?: "generate" | "edit" | "reference";
  modelKey?: string;
  variantCount?: number;
  promptLength?: number;
  durationSeconds?: number | null;
  resolution?: "512" | "1K" | "2K" | "4K";
  routingMode?: GenerationRoutingMode;
}

export interface GenerationCostEstimate {
  domain: string;
  operation: string;
  provider: string;
  modelKey: string;
  modelName: string;
  currency: "USD";
  estimatedCost: CreditAmount;
  reservationAmount: CreditAmount;
  pricingSource: string;
  costIsEstimate: boolean;
  availableBalance: CreditAmount;
  sufficientBalance: boolean;
  accountFrozen: boolean;
  routingMode: GenerationRoutingMode;
  routingReason: string;
  routeCandidates: Array<GenerationRouteCandidate>;
}

export interface GenerationBilling {
  status: "reserved" | "captured" | "released";
  currency: "USD";
  estimatedCost: CreditAmount;
  reservedAmount: CreditAmount;
  actualCost: CreditAmount | null;
  chargedAmount: CreditAmount;
  uncoveredCost: CreditAmount;
  costIsEstimate: boolean;
  provider: string;
  model: string;
  operation: string;
  routingMode: GenerationRoutingMode;
  routingAttempts: Array<Record<string, unknown>>;
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
  routing_mode?: GenerationRoutingMode;
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
  billing?: GenerationBilling | null;
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

export interface ProjectProgressReviewScene {
  sceneId: number;
  title: string;
  currentRevision: number;
  acceptedRevision: number;
}

export interface ProjectReadiness {
  overall: number;
  script: number;
  characters: number | null;
  storyboard: number;
  video: number;
  storyboardNeedsReview: number;
  storyboardReviewScenes: Array<ProjectProgressReviewScene>;
  videoPreparation: VideoPreparationCompact;
}

export interface ProjectProgress {
  overall: number;
  script: number;
  visual: number;
  audio: number;
  postproduction: number;
  readiness: ProjectReadiness;
}

export interface ProjectDashboard {
  progress: ProjectProgress;
}

export interface SceneStoryboard {
  sceneId: number;
  assetId: number | null;
  sourceSceneVersion: number;
  confirmedSceneVersion: number | null;
  acceptedSceneVersion: number;
  currentSceneVersion: number;
  needsReview: boolean;
  updatedAt: string | null;
}

export type StoryboardAzimuth = "front" | "front_left" | "left" | "back_left" | "back" | "back_right" | "right" | "front_right";

export type StoryboardElevation = "low" | "eye_level" | "high" | "top";

export type StoryboardDistance = "wide" | "medium" | "near";

export type StoryboardFraming = "extreme_wide" | "wide" | "full" | "medium" | "medium_close" | "close" | "extreme_close" | "ots" | "pov";

export type StoryboardMovement = "static" | "dolly_in" | "dolly_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "orbit_left" | "orbit_right" | "truck_left" | "truck_right" | "crane_up" | "crane_down" | "follow" | "custom";

export interface StoryboardCameraIntent {
  id: string;
  target: Record<string, unknown>;
  azimuth: StoryboardAzimuth;
  elevation: StoryboardElevation;
  distance: StoryboardDistance;
  framing: StoryboardFraming;
  lensMm?: number | null;
  composition: Array<Record<string, unknown>>;
  cameraMetadata: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface StoryboardCameraIntentMutation {
  expectedVersion?: number;
  target: Record<string, unknown>;
  azimuth: StoryboardAzimuth;
  elevation: StoryboardElevation;
  distance: StoryboardDistance;
  framing: StoryboardFraming;
  lensMm?: number | null;
  composition?: Array<Record<string, unknown>>;
  cameraMetadata?: Record<string, unknown>;
}

export interface StoryboardGenerationImage {
  id: string | null;
  revision: number | null;
  status: "empty" | "queued" | "generating" | "ready" | "failed";
  url: string | null;
  outdated: boolean;
  provider?: string | null;
  model?: string | null;
  error: StoryboardGenerationError | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface StoryboardGenerationReference {
  id: string;
  referenceType: "character" | "location" | "object" | "clothing" | "previous_keyframe" | "previous_shot" | "other_storyboard_keyframe";
  sourceKeyframeId: string | null;
  visualReferenceId: string | null;
  characterId: string | null;
  locationId: number | null;
  priority: number;
  isPrimary: boolean;
  label: string;
  missing: boolean;
}

export interface StoryboardTransition {
  id: string;
  fromKeyframeId: string;
  toKeyframeId: string;
  detectedMovement: StoryboardMovement;
  movementOverride: StoryboardMovement | null;
  effectiveMovement: StoryboardMovement;
  metadata: Record<string, unknown>;
}

export interface StoryboardTransitionMutation {
  movementOverride: StoryboardMovement | null;
}

export interface StoryboardKeyframe {
  id: string;
  type: "start" | "intermediate" | "end";
  position: number;
  cameraIntent: StoryboardCameraIntent | null;
  image: StoryboardGenerationImage;
  latestGeneration: StoryboardGenerationImage;
  activeGeneration: StoryboardGenerationImage | null;
  generationReferences: Array<StoryboardGenerationReference>;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardKeyframePosition {
  position: number;
}

export interface StoryboardGenerationError {
  code: string;
  message: string;
}

export interface StoryboardShotCharacter {
  id: string | null;
  name: string;
  missing: boolean;
}

export interface StoryboardShotVisualReference {
  id: string | null;
  title: string;
  role: "location" | "object" | "clothing" | "transport" | "other";
  missing: boolean;
}

export interface StoryboardShot {
  id: string;
  order: number;
  title: string;
  description: string;
  durationSeconds: number | null;
  location: { id: number; name: string; } | null;
  characters: Array<StoryboardShotCharacter>;
  visualReferences: Array<StoryboardShotVisualReference>;
  keyframes: Array<StoryboardKeyframe>;
  transitions: Array<StoryboardTransition>;
  readiness: { ready: boolean; missing: Array<string>; };
  version: number;
  updatedAt: string;
}

export interface StoryboardShotCreateMutation {
  title?: string;
  description?: string;
  durationSeconds?: number | null;
  locationId?: number | null;
  characterIds?: Array<string>;
  visualReferences?: Array<{ referenceId: string; role: "location" | "object" | "clothing" | "transport" | "other"; }>;
}

export interface StoryboardShotPatchMutation {
  expectedVersion: number;
  title?: string;
  description?: string;
  durationSeconds?: number | null;
  locationId?: number | null;
  characterIds?: Array<string>;
  visualReferences?: Array<{ referenceId: string; role: "location" | "object" | "clothing" | "transport" | "other"; }>;
}

export interface StoryboardShotReorder {
  shotIds: Array<string>;
}

export interface StoryboardSceneSummary {
  id: number;
  number: number;
  title: string;
  status: "empty" | "draft" | "completed";
  shotsCount: number;
  readyShotsCount: number;
  progress: number;
}

export interface StoryboardWorkspace {
  id: number;
  sceneId: number;
  status: "empty" | "draft" | "completed";
  shotsCount: number;
  readyShotsCount: number;
  progress: number;
  sourceSceneVersion: number;
  currentSceneVersion: number;
  needsReview: boolean;
  legacyAssetId: number | null;
  shots: Array<StoryboardShot>;
  context?: Record<string, unknown>;
  updatedAt: string;
}

export interface StoryboardShotListModelOption {
  id: string;
  label: string;
  provider: string;
  available: boolean;
  unavailableReason: "dependencyMissing" | "credentialMissing" | "unsupportedProvider" | null;
  estimatedCostUsd: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

export interface StoryboardShotListOptions {
  defaultModel: string;
  maxShots: number;
  models: Array<StoryboardShotListModelOption>;
  context: { sceneTitle: string; characters: Array<string>; locations: Array<string>; };
}

export interface StoryboardSuggestShotsRequest {
  language?: "ru" | "en";
  model?: string;
  maxShots?: number;
}

export type StoryboardEditorDraftId = string;

export interface StoryboardEditorDraftSourceDocument {
  contentHash: string;
  sceneId: number;
  sceneVersion: number;
  truncated: boolean;
  segments: Array<{ id: StoryboardEditorDraftId; text: string; }>;
}

export interface StoryboardEditorDraftSource {
  document: StoryboardEditorDraftSourceDocument;
  origin?: "manual" | "ai";
  segmentIds: Array<StoryboardEditorDraftId>;
  ranges?: Array<{ start: number; end: number; }>;
}

export interface StoryboardEditorDraftCameraIntent {
  azimuth: "front" | "front-left" | "left" | "back-left" | "back" | "back-right" | "right" | "front-right";
  elevation: "low" | "eye-level" | "high" | "top";
  distance: "wide" | "medium" | "near";
  framing: "extreme-wide" | "wide" | "full" | "medium" | "medium-close" | "close" | "extreme-close" | "ots" | "pov";
  lens?: number;
  targetId?: StoryboardEditorDraftId;
  composition?: Array<{ subjectId: StoryboardEditorDraftId; x: number; y: number; width: number; height: number; }>;
  ots?: { shoulder: "left" | "right"; foregroundSubjectId?: StoryboardEditorDraftId; targetId?: StoryboardEditorDraftId; };
}

export interface StoryboardEditorDraftReference {
  id: StoryboardEditorDraftId;
  title: string;
  type: "character" | "location" | "object" | "clothing" | "other" | "previous-keyframe" | "previous-shot";
  primary?: boolean;
  sourceKeyframeId?: StoryboardEditorDraftId;
  sourceShotId?: StoryboardEditorDraftId;
}

export interface StoryboardEditorDraftKeyframe {
  id: StoryboardEditorDraftId;
  shotId: StoryboardEditorDraftId;
  position: number;
  type: "start" | "intermediate" | "end";
  generationStatus: "idle" | "ready" | "failed";
  cameraIntent: StoryboardEditorDraftCameraIntent;
  generationReferences?: Array<StoryboardEditorDraftReference>;
}

export interface StoryboardEditorDraftTransition {
  id: StoryboardEditorDraftId;
  fromKeyframeId: StoryboardEditorDraftId;
  toKeyframeId: StoryboardEditorDraftId;
  movementOverride?: "Static" | "Dolly In" | "Dolly Out" | "Pan" | "Pan Left" | "Pan Right" | "Tilt Up" | "Tilt Down" | "Orbit Left" | "Orbit Right" | "Truck Left" | "Truck Right" | "Crane Up" | "Crane Down" | "Follow" | "Custom";
}

export interface StoryboardEditorDraftShot {
  id: StoryboardEditorDraftId;
  sceneId: StoryboardEditorDraftId;
  title: string;
  description: string;
  order: number;
  duration?: number;
  characterIds: Array<StoryboardEditorDraftId>;
  referenceIds: Array<StoryboardEditorDraftId>;
  locationId?: StoryboardEditorDraftId;
  keyframes: Array<StoryboardEditorDraftKeyframe>;
  transitions: Array<StoryboardEditorDraftTransition>;
  source?: StoryboardEditorDraftSource;
}

export interface StoryboardEditorDraftPayload {
  schemaVersion: 1;
  stage: "selection" | "builder" | "editor";
  shots: Array<StoryboardEditorDraftShot>;
}

export interface StoryboardEditorDraft {
  sceneId: number;
  revision: number;
  payload: StoryboardEditorDraftPayload;
}

export interface StoryboardEditorDraftList {
  userId: number;
  canEdit: boolean;
  drafts: Array<StoryboardEditorDraft>;
}

export interface StoryboardEditorDraftMutation {
  expectedRevision: number;
  mutationId: string;
  payload: StoryboardEditorDraftPayload;
}

export interface StoryboardSourceSegment {
  id: string;
  text: string;
}

export interface StoryboardShotListSource {
  scene_id: number;
  scene_version: number;
  content_hash: string;
  segments: Array<StoryboardSourceSegment>;
  truncated: boolean;
}

export interface StoryboardShotProposal {
  source: StoryboardShotListSource;
  shots: Array<{ title: string; description: string; source_segment_ids: Array<string>; suggested_characters: Array<string>; suggested_location: string | null; suggested_assets: Array<string>; suggested_framing: StoryboardFraming; }>;
}

export interface StoryboardGenerationReferenceMutation {
  referenceType: "character" | "location" | "object" | "clothing" | "previous_keyframe" | "previous_shot" | "other_storyboard_keyframe";
  sourceKeyframeId?: string | null;
  visualReferenceId?: string | null;
  characterId?: string | null;
  locationId?: number | null;
  priority?: number;
  isPrimary?: boolean;
}

export interface StoryboardGenerationReferencesReplace {
  references: Array<StoryboardGenerationReferenceMutation>;
}

export interface StoryboardGenerateRequest {
  imageModel?: string;
  routingMode?: "manual" | "economy" | "fast" | "balanced" | "quality";
}

export interface StoryboardGeneration {
  generationId: string;
  keyframeId: string;
  revision: number;
  status: "queued" | "generating" | "ready" | "failed";
  imageUrl: string | null;
  provider: string | null;
  model: string | null;
  error: StoryboardGenerationError | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  billing: Record<string, unknown>;
}

export interface StoryboardPreview {
  sceneId: number;
  shots: Array<{ id: string; duration: number | null; keyframes: Array<{ id: string; position: number; imageUrl: string | null; }>; transitions: Array<{ from: string; to: string; movement: StoryboardMovement; }>; }>;
}

export interface SceneStoryboardUpdateRequest {
  assetId: number;
  sourceSceneVersion: number;
}

export interface SceneStoryboardConfirmRequest {
  expectedSceneVersion: number;
}

export interface VideoShot {
  id: number;
  sceneId: number;
  title: string;
  order: number;
  finalAssetId: number | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface VideoShotList {
  shots: Array<VideoShot>;
}

export interface VideoShotCreateRequest {
  sceneId: number;
  title?: string;
  order?: number;
}

export interface VideoShotUpdateRequest {
  version: number;
  title?: string;
  order?: number;
  finalAssetId?: number | null;
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
  defaultModelKey: MusicAudioModelKey;
  models: Array<MusicAudioModel>;
  permissions: MusicPermissions;
}

export type MusicAudioModelKey = "mock" | "stable-audio-3" | "elevenlabs-music-v2" | "minimax-music-3" | "lyria-3-pro" | "lyria-3-clip";

export interface MusicAudioRoute {
  key: string;
  provider: string;
  providerDisplayName: string;
  configured: boolean;
  unitCostUsd: CreditAmount;
  billingUnit: "generation" | "minute";
}

export interface MusicAudioModel {
  key: MusicAudioModelKey;
  label: string;
  configured: boolean;
  default: boolean;
  preview: boolean;
  capabilities: Record<string, unknown>;
  routes: Array<MusicAudioRoute>;
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
  modelKey?: MusicAudioModelKey;
  targetTrackId?: number | null;
  referenceAssetId?: string | null;
  variantCount?: 1 | 2;
  brief: MusicBrief;
}

export interface MusicGenerationAccepted {
  jobId: string;
  modelKey: MusicAudioModelKey;
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
  modelKey: MusicAudioModelKey;
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

export interface SoundEffectPermissions {
  currentUserRole: string | null;
  canView: boolean;
  canEdit: boolean;
  canRunGeneration: boolean;
}

export interface SoundEffectDurationCapabilities {
  autoSupported: boolean;
  minSeconds: number;
  maxSeconds: number;
}

export interface SoundEffectPromptInfluenceCapabilities {
  min: number;
  max: number;
  default: number;
}

export interface SoundEffectModel {
  key: "elevenlabs-sound-effects-v2";
  label: string;
  configured: boolean;
  default: boolean;
  providerDisplayName: string;
  duration: SoundEffectDurationCapabilities;
  supportsLoop: boolean;
  promptInfluence: SoundEffectPromptInfluenceCapabilities;
  outputFormats: Array<"mp3">;
}

export interface SoundEffectCapabilities {
  defaultModelKey: "elevenlabs-sound-effects-v2";
  models: Array<SoundEffectModel>;
  permissions: SoundEffectPermissions;
}

export interface SoundEffectAsset {
  assetId: string;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  mimeType: string;
  durationSeconds: number;
}

export interface SoundEffectVersion {
  id: string;
  effectId: number;
  versionNumber: number;
  asset: SoundEffectAsset;
  request: Record<string, unknown>;
  createdAt: string;
}

export interface SoundEffectItem {
  id: number;
  title: string;
  version: number;
  activeVersion: SoundEffectVersion | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoundEffectPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface SoundEffectPage {
  items: Array<SoundEffectItem>;
  page: SoundEffectPagination;
  permissions: SoundEffectPermissions;
}

export interface SoundEffectGenerationCreateRequest {
  modelKey?: "elevenlabs-sound-effects-v2";
  prompt: string;
  durationSeconds?: number | null;
  loop?: boolean;
  promptInfluence?: number;
  targetEffectId?: number | null;
  sceneId?: number | null;
}

export interface SoundEffectGenerationAccepted {
  jobId: string;
  modelKey: "elevenlabs-sound-effects-v2";
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  stage: "queued" | "generating" | "storing" | "finalized" | "failed" | "cancelled";
  idempotentReplay: boolean;
  pollAfterMs: number;
  createdAt: string;
}

export interface SoundEffectGenerationError {
  code: string;
  detail: string;
  retryable: boolean;
}

export interface SoundEffectVariant {
  variantId: string;
  assetId: string;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  mimeType: string;
  durationSeconds: number;
  appliedEffectVersionId: string | null;
}

export type SoundEffectGenerationJob = SoundEffectGenerationCreateRequest & { jobId: string; modelKey: "elevenlabs-sound-effects-v2"; targetEffectId: number | null; sceneId: number | null; status: "queued" | "processing" | "completed" | "failed" | "cancelled"; stage: "queued" | "generating" | "storing" | "finalized" | "failed" | "cancelled"; retryOf: string | null; attempts: number; canCancel: boolean; canRetry: boolean; error: SoundEffectGenerationError; variants: Array<SoundEffectVariant>; createdAt: string; completedAt: string | null; permissions: SoundEffectPermissions; };

export interface SoundEffectJobPage {
  items: Array<SoundEffectGenerationJob>;
  permissions: SoundEffectPermissions;
}

export interface SoundEffectApplyRequest {
  targetEffectId?: number | null;
  title: string;
}

export interface SoundEffectAssignment {
  id: number;
  sceneId: number;
  effectId: number;
  effectVersionId: string;
  startTimeSeconds: number;
}

export interface SoundEffectAssignments {
  items: Array<SoundEffectAssignment>;
  permissions: SoundEffectPermissions;
}

export interface SoundEffectErrorResponse {
  code: string;
  detail: string;
  retryable: boolean;
  errors?: Record<string, unknown>;
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
  routingMode?: GenerationRoutingMode;
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
  billing?: GenerationBilling | null;
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
