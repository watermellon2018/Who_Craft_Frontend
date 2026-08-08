import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {fetch_project} from '../../../api/projects/properties/project';
import PathConstants, {musicStudioPath, projectDashboardPath} from '../../../routes/pathConstant';
import DashboardHeader from '../../profile/components/DashboardHeader';
import type {BreadcrumbItem} from '../../profile/components/DashboardHeader';

interface MusicStudioShellProps {
  center: React.ReactNode;
  inspector: React.ReactNode;
  library: React.ReactNode;
  projectId: string;
}

const projectTitleCache = new Map<string, string>();

export default function MusicStudioShell({
  center,
  inspector,
  library,
  projectId,
}: MusicStudioShellProps) {
  const {t} = useTranslation();
  const [projectTitle, setProjectTitle] = useState(projectTitleCache.get(projectId) ?? '');

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
    {label: t('musicStudio.breadcrumbs.music'), to: musicStudioPath(projectId)},
  ], [projectId, projectTitle, t]);

  return (
    <>
      <DashboardHeader breadcrumbItems={breadcrumbs} />
      <div className="music-studio-shell">
        {library}
        <main className="music-studio-main">{center}</main>
        <aside className="music-studio-inspector" aria-label={t('musicStudio.scene.context')}>
          {inspector}
        </aside>
      </div>
    </>
  );
}
