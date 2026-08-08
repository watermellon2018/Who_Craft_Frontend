import {getApiErrorCode, getApiStatus} from '../../api/errors';
import i18n from '../../i18n';

const KNOWN_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'PROJECT_ACCESS_DENIED',
  'REFERENCE_EDIT_FORBIDDEN',
  'REFERENCE_GENERATION_FORBIDDEN',
  'REFERENCE_NOT_FOUND',
  'REFERENCE_VERSION_NOT_FOUND',
  'REFERENCE_JOB_NOT_FOUND',
  'REFERENCE_VARIANT_NOT_FOUND',
  'REFERENCE_CROSS_PROJECT_LINK',
  'REFERENCE_INVALID_CATEGORY',
  'REFERENCE_INVALID_BRIEF',
  'REFERENCE_LOCATION_CATEGORY_REQUIRED',
  'REFERENCE_UPLOAD_RIGHTS_REQUIRED',
  'MEDIA_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INVALID_IMAGE',
  'REFERENCE_VERSION_CONFLICT',
  'REFERENCE_IDEMPOTENCY_MISMATCH',
  'REFERENCE_GENERATION_CONFLICT',
  'REFERENCE_PROVIDER_NOT_CONFIGURED',
  'REFERENCE_PROVIDER_RATE_LIMITED',
  'REFERENCE_PROVIDER_TIMEOUT',
  'REFERENCE_PROVIDER_REJECTED',
  'REFERENCE_OUTPUT_INVALID',
  'REFERENCE_CANNOT_CANCEL',
]);

const ERROR_CODE_ALIASES: Record<string, string> = {
  IMAGE_MODEL_UNKNOWN: 'REFERENCE_PROVIDER_NOT_CONFIGURED',
  IMAGE_PROVIDER_BAD_RESPONSE: 'REFERENCE_OUTPUT_INVALID',
  IMAGE_PROVIDER_BLOCKED: 'REFERENCE_PROVIDER_REJECTED',
  IMAGE_PROVIDER_EDIT_NOT_SUPPORTED: 'REFERENCE_PROVIDER_REJECTED',
  IMAGE_PROVIDER_ERROR: 'REFERENCE_PROVIDER_RATE_LIMITED',
  IMAGE_PROVIDER_FORBIDDEN: 'REFERENCE_PROVIDER_REJECTED',
  IMAGE_PROVIDER_NOT_CONFIGURED: 'REFERENCE_PROVIDER_NOT_CONFIGURED',
  IMAGE_PROVIDER_OUTCOME_UNKNOWN: 'REFERENCE_PROVIDER_TIMEOUT',
  IMAGE_PROVIDER_UNAVAILABLE: 'REFERENCE_PROVIDER_RATE_LIMITED',
  MODEL_DOES_NOT_SUPPORT_IMAGE_INPUT: 'REFERENCE_PROVIDER_REJECTED',
};

export interface ReferenceErrorDescriptor {
  code: string | null;
  message: string;
  status: number | null;
}

export function referenceErrorDescriptor(error: unknown): ReferenceErrorDescriptor {
  const code = getApiErrorCode(error);
  const status = getApiStatus(error);
  const translationCode = code ? ERROR_CODE_ALIASES[code] ?? code : null;
  const key = translationCode && KNOWN_ERROR_CODES.has(translationCode)
    ? `referenceLibrary.errors.codes.${translationCode}`
    : 'referenceLibrary.errors.generic';
  return {code, message: i18n.t(key) as string, status};
}

export function referenceJobErrorMessage(code?: string | null): string {
  const translationCode = code ? ERROR_CODE_ALIASES[code] ?? code : null;
  if (translationCode && KNOWN_ERROR_CODES.has(translationCode)) {
    return i18n.t(`referenceLibrary.errors.codes.${translationCode}`) as string;
  }
  return i18n.t('referenceLibrary.errors.generic') as string;
}
