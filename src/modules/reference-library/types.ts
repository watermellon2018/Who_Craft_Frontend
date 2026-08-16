import type {GenerationBilling, GenerationRoutingMode} from '../../api/generated/contracts';

export type ReferenceCategory = 'location' | 'prop' | 'wardrobe' | 'vehicle' | 'symbol' | 'other';

export type ReferenceStatus = 'draft' | 'generating' | 'ready' | 'failed' | 'archived';

export type ReferenceJobStatus =
  | 'queued'
  | 'processing'
  | 'cancellation_requested'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ReferenceJobStage =
  | 'queued'
  | 'compiling'
  | 'generating'
  | 'validating'
  | 'storing'
  | 'finalized'
  | 'failed'
  | 'cancelled';

export interface ReferencePermissions {
  canEdit: boolean;
  canRunGeneration: boolean;
  canView: boolean;
}

export interface ReferenceCategoryOption {
  key: ReferenceCategory;
  label: string;
}

export interface ReferenceCapabilities {
  categories: ReferenceCategoryOption[];
  generation: {
    aspectRatios: string[];
    canEdit: boolean;
    canGenerate: boolean;
    configured: boolean;
    editVariantCounts: number[];
    effectiveModel: string | null;
    generateVariantCounts: number[];
    providerMode: string;
  };
  permissions: ReferencePermissions;
  upload: {
    maxBytes: number;
    maxPixels: number;
    mimeTypes: string[];
    rightsStatementVersion: string;
  };
}

export interface ReferenceBrief {
  schemaVersion: 'reference_brief.v1';
  aspectRatio?: string;
  palette?: string[];
  condition?: string;
  continuityNotes?: string;
  description?: string;
  distinctiveFeatures?: string[];
  materials?: string[];
  negativePrompt?: string;
  dimensions?: string;
}

export interface ReferenceCharacterLink {
  characterId: string;
  name?: string;
  note?: string;
  relation: 'owns' | 'wears' | 'carries' | 'uses' | 'important' | 'associated';
}

export interface ReferenceVersionSummary {
  createdAt?: string;
  height?: number | null;
  id: string;
  imageUrl?: string | null;
  number: number;
  origin?: 'upload' | 'generated' | 'edit';
  thumbnailUrl?: string | null;
  width?: number | null;
}

export interface ReferenceUsageSummary {
  characters: ReferenceCharacterLink[];
  sceneCount: number;
}

export interface ReferenceListItem {
  activeVersion: ReferenceVersionSummary | null;
  category: ReferenceCategory;
  categoryLabel: string;
  id: string;
  lastJobWarning?: ReferenceJobError | null;
  status: ReferenceStatus;
  tags: string[];
  title: string;
  updatedAt: string;
  usage: ReferenceUsageSummary;
  version: number;
}

export interface ReferenceDetail extends ReferenceListItem {
  brief: ReferenceBrief;
  characterLinks: ReferenceCharacterLink[];
  description: string;
  locationId: number | null;
}

export interface ReferenceListResponse {
  items: ReferenceListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ReferenceLinkOptions {
  characters: Array<{id: string; name: string}>;
  locations: Array<{id: number; name: string}>;
}

export interface ReferenceListParams {
  category?: ReferenceCategory;
  ordering?: '-updatedAt' | 'title' | 'updatedAt';
  page: number;
  pageSize: number;
  search?: string;
  status?: ReferenceStatus;
}

export interface ReferenceCreateRequest {
  brief: ReferenceBrief;
  category: ReferenceCategory;
  characterLinks?: ReferenceCharacterLink[];
  description: string;
  locationId?: number | null;
  tags: string[];
  title: string;
}

export interface ReferenceCreateResponse {
  activeVersion: ReferenceVersionSummary | null;
  id: string;
  status: ReferenceStatus;
  version: number;
}

export interface ReferenceUpdateRequest extends Partial<ReferenceCreateRequest> {
  version: number;
}

export interface ReferenceVersion extends ReferenceVersionSummary {
  createdById?: number | null;
  modelName?: string | null;
  provider?: string | null;
}

export interface ReferenceVersionsResponse {
  items: ReferenceVersion[];
}

export interface ReferenceVariant {
  height: number;
  id: string;
  imageUrl: string | null;
  index: number;
  status: 'generated' | 'applied' | 'discarded' | 'failed';
  thumbnailUrl: string | null;
  width: number;
}

export interface ReferenceJobError {
  code: string;
  detail: string;
  retryable?: boolean;
}

export interface ReferenceGenerationJob {
  billing?: GenerationBilling | null;
  attempts: number;
  canCancel: boolean;
  canRetry: boolean;
  completedAt: string | null;
  createdAt: string;
  error: ReferenceJobError | null;
  id: string;
  operation: 'generate' | 'edit';
  progress: number;
  referenceId: string;
  retryOf?: string | null;
  stage: ReferenceJobStage;
  status: ReferenceJobStatus;
  variantCount: number;
  variants: ReferenceVariant[];
}

export interface ReferenceEnqueueRequest {
  brief: ReferenceBrief;
  editInstruction?: string;
  expectedReferenceVersion: number;
  imageModel: string;
  routingMode?: GenerationRoutingMode;
  operation: 'generate' | 'edit';
  sourceVersionId: string | null;
  variantCount: number;
}

export interface ReferenceUploadResponse {
  activeVersion: ReferenceVersionSummary;
  referenceId: string;
  referenceVersion: number;
}

export type ReferenceApplyResponse = ReferenceUploadResponse;

export function isReferenceJobTerminal(status: ReferenceJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
