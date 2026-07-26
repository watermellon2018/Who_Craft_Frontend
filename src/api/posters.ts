/**
 * Project-scoped poster generation API client.
 *
 * Uses the shared axios instance so authentication and the backend base URL
 * are handled consistently with the rest of the application.
 */

import {v4 as uuidv4} from 'uuid';

import api from './http';

type ProjectId = number | string;
type PosterJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PosterVariant {
    id: number;
    imageUrl: string;
}

interface PosterJob {
    id: number;
    status: PosterJobStatus;
    errorMessage?: string | null;
}

interface PosterOperationResponse {
    jobId?: number;
    status?: PosterJobStatus;
    job?: PosterJob;
    variants: PosterVariant[];
}

interface GeneratePosterOptions {
    style?: string;
    format?: string;
    referenceFile?: File | null;
}

interface EditPosterParams {
    sourceVariantId: number;
    instruction: string;
}

const POSTER_POLL_INTERVAL_MS = 1000;
const POSTER_POLL_ATTEMPTS = 90;

function idempotencyHeaders() {
    return {'Idempotency-Key': uuidv4()};
}

function firstVariant(response: PosterOperationResponse): PosterVariant | null {
    const variant = response.variants?.[0];
    return variant?.id != null && variant.imageUrl ? variant : null;
}

function operationStatus(response: PosterOperationResponse): PosterJobStatus | undefined {
    return response.job?.status ?? response.status;
}

function throwTerminalError(response: PosterOperationResponse): void {
    const status = operationStatus(response);
    if (status === 'failed' || status === 'cancelled') {
        throw new Error(
            response.job?.errorMessage ||
            'Генерация постера не завершилась. Повторите попытку.',
        );
    }
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function waitForVariant(
    projectId: ProjectId,
    initial: PosterOperationResponse,
): Promise<PosterVariant> {
    const immediate = firstVariant(initial);
    if (immediate) return immediate;
    throwTerminalError(initial);

    const jobId = initial.jobId ?? initial.job?.id;
    if (!jobId || operationStatus(initial) === 'completed') {
        throw new Error('Сервер не вернул вариант постера. Повторите попытку.');
    }

    for (let attempt = 0; attempt < POSTER_POLL_ATTEMPTS; attempt += 1) {
        await delay(POSTER_POLL_INTERVAL_MS);
        const response = await api.get<PosterOperationResponse>(
            `api/projects/${projectId}/poster/jobs/${jobId}/`,
        );
        const variant = firstVariant(response.data);
        if (variant) return variant;
        throwTerminalError(response.data);
        if (operationStatus(response.data) === 'completed') break;
    }

    throw new Error('Генерация постера заняла слишком много времени. Повторите попытку позже.');
}

export async function generatePoster(
    projectId: ProjectId,
    prompt: string,
    options: GeneratePosterOptions = {},
): Promise<PosterVariant> {
    const {style, format, referenceFile} = options;
    const url = `api/projects/${projectId}/poster/generate/`;
    const headers = idempotencyHeaders();

    if (referenceFile) {
        const form = new FormData();
        form.append('prompt', prompt);
        if (style) form.append('style', style);
        if (format) form.append('format', format);
        form.append('reference_image', referenceFile);

        const response = await api.post<PosterOperationResponse>(url, form, {headers});
        return waitForVariant(projectId, response.data);
    }

    const response = await api.post<PosterOperationResponse>(
        url,
        {prompt, style, format},
        {headers},
    );
    return waitForVariant(projectId, response.data);
}

export async function selectPosterVariant(
    projectId: ProjectId,
    variantId: number,
): Promise<void> {
    await api.patch(`api/projects/${projectId}/poster/select/`, {
        variant_id: variantId,
    });
}

export async function editPoster(
    projectId: ProjectId,
    params: EditPosterParams,
): Promise<PosterVariant> {
    const response = await api.post<PosterOperationResponse>(
        `api/projects/${projectId}/poster/edit/`,
        {
            source_variant_id: params.sourceVariantId,
            instruction: params.instruction,
        },
        {headers: idempotencyHeaders()},
    );
    return waitForVariant(projectId, response.data);
}