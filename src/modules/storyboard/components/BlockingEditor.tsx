import {CommentOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, FullscreenOutlined, PlusOutlined, RedoOutlined, ReloadOutlined, UndoOutlined} from '@ant-design/icons';
import {Alert, Button, Drawer, Empty, InputNumber, message, Progress, Segmented, Select, Spin, Tooltip} from 'antd';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {v4 as uuidv4} from 'uuid';

import {getApiErrorCode} from '../../../api/errors';
import {getAuthGeneration} from '../../../api/http';
import {safeImageUrl} from '../../../utils/safeUrl';
import {CANVAS_MARKER_LIMIT, CANVAS_OBJECT_LIMIT, canvasId, cloneCanvas, createCanvas, createCanvasObject, entityLink, normalizeCanvas} from '../canvasModel';
import type {CanvasPoint, CanvasPrimitive, StoryboardCanvasDocument} from '../canvasModel';
import {exportCanvasPng} from '../canvasExport';
import {savedEditorSceneRevision} from '../editorDrafts';
import {calculateEditorFrameProgress} from '../editorFrameProgress';
import type {EditorFrameJob, EditorFrameOptions, EditorFrameRequest} from '../editorFrameJobs';
import {formatElapsedTime} from '../generationTiming';
import {sortKeyframes} from '../model';
import type {StoryboardSceneEntity} from '../model';
import type {StoryboardFrontendService} from '../storyboardService';
import type {useStoryboardWorkspace} from '../useStoryboardWorkspace';
import BlockingArtwork from './BlockingArtwork';
import BlockingCanvas from './BlockingCanvas';
import type {BlockingCanvasTool} from './BlockingCanvas';
import BlockingInspector from './BlockingInspector';
import BlockingPalette from './BlockingPalette';
import ShotSourceDetails from './ShotSourceDetails';
import './blockingEditor.css';

interface Props {
  workspace: ReturnType<typeof useStoryboardWorkspace>;
  projectId: string;
  service: StoryboardFrontendService;
  onAddShot(): void;
  onLegacyGenerate(): void;
}

type FrameView = 'schema' | 'image';

function FrameGenerationProgress({job}: {job: EditorFrameJob}) {
  const {t} = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [job.jobId]);
  const progress = calculateEditorFrameProgress(job, now);
  const timing = progress.queued
    ? t('storyboard.canvas.generationQueuedEstimate', {time: formatElapsedTime(progress.remainingSeconds)})
    : progress.exceededEstimate
      ? t('storyboard.ai.timing.longer')
      : t('storyboard.ai.timing.remaining', {time: formatElapsedTime(progress.remainingSeconds)});
  return <div className="blocking-editor__generation-progress" role="status"
    aria-label={t('storyboard.canvas.generationProgress')}>
    <strong>{t('storyboard.canvas.generationProgress')}</strong>
    <Progress percent={progress.percent} status="active" strokeColor="#ffb000" />
    <span aria-live="off">{timing}</span>
    <small>{t('storyboard.ai.timing.hint')}</small>
  </div>;
}

