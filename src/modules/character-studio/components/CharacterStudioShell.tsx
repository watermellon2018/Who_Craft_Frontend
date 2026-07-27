import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Empty} from 'antd';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import DashboardHeader, {BreadcrumbItem} from '../../profile/components/DashboardHeader';
import PathConstants, {projectDashboardPath} from '../../../routes/pathConstant';
import {fetch_project} from '../../../api/projects/properties/project';
import CharacterTreeSidebar from './CharacterTreeSidebar';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import {useCharacter} from '../hooks/useCharacter';
import './CharacterStudioShell.css';

const projectTitleCache = new Map<string, string>();

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'characterTreeSidebarCollapsed';

function readSidebarCollapsedPref(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function buildCharactersUrl(projectId: string | number): string {
  return PathConstants.CHARACTER_STUDIO.replace(':projectId', String(projectId));
}


function useTrailingSegment(pathname: string): string | null {
  const {t} = useTranslation();
  if (pathname.endsWith('/create') || pathname.endsWith('/create/reference')) {
    return t('characterStudio.breadcrumbs.newCharacter');
  }
  if (pathname.endsWith('/variants')) return t('characterStudio.breadcrumbs.variants');
  if (pathname.endsWith('/references')) return t('characterStudio.breadcrumbs.references');
  if (pathname.endsWith('/3d-model')) return t('characterStudio.breadcrumbs.model3d');
  return null;
}

export default function CharacterStudioShell({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();
  const location = useLocation();
  const {t} = useTranslation();
  const {characterId} = useParams();
  const projectId = useProjectIdFromRoute();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(readSidebarCollapsedPref);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Storage may be unavailable (private mode, quota); fall back to in-memory state.
      }
      return next;
    });
  }, []);
  const isEditorRoute = Boolean(characterId);

  const projectIdKey = projectId ? String(projectId) : '';
  const [projectTitle, setProjectTitle] = useState<string>(
    projectIdKey ? projectTitleCache.get(projectIdKey) ?? '' : '',
  );

  useEffect(() => {
    if (!projectIdKey) return;
    const cached = projectTitleCache.get(projectIdKey);
    if (cached) {
      setProjectTitle(cached);
      return;
    }
    let cancelled = false;
    fetch_project(projectIdKey)
      .then((project) => {
        if (cancelled) return;
        const title = project.title || '';
        if (title) {
          projectTitleCache.set(projectIdKey, title);
          setProjectTitle(title);
        }
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [projectIdKey]);

  const {character} = useCharacter(projectId ?? undefined, characterId);
  const trailing = useTrailingSegment(location.pathname);
  const newCharacterLabel = t('characterStudio.breadcrumbs.newCharacter');

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    if (!projectId) return [];
    const items: BreadcrumbItem[] = [
      {label: t('characterStudio.breadcrumbs.allProjects'), to: PathConstants.PROJECTS},
      {
        label: projectTitle || t('characterStudio.breadcrumbs.project'),
        to: projectDashboardPath(projectId),
      },
      {label: t('characterStudio.breadcrumbs.characters'), to: buildCharactersUrl(projectId)},
    ];
    if (characterId) {
      items.push({
        label: character?.name || '…',
      });
      if (trailing && trailing !== newCharacterLabel) {
        // Make the character name clickable (back to its editor) once we have one more level beneath it.
        const lastIdx = items.length - 1;
        items[lastIdx] = {
          ...items[lastIdx],
          to: PathConstants.CHARACTER_STUDIO_EDITOR
            .replace(':projectId', String(projectId))
            .replace(':characterId', String(characterId)),
        };
        items.push({label: trailing});
      }
    } else if (trailing) {
      items.push({label: trailing});
    }
    return items;
  }, [projectId, projectTitle, characterId, character?.name, t, trailing, newCharacterLabel]);

  if (!projectId) {
    return (
      <>
        <DashboardHeader breadcrumbItems={breadcrumbItems} />
        <div style={{minHeight: '100vh', background: '#1b1d22', padding: 24}}>
          <Empty description={t('characterStudio.shell.noProject')} />
        </div>
      </>
    );
  }

  const shellClassName = [
    'character-studio-shell',
    sidebarCollapsed ? 'character-studio-shell--collapsed' : 'character-studio-shell--expanded',
    isEditorRoute ? 'character-studio-shell--editor' : 'character-studio-shell--page',
  ].join(' ');

  return (
    <>
      <DashboardHeader breadcrumbItems={breadcrumbItems} />
      <div className={shellClassName}>
        <CharacterTreeSidebar
          projectId={projectId}
          selectedCharacterId={characterId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onSelectCharacter={(id) => navigate(`/project/${projectId}/characters/${id}/edit`)}
          onCreateCharacter={(name, treeNodeId) => navigate(`/project/${projectId}/characters/create`, {state: {initialCharacterName: name, sourceTreeNodeId: treeNodeId}})}
          onDeletedCharacter={(id) => {
            if (id === characterId) {
              navigate(`/project/${projectId}/characters`, {replace: true});
            }
          }}
        />
        <main
          className={isEditorRoute ? 'character-studio-shell-main character-studio-shell-main--editor custom-scrollbar' : 'character-studio-shell-main'}
          style={{minWidth: 0, minHeight: 0, overflow: isEditorRoute ? 'hidden' : 'visible'}}
        >
          {children}
        </main>
      </div>
    </>
  );
}
