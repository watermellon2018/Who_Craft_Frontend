const PathConstants = {
    HOME: '/',
    AUTH: "/login",
    REGISTER: "/register",
    LOGIN: "/login",

    PROFILE: '/profile',
    PROFILE_EDIT: '/profile/edit',
    PROFILE_SETTINGS: '/profile/settings',
    PROFILE_SUBSCRIPTIONS: '/profile/subscriptions',
    CREDITS: '/credits',

    CREATE_PROJECT: '/create-project',
    EDIT_PROJECT: '/projects/:projectId/edit',
    GEN_POSTER: '/projects/:projectId/poster',
    PROJECTS: '/project-list',
    PROJECT_PAGE: '/projects/:projectId',
    PROJECT_TEAM: '/project-list/project/:projectId/team',
    INVITE_ACCEPT: '/invite/:token',

    SCRIPT_PAGE: '/project/:projectId/script',
    STORYBOARD: '/project/:projectId/storyboard',

    VIDEO: '/project/:projectId/video',
    VIDEO_PREPARATION: '/project/:projectId/video/preparation',
    VIDEO_GENERATE: '/project/:projectId/video/generate',

    MUSIC_STUDIO: '/project/:projectId/music',
    MUSIC_STUDIO_CREATE: '/project/:projectId/music/create',
    MUSIC_STUDIO_JOB: '/project/:projectId/music/jobs/:jobId',
    MUSIC_STUDIO_TRACK: '/project/:projectId/music/tracks/:trackId',
    MUSIC_STUDIO_TRACK_EDITOR: '/project/:projectId/music/tracks/:trackId/edit',
    MUSIC_STUDIO_UPLOAD_DRAFT_EDITOR: '/project/:projectId/music/upload-drafts/:draftId/edit',

    SOUND_EFFECTS: '/project/:projectId/sound-effects',
    SOUND_EFFECTS_CREATE: '/project/:projectId/sound-effects/create',
    SOUND_EFFECTS_JOB: '/project/:projectId/sound-effects/jobs/:jobId',
    SOUND_EFFECTS_DETAIL: '/project/:projectId/sound-effects/effects/:effectId',

    REFERENCE_LIBRARY: '/project/:projectId/references',
    REFERENCE_LIBRARY_CREATE: '/project/:projectId/references/create',
    REFERENCE_LIBRARY_JOB: '/project/:projectId/references/:referenceId/jobs/:jobId',
    REFERENCE_LIBRARY_EDIT: '/project/:projectId/references/:referenceId/edit',

    CHARACTER_STUDIO: '/project/:projectId/characters',
    CHARACTER_STUDIO_CREATE: '/project/:projectId/characters/create',
    CHARACTER_STUDIO_CREATE_REFERENCE: '/project/:projectId/characters/create/reference',
    CHARACTER_STUDIO_VARIANTS: '/project/:projectId/characters/:characterId/variants',
    CHARACTER_STUDIO_DETAIL: '/project/:projectId/characters/:characterId',
    CHARACTER_STUDIO_EDITOR: '/project/:projectId/characters/:characterId/edit',
    CHARACTER_STUDIO_REFERENCES: '/project/:projectId/characters/:characterId/references',
    CHARACTER_STUDIO_3D: '/project/:projectId/characters/:characterId/3d-model',

}

export function projectDashboardPath(projectId: string | number): string {
    return PathConstants.PROJECT_PAGE.replace(':projectId', String(projectId));
}

export function projectEditPath(projectId: string | number): string {
    return PathConstants.EDIT_PROJECT.replace(':projectId', String(projectId));
}

export function projectPosterPath(projectId: string | number): string {
    return PathConstants.GEN_POSTER.replace(':projectId', String(projectId));
}

export function scriptScenePath(
    projectId: string | number,
    sceneId: string | number,
): string {
    const base = PathConstants.SCRIPT_PAGE.replace(':projectId', String(projectId));
    return `${base}?sceneId=${encodeURIComponent(String(sceneId))}`;
}

export function storyboardPath(projectId: string | number): string {
    return PathConstants.STORYBOARD.replace(':projectId', String(projectId));
}

export function videoPath(projectId: string | number): string {
    return PathConstants.VIDEO.replace(':projectId', String(projectId));
}

export function videoPreparationPath(projectId: string | number): string {
    return PathConstants.VIDEO_PREPARATION.replace(':projectId', String(projectId));
}

export function videoGenerationPath(projectId: string | number): string {
    return PathConstants.VIDEO_GENERATE.replace(':projectId', String(projectId));
}

export function musicStudioPath(projectId: string | number): string {
    return PathConstants.MUSIC_STUDIO.replace(':projectId', String(projectId));
}

