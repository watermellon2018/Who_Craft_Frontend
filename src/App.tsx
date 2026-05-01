import React, {useMemo} from 'react';
import './App.css';
import {BrowserRouter, Route, Routes} from 'react-router-dom';

import {ConfigProvider} from 'antd';
import MainPage from "./page/main";
import LandingPage from "./page/logIn/start";
import RegistrationPage from "./page/logIn/register";
import LoginPage from "./page/logIn/login";
import ProfilePage from "./page/profile/user";
import ProjectCreatePage from "./page/creation/projects/newProjectPage";
import ProjectListPage from "./page/movie/library/own/list";
import ProjectPage from "./page/movie/projectPage/projectPage";
import CharacterData from "./page/movie/characters/setting/CharacterData";
import PathConstants from "./routes/pathConstant";
import GenPosterPage from "./page/creation/poster/GenPosterPage";
import EditGenImgPage from "./page/creation/edit/editGenImgPage";
import AllHeroesPage from "./page/movie/characters/info/allHeroes";
import HeroPage from "./page/hero/main";
import ScriptPage from "./page/script/editor";
import CharacterGalleryPage from "./modules/character-studio/pages/CharacterGalleryPage";
import CharacterCreatePage from "./modules/character-studio/pages/CharacterCreatePage";
import CharacterEditorPage from "./modules/character-studio/pages/CharacterEditorPage";
import CharacterDetailPage from "./modules/character-studio/pages/CharacterDetailPage";
import CharacterVariantsPage from "./modules/character-studio/pages/CharacterVariantsPage";
import CharacterStudioShell from "./modules/character-studio/components/CharacterStudioShell";

// https://ant.design/theme-editor#component-color настройка цветов
const theme = {
    "token": {
        "colorPrimary": "#fab005",
        "colorInfo": "#fab005",
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
            "optionSelectedColor": "#fab005",
            "optionActiveBg": "rgba(255, 255, 255, 0.05)",
            "selectorBg": "#141820",
        },
        "Checkbox": {
            "colorText": "rgb(27, 29, 34)",
        },
        "Radio": {
            "colorText": "rgb(27, 29, 34)",
        },
        "Card": {
            "colorBgContainer": "#fab005",
            "colorText": "rgb(27, 29, 34)",
            "colorTextHeading":  "rgb(27, 29, 34)",
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
            "colorText": "#fab005",
            "colorTextDisabled": "#fab005",
        }
    }
}

function App() {

    const routes = useMemo(() => [
        { key: 'auth', path: PathConstants.AUTH, component: <LandingPage /> },
        { key: 'register', path: PathConstants.REGISTER, component: <RegistrationPage /> },
        { key: 'login', path: PathConstants.LOGIN, component: <LoginPage /> },
        { key: 'home', path: PathConstants.HOME, component: <MainPage /> },
        { key: 'generating', path: PathConstants.GENERATING, component: <CharacterStudioShell><CharacterGalleryPage /></CharacterStudioShell> },
        { key: 'settingHero', path: PathConstants.SETTING_HERO, component: <CharacterData /> },
        { key: 'profile', path: PathConstants.PROFILE, component: <ProfilePage /> },
        { key: 'createProject', path: PathConstants.CREATE_PROJECT, component: <ProjectCreatePage /> },
        { key: 'projects', path: PathConstants.PROJECTS, component: <ProjectListPage /> },
        { key: 'projectPage', path: PathConstants.PROJECT_PAGE, component: <ProjectPage /> },
        { key: 'genPoster', path: PathConstants.GEN_POSTER, component: <GenPosterPage /> },
        { key: 'editGenImg', path: PathConstants.EDIT_GEN_IMG, component: <EditGenImgPage /> },
        { key: 'allHeroesPage', path: PathConstants.ALL_HEROES_PAGE, component: <AllHeroesPage /> },
        { key: 'heroPage', path: PathConstants.HERO_PAGE, component: <HeroPage /> },
        { key: 'scriptPage', path: PathConstants.SCRIPT_PAGE, component: <ScriptPage /> },
        { key: 'characterStudio', path: PathConstants.CHARACTER_STUDIO, component: <CharacterStudioShell><CharacterGalleryPage /></CharacterStudioShell> },
        { key: 'characterStudioCreate', path: PathConstants.CHARACTER_STUDIO_CREATE, component: <CharacterStudioShell><CharacterCreatePage /></CharacterStudioShell> },
        { key: 'characterStudioCreateReference', path: PathConstants.CHARACTER_STUDIO_CREATE_REFERENCE, component: <CharacterStudioShell><CharacterCreatePage activeMode="reference" /></CharacterStudioShell> },
        { key: 'characterStudioVariants', path: PathConstants.CHARACTER_STUDIO_VARIANTS, component: <CharacterStudioShell><CharacterVariantsPage /></CharacterStudioShell> },
        { key: 'characterStudioDetail', path: PathConstants.CHARACTER_STUDIO_DETAIL, component: <CharacterStudioShell><CharacterDetailPage /></CharacterStudioShell> },
        { key: 'characterStudioEditor', path: PathConstants.CHARACTER_STUDIO_EDITOR, component: <CharacterStudioShell><CharacterEditorPage /></CharacterStudioShell> },
    ], []);



    return (
        <ConfigProvider theme={theme}>
            <BrowserRouter>
                <Routes>
                    {routes.map(({ path, component }) => (
                        <Route key={path} path={path} element={component} />
                    ))}
                </Routes>
            </BrowserRouter>
        </ConfigProvider>
    );
}

export default App;
