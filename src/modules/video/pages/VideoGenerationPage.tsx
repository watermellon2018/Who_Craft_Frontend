import {ArrowLeftOutlined, VideoCameraOutlined} from '@ant-design/icons';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate, useParams} from 'react-router-dom';

import DashboardHeader from '../../profile/components/DashboardHeader';
import {
  projectDashboardPath,
  videoPreparationPath,
} from '../../../routes/pathConstant';
import {useVideoPreparation} from '../useVideoPreparation';
import '../video.css';
import VideoPreparationState from './VideoPreparationState';

export default function VideoGenerationPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {projectId = ''} = useParams<{projectId: string}>();
  const {data, error, loading, retry} = useVideoPreparation(projectId);

  useEffect(() => {
    if (data && !data.ready) {
      navigate(videoPreparationPath(projectId), {replace: true});
    }
  }, [data, navigate, projectId]);

  if (loading || error || !data || !data.ready) {
    return (
      <div className="video-preparation-page">
        <DashboardHeader hideSubnav />
        <VideoPreparationState error={loading || (data && !data.ready) ? null : error ?? 'unknown'} onRetry={retry} />
      </div>
    );
  }

  if (!data.project.permissions.canRunGeneration) {
    return (
      <div className="video-preparation-page">
        <DashboardHeader hideSubnav />
        <VideoPreparationState error="forbidden" />
      </div>
    );
  }

  return (
    <div className="video-preparation-page">
      <DashboardHeader hideSubnav />
      <main className="video-generation-main">
        <section className="video-generation-card">
          <VideoCameraOutlined aria-hidden="true" style={{color: '#f5a623', fontSize: 48}} />
          <h1>{t('videoGeneration.title', {defaultValue: 'Создание видео'})}</h1>
          <p>
            {t('videoGeneration.placeholder', {
              defaultValue: 'Проект готов. Рабочая область генерации видео будет подключена здесь отдельным этапом.',
            })}
          </p>
          <Link className="video-preparation-back" to={videoPreparationPath(projectId)}>
            <ArrowLeftOutlined aria-hidden="true" />
            {t('videoGeneration.openPreparation', {defaultValue: 'Проверить подготовку'})}
          </Link>
          <Link className="video-preparation-action" to={projectDashboardPath(projectId)}>
            {t('videoGeneration.backToProject', {defaultValue: 'К проекту'})}
          </Link>
        </section>
      </main>
    </div>
  );
}
