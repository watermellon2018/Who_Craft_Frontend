/**
 * Poster generation API client.
 *
 * The legacy ``api/characters.ts`` aggregator was removed when the
 * legacy hero editor was retired. ``generatePosterApi`` is the only
 * function from that file that's still wired to a live endpoint
 * (``/api/generate/poster/`` → ``movie/poster/views.generate_poster``),
 * so we keep it in a small dedicated module instead.
 *
 * Uses the shared axios instance so the ``X-User-Token`` header is
 * attached automatically (the legacy version used bare ``axios``,
 * which meant the endpoint was effectively unauthenticated).
 */

import api from './http';

interface GeneratePosterOptions {
    style?: string;
    format?: string;
    referenceFile?: File | null;
}

export async function generatePosterApi(
    description: string,
    options: GeneratePosterOptions = {},
): Promise<any> {
    const {style, format, referenceFile} = options;
    if (referenceFile) {
        const form = new FormData();
        form.append('description', description);
        form.append('prompt', description);
        if (style) form.append('style', style);
        if (format) form.append('format', format);
        form.append('referenceImage', referenceFile);
        return api.post('api/generate/poster/', form, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
    }
    return api.post('api/generate/poster/', {
        description,
        prompt: description,
        style,
        format,
    });
}

interface EditPosterParams {
    url: string;
    correction: string;
}

export async function editGenerateImage(params: EditPosterParams): Promise<any> {
    return api.post('api/generate/edit/', {
        data: {image: params.url, correction: params.correction},
    });
}
