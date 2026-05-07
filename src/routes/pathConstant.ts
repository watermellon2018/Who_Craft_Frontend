const PathConstants = {
    HOME: '/',
    AUTH: "/start",
    REGISTER: "/register",
    LOGIN: "/login",

    GENERATING: '/generating',
    SETTING_HERO: '/generating/setting-hero',

    PROFILE: '/profile',
    PROFILE_EDIT: '/profile/edit',

    EDIT_GEN_IMG: '/generating/edit',
    CREATE_PROJECT: '/create-project',
    EDIT_PROJECT: '/edit-project',
    GEN_POSTER: '/create-project/gen-poster',
    PROJECTS: '/project-list',
    PROJECT_PAGE: '/project-list/project',

    ALL_HEROES_PAGE: '/project/heroes-list',
    HERO_PAGE: '/project/hero',

    SCRIPT_PAGE: '/project/script'
    ,
    CHARACTER_STUDIO: '/project/:projectId/characters',
    CHARACTER_STUDIO_CREATE: '/project/:projectId/characters/create',
    CHARACTER_STUDIO_CREATE_REFERENCE: '/project/:projectId/characters/create/reference',
    CHARACTER_STUDIO_VARIANTS: '/project/:projectId/characters/:characterId/variants',
    CHARACTER_STUDIO_DETAIL: '/project/:projectId/characters/:characterId',
    CHARACTER_STUDIO_EDITOR: '/project/:projectId/characters/:characterId/edit',
    CHARACTER_STUDIO_REFERENCES: '/project/:projectId/characters/:characterId/references',
    CHARACTER_STUDIO_3D: '/project/:projectId/characters/:characterId/3d-model',

}
export default PathConstants
