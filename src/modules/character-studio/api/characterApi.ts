import axios from 'axios';
import {EditRequest} from '../types/character.types';

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
  listRevisions(projectId: string | number, characterId: string) {
    return axios.get(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/revisions`, {params: tokenParams()});
  },
  restoreRevision(projectId: string | number, characterId: string, revisionId: string) {
    return axios.post(`${backendUrl}/api/projects/${projectId}/characters/${characterId}/revisions/${revisionId}/restore`, tokenBody());
  },
};
