import {ArrowRightOutlined, CheckCircleOutlined, PictureOutlined, VideoCameraOutlined} from '@ant-design/icons';
import {Alert, Button, Checkbox, Input, Select} from 'antd';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import {getApiErrorEnvelope, getApiStatus} from '../../../api/errors';
import {getAuthGeneration} from '../../../api/http';
import PathConstants, {storyboardPath} from '../../../routes/pathConstant';
import {saveVideoMotion, selectVideoVersion} from '../api';
import {videoErrorMessage, videoModelReason} from '../messages';
import {isActiveVideoJob, videoShotKey} from '../types';
import type {VideoBlocker, VideoFrame, VideoScene, VideoSourceShot, VideoWorkspace} from '../types';
import {useVideoOptions} from '../useVideoOptions';
import {acknowledgeVideoRequest, submitVideoRequest, useVideoRequest} from '../useVideoRequest';

// Drafts survive navigation within this browser session, never a different login.
let draftGeneration = getAuthGeneration();
const motionDrafts = new Map<string, string>();

interface VideoShotWorkspaceProps {
  projectId: string;
  shot: VideoSourceShot;
  scene?: VideoScene;
  workspace: VideoWorkspace;
  onRefresh: () => void;
}

function FrameImage({frame, label, missing}: {frame: VideoFrame | null; label: string; missing: string}) {
  return <figure className="video-source-frame">
    <div>{frame?.imageUrl ? <img alt={label} src={frame.imageUrl} crossOrigin="anonymous" />
      : <span className="video-missing-frame"><PictureOutlined aria-hidden="true" />{missing}</span>}</div>
    <figcaption>{label}</figcaption>
  </figure>;
}

function Blockers({items}: {items: VideoBlocker[]}) {
  const {t} = useTranslation();
  return <ul className="video-blockers">{items.map((blocker, index) =>
    <li key={`${blocker.code}:${index}`}>{videoErrorMessage(blocker, t)}</li>)}</ul>;
}

