import {ArrowLeftOutlined, PictureOutlined, VideoCameraOutlined} from '@ant-design/icons';
import {Alert, Button, Spin} from 'antd';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useParams, useSearchParams} from 'react-router-dom';

import {projectDashboardPath, storyboardPath} from '../../../routes/pathConstant';
import DashboardHeader from '../../profile/components/DashboardHeader';
import VideoProjectNavigation from '../components/VideoProjectNavigation';
import VideoShotWorkspace from '../components/VideoShotWorkspace';
import {isActiveVideoJob, videoShotKey} from '../types';
import type {VideoSourceShot} from '../types';
import {useVideoWorkspace} from '../useVideoWorkspace';
import '../workspace.css';

export default function VideoGenerationPage() {
  const {t} = useTranslation();
  const {projectId = ''} = useParams<{projectId: string}>();
  const [search, setSearch] = useSearchParams();
  const workspace = useVideoWorkspace(projectId);
  const allShots = workspace.data
    ? [...workspace.data.scenes.flatMap((scene) => scene.shots), ...workspace.data.archivedShots] : [];
  const requestedScene = search.get('sceneId');
  const requestedShot = search.get('shotId');
  const requestedKind = search.get('sourceKind');
  const requestedSceneExists = workspace.data?.scenes.some((scene) => String(scene.id) === requestedScene);
  const selectedShot = allShots.find((shot) => String(shot.sceneId) === requestedScene
    && shot.sourceShotId === requestedShot && (!requestedKind || shot.sourceKind === requestedKind))
    ?? allShots.find((shot) => String(shot.sceneId) === requestedScene)
    ?? (!requestedSceneExists ? allShots[0] : undefined);
  const selectedScene = selectedShot
    ? workspace.data?.scenes.find((scene) => scene.id === selectedShot.sceneId)
    : workspace.data?.scenes.find((scene) => String(scene.id) === requestedScene) ?? workspace.data?.scenes[0];
  const selectedSceneId = selectedShot?.sceneId ?? selectedScene?.id;

  useEffect(() => {
    if (!selectedShot || (requestedScene === String(selectedShot.sceneId)
      && requestedShot === selectedShot.sourceShotId && requestedKind === selectedShot.sourceKind)) return;
    setSearch({sceneId: String(selectedShot.sceneId), shotId: selectedShot.sourceShotId, sourceKind: selectedShot.sourceKind}, {replace: true});
  }, [selectedShot, requestedScene, requestedShot, requestedKind, setSearch]);

  const selectShot = (shot: VideoSourceShot) => {
    setSearch({sceneId: String(shot.sceneId), shotId: shot.sourceShotId, sourceKind: shot.sourceKind});
  };
  const renderShot = (shot: VideoSourceShot) => {
    const selectedJob = shot.jobs.find((job) => job.id === shot.selectedJobId);
    const activeJob = shot.jobs.find(isActiveVideoJob);
    const status = activeJob ? activeJob.stage : selectedJob?.stale ? 'needsUpdate'
      : selectedJob ? 'selected' : shot.ready ? 'ready' : 'sceneBlocked';
    return <button className="video-shot-card" key={videoShotKey(shot)} type="button"
      aria-pressed={Boolean(selectedShot && videoShotKey(selectedShot) === videoShotKey(shot))}
      onClick={() => selectShot(shot)}>
      <span className="video-shot-thumbnail">
        {shot.startFrame?.imageUrl ? <img src={shot.startFrame.imageUrl} alt="" loading="lazy" crossOrigin="anonymous" />
          : <PictureOutlined aria-hidden="true" />}
        <span className="video-shot-duration">{t('videoWorkspace.seconds', {count: shot.durationSeconds})}</span>
      </span>
      <span className="video-shot-name">{t('videoWorkspace.plan', {number: shot.order})} · {shot.title}</span>
      <span className="video-shot-status">{t(`videoWorkspace.${status}`)}</span>
    </button>;
  };

  return <div className="video-workspace-page">
    <a className="video-skip-link" href="#video-workspace-main">{t('videoWorkspace.skip')}</a>
    <DashboardHeader hideSubnav />
    <main className="video-workspace-shell" id="video-workspace-main">
      <header className="video-workspace-heading">
        <h1>{t('videoWorkspace.title')}</h1>
        <Link to={projectDashboardPath(projectId)} className="video-project-back">
          <ArrowLeftOutlined aria-hidden="true" />{workspace.data?.projectTitle || t('videoWorkspace.project')}
        </Link>
      </header>
      <VideoProjectNavigation projectId={projectId} sceneId={selectedSceneId} />
      {workspace.loading && <div className="video-workspace-empty" aria-busy="true">
        <Spin /><p role="status">{t('videoWorkspace.loading')}</p>
      </div>}
      {!workspace.loading && workspace.error && <div className="video-workspace-empty">
        <Alert type="error" showIcon message={t(workspace.error === 'unknown'
          ? 'videoWorkspace.loadError' : `videoWorkspace.${workspace.error}`)}
        action={workspace.error === 'unknown' ? <Button onClick={workspace.retry}>{t('videoWorkspace.retry')}</Button> : undefined} />
      </div>}
      {workspace.data && <>
        {workspace.refreshError && <Alert className="video-workspace-notice" type="warning" showIcon
          message={t('videoWorkspace.refreshError')}
          action={<Button onClick={workspace.retry}>{t('videoWorkspace.retry')}</Button>} />}
        {!workspace.data.permissions.canEdit && <Alert className="video-workspace-notice" type="info" showIcon message={t('videoWorkspace.readOnly')} />}
        <div className="video-workspace-grid">
          <aside className="video-shot-navigation" aria-label={t('videoWorkspace.scenes')}>
            <h2>{t('videoWorkspace.scenes')}</h2>
            {workspace.data.scenes.map((scene) => <section key={scene.id} className="video-scene-group">
              <button type="button" className="video-scene-heading" onClick={() => {
                if (scene.shots[0]) selectShot(scene.shots[0]);
                else setSearch({sceneId: String(scene.id)});
              }} aria-pressed={selectedSceneId === scene.id}>
                <span>{t('videoWorkspace.scene', {number: scene.order})} · {scene.title}</span>
                <small>{t(scene.ready ? 'videoWorkspace.sceneReady' : 'videoWorkspace.sceneBlocked')}</small>
              </button>
              <div className="video-shot-list">{scene.shots.map(renderShot)}</div>
            </section>)}
            {workspace.data.archivedShots.length > 0 && <section className="video-scene-group">
              <h3>{t('videoWorkspace.archived')}</h3>
              <div className="video-shot-list">{workspace.data.archivedShots.map(renderShot)}</div>
            </section>}
          </aside>
          {selectedShot ? <VideoShotWorkspace key={`${projectId}:${videoShotKey(selectedShot)}`}
            projectId={projectId} shot={selectedShot} scene={selectedScene}
            workspace={workspace.data} onRefresh={workspace.retry} />
            : <section className="video-workspace-empty video-workspace-empty--wide">
              <VideoCameraOutlined aria-hidden="true" />
              <h2>{t(selectedScene ? 'videoWorkspace.noShots' : 'videoWorkspace.noScenes')}</h2>
              <p>{t(selectedScene ? 'videoWorkspace.noShotsHelp' : 'videoWorkspace.noScenesHelp')}</p>
              <Link className="video-inline-link" to={`${storyboardPath(projectId)}${selectedSceneId == null ? ''
                : `?sceneId=${encodeURIComponent(String(selectedSceneId))}`}`}>{t('videoWorkspace.openStoryboard')}</Link>
            </section>}
        </div>
      </>}
    </main>
  </div>;
}