export default function BlockingEditor({workspace, projectId, service, onAddShot, onLegacyGenerate}: Props) {
  const {t} = useTranslation();
  const {selectedScene: scene, selectedShot: shot, selectedKeyframe: frame} = workspace;
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [tool, setTool] = useState<BlockingCanvasTool>('select');
  const [notesOpenRequest, setNotesOpenRequest] = useState(0);
  const [overlays, setOverlays] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [view, setView] = useState<FrameView>(() => frame?.imageUrl ? 'image' : 'schema');
  const [imageError, setImageError] = useState(false);
  const imageRetry = useRef(false);
  const [library, setLibrary] = useState<StoryboardSceneEntity[]>([]);
  const [libraryError, setLibraryError] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryReload, setLibraryReload] = useState(0);
  const [jobs, setJobs] = useState<EditorFrameJob[]>([]);
  const [jobsError, setJobsError] = useState(false);
  const [jobsReload, setJobsReload] = useState(0);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [options, setOptions] = useState<EditorFrameOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [model, setModel] = useState<string | undefined>();
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [, updateHistory] = useState(0);
  const history = useRef<{past: StoryboardCanvasDocument[]; future: StoryboardCanvasDocument[]}>({past: [], future: []});
  const frameId = frame?.id;
  const activeFrame = useRef(frameId);
  activeFrame.current = frameId;
  const mounted = useRef(true);
  const generationRequest = useRef<{signature: string; request: EditorFrameRequest} | null>(null);
  const canvasArea = useRef<HTMLDivElement>(null);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const disabled = scene?.canEdit === false || workspace.authInvalid;
  const entities = useMemo(() => {
    const byId = new Map((scene?.entities ?? []).map((entity) => [entity.id, entity]));
    library.forEach((entity) => byId.set(entity.id, entity));
    return Array.from(byId.values());
  }, [library, scene?.entities]);
  // Media polling must not replace the canvas document during a pointer gesture.
  const savedCanvas = frame?.canvas;
  const composition = frame?.cameraIntent.composition;
  const document = useMemo(() => savedCanvas ? cloneCanvas(savedCanvas)
    : createCanvas(composition ? {cameraIntent: {composition}} : undefined, entities, shot?.duration ?? 4),
  [savedCanvas, composition, entities, shot?.duration]);
  const documentRef = useRef(document);
  documentRef.current = document;

  useEffect(() => {
    history.current = {past: [], future: []};
    setSelectedObjectId(null); setTool('select'); setNotesOpenRequest(0); setZoom(100); setGenerationOpen(false);
    // Selection and history belong to the frame. The Schema/Image choice belongs to the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId]);
  useEffect(() => {setImageError(false); imageRetry.current = false;}, [frameId]);
  useEffect(() => {
    if (tool === 'camera-path' && document.cameraMotion.type !== 'Custom') setTool('select');
  }, [document.cameraMotion.type, tool]);

  useEffect(() => {
    const loader = service.loadCanvasLibrary;
    if (!loader || workspace.authInvalid) return;
    const controller = new AbortController();
    const auth = getAuthGeneration();
    setLibraryLoading(true); setLibraryError(false);
    void loader(projectId, controller.signal).then((items) => {
      if (!controller.signal.aborted && auth === getAuthGeneration()) setLibrary(items);
    }).catch(() => {
      if (!controller.signal.aborted && auth === getAuthGeneration()) setLibraryError(true);
    }).finally(() => {if (!controller.signal.aborted) setLibraryLoading(false);});
    return () => controller.abort();
  }, [service, projectId, libraryReload, workspace.authInvalid]);

  const sceneId = scene?.id;
  const revision = scene?.draftRevision;
  const {setFrameMedia} = workspace;
  useEffect(() => {
    const frameService = service.editorFrames;
    if (!frameService || !sceneId || workspace.authInvalid) return;
    const controller = new AbortController();
    const auth = getAuthGeneration();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const result = await frameService.list(projectId, sceneId, controller.signal);
        if (controller.signal.aborted || auth !== getAuthGeneration()) return;
        setJobs(result); setJobsError(false); setFrameMedia(sceneId, result, revision);
        // Signed media links expire even when no generation is running.
        timer = setTimeout(poll, result.some(({status}) => status === 'queued' || status === 'running') ? 2500 : 240000);
      } catch {
        if (!controller.signal.aborted && auth === getAuthGeneration()) setJobsError(true);
      }
    };
    void poll();
    return () => {controller.abort(); if (timer) clearTimeout(timer);};
  }, [service, projectId, sceneId, revision, jobsReload, setFrameMedia, workspace.authInvalid]);

  useEffect(() => {
    if (view === 'image' && service.editorFrames) setJobsReload((n) => n + 1);
  }, [view, frameId, service.editorFrames]);

  const commit = useCallback((next: StoryboardCanvasDocument, recordHistory = true) => {
    if (disabled || !frameId) return;
    const valid = normalizeCanvas(next);
    if (!valid) {message.error(t('storyboard.canvas.invalid', {defaultValue: 'Проверьте параметры схемы.'})); return;}
    if (JSON.stringify(valid) === JSON.stringify(documentRef.current)) return;
    if (recordHistory) {
      history.current.past = [...history.current.past.slice(-39), cloneCanvas(documentRef.current)];
      history.current.future = [];
    }
    documentRef.current = valid;
    workspace.updateSelectedShot((current) => ({...current, keyframes: current.keyframes.map((item) => item.id === frameId
      ? {...item, canvas: valid, imageOutdated: Boolean(item.imageUrl)} : item)}));
    updateHistory((count) => count + 1);
  }, [disabled, frameId, t, workspace]);

  const add = (kind: CanvasPrimitive, entity?: StoryboardSceneEntity, point?: CanvasPoint) => {
    if (disabled || document.objects.length >= CANVAS_OBJECT_LIMIT) return;
    const object = createCanvasObject(kind, entity?.title ?? t(`storyboard.canvas.primitive.${kind}`), shot?.duration ?? 4,
      entity ? entityLink(entity) : undefined, point);
    object.x = Math.min(object.x, 100 - object.width); object.y = Math.min(object.y, 100 - object.height);
    commit({...document, objects: [...document.objects, object]}); setSelectedObjectId(object.id); setView('schema'); setTool('select');
  };
  const undo = (redo = false) => {
    if (disabled) return;
    const source = redo ? history.current.future : history.current.past;
    const target = redo ? history.current.past : history.current.future;
    const previous = source.pop();
    if (!previous) return;
    target.push(cloneCanvas(documentRef.current)); commit(previous, false);
  };
  const download = async () => {
    setExporting(true);
    try {
      const blob = await exportCanvasPng(document, {includeMotionGuides: true});
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a'); link.href = url; link.download = `storyboard-${shot?.order ?? 1}.png`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {message.error(t('storyboard.canvas.exportError', {defaultValue: 'Не удалось скачать схему.'}));}
    finally {if (mounted.current) setExporting(false);}
  };
  const openGeneration = async () => {
    if (!service.editorFrames) {onLegacyGenerate(); return;}
    if (!sceneId || disabled) return;
    setGenerationOpen(true); setOptionsLoading(true); setGenerationError(null); setOptions(null);
    const auth = getAuthGeneration(); const requestedFrame = frameId;
    try {
      const result = await service.editorFrames.options(projectId, sceneId);
      if (!mounted.current || activeFrame.current !== requestedFrame || auth !== getAuthGeneration()) return;
      setOptions(result); setModel(result.defaultModel ?? result.models.find((item) => item.available)?.id);
    } catch {if (mounted.current) setGenerationError(t('storyboard.canvas.optionsError', {defaultValue: 'Не удалось загрузить модели.'}));}
    finally {if (mounted.current) setOptionsLoading(false);}
  };
  const startGeneration = async () => {
    if (!service.editorFrames || !scene || !shot || !frame || !model || disabled || starting) return;
    setStarting(true); setGenerationError(null);
    const auth = getAuthGeneration(); const requestedFrame = frame.id;
    try {
      // Materialize an inherited legacy composition before snapshotting it on the server.
      if (!frame.canvas) workspace.updateSelectedShot((current) => ({...current, keyframes: current.keyframes.map((item) =>
        item.id === frame.id ? {...item, canvas: cloneCanvas(document)} : item)}));
      const expectedRevision = await savedEditorSceneRevision(projectId, scene);
      if (!mounted.current || activeFrame.current !== requestedFrame || auth !== getAuthGeneration()) return;
      const signature = JSON.stringify([scene.id, shot.id, frame.id, expectedRevision, model]);
      if (generationRequest.current?.signature !== signature) generationRequest.current = {signature,
        request: {shotId: shot.id, keyframeId: frame.id, expectedRevision, imageModel: model, requestId: uuidv4(), routingMode: 'manual'}};
      const createdJob = await service.editorFrames.start(projectId, scene.id, generationRequest.current.request);
      if (!mounted.current || auth !== getAuthGeneration()) return;
      setJobs((current) => [createdJob, ...current.filter((item) => item.jobId !== createdJob.jobId)]);
      generationRequest.current = null; setGenerationOpen(false); setView('image'); setJobsReload((n) => n + 1);
    } catch (error) {
      if (mounted.current && auth === getAuthGeneration()) setGenerationError(t('storyboard.canvas.generationError', {
        defaultValue: 'Не удалось запустить генерацию. {{code}}', code: getApiErrorCode(error) ?? '',
      }));
    } finally {if (mounted.current) setStarting(false);}
  };
  if (!scene || !shot || !frame) return <Empty />;
  const frameJobs = jobs.filter((job) => job.shotId === shot.id && job.keyframeId === frame.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeJob = frameJobs.find((job) => job.status === 'queued' || job.status === 'running');
  const imageUrl = safeImageUrl(frame.imageUrl);
  const selectedModel = options?.models.find((item) => item.id === model);
  const referenceCount = (document.objects.some((object) => !object.hidden) ? 1 : 0)
    + new Set([...document.objects.flatMap((object) => !object.hidden && object.entity ? [object.entity] : []),
      ...(frame.generationReferences ?? [])].map((entity) => entity.assetId ? `asset/${entity.assetId}`
      : `${entity.type}/${entity.id}/${entity.versionId ?? ''}`)).size;
  const tooManyReferences = Boolean(selectedModel && referenceCount > selectedModel.maxReferenceImages);
  return (
    <main className="blocking-editor" onKeyDown={(event) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"], [role="combobox"]')) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'KeyZ') {
        event.preventDefault(); undo(event.shiftKey);
      }
    }}>
      <div className="blocking-editor__palette">
        {libraryLoading && <Spin size="small" />}
        {libraryError && <Alert type="warning" message={t('storyboard.canvas.libraryError', {defaultValue: 'Библиотека не загружена.'})}
          action={<Button onClick={() => setLibraryReload((n) => n + 1)}>{t('common.retry')}</Button>} />}
        <BlockingPalette document={document} entities={entities} selectedObjectId={selectedObjectId} disabled={disabled}
          onAdd={add} onSelect={setSelectedObjectId} onChange={commit} />
      </div>
      <section className="blocking-editor__center" aria-label={t('storyboard.canvas.stage', {defaultValue: 'Постановка кадра'})}>
        <div className="blocking-editor__heading"><h2>{String(shot.order).padStart(2, '0')} · {shot.title}</h2>
          <ShotSourceDetails scene={scene} shot={shot} />
          <Segmented value={view} onChange={(value) => setView(value as FrameView)} options={[
            {value: 'schema', label: t('storyboard.canvas.schema', {defaultValue: 'Схема'})},
            {value: 'image', label: t('storyboard.canvas.image', {defaultValue: 'Изображение'})},
          ]} /></div>
        <div className="blocking-editor__tools">
          <Segmented value={tool} disabled={disabled || view !== 'schema'} onChange={(value) => setTool(value as typeof tool)} options={[
            {value: 'select', label: t('storyboard.canvas.select', {defaultValue: 'Выбор'})},
            {value: 'path', label: t('storyboard.canvas.path', {defaultValue: 'Траектория'})},
            ...(document.cameraMotion.type === 'Custom' ? [{value: 'camera-path', label: t('storyboard.canvas.cameraPath', {defaultValue: 'Камера'})}] : []),
            {value: 'comment', label: <CommentOutlined aria-label={t('storyboard.canvas.comment', {defaultValue: 'Комментарий'})} />},
          ]} />
          <Tooltip title={t('storyboard.canvas.undo', {defaultValue: 'Отменить изменение'})}><span><Button aria-label={t('storyboard.canvas.undo', {defaultValue: 'Отменить изменение'})}
            disabled={disabled || !history.current.past.length} icon={<UndoOutlined />} onClick={() => undo()} /></span></Tooltip>
          <Tooltip title={t('storyboard.canvas.redo', {defaultValue: 'Повторить изменение'})}><span><Button aria-label={t('storyboard.canvas.redo', {defaultValue: 'Повторить изменение'})}
            disabled={disabled || !history.current.future.length} icon={<RedoOutlined />} onClick={() => undo(true)} /></span></Tooltip>
          <Tooltip title={t(overlays ? 'storyboard.canvas.hideOverlays' : 'storyboard.canvas.showOverlays',
            {defaultValue: overlays ? 'Скрыть обозначения' : 'Показать обозначения'})}><Button
              aria-label={t(overlays ? 'storyboard.canvas.hideOverlays' : 'storyboard.canvas.showOverlays',
                {defaultValue: overlays ? 'Скрыть обозначения' : 'Показать обозначения'})}
              aria-pressed={overlays} icon={<EyeOutlined />} onClick={() => setOverlays(!overlays)} /></Tooltip>
          <Tooltip title={t('storyboard.canvas.ratio', {defaultValue: 'Соотношение сторон'})}><span className="blocking-editor__ratio"><Select
            aria-label={t('storyboard.canvas.ratio', {defaultValue: 'Соотношение сторон'})} value={document.aspectRatio} disabled={disabled}
            options={['16:9', '9:16', '1:1'].map((value) => ({value, label: value}))}
            onChange={(aspectRatio: StoryboardCanvasDocument['aspectRatio']) => commit({...document, aspectRatio})} /></span></Tooltip>
          <Tooltip title={t('storyboard.canvas.zoom', {defaultValue: 'Масштаб схемы'})}><span><InputNumber
            aria-label={t('storyboard.canvas.zoom', {defaultValue: 'Масштаб схемы'})} min={50} max={200} step={10} value={zoom}
            formatter={(value) => `${value}%`} onChange={(value) => setZoom(value ?? 100)} /></span></Tooltip>
          <Tooltip title={t('storyboard.canvas.fit', {defaultValue: 'Вписать схему в область'})}><Button
            aria-label={t('storyboard.canvas.fit', {defaultValue: 'Вписать схему в область'})} icon={<FullscreenOutlined />} onClick={() => setZoom(100)} /></Tooltip>
          <Tooltip title={t('storyboard.canvas.download', {defaultValue: 'Скачать схему PNG'})}><Button aria-label={t('storyboard.canvas.download', {defaultValue: 'Скачать схему PNG'})}
            loading={exporting} icon={<DownloadOutlined />} onClick={() => void download()} /></Tooltip>
        </div>
        {tool !== 'select' && view === 'schema' && <p className="blocking-editor__hint">{t(tool === 'path' ? 'storyboard.canvas.pathHint'
          : tool === 'camera-path' ? 'storyboard.canvas.cameraPathHint' : 'storyboard.canvas.commentHint', {
          defaultValue: tool === 'path' ? 'Выберите объект и укажите конечную точку движения на схеме.'
            : tool === 'camera-path' ? 'Проведите траекторию камеры от начальной до конечной точки.' : 'Нажмите на схему, затем заполните текст отметки справа.',
        })}</p>}
        {jobsError && <Alert type="warning" message={t('storyboard.canvas.jobsError', {defaultValue: 'Не удалось проверить генерацию.'})}
          action={<Button onClick={() => setJobsReload((n) => n + 1)}>{t('common.retry')}</Button>} />}
        {activeJob && <Alert type="info" showIcon icon={<Spin size="small" />} message={t('storyboard.canvas.background', {defaultValue: 'Генерация выполняется на сервере. Можно уйти со страницы.'})} />}
        {frameJobs[0]?.status === 'failed' && <Alert type="error" message={t('storyboard.canvas.failed', {defaultValue: 'Генерация не завершилась. Предыдущее изображение сохранено.'})}
          description={['IMAGE_PROVIDER_OUTCOME_UNKNOWN', 'IMAGE_PROVIDER_UNAVAILABLE'].includes(frameJobs[0].errorCode ?? '')
            ? t('storyboard.canvas.generationUnknown') : frameJobs[0].errorCode} />}
        <div className="blocking-editor__canvas" ref={canvasArea}>
          <div className="blocking-editor__zoom" style={{width: `${zoom}%`}}>
            {view === 'schema' ? <BlockingCanvas key={frame.id} document={document} selectedObjectId={selectedObjectId} tool={tool}
              overlays={overlays} disabled={disabled} onChange={commit} onSelect={setSelectedObjectId} onToolChange={setTool}
              onAdd={(kind, point, entityId) => add(kind, entities.find((entity) => entity.id === entityId), point)}
              onOpenMarker={() => setNotesOpenRequest((request) => request + 1)} />
                : activeJob ? <div className={`blocking-editor__image-stage${imageUrl ? ' blocking-editor__image-stage--with-preview' : ''}`}
                  style={{aspectRatio: document.aspectRatio.replace(':', ' / ')}}>
                  {imageUrl && <img className="blocking-editor__image" src={imageUrl} alt={shot.title}
                    onLoad={() => setImageError(false)} onError={() => {
                      setImageError(true);
                      if (!imageRetry.current && service.editorFrames) {imageRetry.current = true; setJobsReload((n) => n + 1);}
                    }} />}
                  <FrameGenerationProgress job={activeJob} />
                </div>
                : imageUrl ? <img className="blocking-editor__image" src={imageUrl} alt={shot.title}
                  onLoad={() => setImageError(false)} onError={() => {
                    setImageError(true);
                    if (!imageRetry.current && service.editorFrames) {imageRetry.current = true; setJobsReload((n) => n + 1);}
                  }} />
                : <Empty description={t('storyboard.canvas.noImage', {defaultValue: 'Изображение ещё не создано'})} />}
          </div>
        </div>
        {imageError && view === 'image' && <Alert type="warning" message={t('storyboard.canvas.imageError')}
          action={<Button onClick={() => {imageRetry.current = false; setJobsReload((n) => n + 1);}}>{t('common.retry')}</Button>} />}
        {frame.imageOutdated && view === 'image' && <Alert type="warning" message={t('storyboard.canvas.outdated', {defaultValue: 'Постановка изменилась после генерации. Изображение сохранено; можно создать новый вариант.'})} />}
        <div className="blocking-editor__summary"><span>{t(`storyboard.camera.framingValue.${frame.cameraIntent.framing}`)}</span><span>{t(`storyboard.camera.elevation.${frame.cameraIntent.elevation}`)}</span>
          <span>{frame.cameraIntent.lens ?? 50} mm</span><span>{shot.duration ?? 4} {t('storyboard.secondsShort')}</span></div>
        <div className="blocking-editor__bottom">
          <div className="blocking-editor__keyframes">
            {sortKeyframes(shot.keyframes).map((item) => <div className="blocking-editor__keyframe" key={item.id}>
              <button type="button" aria-current={frame.id === item.id ? 'true' : undefined} onClick={() => workspace.setSelectedKeyframeId(item.id)}>
                {safeImageUrl(item.imageUrl) ? <img src={safeImageUrl(item.imageUrl) ?? undefined} alt="" /> : <BlockingArtwork document={createCanvas(item, entities, shot.duration)} />}
                <span>{item.type === 'start' ? t('storyboard.canvas.primary', {defaultValue: 'Основное'}) : item.type === 'end'
                  ? t('storyboard.canvas.ending') : t(`storyboard.keyframeType.${item.type}`)}</span>
              </button>
              {item.type !== 'start' && <Button aria-label={t('storyboard.canvas.deleteState', {defaultValue: 'Удалить опорное изображение'})}
                size="small" disabled={disabled} icon={<DeleteOutlined />} onClick={() => workspace.deleteKeyframe(item.id)} />}
            </div>)}
            {!shot.keyframes.some(({type}) => type === 'end') && <Button aria-label={t('storyboard.canvas.addEnd', {defaultValue: 'Добавить конечное'})}
              disabled={disabled} icon={<PlusOutlined />} onClick={() => {
              if (!frame.canvas) workspace.updateSelectedShot((current) => ({...current, keyframes: current.keyframes.map((item) => item.id === frame.id ? {...item, canvas: document} : item)}));
              workspace.addEnd();
            }}>{t('storyboard.canvas.addEnd', {defaultValue: 'Добавить конечное'})}</Button>}
            {shot.keyframes.some(({type}) => type === 'end') && <Button aria-label={t('storyboard.addIntermediate')}
              disabled={disabled} icon={<PlusOutlined />} onClick={workspace.addIntermediate}>{t('storyboard.addIntermediate')}</Button>}
            {frame.type === 'intermediate' && <label className="blocking-editor__position">{t('storyboard.canvas.keyframePosition')}
              <InputNumber aria-label={t('storyboard.canvas.keyframePosition')} min={2} max={98} disabled={disabled}
                value={Math.round(frame.position * 100)} onChange={(value) => value !== null && workspace.repositionKeyframe(frame.id, value / 100)} />
            </label>}
          </div>
          <Button className="craft-action-button" type="primary" disabled={disabled || Boolean(activeJob) || workspace.autosaveState === 'conflict'}
            icon={imageUrl ? <ReloadOutlined /> : undefined} onClick={() => void openGeneration()}>
            {t(imageUrl ? 'common.regenerate' : 'storyboard.canvas.generate', {defaultValue: 'Создать изображение'})}</Button>
        </div>
      </section>
      <BlockingInspector key={frame.id} document={document} selectedObjectId={selectedObjectId} intent={frame.cameraIntent} entities={entities}
        duration={shot.duration ?? 4} disabled={disabled} onChange={commit} onIntentChange={workspace.updateCameraIntent}
        onDurationChange={(duration) => workspace.updateShot(shot.id, {duration})}
        onDrawPath={() => {setTool('path'); setView('schema'); setOverlays(true);}}
        onDrawCameraPath={() => {setTool('camera-path'); setView('schema'); setOverlays(true);}}
        notesOpenRequest={notesOpenRequest}
        onAddComment={() => {
          if (disabled || document.markers.length >= CANVAS_MARKER_LIMIT) return;
          const index = document.markers.length;
          const marker = {id: canvasId(), x: 50 + (index % 5) * 4, y: 50 + (index % 4) * 4, text: ''};
          commit({...document, markers: [...document.markers, marker]});
          setTool('select'); setView('schema'); setOverlays(true);
          setNotesOpenRequest((request) => request + 1);
        }} />
      <nav className="blocking-editor__filmstrip" aria-label={t('storyboard.canvas.shots', {defaultValue: 'Кадры сцены'})}>
        {[...scene.shots].sort((a, b) => a.order - b.order).map((item) => <button type="button" key={item.id} aria-current={shot.id === item.id ? 'true' : undefined}
          onClick={() => workspace.selectShot(item.id)} title={item.title}>
          {safeImageUrl(item.keyframes[0]?.imageUrl) ? <img src={safeImageUrl(item.keyframes[0]?.imageUrl) ?? undefined} alt="" />
            : <BlockingArtwork responsive={false} document={createCanvas(item.keyframes[0], entities, item.duration)} />}
          <span>{String(item.order).padStart(2, '0')} · {item.title}</span>
        </button>)}
        <Button disabled={disabled} aria-label={t('storyboard.addShot')} icon={<PlusOutlined />} onClick={onAddShot} />
      </nav>
      <Drawer open={generationOpen} onClose={() => setGenerationOpen(false)} title={t('storyboard.canvas.generate', {defaultValue: 'Создать изображение'})} width={440}>
        <div className="blocking-generation">
          {optionsLoading && <Spin />}
          {generationError && <Alert type="error" message={generationError} action={!options && <Button onClick={() => void openGeneration()}>{t('common.retry')}</Button>} />}
          {options && <>
            <label htmlFor="blocking-image-model">{t('storyboard.canvas.model', {defaultValue: 'Модель изображения'})}</label>
            <Select id="blocking-image-model" value={model} onChange={setModel} showSearch optionFilterProp="label"
              options={options.models.map((item) => ({value: item.id, label: item.label, disabled: !item.available}))} />
            <p>{t('storyboard.canvas.price', {defaultValue: 'Примерная стоимость: {{cost}}', cost: selectedModel?.estimatedCost ? `$${selectedModel.estimatedCost}` : '—'})}</p>
            <p>{t('storyboard.canvas.referenceCount', {defaultValue: 'Изображений на входе: {{count}} · лимит модели: {{limit}}', count: referenceCount, limit: selectedModel?.maxReferenceImages ?? 0})}</p>
            {tooManyReferences && <Alert type="warning" message={t('storyboard.canvas.referenceLimit', {defaultValue: 'Выберите модель с поддержкой большего числа референсов или уменьшите их количество.'})} />}
            {!options.canGenerate && <Alert type="warning" message={t('storyboard.canvas.notAllowed', {defaultValue: 'Генерация недоступна для этой учётной записи или проекта.'})} />}
            <Button className="craft-action-button" type="primary" loading={starting} disabled={disabled || !options.canGenerate || !selectedModel?.available || tooManyReferences || Boolean(activeJob)}
              onClick={() => void startGeneration()}>{t('storyboard.canvas.generate', {defaultValue: 'Создать изображение'})}</Button>
          </>}
        </div>
      </Drawer>
    </main>
  );
}
