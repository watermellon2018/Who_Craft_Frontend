import React, {useEffect, useMemo} from 'react';
import './App.css';
import {
    createBrowserRouter,
    Outlet,
    RouterProvider,
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
import PathConstants from "./routes/pathConstant";
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
import AudioTrackEditorPage from "./modules/music-studio/pages/AudioTrackEditorPage";
import ReferenceLibraryPage from "./modules/reference-library/pages/ReferenceLibraryPage";
import ReferenceWorkspacePage from "./modules/reference-library/pages/ReferenceWorkspacePage";
import VisualReferenceCreatePage from "./modules/reference-library/pages/VisualReferenceCreatePage";
import CreditWalletPage from './modules/credits/pages/CreditWalletPage';
import withAuth from "./utils/auth/check_auth";
import AppErrorBoundary from './components/AppErrorBoundary';
import NotFoundPage from './page/errors/NotFoundPage';
import {AUTH_EXPIRED_EVENT} from './api/http';
import type {AuthExpiredEventDetail} from './api/http';
import {safeReturnTo} from './utils/auth/returnTo';
import {createAntTheme} from './theme/antdTheme';
import {CraftThemeProvider, useCraftTheme} from './theme/CraftThemeProvider';

// All private pages are wrapped once here so adding a new private route is a
// one-line change and we can't forget the auth gate on any single page.
const ProtectedMainPage = withAuth(MainPage);
const ProtectedProfilePage = withAuth(ProfilePage);
const ProtectedProfileEditPage = withAuth(ProfileEditPage);
const ProtectedSubscriptionsPage = withAuth(SubscriptionsPage);
const ProtectedCreditWalletPage = withAuth(CreditWalletPage);
const ProtectedProjectCreatePage = withAuth(ProjectCreatePage);
const ProtectedProjectListPage = withAuth(ProjectListPage);
const ProtectedProjectPage = withAuth(ProjectPage);
const ProtectedGenPosterPage = withAuth(GenPosterPage);
const ProtectedScriptPage = withAuth(ScriptPage);
const ProtectedMusicStudioPage = withAuth(MusicStudioPage);
const ProtectedAudioTrackEditorPage = withAuth(AudioTrackEditorPage);
const ProtectedReferenceLibraryPage = withAuth(ReferenceLibraryPage);
const ProtectedReferenceWorkspacePage = withAuth(ReferenceWorkspacePage);
const ProtectedVisualReferenceCreatePage = withAuth(VisualReferenceCreatePage);
const ProtectedCharacterStudioShell = withAuth(CharacterStudioShell);

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
export const APP_ROUTES = [
        // Public.
        { key: 'register', path: PathConstants.REGISTER, component: <RegistrationPage /> },
        { key: 'login', path: PathConstants.LOGIN, component: <LoginPage /> },

        // Private — every entry below MUST be wrapped via withAuth.
        { key: 'home', path: PathConstants.HOME, component: <ProtectedMainPage /> },
        { key: 'profile', path: PathConstants.PROFILE, component: <ProtectedProfilePage /> },
        { key: 'profileEdit', path: PathConstants.PROFILE_EDIT, component: <ProtectedProfileEditPage /> },
        { key: 'profileSubscriptions', path: PathConstants.PROFILE_SUBSCRIPTIONS, component: <ProtectedSubscriptionsPage /> },
        { key: 'credits', path: PathConstants.CREDITS, component: <ProtectedCreditWalletPage /> },
        { key: 'createProject', path: PathConstants.CREATE_PROJECT, component: <ProtectedProjectCreatePage /> },
        { key: 'editProject', path: PathConstants.EDIT_PROJECT, component: <ProtectedProjectCreatePage /> },
        { key: 'projects', path: PathConstants.PROJECTS, component: <ProtectedProjectListPage /> },
        { key: 'projectPage', path: PathConstants.PROJECT_PAGE, component: <ProtectedProjectPage /> },
        { key: 'projectTeam', path: PathConstants.PROJECT_TEAM, component: <ProjectTeamPage /> },
        { key: 'inviteAccept', path: PathConstants.INVITE_ACCEPT, component: <InviteAcceptPage /> },
        { key: 'genPoster', path: PathConstants.GEN_POSTER, component: <ProtectedGenPosterPage /> },
        { key: 'scriptPage', path: PathConstants.SCRIPT_PAGE, component: <ProtectedScriptPage /> },
        { key: 'musicStudio', path: PathConstants.MUSIC_STUDIO, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioCreate', path: PathConstants.MUSIC_STUDIO_CREATE, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioJob', path: PathConstants.MUSIC_STUDIO_JOB, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioTrack', path: PathConstants.MUSIC_STUDIO_TRACK, component: <ProtectedMusicStudioPage /> },
        { key: 'musicStudioTrackEditor', path: PathConstants.MUSIC_STUDIO_TRACK_EDITOR, component: <ProtectedAudioTrackEditorPage /> },
        { key: 'musicStudioUploadDraftEditor', path: PathConstants.MUSIC_STUDIO_UPLOAD_DRAFT_EDITOR, component: <ProtectedAudioTrackEditorPage /> },
        { key: 'referenceLibrary', path: PathConstants.REFERENCE_LIBRARY, component: <ProtectedReferenceLibraryPage /> },
        { key: 'referenceLibraryCreate', path: PathConstants.REFERENCE_LIBRARY_CREATE, component: <ProtectedVisualReferenceCreatePage /> },
        { key: 'referenceLibraryJob', path: PathConstants.REFERENCE_LIBRARY_JOB, component: <ProtectedReferenceWorkspacePage /> },
        { key: 'referenceLibraryEdit', path: PathConstants.REFERENCE_LIBRARY_EDIT, component: <ProtectedReferenceWorkspacePage /> },
        { key: 'characterStudio', path: PathConstants.CHARACTER_STUDIO, component: <ProtectedCharacterStudioShell><CharacterGalleryPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioCreate', path: PathConstants.CHARACTER_STUDIO_CREATE, component: <ProtectedCharacterStudioShell><CharacterCreatePage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioCreateReference', path: PathConstants.CHARACTER_STUDIO_CREATE_REFERENCE, component: <ProtectedCharacterStudioShell><CharacterCreatePage activeMode="reference" /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioVariants', path: PathConstants.CHARACTER_STUDIO_VARIANTS, component: <ProtectedCharacterStudioShell><CharacterVariantsPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioDetail', path: PathConstants.CHARACTER_STUDIO_DETAIL, component: <ProtectedCharacterStudioShell><CharacterDetailPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioEditor', path: PathConstants.CHARACTER_STUDIO_EDITOR, component: <ProtectedCharacterStudioShell><CharacterEditorPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudioReferences', path: PathConstants.CHARACTER_STUDIO_REFERENCES, component: <ProtectedCharacterStudioShell><CharacterReferencesPage /></ProtectedCharacterStudioShell> },
        { key: 'characterStudio3D', path: PathConstants.CHARACTER_STUDIO_3D, component: <ProtectedCharacterStudioShell><Character3DEditorPage /></ProtectedCharacterStudioShell> },
    ];

function ThemedApp() {

    const {theme} = useCraftTheme();
    const antdTheme = useMemo(() => createAntTheme(theme), [theme]);

    const router = useMemo(() => createBrowserRouter([{
        element: <><AuthExpiryRedirect /><Outlet /></>,
        children: [
            ...APP_ROUTES.map(({path, component}) => ({path, element: component})),
            {path: '*', element: <NotFoundPage />},
        ],
    }]), []);



    return (
        <AppErrorBoundary>
            <ConfigProvider theme={antdTheme}>
                <RouterProvider router={router} />
            </ConfigProvider>
        </AppErrorBoundary>
    );
}

function App() {
    return (
        <CraftThemeProvider>
            <ThemedApp />
        </CraftThemeProvider>
    );
}

export default App;
