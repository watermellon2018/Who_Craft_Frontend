import i18n from '../../i18n';
import {getApiErrorCode, getApiStatus} from '../../api/errors';

const KNOWN_ERROR_CODES = new Set([
  'MUSIC_VALIDATION_ERROR',
  'MUSIC_CAPABILITY_UNSUPPORTED',
  'MUSIC_PROJECT_NOT_FOUND',
  'MUSIC_TRACK_NOT_FOUND',
  'MUSIC_SCENE_NOT_FOUND',
  'MUSIC_REFERENCE_NOT_FOUND',
  'MUSIC_REFERENCE_INVALID',
  'MUSIC_REFERENCE_RIGHTS_REQUIRED',
  'MUSIC_REFERENCE_REJECTED',
  'MUSIC_LYRICS_UNSUPPORTED',
  'MUSIC_JOB_NOT_FOUND',
  'MUSIC_VARIANT_NOT_FOUND',
  'MUSIC_PERMISSION_DENIED',
  'MUSIC_IDEMPOTENCY_REQUIRED',
  'MUSIC_IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'MUSIC_GENERATION_CONFLICT',
  'MUSIC_QUOTA_EXCEEDED',
  'MUSIC_PROVIDER_NOT_CONFIGURED',
  'MUSIC_PROVIDER_RATE_LIMITED',
  'MUSIC_PROVIDER_TIMEOUT',
  'MUSIC_PROVIDER_REJECTED',
  'MUSIC_PROVIDER_OUTCOME_UNKNOWN',
  'MUSIC_OUTPUT_INVALID',
  'MUSIC_OUTPUT_TOO_LARGE',
  'MUSIC_MAX_ATTEMPTS_EXCEEDED',
  'MUSIC_CANNOT_CANCEL',
]);

export interface MusicErrorDescriptor {
  code: string | null;
  message: string;
  status: number | null;
}

export function musicErrorDescriptor(error: unknown): MusicErrorDescriptor {
  const code = getApiErrorCode(error);
  const status = getApiStatus(error);
  const translationKey = code && KNOWN_ERROR_CODES.has(code)
    ? `musicStudio.errors.codes.${code}`
    : 'musicStudio.errors.generic';
  return {
    code,
    message: i18n.t(translationKey) as string,
    status,
  };
}

export function musicJobErrorMessage(code?: string | null): string {
  if (code && KNOWN_ERROR_CODES.has(code)) {
    return i18n.t(`musicStudio.errors.codes.${code}`) as string;
  }
  return i18n.t('musicStudio.errors.generic') as string;
}
