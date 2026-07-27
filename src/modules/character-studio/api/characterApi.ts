import api from '../../../api/http';
import {
  CreateCharacterFromReferencePayload,
  EditRequest,
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

const generationRequestConfig = () => ({
  headers: { 'Idempotency-Key': globalThis.crypto.randomUUID() },
});

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
    return api.post(`${base(projectId)}/from-reference`, form, generationRequestConfig());
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
  generateInitial(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return api.post(
      `${base(projectId, characterId)}/generate-initial-variants`,
      data,
      generationRequestConfig(),
    );
  },
  generateEdit(projectId: string | number, characterId: string, data: EditRequest) {
    return api.post(
      `${base(projectId, characterId)}/generate-edit-variants`,
      data,
      generationRequestConfig(),
    );
  },
  zoneEdit(projectId: string | number, characterId: string, data: ZoneEditRequest) {
    return api.post(`${base(projectId, characterId)}/zone-edit`, data, generationRequestConfig());
  },
  getJob(jobId: string) {
    return api.get(`api/generation-jobs/${jobId}`);
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
      generationRequestConfig(),
    );
  },
  applyVariant(
    projectId: string | number,
    characterId: string,
    variantId: string,
    notes: string,
    imageType?: string,
  ) {
    return api.post(`${base(projectId, characterId)}/apply-variant`, {
      variant_id: variantId,
      apply_as: 'current_reference',
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
    payload: { reference_type: ReferenceType; correction_prompt?: string; preserve_identity?: boolean },
  ) {
    return api.post(
      `${base(projectId, characterId)}/references/generate`,
      payload,
      generationRequestConfig(),
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
      generationRequestConfig(),
    );
  },
  correctReference(
    projectId: string | number,
    characterId: string,
    referenceId: string,
    payload: { correction_prompt: string; preserve_identity?: boolean },
  ) {
    return api.post(
      `${base(projectId, characterId)}/references/${referenceId}/correct`,
      payload,
      generationRequestConfig(),
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
      generationRequestConfig(),
    );
  },
};
