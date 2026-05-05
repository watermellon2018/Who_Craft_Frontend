import axios from 'axios';
import {EditRequest, ReferenceType, ZoneEditRequest} from '../types/character.types';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const tokenParams = () => ({token_user: localStorage.getItem('userId')});
const tokenBody = () => ({token_user: localStorage.getItem('userId')});

export const characterApi = {
  list(projectId: string | number, params: Record<string, unknown> = {}) {
    return axios.get(`${backendUrl}/api/projects/${projectId}/characters`, {
      params: {...tokenParams(), ...params},
    });
  },
  create(projectId: string | number, data: Record<string, unknown>) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters`, {...data, ...tokenBody()});
  },
  get(projectId: string | number, characterId: string) {
    return axios.get(`${backendUrl}/api/projects/${projectId}/characters/${characterId}`, {
      params: tokenParams(),
    });
  },
  update(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return axios.patch(`${backendUrl}/api/projects/${projectId}/characters/${characterId}`, {...data, ...tokenBody()});
  },
  delete(projectId: string | number, characterId: string) {
    return axios.delete(`${backendUrl}/api/projects/${projectId}/characters/${characterId}`, {data: tokenBody()});
  },
  generateInitial(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/generate-initial-variants`, {...data, ...tokenBody()});
  },
  generateEdit(projectId: string | number, characterId: string, data: EditRequest) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/generate-edit-variants`, {...data, ...tokenBody()});
  },
  zoneEdit(projectId: string | number, characterId: string, data: ZoneEditRequest) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/zone-edit`, {...data, ...tokenBody()});
  },
  getJob(jobId: string) {
    return axios.get(`${backendUrl}/api/generation-jobs/${jobId}`, {params: tokenParams()});
  },
  applyVariant(projectId: string | number, characterId: string, variantId: string, notes: string, imageType?: string) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/apply-variant`, {
      variant_id: variantId,
      apply_as: 'current_reference',
      image_type: imageType,
      notes,
      ...tokenBody(),
    });
  },
  lockIdentity(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/lock-identity`, {...data, confirm: true, ...tokenBody()});
  },
  listOutfits(projectId: string | number, characterId: string) {
    return axios.get(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits`, {params: tokenParams()});
  },
  createOutfit(projectId: string | number, characterId: string, data: Record<string, unknown>) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits`, {...data, ...tokenBody()});
  },
  updateOutfit(projectId: string | number, characterId: string, outfitId: string, data: Record<string, unknown>) {
    return axios.patch(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits/${outfitId}`, {...data, ...tokenBody()});
  },
  deleteOutfit(projectId: string | number, characterId: string, outfitId: string) {
    return axios.delete(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits/${outfitId}`, {data: tokenBody()});
  },
  setDefaultOutfit(projectId: string | number, characterId: string, outfitId: string) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits/${outfitId}/set-default`, tokenBody());
  },
  uploadOutfitReference(projectId: string | number, characterId: string, outfitId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('token_user', localStorage.getItem('userId') || '');
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits/${outfitId}/upload-reference`,
      form,
      {headers: {'Content-Type': 'multipart/form-data'}},
    );
  },
  deleteOutfitReference(projectId: string | number, characterId: string, outfitId: string) {
    return axios.delete(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/outfits/${outfitId}/delete-reference`,
      {data: tokenBody()},
    );
  },
  uploadClothingReference(projectId: string | number, characterId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('token_user', localStorage.getItem('userId') || '');
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/clothing-references`,
      form,
      {headers: {'Content-Type': 'multipart/form-data'}},
    );
  },
  deleteClothingReference(projectId: string | number, characterId: string, assetId: string) {
    return axios.delete(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/clothing-references/${assetId}`,
      {data: tokenBody()},
    );
  },
  listRevisions(projectId: string | number, characterId: string) {
    return axios.get(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/revisions`, {params: tokenParams()});
  },
  restoreRevision(projectId: string | number, characterId: string, revisionId: string) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/revisions/${revisionId}/restore`, tokenBody());
  },
  // --- References stage -----------------------------------------------------
  getReferences(projectId: string | number, characterId: string) {
    return axios.get(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references`,
      {params: tokenParams()},
    );
  },
  generateReference(
    projectId: string | number,
    characterId: string,
    payload: {reference_type: ReferenceType; correction_prompt?: string; preserve_identity?: boolean},
  ) {
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/generate`,
      {...payload, ...tokenBody()},
    );
  },
  generateMissingReferences(
    projectId: string | number,
    characterId: string,
    payload: {reference_types: ReferenceType[]; only_missing?: boolean; preserve_identity?: boolean},
  ) {
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/generate-missing`,
      {...payload, ...tokenBody()},
    );
  },
  correctReference(
    projectId: string | number,
    characterId: string,
    referenceId: string,
    payload: {correction_prompt: string; preserve_identity?: boolean},
  ) {
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/${referenceId}/correct`,
      {...payload, ...tokenBody()},
    );
  },
  uploadReference(
    projectId: string | number,
    characterId: string,
    referenceType: ReferenceType,
    file: File,
    replaceCurrent = true,
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append('reference_type', referenceType);
    form.append('replace_current', replaceCurrent ? 'true' : 'false');
    form.append('token_user', localStorage.getItem('userId') || '');
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/upload`,
      form,
      {headers: {'Content-Type': 'multipart/form-data'}},
    );
  },
  makePrimaryReference(projectId: string | number, characterId: string, referenceId: string) {
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/${referenceId}/make-primary`,
      tokenBody(),
    );
  },
  getReferencesReadiness(projectId: string | number, characterId: string) {
    return axios.get(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/readiness`,
      {params: tokenParams()},
    );
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
    return axios.patch(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/checklist`,
      {...payload, ...tokenBody()},
    );
  },
  proceedReferencesTo3D(projectId: string | number, characterId: string) {
    return axios.post(
      `${backendUrl}/api/projects/${projectId}/characters/${characterId}/references/proceed-to-3d`,
      tokenBody(),
    );
  },
};