export default function VideoShotWorkspace({projectId, shot, scene, workspace, onRefresh}: VideoShotWorkspaceProps) {
  const {t, i18n} = useTranslation();
  const authGeneration = useRef(getAuthGeneration());
  const draftKey = `${projectId}:${videoShotKey(shot)}`;
  if (draftGeneration !== getAuthGeneration()) {
    draftGeneration = getAuthGeneration();
    motionDrafts.clear();
  }
  const [motion, setMotion] = useState(() => motionDrafts.get(draftKey) ?? shot.motionPrompt);
  const [dirty, setDirty] = useState(() => motionDrafts.has(draftKey));
  const lastSavedMotion = useRef(shot.motionPrompt);
  const [modelId, setModelId] = useState<string>();
  const [viewedJobId, setViewedJobId] = useState<string | null>(null);
  const [tab, setTab] = useState<'video' | 'frames'>(shot.jobs.some((job) => job.status === 'completed') ? 'video' : 'frames');
  const [busy, setBusy] = useState<'create' | 'select' | 'save' | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [playbackError, setPlaybackError] = useState(false);
  const [playbackSource, setPlaybackSource] = useState<{id: string; url: string} | null>(null);
  const [unknownAcknowledged, setUnknownAcknowledged] = useState(false);
  const receipt = useVideoRequest(draftKey, authGeneration.current);
  const requestPending = receipt?.state === 'pending';
  const unconfirmedRequest = receipt?.state === 'uncertain';
  const submittedJob = receipt?.state === 'accepted' ? receipt.job : undefined;
  const previousReceipt = useRef<typeof receipt>(null);
  const source = workspace.generationSource;
  const canEdit = workspace.permissions.canEdit;
  const canRun = workspace.permissions.canRunGeneration;
  const camera = shot.inheritedCamera;
  const cameraDescription = [
    ['framing', 'framingValue'], ['azimuth', 'azimuth'],
    ['elevation', 'elevation'], ['distance', 'distanceValue'],
  ].flatMap(([field, key]) => {
    const value = camera?.[field];
    const translation = `storyboard.camera.${key}.${value}`;
    return typeof value === 'string' && i18n.exists(translation) ? [t(translation)] : [];
  });
  const input = shot.sourceRemoved ? null : {
    sceneId: shot.sceneId, sourceKind: shot.sourceKind, sourceShotId: shot.sourceShotId,
    motionPrompt: motion, ...(source === 'platform' && modelId ? {modelId} : {}),
  };
  const options = useVideoOptions(projectId, input, shot.fingerprint, source);
  const jobs = submittedJob && !shot.jobs.some((job) => job.id === submittedJob.id)
    ? [submittedJob, ...shot.jobs] : shot.jobs;
  const completedJobs = jobs.filter((job) => job.status === 'completed' && job.videoUrl);
  const viewedJob = completedJobs.find((job) => job.id === viewedJobId)
    ?? completedJobs.find((job) => job.id === shot.selectedJobId) ?? completedJobs[0];
  const activeJob = jobs.find(isActiveVideoJob);
  const latestJob = jobs[0];
  const outcomeUnknown = latestJob?.status === 'outcome_unknown';
  const staleSelected = jobs.find((job) => job.id === shot.selectedJobId)?.stale;
  const storyboardUrl = `${storyboardPath(projectId)}?sceneId=${encodeURIComponent(String(shot.sceneId))}`;
  const currentOptions = options.data?.generationSource === source ? options.data : null;
  const blocked = !canRun || Boolean(busy) || requestPending || Boolean(activeJob) || Boolean(shot.sourceRemoved)
    || (!unconfirmedRequest && (!shot.ready || !scene?.ready || !currentOptions?.canGenerate
      || !currentOptions.preflightToken || Boolean(outcomeUnknown && !unknownAcknowledged)));

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (receipt?.state === 'accepted' && receipt.job) {
      if (shot.jobs.some((job) => job.id === receipt.job?.id)) {
        acknowledgeVideoRequest(draftKey, authGeneration.current, receipt.job.id);
      } else if (previousReceipt.current !== receipt) onRefresh();
    } else if ((receipt?.state === 'uncertain' && previousReceipt.current !== receipt)
      || (previousReceipt.current?.state === 'pending' && !requestPending)) onRefresh();
    previousReceipt.current = receipt;
  }, [receipt, shot.jobs, draftKey, onRefresh, requestPending]);
  useEffect(() => {
    if (lastSavedMotion.current !== shot.motionPrompt && !dirty) setMotion(shot.motionPrompt);
    lastSavedMotion.current = shot.motionPrompt;
  }, [dirty, shot.motionPrompt]);
  useEffect(() => {
    if (!viewedJob?.videoUrl) return;
    if (viewedJob.id !== playbackSource?.id || (playbackError && viewedJob.videoUrl !== playbackSource.url)) {
      setPlaybackSource({id: viewedJob.id, url: viewedJob.videoUrl});
      setPlaybackError(false);
    }
  }, [viewedJob?.id, viewedJob?.videoUrl, playbackSource, playbackError]);
  useEffect(() => setUnknownAcknowledged(false), [latestJob?.id]);

  const stillCurrent = () => mountedRef.current && getAuthGeneration() === authGeneration.current;
  const mutate = async (kind: 'create' | 'select' | 'save', action: () => Promise<void>) => {
    if (busyRef.current || !stillCurrent()) return;
    busyRef.current = true;
    setBusy(kind);
    setError(null);
    setNotice('');
    try {
      await action();
    } catch (failure: unknown) {
      if (!stillCurrent()) return;
      const status = getApiStatus(failure);
      const failureEnvelope = getApiErrorEnvelope(failure);
      setError((status !== 409 || failureEnvelope?.error.code === 'VIDEO_GENERATION_ACTIVE') && status !== null && status < 500 && failureEnvelope
        ? videoErrorMessage({code: failureEnvelope.error.code, detail: failureEnvelope.error.message}, t)
        : t(status === 409 ? 'videoWorkspace.conflict' : kind === 'create'
        ? status === null || status >= 500 ? 'videoWorkspace.requestUnconfirmed' : 'videoWorkspace.generationError'
        : 'videoWorkspace.mutationError'));
      if (status === 409) options.refresh();
      onRefresh();
    } finally {
      busyRef.current = false;
      if (stillCurrent()) setBusy(null);
    }
  };
  const create = () => {
    const token = unconfirmedRequest ? receipt.token : currentOptions?.preflightToken;
    if (blocked || !token) return;
    void mutate('create', async () => {
      await submitVideoRequest(projectId, draftKey, token, authGeneration.current);
      if (!stillCurrent()) return;
      motionDrafts.delete(draftKey);
      setDirty(false);
      setNotice(t('videoWorkspace.jobAccepted'));
      onRefresh();
    });
  };
  const selectVersion = () => {
    const {videoShotId, videoShotVersion} = shot;
    if (!viewedJob || !canEdit || videoShotId == null || videoShotVersion == null) return;
    void mutate('select', async () => {
      await selectVideoVersion(projectId, videoShotId, viewedJob.id, videoShotVersion);
      if (!stillCurrent()) return;
      setNotice(t('videoWorkspace.selectedNotice'));
      onRefresh();
    });
  };
  const saveMotion = () => {
    const {videoShotId, videoShotVersion} = shot;
    if (!canEdit || videoShotId == null || videoShotVersion == null) return;
    void mutate('save', async () => {
      await saveVideoMotion(projectId, videoShotId, motion, videoShotVersion);
      if (!stillCurrent()) return;
      motionDrafts.delete(draftKey);
      setDirty(false);
      setNotice(t('videoWorkspace.motionSaved'));
      onRefresh();
    });
  };

  return <>
    <section className="video-stage" aria-labelledby="video-shot-title">
      <div className="video-stage-heading">
        <div><h2 id="video-shot-title">{shot.title || t('videoWorkspace.plan', {number: shot.order})}</h2>
          <p>{scene?.title} · {t('videoWorkspace.plan', {number: shot.order})}</p></div>
        <span className="video-meta-pill">{shot.aspectRatio}</span>
      </div>
      {shot.sourceRemoved && <Alert type="warning" showIcon message={t('videoWorkspace.sourceRemoved')} />}
      {staleSelected && (!viewedJob || !viewedJob.stale) && <Alert type="warning" showIcon message={t('videoWorkspace.stale')} />}
      <div className="video-view-toolbar">
        <div className="video-view-switch" aria-label={t('videoWorkspace.conditions')}>
          <button type="button" aria-pressed={tab === 'video'} onClick={() => setTab('video')}>{t('videoWorkspace.result')}</button>
          <button type="button" aria-pressed={tab === 'frames'} onClick={() => setTab('frames')}>{t('videoWorkspace.conditions')}</button>
        </div>
        {viewedJob && tab === 'video' && <span className="video-muted">{viewedJob.modelLabel}</span>}
      </div>
      {tab === 'video' ? <>
        {viewedJob?.stale && <Alert type="warning" showIcon message={t('videoWorkspace.stale')} />}
        <div className="video-player">
          {viewedJob?.videoUrl ? <video key={viewedJob.id} controls preload="metadata" playsInline crossOrigin="anonymous"
            src={playbackSource?.id === viewedJob.id ? playbackSource.url : viewedJob.videoUrl}
            aria-label={t('videoWorkspace.player', {title: shot.title})}
            onError={() => setPlaybackError(true)}>
            {t('videoWorkspace.unsupportedVideo')}
          </video> : <div className="video-player-empty">
            <VideoCameraOutlined aria-hidden="true" /><h3>{t('videoWorkspace.noVersions')}</h3>
            <p>{t('videoWorkspace.noVersionsHelp')}</p>
          </div>}
        </div>
        {playbackError && <Alert type="warning" message={t('videoWorkspace.playbackError')}
          action={<Button onClick={onRefresh}>{t('videoWorkspace.refreshVideo')}</Button>} />}
      </> : <div className="video-frame-preview">
        {shot.startFrame?.imageUrl ? <img src={shot.startFrame.imageUrl} alt={t('videoWorkspace.startFrame')} crossOrigin="anonymous" />
          : <div className="video-player-empty"><PictureOutlined aria-hidden="true" />{t('videoWorkspace.missingStart')}</div>}
      </div>}
      {activeJob && <Alert className="video-job-notice" type="info" showIcon
        message={<span role="status">{t(`videoWorkspace.${activeJob.stage}`)}</span>}
        description={t('videoWorkspace.jobContinues')} />}
      {latestJob?.status === 'failed' && <Alert className="video-job-notice" type="error" showIcon
        message={t('videoWorkspace.failed')} description={latestJob.error ? videoErrorMessage(latestJob.error, t) : undefined} />}
      {outcomeUnknown && <Alert className="video-job-notice" type="warning" showIcon
        message={t('videoWorkspace.outcome_unknown')} description={t('videoWorkspace.unknownHelp')} />}
      <section className="video-versions" aria-labelledby="video-versions-title">
        <div className="video-section-heading"><h3 id="video-versions-title">{t('videoWorkspace.versions')}</h3>
          <span className="video-muted">{completedJobs.length}</span></div>
        <div className="video-version-list">{completedJobs.map((job, index) => <button type="button" key={job.id}
          className="video-version-card" aria-pressed={viewedJob?.id === job.id}
          onClick={() => {setViewedJobId(job.id); setTab('video');}}>
          <span className="video-version-art"><VideoCameraOutlined aria-hidden="true" />
            {shot.selectedJobId === job.id && <CheckCircleOutlined className="video-version-check" aria-hidden="true" />}</span>
          <strong>{t('videoWorkspace.version', {number: completedJobs.length - index})}</strong>
          <span>{t('videoWorkspace.seconds', {count: job.effectiveDurationSeconds})} · {job.resolution}</span>
          {shot.selectedJobId === job.id && <small>{t('videoWorkspace.selected')}</small>}
          {job.stale && <small>{t('videoWorkspace.needsUpdate')}</small>}
        </button>)}</div>
        {!completedJobs.length && <p className="video-muted">{t('videoWorkspace.noVersions')}</p>}
        {viewedJob && <div className="video-version-actions">
          <p className="video-muted">{t('videoWorkspace.viewingOnly')}</p>
          {canEdit && <Button disabled={Boolean(busy) || shot.selectedJobId === viewedJob.id}
            loading={busy === 'select'} onClick={selectVersion}
            icon={shot.selectedJobId === viewedJob.id ? <CheckCircleOutlined /> : undefined}>
            {t(shot.selectedJobId === viewedJob.id ? 'videoWorkspace.selected' : 'videoWorkspace.chooseVersion')}
          </Button>}
        </div>}
        {viewedJob && <details className="video-version-conditions"><summary>{t('videoWorkspace.savedConditions')}</summary>
          <dl><dt>{t('videoWorkspace.model')}</dt><dd>{viewedJob.modelLabel}</dd>
            <dt>{t('videoWorkspace.duration')}</dt><dd>{t('videoWorkspace.seconds', {count: viewedJob.effectiveDurationSeconds})}</dd>
            <dt>{t('videoWorkspace.created')}</dt><dd>{new Date(viewedJob.createdAt).toLocaleString(i18n.language)}</dd>
            <dt>{t('videoWorkspace.motion')}</dt><dd>{viewedJob.motionPrompt || '—'}</dd></dl>
        </details>}
      </section>
      <section className="video-source-section" aria-labelledby="video-frames-title">
        <div className="video-section-heading"><h3 id="video-frames-title">{t('videoWorkspace.conditions')}</h3>
          <Link className="video-inline-link" to={storyboardUrl}>{t('videoWorkspace.openStoryboard')}</Link></div>
        <div className="video-source-frames">
          <FrameImage frame={shot.startFrame} label={t('videoWorkspace.startFrame')} missing={t('videoWorkspace.missingStart')} />
          <ArrowRightOutlined aria-hidden="true" />
          <FrameImage frame={shot.endFrame} label={t('videoWorkspace.endFrame')} missing={t('videoWorkspace.optionalEnd')} />
        </div>
        <p className="video-muted">{t('videoWorkspace.intermediate')}</p>
      </section>
    </section>
    <aside className="video-inspector" aria-labelledby="video-inspector-title">
      <header><h2 id="video-inspector-title">{t('videoWorkspace.inputsTitle')}</h2></header>
      <div className="video-inspector-body">
        <section className="video-condition-group"><h3>{t('videoWorkspace.inherited')}</h3>
          <p className="video-inherited-text">{shot.description || t('videoWorkspace.emptyText')}</p></section>
        {cameraDescription.length > 0 && <section className="video-condition-group">
          <h3>{t('videoWorkspace.inheritedCamera')}</h3>
          <p className="video-muted">{cameraDescription.join(' · ')}</p>
        </section>}
        <section className="video-condition-group"><label htmlFor="video-motion">{t('videoWorkspace.motion')}</label>
          <Input.TextArea id="video-motion" autoSize={{minRows: 4, maxRows: 12}} value={motion}
            maxLength={6000} disabled={!canEdit || Boolean(shot.sourceRemoved) || Boolean(busy) || requestPending || unconfirmedRequest}
            placeholder={t('videoWorkspace.motionPlaceholder')} aria-describedby="video-motion-help"
            onChange={(event) => {
              setMotion(event.target.value);
              setDirty(true);
              motionDrafts.set(draftKey, event.target.value);
            }} />
          <p className="video-muted" id="video-motion-help">{t('videoWorkspace.motionHint')}</p>
          {canEdit && !shot.sourceRemoved && (shot.videoShotId == null
            ? <p className="video-muted">{t('videoWorkspace.draftHint')}</p>
            : <Button onClick={saveMotion} disabled={!dirty || Boolean(busy) || requestPending || unconfirmedRequest} loading={busy === 'save'}>
              {t('videoWorkspace.saveMotion')}</Button>)}
        </section>
        <details className="video-reference-context"><summary>{t('videoWorkspace.referenceContext')}</summary>
          {shot.references?.length ? <ul>{shot.references.map((reference) => <li key={`${reference.kind}:${reference.id}`}>
            {reference.imageUrl && <img src={reference.imageUrl} alt="" loading="lazy" crossOrigin="anonymous" />}
            <span>{reference.title}<small>{t(reference.usage === 'sent' ? 'videoWorkspace.referenceSent' : 'videoWorkspace.contextOnly')}</small></span>
          </li>)}</ul> : <p className="video-muted">{t('videoWorkspace.noReferences')}</p>}
          <p className="video-muted">{t('videoWorkspace.referencesHint')}</p>
        </details>
        {!shot.sourceRemoved && <div className="video-generation-controls">
          {source === 'platform' && <div className="video-condition-group">
            <label htmlFor="video-model">{t('videoWorkspace.craftModel')}</label>
            <Select id="video-model" value={modelId ?? currentOptions?.selectedModelId ?? undefined}
              placeholder={t('videoWorkspace.chooseModel')} loading={options.loading}
              disabled={Boolean(busy) || requestPending || !canRun || unconfirmedRequest} onChange={setModelId}
              notFoundContent={t('videoWorkspace.noModels')} optionLabelProp="label"
              optionRender={(option) => <div className="video-model-option">{option.data.label}
                {option.data.unavailableReason && <small>{option.data.unavailableReason}</small>}</div>}
              options={(currentOptions?.models ?? []).map((model) => ({value: model.id,
                label: model.label, disabled: !model.compatible,
                title: videoModelReason(model, t) || model.label,
                unavailableReason: videoModelReason(model, t),
              }))} />
          </div>}
          <dl className="video-generation-facts">
            <div><dt>{t('videoWorkspace.duration')}</dt><dd>{currentOptions?.effectiveDurationSeconds != null
              ? t('videoWorkspace.seconds', {count: currentOptions.effectiveDurationSeconds}) : '—'}</dd></div>
            <div><dt>{t('videoWorkspace.originalDuration', {count: shot.durationSeconds})}</dt><dd>{shot.aspectRatio}</dd></div>
          </dl>
          {currentOptions?.durationAdjusted && <p className="video-duration-adjustment">{t('videoWorkspace.adjustedDuration', {
            actual: currentOptions.effectiveDurationSeconds, requested: currentOptions.requestedDurationSeconds,
          })}</p>}
          {options.loading && <p className="video-muted" role="status">{t('videoWorkspace.preflight')}</p>}
          {options.failed && <Alert type="error" message={t('videoWorkspace.preflightError')}
            action={<Button onClick={options.refresh}>{t('videoWorkspace.retry')}</Button>} />}
          {currentOptions?.blockers.length ? <Blockers items={currentOptions.blockers} />
            : !shot.ready || !scene?.ready ? <Blockers items={scene?.blockers.length ? scene.blockers : shot.blockers} /> : null}
          {outcomeUnknown && canRun && <Checkbox checked={unknownAcknowledged}
            onChange={(event) => setUnknownAcknowledged(event.target.checked)}>{t('videoWorkspace.unknownAcknowledge')}</Checkbox>}
          {canRun && <Button type="primary" className="video-create-button" block disabled={blocked}
            aria-label={t(unconfirmedRequest ? 'videoWorkspace.checkRequest' : 'videoWorkspace.create')}
            loading={busy === 'create' || requestPending} onClick={create} icon={<VideoCameraOutlined aria-hidden="true" />}>
            {t(unconfirmedRequest ? 'videoWorkspace.checkRequest' : 'videoWorkspace.create')}</Button>}
          <p className="video-muted">{t(source === 'personal' ? 'videoWorkspace.personalPayment' : 'videoWorkspace.platformPayment')}</p>
          <Link className="video-inline-link" to={PathConstants.PROFILE_SETTINGS}>{t('videoWorkspace.profileSettings')}</Link>
        </div>}
        {(error || unconfirmedRequest) && <Alert type="error" showIcon message={error || t('videoWorkspace.requestUnconfirmed')} />}
        <p className="video-operation-status" role="status">{notice}</p>
      </div>
    </aside>
  </>;
}
