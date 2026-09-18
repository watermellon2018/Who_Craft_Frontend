import type {TFunction} from 'i18next';

import {getApiErrorCode} from '../../../api/errors';
import {getPosterClientErrorCode} from '../../../api/posters';

const ERROR_TRANSLATION_KEYS: Record<string, string> = {
    AUTH_REQUIRED: 'poster.errors.authRequired',
    IDEMPOTENCY_KEY_INVALID: 'poster.errors.requestInvalid',
    IDEMPOTENCY_KEY_REQUIRED: 'poster.errors.requestInvalid',
    IDEMPOTENCY_KEY_REUSED: 'poster.errors.requestConflict',
    INVALID_POSTER_FORMAT: 'poster.errors.invalidFormat',
    INVALID_POSTER_STYLE: 'poster.errors.invalidStyle',
    POSTER_CANCELLATION_REQUESTED: 'poster.errors.cancellationRequested',
    POSTER_CONCURRENCY_LIMIT: 'poster.errors.concurrencyLimit',
    POSTER_DAILY_QUOTA_EXCEEDED: 'poster.errors.dailyQuotaExceeded',
    POSTER_ERROR: 'poster.errors.generationFailed',
    POSTER_GENERATION_ALREADY_STARTED: 'poster.errors.alreadyStarted',
    POSTER_GENERATION_FAILED: 'poster.errors.generationFailed',
    POSTER_IMAGE_TOO_LARGE: 'poster.errors.imageTooLarge',
    POSTER_INPUT_UNAVAILABLE: 'poster.errors.inputUnavailable',
    POSTER_JOB_ACTIVE: 'poster.errors.jobActive',
    POSTER_JOB_NOT_FOUND: 'poster.errors.jobNotFound',
    POSTER_NO_VARIANT: 'poster.errors.noVariant',
    POSTER_PROMPT_REQUIRED: 'poster.errors.promptRequired',
    POSTER_PROMPT_TOO_LONG: 'poster.errors.promptTooLong',
    POSTER_PROVIDER_CIRCUIT_OPEN: 'poster.errors.providerUnavailable',
    POSTER_PROVIDER_FAILURE: 'poster.errors.providerFailure',
    POSTER_PROVIDER_OUTCOME_UNKNOWN: 'poster.errors.providerOutcomeUnknown',
    POSTER_RESULT_PERSISTENCE_FAILED: 'poster.errors.resultPersistenceFailed',
    POSTER_SOURCE_MISSING: 'poster.errors.sourceMissing',
    POSTER_TIMEOUT: 'poster.errors.timeout',
    POSTER_VARIANT_DELETED: 'poster.errors.variantDeleted',
    POSTER_VARIANT_NOT_FOUND: 'poster.errors.variantNotFound',
    PROJECT_ACCESS_DENIED: 'poster.errors.projectAccessDenied',
    PROJECT_NOT_FOUND: 'poster.errors.projectNotFound',
    VALIDATION_ERROR: 'poster.errors.validation',
};

export function getPosterErrorTranslationKey(
    error: unknown,
    fallbackKey: string,
): string {
    const code = getPosterClientErrorCode(error) ?? getApiErrorCode(error);
    return code ? ERROR_TRANSLATION_KEYS[code] ?? fallbackKey : fallbackKey;
}

export function getPosterJobErrorTranslationKey(
    errorCode: string | null | undefined,
): string {
    return errorCode
        ? ERROR_TRANSLATION_KEYS[errorCode] ?? 'poster.errors.generationFailed'
        : 'poster.errors.generationFailed';
}

export function translatePosterError(
    error: unknown,
    t: TFunction,
    fallbackKey: string,
): string {
    return t(getPosterErrorTranslationKey(error, fallbackKey));
}
