import type {TFunction} from 'i18next';

import {getApiErrorMessage} from '../../api/errors';
import type {VideoBlocker, VideoModelOption} from './types';

const errorKeys: Record<string, string> = {
  CRAFT_SUBSCRIPTION_REQUIRED: 'subscriptionRequired',
  PERSONAL_API_NOT_CONFIGURED: 'personalNotConfigured',
  PERSONAL_API_STORAGE_UNAVAILABLE: 'personalUnavailable',
  VIDEO_FORBIDDEN: 'forbidden',
  VIDEO_GENERATION_ACTIVE: 'generationActive',
  VIDEO_MODEL_REQUIRED: 'modelRequired',
  VIDEO_MODEL_INCOMPATIBLE: 'modelIncompatible',
  VIDEO_MODEL_UNAVAILABLE: 'modelUnavailable',
  VIDEO_PROVIDER_NOT_CONFIGURED: 'providerNotConfigured',
  VIDEO_PRICE_UNAVAILABLE: 'priceUnavailable',
  VIDEO_AUTHENTICATION_FAILED: 'providerAuthentication',
  VIDEO_PROVIDER_FORBIDDEN: 'providerForbidden',
  VIDEO_PROVIDER_BALANCE_REQUIRED: 'providerBalance',
  VIDEO_PROVIDER_RATE_LIMITED: 'providerRateLimit',
  VIDEO_PROVIDER_UNAVAILABLE: 'providerUnavailable',
  VIDEO_PROVIDER_REJECTED: 'providerRejected',
  VIDEO_PROVIDER_GENERATION_FAILED: 'providerFailed',
  VIDEO_PARAMETERS_INCOMPATIBLE: 'modelIncompatible',
  VIDEO_MODEL_PROFILE_ONLY: 'profileOnly',
  VIDEO_PROFILE_ROUTE_REQUIRED: 'profileOnly',
  VIDEO_SCRIPT_REQUIRED: 'scriptRequired',
  VIDEO_STORYBOARD_REQUIRED: 'storyboardRequired',
  VIDEO_SCENE_NOT_READY: 'sceneNotReady',
  VIDEO_START_FRAME_REQUIRED: 'startRequired',
  VIDEO_FRAME_NOT_READY: 'frameNotReady',
  VIDEO_SCRIPT_CHANGED: 'scriptChanged',
  VIDEO_CHARACTER_MISSING: 'characterMissing',
  VIDEO_CHARACTER_NOT_READY: 'characterNotReady',
  VIDEO_REFERENCE_MISSING: 'referenceMissing',
  VIDEO_REFERENCE_NOT_READY: 'referenceNotReady',
  VIDEO_DESCRIPTION_REQUIRED: 'descriptionRequired',
  VIDEO_DURATION_REQUIRED: 'durationRequired',
};

export function videoErrorMessage(error: VideoBlocker, t: TFunction) {
  const key = errorKeys[error.code];
  const fallback = t(key ? `videoWorkspace.errors.${key}` : 'videoWorkspace.generationError');
  // Keep useful project-specific names when the server message matches the locale.
  if (key && !/^(VIDEO_(SCRIPT|STORYBOARD|SCENE|START|FRAME|CHARACTER|REFERENCE|DESCRIPTION|DURATION))/.test(error.code)) return fallback;
  return getApiErrorMessage({code: error.code, detail: error.detail}, fallback);
}

export function videoModelReason(model: VideoModelOption, t: TFunction) {
  if (!model.unavailableReason) return '';
  if (model.unavailableReason === 'Conditions are not supported.') return t('videoWorkspace.errors.modelIncompatible');
  if (model.unavailableReason === 'Provider is not configured.') return t('videoWorkspace.errors.providerNotConfigured');
  return getApiErrorMessage({detail: model.unavailableReason}, t('videoWorkspace.modelUnavailable'));
}
