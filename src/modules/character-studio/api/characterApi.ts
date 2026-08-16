import api from '../../../api/http';
import type {
  CharacterSecondaryAssetsGenerateResponse,
  CharacterSecondaryAssetsQuote,
  CharacterSecondaryAssetsQuoteRequest,
} from '../../../api/generated/contracts';
import {notifyCreditBalanceUpdated} from '../../credits/api/creditApi';
import type {
  CreateCharacterFromReferencePayload,
  EditRequest,
  GenerationJob,
  ImageModelCatalog,
  Model3DReconstruction,
  Model3DState,
  ReferenceType,
  ZoneEditRequest,
} from '../types/character.types';

// All requests use the shared axios instance which attaches the X-User-Token
// header. Do NOT add ``token_user`` to params/body anywhere in this file —
// it would leak to logs and bypasses our central auth handling.

const base = (projectId: string | number, characterId = '') =>
  characterId
    ? `api/projects/${projectId}/characters/${characterId}`
    : `api/projects/${projectId}/characters`;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function hashIntent(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function generationIdempotencyKey(scope: string, payload: unknown): string {
  const safeScope = scope.replace(/[^A-Za-z0-9._:-]/g, '-');
  return `character:${safeScope}:${hashIntent(stableSerialize(payload))}`.slice(0, 128);
}

const generationRequestConfig = (
  scope: string,
  payload: unknown,
  idempotencyKey?: string,
) => ({
  headers: {
    'Idempotency-Key': idempotencyKey || generationIdempotencyKey(scope, payload),
  },
});

export interface CharacterGenerationPreview {
  provider: string;
  mode: 'offline' | 'paid';
  image_types: string[];
  provider_call_count: number;
  estimated_cost_usd: string | null;
  reservation_amount: string;
  currency: 'USD';
  pricing_source: string;
  available_balance: string;
  sufficient_balance: boolean;
  budgets: {
    user: {used: number; limit: number};
    project: {used: number; limit: number};
  };
  concurrency: {
    global: {active: number; limit: number};
    project: {active: number; limit: number};
  };
}

const upload = (url: string, file: File, extra?: Record<string, string>) => {
  const form = new FormData();
  form.append('file', file);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
  }
  return api.post(url, form);
};

