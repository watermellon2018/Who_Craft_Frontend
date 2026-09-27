import {BookOutlined, FileTextOutlined, PictureOutlined, TeamOutlined, VideoCameraOutlined} from '@ant-design/icons';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import PathConstants, {referenceLibraryPath, storyboardPath} from '../../../routes/pathConstant';

export default function VideoProjectNavigation({projectId, sceneId}: {projectId: string; sceneId?: number}) {
  const {t} = useTranslation();
  const sceneQuery = sceneId == null ? '' : `?sceneId=${encodeURIComponent(String(sceneId))}`;
  const links = [
    {label: 'characters', icon: <TeamOutlined />, to: PathConstants.CHARACTER_STUDIO.replace(':projectId', projectId)},
    {label: 'references', icon: <PictureOutlined />, to: referenceLibraryPath(projectId)},
    {label: 'script', icon: <FileTextOutlined />, to: `${PathConstants.SCRIPT_PAGE.replace(':projectId', projectId)}${sceneQuery}`},
    {label: 'storyboard', icon: <BookOutlined />, to: `${storyboardPath(projectId)}${sceneQuery}`},
  ];
  return <nav className="video-workspace-steps" aria-label={t('videoWorkspace.steps')}>
    {links.map((link) => <Link key={link.label} to={link.to}>
      <span aria-hidden="true">{link.icon}</span>{t(`videoWorkspace.${link.label}`)}
    </Link>)}
    <span aria-current="page"><VideoCameraOutlined aria-hidden="true" />{t('videoWorkspace.video')}</span>
  </nav>;
}