export function musicStudioCreatePath(
    projectId: string | number,
    sceneId?: string | number,
): string {
    const base = PathConstants.MUSIC_STUDIO_CREATE.replace(':projectId', String(projectId));
    return sceneId == null ? base : `${base}?sceneId=${encodeURIComponent(String(sceneId))}`;
}

export function musicStudioUploadCreatePath(projectId: string | number): string {
    return `${musicStudioCreatePath(projectId)}?mode=upload`;
}

export function musicJobPath(projectId: string | number, jobId: string): string {
    return PathConstants.MUSIC_STUDIO_JOB
        .replace(':projectId', String(projectId))
        .replace(':jobId', encodeURIComponent(jobId));
}

export function musicTrackPath(projectId: string | number, trackId: string | number): string {
    return PathConstants.MUSIC_STUDIO_TRACK
        .replace(':projectId', String(projectId))
        .replace(':trackId', encodeURIComponent(String(trackId)));
}

export function musicTrackEditorPath(
    projectId: string | number,
    trackId: string | number,
): string {
    return PathConstants.MUSIC_STUDIO_TRACK_EDITOR
        .replace(':projectId', String(projectId))
        .replace(':trackId', encodeURIComponent(String(trackId)));
}

export function musicUploadDraftEditorPath(
    projectId: string | number,
    draftId: string,
): string {
    return PathConstants.MUSIC_STUDIO_UPLOAD_DRAFT_EDITOR
        .replace(':projectId', String(projectId))
        .replace(':draftId', encodeURIComponent(draftId));
}

export function soundEffectsPath(projectId: string | number): string {
    return PathConstants.SOUND_EFFECTS.replace(':projectId', String(projectId));
}

export function soundEffectCreatePath(
    projectId: string | number,
    sceneId?: string | number,
): string {
    const base = PathConstants.SOUND_EFFECTS_CREATE.replace(':projectId', String(projectId));
    return sceneId == null ? base : `${base}?sceneId=${encodeURIComponent(String(sceneId))}`;
}

export function soundEffectJobPath(projectId: string | number, jobId: string): string {
    return PathConstants.SOUND_EFFECTS_JOB
        .replace(':projectId', String(projectId))
        .replace(':jobId', encodeURIComponent(jobId));
}

export function soundEffectDetailPath(
    projectId: string | number,
    effectId: string | number,
): string {
    return PathConstants.SOUND_EFFECTS_DETAIL
        .replace(':projectId', String(projectId))
        .replace(':effectId', encodeURIComponent(String(effectId)));
}

export function referenceLibraryPath(projectId: string | number): string {
    return PathConstants.REFERENCE_LIBRARY.replace(':projectId', String(projectId));
}

export function referenceCreatePath(projectId: string | number): string {
    return PathConstants.REFERENCE_LIBRARY_CREATE.replace(':projectId', String(projectId));
}

export function referenceLocationCreatePath(projectId: string | number): string {
    return `${referenceCreatePath(projectId)}?category=location`;
}

export function referenceEditPath(
    projectId: string | number,
    referenceId: string,
): string {
    return PathConstants.REFERENCE_LIBRARY_EDIT
        .replace(':projectId', String(projectId))
        .replace(':referenceId', encodeURIComponent(referenceId));
}

export function referenceJobPath(
    projectId: string | number,
    referenceId: string,
    jobId: string,
): string {
    return PathConstants.REFERENCE_LIBRARY_JOB
        .replace(':projectId', String(projectId))
        .replace(':referenceId', encodeURIComponent(referenceId))
        .replace(':jobId', encodeURIComponent(jobId));
}

export function characterCreatePath(
    projectId: string | number,
    context: {draftId?: string; treeNodeId?: string} = {},
): string {
    const base = PathConstants.CHARACTER_STUDIO_CREATE.replace(':projectId', String(projectId));
    const params = new URLSearchParams();
    if (context.draftId) params.set('draftId', context.draftId);
    if (context.treeNodeId) params.set('treeNodeId', context.treeNodeId);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
}

export function characterVariantsPath(
    projectId: string | number,
    characterId: string,
    jobId: string,
    treeNodeId?: string,
): string {
    const base = PathConstants.CHARACTER_STUDIO_VARIANTS
        .replace(':projectId', String(projectId))
        .replace(':characterId', characterId);
    const treeContext = treeNodeId ? `&treeNodeId=${encodeURIComponent(treeNodeId)}` : '';
    return `${base}?jobId=${encodeURIComponent(jobId)}${treeContext}`;
}

export function isProjectEditPath(pathname: string): boolean {
    return /^\/projects\/[^/]+\/edit\/?$/.test(pathname);
}

export function isScriptWorkspacePath(pathname: string) {
    return /^\/project\/[^/]+\/script\/?$/.test(pathname);
}
export default PathConstants