export const characterApi = {
  list(projectId: string | number, params: Record<string, unknown> = {}) {
    return api.get(base(projectId), { params });
  },
  create(projectId: string | number, data: Record<string, unknown>) {
    return api.post(base(projectId), data);
  },
  createFromReference(
    projectId: string | number,
    payload: CreateCharacterFromReferencePayload,
  ) {
    const form = new FormData();
    form.append('reference_image', payload.referenceImage);
    form.append('name', payload.name);
    form.append('character_type', payload.entityType);
    if (payload.role) form.append('role', payload.role);
    if (payload.lifecycleStage) form.append('lifecycle_stage', payload.lifecycleStage);
    if (payload.gender) form.append('gender', payload.gender);
    if (payload.visualStyle) form.append('visual_style', payload.visualStyle);
    if (payload.refinement) form.append('refinement', payload.refinement);
    if (payload.variantsCount !== undefined && payload.variantsCount !== null) {
      form.append('variants_count', String(payload.variantsCount));
    }
    if (payload.preserveIdentity !== undefined) {
      form.append('preserve_identity', String(payload.preserveIdentity));
    }
    if (payload.imageModel !== undefined) {
      form.append('image_model', payload.imageModel);
    }
    const fileIntent = {
      ...payload,
      referenceImage: {
        name: payload.referenceImage.name,
        size: payload.referenceImage.size,
        type: payload.referenceImage.type,
        lastModified: payload.referenceImage.lastModified,
      },
    };
    return api.post(
      `${base(projectId)}/from-reference`,
      form,
      generationRequestConfig(`${projectId}:from-reference`, fileIntent),
    ).then((response) => {
      notifyCreditBalanceUpdated();
      return response;
    });
  },
  get(projectId: string | number, characterId: string) {
    return api.get(base(projectId, characterId));
  },
  update(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return api.patch(base(projectId, characterId), data);
  },
  delete(projectId: string | number, characterId: string) {
    return api.delete(base(projectId, characterId));
  },
  getGenerationPreview(
    projectId: string | number,
    characterId: string,
    imageTypes: string[],
    imageModel?: string,
  ) {
    return api.get<CharacterGenerationPreview>(
      `${base(projectId, characterId)}/generation-preview`,
      {
        params: {
          image_types: imageTypes.join(','),
          ...(imageModel ? {image_model: imageModel} : {}),
        },
      },
    );
  },
  getImageModelCatalog(projectId?: string | number) {
    return api.get<ImageModelCatalog>('api/profile/me/image-model/', {
      params: projectId === undefined || projectId === '' ? {} : {project_id: projectId},
    });
  },
  generateInitial(
    projectId: string | number,
    characterId: string,
    data: Record<string, unknown>,
    idempotencyKey?: string,
  ) {
    return api.post(
      `${base(projectId, characterId)}/generate-initial-variants`,
      data,
      generationRequestConfig(`${projectId}:${characterId}:initial`, data, idempotencyKey),
    ).then((response) => {
      notifyCreditBalanceUpdated();
      return response;
    });
  },
  generateEdit(
    projectId: string | number,
    characterId: string,
    data: EditRequest,
    idempotencyKey?: string,
  ) {
    return api.post(
      `${base(projectId, characterId)}/generate-edit-variants`,
      data,
      generationRequestConfig(`${projectId}:${characterId}:edit`, data, idempotencyKey),
    ).then((response) => {
      notifyCreditBalanceUpdated();
      return response;
    });
  },
  quoteSecondaryAssets(
    projectId: string | number,
    characterId: string,
    payload: CharacterSecondaryAssetsQuoteRequest,
  ) {
    return api.post<CharacterSecondaryAssetsQuote>(
      `${base(projectId, characterId)}/secondary-assets/quote`,
      payload,
    );
  },
  generateSecondaryAssets(
    projectId: string | number,
    characterId: string,
    quoteToken: string,
    idempotencyKey?: string,
  ) {
    const payload = {quote_token: quoteToken};
    return api.post<CharacterSecondaryAssetsGenerateResponse>(
      `${base(projectId, characterId)}/secondary-assets/generate`,
      payload,
      generationRequestConfig(
        `${projectId}:${characterId}:secondary-assets`,
        payload,
        idempotencyKey,
      ),
    ).then((response) => {
      notifyCreditBalanceUpdated();
      return response;
    });
  },
  zoneEdit(projectId: string | number, characterId: string, data: ZoneEditRequest, idempotencyKey?: string) {
    return api.post(
      `${base(projectId, characterId)}/zone-edit`,
      data,
      generationRequestConfig(`${projectId}:${characterId}:zone-edit`, data, idempotencyKey),
    );
  },
  getJob(jobId: string) {
    return api.get<GenerationJob>(`api/generation-jobs/${jobId}`);
  },
  listGenerationJobs(projectId: string | number, characterId: string) {
    return api.get<{jobs: GenerationJob[]}>(`${base(projectId, characterId)}/generation-jobs`);
  },
  retryGenerationJob(jobId: string) {
    return api.post<{job?: GenerationJob; job_id: string; status: GenerationJob['status']}>(
      `api/generation-jobs/${jobId}/retry`,
    );
  },
  requestGenerationJobCancellation(jobId: string) {
    return api.post<GenerationJob | {job?: GenerationJob; job_id: string; status: GenerationJob['status']}>(
      `api/generation-jobs/${jobId}/cancellation-request`,
    );
  },
  getModel3D(projectId: string | number, characterId: string) {
    return api.get<Model3DState>(`${base(projectId, characterId)}/model3d`);
  },
  saveModel3D(projectId: string | number, characterId: string, params: Record<string, unknown>) {
    return api.put(`${base(projectId, characterId)}/model3d`, { params });
  },
  autofitModel3D(projectId: string | number, characterId: string) {
    return api.post(`${base(projectId, characterId)}/model3d/autofit`);
  },
  retryModel3DReconstruction(projectId: string | number, characterId: string) {
    return api.post<{reconstruction: Model3DReconstruction}>(
      `${base(projectId, characterId)}/model3d/reconstruction`,
      undefined,
      generationRequestConfig(`${projectId}:${characterId}:model3d-reconstruction`, null),
    );
  },
  applyVariant(
    projectId: string | number,
    characterId: string,
    variantId: string,
    notes: string,
    imageType?: string,
    applyAs: 'current_reference' | 'canonical_reference' | null = 'current_reference',
  ) {
    return api.post(`${base(projectId, characterId)}/apply-variant`, {
      variant_id: variantId,
      apply_as: applyAs,
      image_type: imageType,
      notes,
    });
  },
  lockIdentity(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return api.post(`${base(projectId, characterId)}/lock-identity`, { ...data, confirm: true });
  },
  listOutfits(projectId: string | number, characterId: string) {
    return api.get(`${base(projectId, characterId)}/outfits`);
  },
  createOutfit(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return api.post(`${base(projectId, characterId)}/outfits`, data);
  },
  updateOutfit(projectId: string | number, characterId: string, outfitId: string, data: Record<string, unknown>) {
    return api.patch(`${base(projectId, characterId)}/outfits/${outfitId}`, data);
  },
  deleteOutfit(projectId: string | number, characterId: string, outfitId: string) {
    return api.delete(`${base(projectId, characterId)}/outfits/${outfitId}`);
  },
  setDefaultOutfit(projectId: string | number, characterId: string, outfitId: string) {
    return api.post(`${base(projectId, characterId)}/outfits/${outfitId}/set-default`);
  },
  uploadOutfitReference(projectId: string | number, characterId: string, outfitId: string, file: File) {
    return upload(`${base(projectId, characterId)}/outfits/${outfitId}/upload-reference`, file);
  },
  deleteOutfitReference(projectId: string | number, characterId: string, outfitId: string) {
    return api.delete(`${base(projectId, characterId)}/outfits/${outfitId}/delete-reference`);
  },
  uploadClothingReference(projectId: string | number, characterId: string, file: File) {
    return upload(`${base(projectId, characterId)}/clothing-references`, file);
  },
  deleteClothingReference(projectId: string | number, characterId: string, assetId: string) {
    return api.delete(`${base(projectId, characterId)}/clothing-references/${assetId}`);
  },
  listRevisions(projectId: string | number, characterId: string) {
    return api.get(`${base(projectId, characterId)}/revisions`);
  },
  restoreRevision(projectId: string | number, characterId: string, revisionId: string) {
    return api.post(`${base(projectId, characterId)}/revisions/${revisionId}/restore`);
  },
  // --- References stage -----------------------------------------------------
  getReferences(projectId: string | number, characterId: string) {
    return api.get(`${base(projectId, characterId)}/references`);
  },
  generateReference(
    projectId: string | number,
    characterId: string,
    payload: {
      reference_type: ReferenceType;
      correction_prompt?: string;
      preserve_identity?: boolean;
      image_model?: string;
      routing_mode?: import('../../../api/generated/contracts').GenerationRoutingMode;
    },
  ) {
    return api.post(
      `${base(projectId, characterId)}/references/generate`,
      payload,
      generationRequestConfig(`${projectId}:${characterId}:reference`, payload),
    );
  },
  generateMissingReferences(
    projectId: string | number,
    characterId: string,
    payload: { reference_types: ReferenceType[]; only_missing?: boolean; preserve_identity?: boolean },
  ) {
    return api.post(
      `${base(projectId, characterId)}/references/generate-missing`,
      payload,
      generationRequestConfig(`${projectId}:${characterId}:references-missing`, payload),
    );
  },
  correctReference(
    projectId: string | number,
    characterId: string,
    referenceId: string,
    payload: {
      correction_prompt: string;
      preserve_identity?: boolean;
      image_model?: string;
      routing_mode?: import('../../../api/generated/contracts').GenerationRoutingMode;
    },
  ) {
    return api.post(
      `${base(projectId, characterId)}/references/${referenceId}/correct`,
      payload,
      generationRequestConfig(
        `${projectId}:${characterId}:reference:${referenceId}:correct`,
        payload,
      ),
    );
  },
  uploadReference(
    projectId: string | number,
    characterId: string,
    referenceType: ReferenceType,
    file: File,
    replaceCurrent = true,
  ) {
    return upload(`${base(projectId, characterId)}/references/upload`, file, {
      reference_type: referenceType,
      replace_current: replaceCurrent ? 'true' : 'false',
    });
  },
  makePrimaryReference(projectId: string | number, characterId: string, referenceId: string) {
    return api.post(`${base(projectId, characterId)}/references/${referenceId}/make-primary`);
  },
  getReferencesReadiness(projectId: string | number, characterId: string) {
    return api.get(`${base(projectId, characterId)}/references/readiness`);
  },
  updateReferencesChecklist(
    projectId: string | number,
    characterId: string,
    payload: Partial<{
      appearance_stable: boolean;
      face_matches_base: boolean;
      outfit_readable: boolean;
      suitable_for_3d: boolean;
    }>,
  ) {
    return api.patch(`${base(projectId, characterId)}/references/checklist`, payload);
  },
  proceedReferencesTo3D(projectId: string | number, characterId: string) {
    return api.post(
      `${base(projectId, characterId)}/references/proceed-to-3d`,
      undefined,
      generationRequestConfig(`${projectId}:${characterId}:proceed-to-3d`, null),
    );
  },
};
