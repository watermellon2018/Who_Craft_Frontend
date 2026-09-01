import type {GenerationBilling} from '../../api/generated/contracts';

export type SoundEffectJobStatus =
  | 'queued'
  | 'processing'
  | 'cancellation_requested'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SoundEffectPermissions {
  canEdit: boolean;
  canRunGeneration: boolean;
  canView?: boolean;
}

export interface SoundEffectModelCapabilities {
  duration?: {
    autoSupported?: boolean;
    defaultSeconds?: number | null;
    maxSeconds?: number;
    minSeconds?: number;
  };
  promptInfluence?: {
    default?: number;
    max?: number;
    min?: number;
  };
  supportsLoop?: boolean;
}

export interface SoundEffectModel {
  capabilities?: SoundEffectModelCapabilities;
  configured: boolean;
  default: boolean;
  duration?: SoundEffectModelCapabilities['duration'];
  key: string;
  label: string;
  outputFormats?: string[];
  preview?: boolean;
  promptInfluence?: SoundEffectModelCapabilities['promptInfluence'];
  providerDisplayName?: string;
  routes?: Array<{
    configured: boolean;
    key: string;
    provider: string;
    providerDisplayName: string;
    unitCostUsd: number | string | null;
  }>;
  supportsLoop?: boolean;
}

export interface SoundEffectCapabilities extends SoundEffectModelCapabilities {
  defaultModelKey?: string;
  models?: SoundEffectModel[];
  permissions: SoundEffectPermissions;
  prompt?: {maxChars?: number};
}

export interface SoundEffectCreateRequest {
  durationSeconds: number | null;
  loop: boolean;
  modelKey: string;
  prompt: string;
  promptInfluence: number;
  sceneId?: number | null;
  targetEffectId?: number | null;
}

export interface SoundEffectAccepted {
  createdAt?: string;
  idempotentReplay?: boolean;
  jobId: string;
  modelKey: string;
  pollAfterMs?: number;
  stage: string;
  status: SoundEffectJobStatus;
}

export interface SoundEffectVariant {
  appliedEffectVersionId?: string | null;
  audioUrl: string | null;
  audioUrlExpiresAt?: string | null;
  durationSeconds: number | null;
  index?: number;
  mimeType?: string | null;
  status?: 'generated' | 'failed';
  variantId: string;
}

export interface SoundEffectJob {
  billing?: GenerationBilling | null;
  canCancel: boolean;
  canRetry: boolean;
  durationSeconds: number | null;
  error?: {code: string; detail: string; retryable?: boolean} | null;
  jobId: string;
  loop: boolean;
  modelKey: string;
  permissions: SoundEffectPermissions;
  pollAfterMs?: number;
  prompt: string;
  promptInfluence: number;
  sceneId?: number | null;
  stage: string;
  status: SoundEffectJobStatus;
  targetEffectId?: number | null;
  variants: SoundEffectVariant[];
}

export interface SoundEffectVersion {
  asset: {
    assetId: string;
    audioUrl: string | null;
    audioUrlExpiresAt?: string | null;
    durationSeconds: number | null;
    mimeType?: string | null;
  };
  createdAt?: string | null;
  id: string;
  request?: Partial<SoundEffectCreateRequest>;
  versionNumber: number;
}

export interface SoundEffectItem {
  activeVersion: SoundEffectVersion | null;
  archivedAt?: string | null;
  createdAt?: string | null;
  id: number;
  title: string;
  updatedAt: string;
  version?: number;
}

export interface SoundEffectPage {
  items: SoundEffectItem[];
  page?: {limit: number; offset: number; total: number};
  permissions: SoundEffectPermissions;
}

export interface SoundEffectJobPage {
  items: SoundEffectJob[];
  page?: {limit: number; offset: number; total: number};
}

export interface SoundEffectApplyResponse {
  effectId?: number;
  idempotentReplay?: boolean;
}

export function isSoundEffectJobTerminal(status: SoundEffectJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
