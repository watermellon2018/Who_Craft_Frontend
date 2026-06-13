export type CharacterRegion = 'face' | 'hair' | 'body' | 'outfit' | 'style' | 'full_character';

export interface ClothingReference {
  asset_id: string;
  image_url: string;
  created_at?: string;
}
export type CharacterRevisionRegion = CharacterRegion | '';
export type PreviewType = 'portrait' | 'full_body' | 'face_closeup' | 'character_sheet' | 'front_view' | 'side_view' | 'expression_sheet';
export type CharacterViewMode = 'portrait' | 'fullBody' | 'scene';
export type CharacterImageType = 'portrait' | 'full_body' | 'scene';
export type CharacterType = 'human' | 'animal' | 'creature' | 'robot' | 'object' | 'other';

export interface CharacterAppearance {
  appearance_id?: string;
  character?: string;
  face_shape?: string;
  skin_tone?: string;
  eye_shape?: string;
  eye_color?: string;
  eyebrow_shape?: string;
  nose_shape?: string;
  lips_shape?: string;
  jawline?: string;
  hair_length?: string;
  hair_style?: string;
  hair_color?: string;
  hair_details?: Record<string, unknown>;
  height?: string;
  height_cm?: number | null;
  body_type?: string;
  body_structure?: string;
  surface_material?: string;
  special_features?: string;
  posture?: string;
  distinctive_features?: string[];
  appearance_prompt?: string;
  negative_prompt?: string;
  source_type?: string;
  source_description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CharacterOutfit {
  outfit_id: string;
  character?: string;
  name: string;
  description?: string;
  style?: string;
  color_palette?: string[];
  layers?: Record<string, unknown>;
  is_default?: boolean;
  reference_image?: string | null;
  reference_image_url?: string | null;
  reference_image_asset_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CharacterAsset {
  asset_id: string;
  character?: string;
  project?: number;
  user?: number;
  image_url: string;
  asset_type: string;
  storage_path?: string;
  width?: number | null;
  height?: number | null;
  mime_type?: string;
  is_primary?: boolean;
  is_canonical?: boolean;
  source?: string;
  source_job_id?: string | null;
  source_variant_id?: string | null;
  generation_prompt?: string;
  negative_prompt?: string;
  model_name?: string;
  model_version?: string;
  seed?: number | null;
  metadata?: Record<string, unknown>;
  safety_status?: string;
  created_at?: string;
}

export interface CharacterImage {
  image_id: string;
  character_id?: string;
  asset_id?: string | null;
  image_type: CharacterImageType;
  image_url: string;
  storage_path?: string;
  prompt?: string;
  seed?: number | null;
  generation_params?: Record<string, unknown>;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CharacterVariant {
  variant_id: string;
  job_id?: string;
  character_id?: string;
  asset_id?: string | null;
  image_url: string;
  variant_index: number;
  region: CharacterRegion;
  status: 'generated' | 'applied' | 'discarded';
  applied?: boolean;
  controls_snapshot?: Record<string, unknown>;
  appearance_snapshot?: Record<string, unknown>;
  prompt?: string;
  negative_prompt?: string;
  seed?: number | null;
  model_name?: string;
  created_at?: string;
  applied_at?: string | null;
}

export interface CharacterRevision {
  revision_id: string;
  character_id?: string;
  project_id?: number;
  user_id?: number;
  revision_number: number;
  change_type: string;
  changed_region: CharacterRevisionRegion;
  change_summary?: string;
  text_refinement?: string;
  before_snapshot?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  created_at: string;
  source_variant_id?: string | null;
  source_job_id?: string | null;
  reference_image_id?: string | null;
  appearance?: string | null;
  outfit?: string | null;
  version?: string | null;
}

export interface StudioCharacter {
  character_id: string;
  project_id: number;
  user_id?: number;
  name: string;
  character_type?: CharacterType;
  role?: 'main' | 'secondary' | 'antagonist' | 'episodic' | 'cameo' | '';
  short_description?: string;
  age?: number | null;
  lifecycle_stage?: string;
  gender?: string;
  species?: string;
  visual_style?: string;
  status?: 'draft' | 'active' | 'references_locked';
  identity_locked: boolean;
  locked_at?: string | null;
  locked_by_id?: number | null;
  model3d_params?: Record<string, Record<string, number | string | boolean>>;
  active_appearance_id?: string | null;
  active_outfit_id?: string | null;
  active_version_id?: string | null;
  current_revision_id?: string | null;
  canonical_reference_image_id?: string | null;
  appearance?: CharacterAppearance;
  outfits?: CharacterOutfit[];
  references?: CharacterAsset[];
  images?: Partial<Record<CharacterImageType, CharacterImage>>;
  active_version?: Record<string, unknown> | null;
  current_revision?: CharacterRevision;
  personality?: Record<string, unknown>;
  speech_style?: string;
  backstory?: string;
  clothing_source?: 'reference' | 'text';
  clothing_description?: string;
  clothing_references?: ClothingReference[];
  created_at?: string;
  updated_at?: string;
}

export interface GenerationJob {
  job_id: string;
  character_id?: string;
  project_id?: number;
  user_id?: number;
  job_type?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  region?: CharacterRegion;
  variant_count?: number;
  request_payload?: Record<string, unknown>;
  compiled_prompt?: string;
  negative_prompt?: string;
  edit_instruction?: string;
  preserve_options?: Record<string, unknown>;
  provider?: string;
  model_name?: string;
  model_version?: string;
  progress: number;
  error_code?: string;
  error_message?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  variants: CharacterVariant[];
}

export interface EditRequest {
  region: CharacterRegion;
  image_type?: CharacterImageType;
  controls: Record<string, unknown>;
  changed_fields?: string[];
  previous_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  current_image_url?: string | null;
  current_asset_id?: string | null;
  text_refinement?: string;
  preserve: Record<string, boolean>;
  variant_count: number;
}

export interface ZoneSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoneEditRequest {
  asset_type: CharacterImageType;
  instruction: string;
  selection: ZoneSelection;
  variant_count?: number;
}

export interface ZoneEditResponse {
  job_id: string;
  status: GenerationJob['status'];
  error_code?: string;
  error_message?: string;
  dependent_image_types?: CharacterImageType[];
  secondary_job_ids?: Partial<Record<CharacterImageType, string>>;
}

// --- References stage --------------------------------------------------------
// 9 types in stable display order. `character_sheet` is the UI alias for the
// backend `reference_sheet` asset_type — kept as ASCII for tooling.
export type ReferenceType =
  | 'portrait'
  | 'full_body'
  | 'three_quarter'
  | 'profile'
  | 'back_view'
  | 'emotions'
  | 'poses'
  | 'outfit_details'
  | 'character_sheet';

// Reference types shown as navigable cards in the left sidebar. The
// `outfit_details` and `character_sheet` backend types still exist in
// `ReferenceType` and on the API, but they're hidden from the UI list
// (product decision — they were too niche for the references stage).
export const REFERENCE_TYPE_ORDER: ReferenceType[] = [
  'portrait',
  'full_body',
  'three_quarter',
  'profile',
  'back_view',
  'emotions',
  'poses',
];

export type ReferenceStatus = 'missing' | 'generating' | 'ready' | 'failed';

export type ReferenceSource = 'generated' | 'uploaded' | 'derived' | 'imported' | 'mock' | string;

export interface CharacterReference {
  reference_type: ReferenceType;
  status: ReferenceStatus;
  asset_id: string | null;
  image_url: string | null;
  thumbnail_url?: string | null;
  is_primary: boolean;
  version: number;
  source: ReferenceSource | null;
  generation_job_id?: string | null;
  correction_prompt?: string;
  error_message?: string;
  updated_at?: string | null;
}

export interface ReferencesChecklist {
  appearance_stable: boolean;
  face_matches_base: boolean;
  outfit_readable: boolean;
  full_body_ready: boolean;
  front_side_back_ready: boolean;
  suitable_for_3d: boolean;
}

export interface ReferencesState {
  character: {
    character_id: string;
    name: string;
    identity_locked: boolean;
    status?: string;
  };
  references: CharacterReference[];
  primary_reference_id: string | null;
  checklist: ReferencesChecklist;
  can_proceed_to_3d: boolean;
  proceed_blockers: string[];
}

export interface ReferenceJobResponse {
  job_id: string;
  status: GenerationJob['status'];
  error_code?: string;
  error_message?: string;
  references: ReferencesState;
}

export interface ProceedTo3DResponse {
  can_proceed: boolean;
  next_stage?: string;
  next_url?: string;
  locked_reference_ids?: string[];
  blockers?: string[];
  checklist?: ReferencesChecklist;
}

export interface CreateCharacterFromReferencePayload {
  name: string;
  entityType: string;
  role?: string;
  lifecycleStage?: string;
  gender?: string;
  visualStyle?: string;
  refinement?: string;
  variantsCount?: number;
  preserveIdentity?: boolean;
  referenceImage: File;
}

export interface CreateCharacterFromReferenceResponse {
  character: StudioCharacter;
  reference: CharacterAsset;
  generation_job: GenerationJob;
}
