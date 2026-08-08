import React, {useEffect, useMemo} from 'react';
import './App.css';
import {
    createBrowserRouter,
    Navigate,
    Outlet,
    RouterProvider,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import {ConfigProvider} from 'antd';
import MainPage from "./page/main";
import RegistrationPage from "./page/logIn/register";
import LoginPage from "./page/logIn/login";
import ProfilePage from "./modules/profile/ProfileDashboardPage";
import ProfileEditPage from "./modules/profile/ProfileEditPage";
import SubscriptionsPage from "./modules/subscriptions/SubscriptionsPage";
import ProjectCreatePage from "./page/creation/projects/newProjectPage";
import ProjectListPage from "./page/movie/library/own/list";
import ProjectPage from "./page/movie/projectPage/projectPage";
import ProjectTeamPage from "./page/movie/projectPage/team/ProjectTeamPage";
import InviteAcceptPage from "./page/movie/projectPage/team/InviteAcceptPage";
import PathConstants, {projectDashboardPath} from "./routes/pathConstant";
import GenPosterPage from "./page/creation/poster/GenPosterPage";
import ScriptPage from "./page/script/editor";
import CharacterGalleryPage from "./modules/character-studio/pages/CharacterGalleryPage";
import CharacterCreatePage from "./modules/character-studio/pages/CharacterCreatePage";
import CharacterEditorPage from "./modules/character-studio/pages/CharacterEditorPage";
import CharacterDetailPage from "./modules/character-studio/pages/CharacterDetailPage";
import CharacterVariantsPage from "./modules/character-studio/pages/CharacterVariantsPage";
import CharacterReferencesPage from "./modules/character-studio/pages/CharacterReferencesPage";
import Character3DEditorPage from "./modules/character-studio/pages/Character3DEditorPage";
import CharacterStudioShell from "./modules/character-studio/components/CharacterStudioShell";
import MusicStudioPage from "./modules/music-studio/pages/MusicStudioPage";
import ReferenceLibraryPage from "./modules/reference-library/pages/ReferenceLibraryPage";
import ReferenceWorkspacePage from "./modules/reference-library/pages/ReferenceWorkspacePage";
import withAuth from "./utils/auth/check_auth";
import {CRAFT_ACCENT} from './constants/theme';
import AppErrorBoundary from './components/AppErrorBoundary';
import NotFoundPage from './page/errors/NotFoundPage';
import {AUTH_EXPIRED_EVENT} from './api/http';
import type {AuthExpiredEventDetail} from './api/http';
import {safeReturnTo} from './utils/auth/returnTo';

// All private pages are wrapped once here so adding a new private route is a
// one-line change and we can't forget the auth gate on any single page.
const ProtectedMainPage = withAuth(MainPage);
const ProtectedProfilePage = withAuth(ProfilePage);
const ProtectedProfileEditPage = withAuth(ProfileEditPage);
const ProtectedSubscriptionsPage = withAuth(SubscriptionsPage);
const ProtectedProjectCreatePage = withAuth(ProjectCreatePage);
const ProtectedProjectListPage = withAuth(ProjectListPage);
const ProtectedProjectPage = withAuth(ProjectPage);
const ProtectedGenPosterPage = withAuth(GenPosterPage);
const ProtectedScriptPage = withAuth(ScriptPage);
const ProtectedMusicStudioPage = withAuth(MusicStudioPage);
const ProtectedReferenceLibraryPage = withAuth(ReferenceLibraryPage);
const ProtectedReferenceWorkspacePage = withAuth(ReferenceWorkspacePage);
const ProtectedCharacterStudioShell = withAuth(CharacterStudioShell);

const LegacyProjectDashboardRedirect: React.FC = () => {
    const location = useLocation();
    const projectId = (location.state as {project_id?: string | number} | null)?.project_id;
    return (
        <Navigate
            to={projectId ? projectDashboardPath(projectId) : PathConstants.PROJECTS}
            replace
        />
    );
};

const AuthExpiryRedirect: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuthExpired = (event: Event) => {
            const detail = (event as CustomEvent<AuthExpiredEventDetail>).detail;
            const returnTo = safeReturnTo(detail?.returnTo);
            navigate(PathConstants.LOGIN, {
                replace: true,
                state: returnTo ? {returnTo} : undefined,
            });
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    }, [navigate]);

    return null;
};
// https://ant.design/theme-editor#component-color настройка цветов
const theme = {
    "token": {
        "colorPrimary": CRAFT_ACCENT,
        "colorInfo": CRAFT_ACCENT,
        "colorBgBase": "#1b1d22",
        "colorTextBase": "#ffffff",
        "fontSize": 16,
        "sizeStep": 3,
        "sizeUnit": 3,
        "borderRadius": 3,
        "wireframe": false,
        "backgroundColor": '#1b1d22',
        "background": '#1b1d22',
        "algorithm": true,
    },
    "components": {
        "Button": {
            "defaultBorderColor": "rgb(250, 176, 5)",
            "colorPrimaryBorder": "rgb(27, 29, 34) !important",
            "colorPrimary": "rgb(250, 176, 5) !important",
            "colorError": "rgba(255, 77, 79, 0.57)",
            "colorTextLightSolid": "rgb(27, 29, 34)",
            "colorText": "rgb(250, 176, 5)",
            "defaultColor": "rgb(250, 176, 5)",
            "colorPrimaryHover": "rgb(252, 209, 95)",
            "primaryShadow": "0 0px 0",
            "transition": "transform 0.3s ease",
            "&:active": {
                "transform": "scale(0.95)",
            },
        },
        "Input": {
            "colorTextPlaceholder": "rgba(250, 176, 5, 0.55)",
            "colorBorder": "rgb(250, 176, 5)",
            "colorBgContainer": "rgb(27, 29, 34)"
        },
        "Sidebar": {
            "textColor": "#fff",
        },
        "Switch": {
            "colorPrimary": "rgb(27, 29, 34)",
            "colorTextQuaternary": "rgb(27, 29, 34) !important",
            "colorPrimaryHover": "rgb(208, 154, 26)",
            "colorPrimaryBorder": "rgb(27, 29, 34)",
        },
        "InputNumber": {
            "colorTextPlaceholder": "rgb(250, 176, 5, 0.55)",
            "colorBorder": "rgb(250, 176, 5)",
        },
        "Select": {
            "colorBgContainer": "#141820",
            "colorBgElevated": "#1b2029",
            "colorText": "rgba(255, 255, 255, 0.88)",
            "colorTextPlaceholder": "#6f7784",
            "colorBorder": "#3b414d",
            "optionSelectedBg": "rgba(250, 176, 5, 0.12)",
            "optionSelectedColor": CRAFT_ACCENT,
            "optionActiveBg": "rgba(255, 255, 255, 0.05)",
            "selectorBg": "#141820",
        },
        "Checkbox": {
            "colorText": "rgb(27, 29, 34)",
        },
        "Radio": {
            "colorText": "rgb(27, 29, 34)",
        },
        "Tabs": {
            "itemSelectedColor":  "rgb(27, 29, 34)",
            "itemActiveColor":  "rgb(27, 29, 34)",
            "itemColor":  "rgb(27, 29, 34)",
            "itemHoverColor":  "rgba(27, 29, 34, 0.7)",
        },
        "Form": {
            "labelColor": "rgb(27, 29, 34)",
        },
        "Empty": {
            "colorText": CRAFT_ACCENT,
            "colorTextDisabled": CRAFT_ACCENT,
        }
    }
}

