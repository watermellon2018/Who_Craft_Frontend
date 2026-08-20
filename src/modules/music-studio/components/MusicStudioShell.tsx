import React, {useEffect, useMemo, useState} from 'react';
import {Button} from 'antd';
import {MenuFoldOutlined, MenuUnfoldOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import {fetch_project} from '../../../api/projects/properties/project';
import PathConstants, {
  musicStudioPath,
  projectDashboardPath,
  soundEffectsPath,
} from '../../../routes/pathConstant';
import DashboardHeader from '../../profile/components/DashboardHeader';
import type {BreadcrumbItem} from '../../profile/components/DashboardHeader';

interface MusicStudioShellProps {
  center: React.ReactNode;
  inspector: React.ReactNode;
  library: React.ReactNode;
  projectId: string;
  workspace?: 'music' | 'sound-effects';
}

const projectTitleCache = new Map<string, string>();

export default function MusicStudioShell({
  center,
  inspector,
  library,
  projectId,
  workspace = 'music',
}: MusicStudioShellProps) {
  const {t} = useTranslation();
  const [projectTitle, setProjectTitle] = useState(projectTitleCache.get(projectId) ?? '');
  const [libraryOpen, setLibraryOpen] = useState(true);

  useEffect(() => {
    const cached = projectTitleCache.get(projectId);
    if (cached) {
      setProjectTitle(cached);
      return;
    }
    let cancelled = false;
    fetch_project(projectId)
      .then((project) => {
        if (cancelled) return;
        const title = project.title || '';
        if (title) {
          projectTitleCache.set(projectId, title);
          setProjectTitle(title);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => [
    {label: t('musicStudio.breadcrumbs.allProjects'), to: PathConstants.PROJECTS},
    {
      label: projectTitle || t('musicStudio.breadcrumbs.project'),
      to: projectDashboardPath(projectId),
    },
    {
      label: workspace === 'music'
        ? t('musicStudio.breadcrumbs.music')
        : t('soundEffects.breadcrumb'),
      to: workspace === 'music' ? musicStudioPath(projectId) : soundEffectsPath(projectId),
    },
  ], [projectId, projectTitle, t, workspace]);
  const libraryToggleLabel = libraryOpen
    ? t(workspace === 'music' ? 'musicStudio.library.hide' : 'soundEffects.library.hide')
    : t(workspace === 'music' ? 'musicStudio.library.show' : 'soundEffects.library.show');

  return (
    <>
      <DashboardHeader breadcrumbItems={breadcrumbs} />
      <nav className="music-workspace-nav" aria-label={t('soundEffects.navigation.label')}>
        <Link aria-current={workspace === 'music' ? 'page' : undefined} to={musicStudioPath(projectId)}>
          {t('soundEffects.navigation.music')}
        </Link>
        <Link
          aria-current={workspace === 'sound-effects' ? 'page' : undefined}
          to={soundEffectsPath(projectId)}
        >
          {t('soundEffects.navigation.effects')}
        </Link>
      </nav>
      <div className={libraryOpen
        ? 'music-studio-shell'
        : 'music-studio-shell music-studio-shell--library-closed'}>
        <div className={libraryOpen
          ? 'music-studio-library-region music-studio-library-region--open'
          : 'music-studio-library-region'}>
          <div
            aria-hidden={!libraryOpen}
            className="music-studio-library-content"
            id="music-studio-library-sidebar"
          >
            {library}
          </div>
          <Button
            block
            aria-controls="music-studio-library-sidebar"
            aria-label={libraryToggleLabel}
            className="music-studio-library-trigger"
            icon={libraryOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            aria-expanded={libraryOpen}
            title={libraryToggleLabel}
            type="text"
            onClick={() => setLibraryOpen((open) => !open)}
          >
            {libraryOpen ? libraryToggleLabel : null}
          </Button>
        </div>
        <main className="music-studio-main">{center}</main>
        <aside className="music-studio-inspector" aria-label={workspace === 'music'
          ? t('musicStudio.scene.context')
          : t('soundEffects.summary.title')}>
          {inspector}
        </aside>
      </div>
    </>
  );
}
