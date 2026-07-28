const PathConstants = {
    HOME: '/',
    AUTH: "/login",
    REGISTER: "/register",
    LOGIN: "/login",

    PROFILE: '/profile',
    PROFILE_EDIT: '/profile/edit',
    PROFILE_SUBSCRIPTIONS: '/profile/subscriptions',

    CREATE_PROJECT: '/create-project',
    EDIT_PROJECT: '/projects/:projectId/edit',
    EDIT_PROJECT_LEGACY: '/edit-project',
    GEN_POSTER: '/projects/:projectId/poster',
    GEN_POSTER_LEGACY: '/create-project/gen-poster',
    PROJECTS: '/project-list',
    PROJECT_PAGE: '/projects/:projectId',
    PROJECT_PAGE_LEGACY: '/project-list/project',
    PROJECT_TEAM: '/project-list/project/:projectId/team',
    INVITE_ACCEPT: '/invite/:token',

    SCRIPT_PAGE: '/project/:projectId/script',
    SCRIPT_PAGE_LEGACY: '/project/script',

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
    return pathname === PathConstants.SCRIPT_PAGE_LEGACY
        || /^\/project\/[^/]+\/script\/?$/.test(pathname);
}
export default PathConstants