function App() {

    const routes = useMemo(() => [
        // Public.
        { key: 'startRedirect', path: '/start', component: <Navigate to={PathConstants.LOGIN} replace /> },
        { key: 'register', path: PathConstants.REGISTER, component: <RegistrationPage /> },
        { key: 'login', path: PathConstants.LOGIN, component: <LoginPage /> },

        // Private — every entry below MUST be wrapped via withAuth.
        { key: 'home', path: PathConstants.HOME, component: <ProtectedMainPage /> },
        { key: 'profile', path: PathConstants.PROFILE, component: <ProtectedProfilePage /> },
        { key: 'profileEdit', path: PathConstants.PROFILE_EDIT, component: <ProtectedProfileEditPage /> },
        { key: 'profileSubscriptions', path: PathConstants.PROFILE_SUBSCRIPTIONS, component: <ProtectedSubscriptionsPage /> },
        { key: 'createProject', path: PathConstants.CREATE_PROJECT, component: <ProtectedProjectCreatePage /> },
        { key: 'editProject', path: PathConstants.EDIT_PROJECT, component: <ProtectedProjectCreatePage /> },
        { key: 'editProjectLegacy', path: PathConstants.EDIT_PROJECT_LEGACY, component: <Navigate to={PathConstants.PROJECTS} replace /> },
        { key: 'projects', path: PathConstants.PROJECTS, component: <ProtectedProjectListPage /> },
        { key: 'projectPage', path: PathConstants.PROJECT_PAGE, component: <ProtectedProjectPage /> },
        { key: 'projectPageLegacy', path: PathConstants.PROJECT_PAGE_LEGACY, component: <LegacyProjectDashboardRedirect /> },
        { key: 'projectTeam', path: PathConstants.PROJECT_TEAM, component: <ProjectTeamPage /> },
        { key: 'inviteAccept', path: PathConstants.INVITE_ACCEPT, component: <InviteAcceptPage /> },
        { key: 'genPoster', path: PathConstants.GEN_POSTER, component: <ProtectedGenPosterPage /> },
        { key: 'genPosterLegacy', path: PathConstants.GEN_POSTER_LEGACY, component: <Navigate to={PathConstants.CREATE_PROJECT} replace /> },
        { key: 'scriptPage', path: PathConstants.SCRIPT_PAGE, component: <ProtectedScriptPage /> },
        { key: 'scriptPageLegacy', path: PathConstants.SCRIPT_PAGE_LEGACY, component: <ProtectedScriptPage /> },
        { key: 'musicStudio', path: PathConstants.MUSIC_STUDIO, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioCreate', path: PathConstants.MUSIC_STUDIO_CREATE, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioJob', path: PathConstants.MUSIC_STUDIO_JOB, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioTrack', path: PathConstants.MUSIC_STUDIO_TRACK, component: <ProtectedMusicStudioPage /> },
        { key: 'referenceLibrary', path: PathConstants.REFERENCE_LIBRARY, component: <ProtectedReferenceLibraryPage /> },
        { key: 'referenceLibraryCreate', path: PathConstants.REFERENCE_LIBRARY_CREATE, component: <ProtectedReferenceWorkspacePage /> },
        { key: 'referenceLibraryJob', path: PathConstants.REFERENCE_LIBRARY_JOB, component: <ProtectedReferenceWorkspacePage /> },
        { key: 'referenceLibraryEdit', path: PathConstants.REFERENCE_LIBRARY_EDIT, component: <ProtectedReferenceWorkspacePage /> },
        { key: 'referenceLibraryDetail', path: PathConstants.REFERENCE_LIBRARY_DETAIL, component: <ProtectedReferenceWorkspacePage /> },
        { key: 'characterStudio', path: PathConstants.CHARACTER_STUDIO, component: <ProtectedCharacterStudioShell><CharacterGalleryPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioCreate', path: PathConstants.CHARACTER_STUDIO_CREATE, component: <ProtectedCharacterStudioShell><CharacterCreatePage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioCreateReference', path: PathConstants.CHARACTER_STUDIO_CREATE_REFERENCE, component: <ProtectedCharacterStudioShell><CharacterCreatePage activeMode="reference" /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioVariants', path: PathConstants.CHARACTER_STUDIO_VARIANTS, component: <ProtectedCharacterStudioShell><CharacterVariantsPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioDetail', path: PathConstants.CHARACTER_STUDIO_DETAIL, component: <ProtectedCharacterStudioShell><CharacterDetailPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioEditor', path: PathConstants.CHARACTER_STUDIO_EDITOR, component: <ProtectedCharacterStudioShell><CharacterEditorPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioReferences', path: PathConstants.CHARACTER_STUDIO_REFERENCES, component: <ProtectedCharacterStudioShell><CharacterReferencesPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudio3D', path: PathConstants.CHARACTER_STUDIO_3D, component: <ProtectedCharacterStudioShell><Character3DEditorPage /></ProtectedCharacterStudioShell> },
    ], []);

    const router = useMemo(() => createBrowserRouter([{
        element: <><AuthExpiryRedirect /><Outlet /></>,
        children: [
            ...routes.map(({path, component}) => ({path, element: component})),
            {path: '*', element: <NotFoundPage />},
        ],
    }]), [routes]);



    return (
        <AppErrorBoundary>
            <ConfigProvider theme={theme}>
                <RouterProvider router={router} />
            </ConfigProvider>
        </AppErrorBoundary>
    );
}

export default App;
