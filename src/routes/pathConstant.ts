const PathConstants = {
    HOME: '/',
    AUTH: "/login",
    REGISTER: "/register",
    LOGIN: "/login",

    PROFILE: '/profile',
    PROFILE_EDIT: '/profile/edit',
    PROFILE_SUBSCRIPTIONS: '/profile/subscriptions',

    CREATE_PROJECT: '/create-project',
    EDIT_PROJECT: '/edit-project',
    GEN_POSTER: '/create-project/gen-poster',
    PROJECTS: '/project-list',
    PROJECT_PAGE: '/project-list/project',
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

export function isScriptWorkspacePath(pathname: string) {
    return pathname === PathConstants.SCRIPT_PAGE_LEGACY
        || /^\/project\/[^/]+\/script\/?$/.test(pathname);
}
export default PathConstants
