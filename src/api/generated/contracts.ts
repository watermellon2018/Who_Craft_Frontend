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

export interface CharacterTreeNode {
  id: string;
  key: string;
  name: string;
  is_folder: boolean;
  character_id?: string | null;
  legacy_hero_id?: number | null;
  children?: Array<CharacterTreeNode>;
}

export interface CharacterTreeCreateRequest {
  id: string;
  name: string;
  type: "leaf" | "node";
  projectId: number | string;
  parent?: string | null;
  heroID?: number | null;
  studioCharacterId?: string | null;
}

export interface CharacterTreeRenameRequest {
  id: string;
  name: string;
}

export interface CharacterTreeRenameResponse {
  id: string;
  name: string;
  character_id?: string | null;
}

export interface CharacterTreeDeleteRequest {
  id: string;
}

export interface DeleteResponse {
  message: string;
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
  format?: string;
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
  format?: string;
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
