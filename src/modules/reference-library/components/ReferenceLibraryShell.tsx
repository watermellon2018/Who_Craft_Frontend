import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {fetch_project} from '../../../api/projects/properties/project';
import DashboardHeader from '../../profile/components/DashboardHeader';
import type {BreadcrumbItem} from '../../profile/components/DashboardHeader';
import PathConstants, {projectDashboardPath, referenceLibraryPath} from '../../../routes/pathConstant';

const projectTitleCache = new Map<string, string>();

interface ReferenceLibraryShellProps {
  children: React.ReactNode;
  currentTitle?: string;
  projectId: string;
}

export default function ReferenceLibraryShell({
  children,
  currentTitle,
  projectId,
}: ReferenceLibraryShellProps) {
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

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      {label: t('referenceLibrary.breadcrumbs.allProjects'), to: PathConstants.PROJECTS},
      {
        label: projectTitle || t('referenceLibrary.breadcrumbs.project'),
        to: projectDashboardPath(projectId),
      },
      {
        label: t('referenceLibrary.title'),
        to: referenceLibraryPath(projectId),
      },
    ];
    if (currentTitle) items.push({label: currentTitle});
    return items;
  }, [currentTitle, projectId, projectTitle, t]);

  return (
    <>
      <DashboardHeader breadcrumbItems={breadcrumbs} />
      <div className="reference-library-shell">{children}</div>
    </>
  );
}
