import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FallOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  RedoOutlined,
  RiseOutlined,
  SaveOutlined,
  ScissorOutlined,
  SelectOutlined,
  SoundOutlined,
  SplitCellsOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {Alert, Button, Empty, InputNumber, Result, Skeleton, Slider, Spin} from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

import {backendAssetUrl} from '../../../api/http';
import DashboardHeader from '../../profile/components/DashboardHeader';
import PathConstants, {
  musicStudioPath,
  musicTrackPath,
} from '../../../routes/pathConstant';
import {safeReturnTo} from '../../../utils/auth/returnTo';
import {
  audioEditorSaveAdapter,
  AudioEditSaveUnavailableError,
} from '../api/audioEditorSaveAdapter';
import {musicApi} from '../api/musicApi';
import AudioWaveformTimeline from '../components/AudioWaveformTimeline';
import type {AudioWaveformPeak} from '../editor/audioWaveform';
import {
  audioEditDuration,
  createAudioEditDocument,
  deleteAudioSelection,
  normalizeAudioSelection,
  splitAudioAt,
  timelineToSourcePosition,
  trimAudioToSelection,
  updateSelectionEffects,
} from '../editor/audioEditModel';
import type {
  AudioEditDocument,
  AudioEditSegment,
  AudioSelection,
  AudioSourcePosition,
} from '../editor/audioEditModel';
import {musicErrorDescriptor} from '../errors';
import type {MusicErrorDescriptor} from '../errors';
import {useAudioWaveform} from '../hooks/useAudioWaveform';
import {useUnsavedMusicGuard} from '../hooks/useUnsavedMusicGuard';
import type {MusicTrackDetail} from '../types';
import '../audioEditor.css';

interface DocumentHistory {
  future: AudioEditDocument[];
  past: AudioEditDocument[];
  present: AudioEditDocument | null;
}

interface EditorLocationState {
  returnTo?: unknown;
}

const EMPTY_HISTORY: DocumentHistory = {future: [], past: [], present: null};
const MIN_SELECTION_SECONDS = 0.01;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
);

const formatTime = (seconds: number) => {
  const normalized = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const wholeSeconds = Math.floor(normalized);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

const formatPreciseTime = (seconds: number, unit: string) => (
  `${Math.max(0, seconds).toFixed(2)} ${unit}`
);

const documentFingerprint = (document: AudioEditDocument | null) => (
  document ? JSON.stringify(document.segments) : ''
);

const isInteractiveTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
};

function sourceLabelKey(track: MusicTrackDetail) {
  if (track.source === 'generated' || track.activeVersion?.provenance?.createdByAi) {
    return 'ai';
  }
  if (track.source === 'manual') return 'uploaded';
  return 'legacy';
}

function waveformForDocument(
  peaks: readonly AudioWaveformPeak[],
  sourceDuration: number,
  document: AudioEditDocument | null,
): AudioWaveformPeak[] {
  if (!document || peaks.length === 0 || sourceDuration <= 0) return [];

  return document.segments.flatMap((segment) => {
    const startIndex = clamp(
      Math.floor((segment.sourceStartSeconds / sourceDuration) * peaks.length),
      0,
      peaks.length,
    );
    const endIndex = clamp(
      Math.ceil((segment.sourceEndSeconds / sourceDuration) * peaks.length),
      startIndex,
      peaks.length,
    );
    return peaks.slice(startIndex, endIndex);
  });
}

function segmentGainAt(
  position: AudioSourcePosition,
  masterVolume: number,
): number {
  const {offsetInSegmentSeconds, segment} = position;
  const segmentDuration = Math.max(0, segment.sourceEndSeconds - segment.sourceStartSeconds);
  const fadeIn = segment.fadeInSeconds > 0
    ? clamp(
      (offsetInSegmentSeconds + (segment.fadeInOffsetSeconds ?? 0))
        / segment.fadeInSeconds,
      0,
      1,
    )
    : 1;
  const remaining = Math.max(0, segmentDuration - offsetInSegmentSeconds);
  const fadeOut = segment.fadeOutSeconds > 0
    ? clamp(
      (remaining + (segment.fadeOutOffsetSeconds ?? 0)) / segment.fadeOutSeconds,
      0,
      1,
    )
    : 1;
  return clamp(masterVolume * segment.gain * Math.min(fadeIn, fadeOut), 0, 1);
}

export default function AudioTrackEditorPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {projectId = '', trackId: trackIdParam = ''} = useParams<{
    projectId: string;
    trackId: string;
  }>();
  const trackId = /^\d+$/.test(trackIdParam) ? Number(trackIdParam) : null;
  const returnTo = safeReturnTo((location.state as EditorLocationState | null)?.returnTo)
    ?? (trackId == null ? musicStudioPath(projectId) : musicTrackPath(projectId, trackId));

  const [track, setTrack] = useState<MusicTrackDetail | null>(null);
  const [trackError, setTrackError] = useState<MusicErrorDescriptor | null>(null);
  const [trackLoading, setTrackLoading] = useState(true);
  const [trackRevision, setTrackRevision] = useState(0);
  const [waveformRevision, setWaveformRevision] = useState(0);
  const [history, setHistory] = useState<DocumentHistory>(EMPTY_HISTORY);
  const [baselineFingerprint, setBaselineFingerprint] = useState('');
  const [selection, setSelection] = useState<AudioSelection | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftGain, setDraftGain] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackPositionRef = useRef<AudioSourcePosition | null>(null);
  const documentSourceKeyRef = useRef<string | null>(null);
  const signedUrlRefreshKeyRef = useRef<string | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const selectionPanelRef = useRef<HTMLElement>(null);

  const activeVersion = track?.activeVersion ?? null;
  const audioUrl = activeVersion?.audioUrl ? backendAssetUrl(activeVersion.audioUrl) : null;
  const waveform = useAudioWaveform(audioUrl, waveformRevision);
  const document = history.present;
  const editedDuration = document ? audioEditDuration(document) : 0;
  const documentRef = useRef(document);
  const masterVolumeRef = useRef(masterVolume);
  documentRef.current = document;
  masterVolumeRef.current = masterVolume;

  const dirty = Boolean(document)
    && documentFingerprint(document) !== baselineFingerprint;
  const canEdit = track?.permissions?.canEdit ?? false;
  const validSelection = selection != null
    && selection.endSeconds - selection.startSeconds >= MIN_SELECTION_SECONDS;

  const unsavedCopy = useMemo(() => ({
    description: t('musicStudio.audioEditor.unsaved.description'),
    leave: t('musicStudio.audioEditor.unsaved.leave'),
    stay: t('musicStudio.audioEditor.unsaved.stay'),
    title: t('musicStudio.audioEditor.unsaved.title'),
  }), [t]);
  useUnsavedMusicGuard(dirty, unsavedCopy);

  useEffect(() => {
    if (!projectId || trackId == null) {
      setTrackLoading(false);
      setTrack(null);
      return undefined;
    }

    const controller = new AbortController();
    setTrackLoading(true);
    setTrackError(null);
    musicApi.getTrack(projectId, trackId, controller.signal)
      .then((response) => setTrack(response.data))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setTrackError(musicErrorDescriptor(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setTrackLoading(false);
      });
    return () => controller.abort();
  }, [projectId, trackId, trackRevision]);

  useEffect(() => {
    if (!track || !activeVersion?.audioUrl || waveform.loading || waveform.error) return;
    const sourceDuration = waveform.duration || activeVersion.durationSeconds || 0;
    const sourceKey = activeVersion.versionId
      ?? [track.id, activeVersion.audioUrl].join(':');
    if (sourceDuration <= 0 || documentSourceKeyRef.current === sourceKey) return;

    const initialDocument = createAudioEditDocument(sourceDuration);
    documentSourceKeyRef.current = sourceKey;
    signedUrlRefreshKeyRef.current = null;
    setHistory({future: [], past: [], present: initialDocument});
    setBaselineFingerprint(documentFingerprint(initialDocument));
    setSelection(null);
    setCurrentTime(0);
    setSaveError(null);
  }, [activeVersion, track, waveform.duration, waveform.error, waveform.loading]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const seek = useCallback((seconds: number) => {
    const currentDocument = documentRef.current;
    if (!currentDocument) return;
    const duration = audioEditDuration(currentDocument);
    const nextTime = clamp(seconds, 0, duration);
    const position = timelineToSourcePosition(currentDocument, nextTime);
    const audio = audioRef.current;
    if (position && audio) {
      audio.currentTime = position.sourceSeconds;
      audio.volume = segmentGainAt(position, masterVolumeRef.current);
    }
    playbackPositionRef.current = position;
    setCurrentTime(nextTime);
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    const currentDocument = documentRef.current;
    if (!audio || !currentDocument || audioUrl == null) return;
    if (playing) {
      pause();
      return;
    }

    const duration = audioEditDuration(currentDocument);
    const startTime = currentTime >= duration ? 0 : currentTime;
    seek(startTime);
    const playResult = audio.play();
    if (playResult) void playResult.catch(() => setPlaying(false));
  }, [audioUrl, currentTime, pause, playing, seek]);

  useEffect(() => {
    if (!playing) return undefined;

    const updatePlayhead = () => {
      const audio = audioRef.current;
      const currentDocument = documentRef.current;
      let position = playbackPositionRef.current;
      if (!audio || !currentDocument || !position) return;

      if (audio.currentTime >= position.segment.sourceEndSeconds) {
        const duration = audioEditDuration(currentDocument);
        if (position.segmentTimelineEndSeconds >= duration - 0.015) {
          audio.pause();
          setCurrentTime(duration);
          setPlaying(false);
          return;
        }
        const nextPosition = timelineToSourcePosition(
          currentDocument,
          position.segmentTimelineEndSeconds,
        );
        if (nextPosition) {
          const sourceIsContiguous = Math.abs(
            position.segment.sourceEndSeconds - nextPosition.segment.sourceStartSeconds,
          ) < 0.001;
          position = nextPosition;
          playbackPositionRef.current = nextPosition;
          if (!sourceIsContiguous) audio.currentTime = nextPosition.sourceSeconds;
        }
      }

      const timelineTime = clamp(
        position.segmentTimelineStartSeconds
          + audio.currentTime
          - position.segment.sourceStartSeconds,
        0,
        audioEditDuration(currentDocument),
      );
      audio.volume = segmentGainAt(position, masterVolumeRef.current);
      setCurrentTime(timelineTime);
      animationFrameRef.current = window.requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = window.requestAnimationFrame(updatePlayhead);
    return () => {
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [playing]);

  useEffect(() => () => {
    audioRef.current?.pause();
    saveAbortRef.current?.abort();
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!document) return;
    const duration = audioEditDuration(document);
    setCurrentTime((value) => clamp(value, 0, duration));
    setSelection((value) => value ? normalizeAudioSelection(value, duration) : null);
  }, [document]);

  const selectedSegment: AudioEditSegment | null = useMemo(() => {
    if (!document || !selection) return null;
    return timelineToSourcePosition(
      document,
      Math.min(selection.endSeconds, selection.startSeconds + 0.001),
    )?.segment ?? null;
  }, [document, selection]);

  useEffect(() => {
    setDraftGain(selectedSegment?.gain ?? 1);
  }, [selectedSegment?.gain, selectedSegment?.id]);

  const commit = useCallback((nextDocument: AudioEditDocument) => {
    pause();
    setHistory((current) => {
      if (!current.present
        || documentFingerprint(current.present) === documentFingerprint(nextDocument)) {
        return current;
      }
      return {
        future: [],
        past: [...current.past, current.present],
        present: nextDocument,
      };
    });
    setSaveError(null);
  }, [pause]);

  const undo = useCallback(() => {
    pause();
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!current.present || !previous) return current;
      return {
        future: [current.present, ...current.future],
        past: current.past.slice(0, -1),
        present: previous,
      };
    });
  }, [pause]);

  const redo = useCallback(() => {
    pause();
    setHistory((current) => {
      const next = current.future[0];
      if (!current.present || !next) return current;
      return {
        future: current.future.slice(1),
        past: [...current.past, current.present],
        present: next,
      };
    });
  }, [pause]);

  const trimSelection = useCallback(() => {
    if (!document || !selection || !validSelection) return;
    const next = trimAudioToSelection(document, selection);
    commit(next);
    const duration = audioEditDuration(next);
    setSelection(duration > 0 ? {endSeconds: duration, startSeconds: 0} : null);
    seek(0);
  }, [commit, document, seek, selection, validSelection]);

  const deleteSelection = useCallback(() => {
    if (!document || !selection || !validSelection) return;
    const joinTime = selection.startSeconds;
    const next = deleteAudioSelection(document, selection);
    commit(next);
    setSelection(null);
    seek(Math.min(joinTime, audioEditDuration(next)));
  }, [commit, document, seek, selection, validSelection]);

  const splitAtPlayhead = useCallback(() => {
    if (!document || currentTime <= 0 || currentTime >= editedDuration) return;
    commit(splitAudioAt(document, currentTime));
  }, [commit, currentTime, document, editedDuration]);

  const updateEffects = useCallback((effects: {
    fadeInSeconds?: number;
    fadeOutSeconds?: number;
    gain?: number;
  }) => {
    if (!document || !selection || !validSelection) return;
    commit(updateSelectionEffects(document, selection, effects));
  }, [commit, document, selection, validSelection]);

  const applyDefaultFade = useCallback((kind: 'in' | 'out') => {
    if (!selection) return;
    const duration = selection.endSeconds - selection.startSeconds;
    updateEffects(kind === 'in'
      ? {fadeInSeconds: Math.min(1, duration)}
      : {fadeOutSeconds: Math.min(1, duration)});
  }, [selection, updateEffects]);

  const createKeyboardSelection = useCallback(() => {
    if (!document || editedDuration <= 0 || !canEdit) return;
    const selectionDuration = Math.min(5, editedDuration);
    const startSeconds = clamp(
      currentTime - selectionDuration / 2,
      0,
      editedDuration - selectionDuration,
    );
    setSelection({
      endSeconds: startSeconds + selectionDuration,
      startSeconds,
    });
  }, [canEdit, currentTime, document, editedDuration]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (['Delete', 'Backspace'].includes(event.key) && canEdit && validSelection) {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, deleteSelection, redo, togglePlayback, undo, validSelection]);

  const retryAudio = () => {
    pause();
    setTrackError(null);
    setTrackRevision((revision) => revision + 1);
    setWaveformRevision((revision) => revision + 1);
  };

  const saveNewVersion = async () => {
    if (!track || !document || !dirty || !canEdit) return;
    saveAbortRef.current?.abort();
    const controller = new AbortController();
    saveAbortRef.current = controller;
    setSaving(true);
    setSaveError(null);
    try {
      await audioEditorSaveAdapter.saveNewVersion({
        document,
        expectedTrackVersion: track.version,
        makeActive: true,
        projectId,
        sourceVersionId: activeVersion?.versionId ?? null,
        trackId: track.id,
      }, controller.signal);
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setSaveError(error instanceof AudioEditSaveUnavailableError
          ? t('musicStudio.audioEditor.errors.saveDescription')
          : musicErrorDescriptor(error).message);
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  };

  const displayPeaks = useMemo(() => waveformForDocument(
    waveform.peaks,
    waveform.duration,
    document,
  ), [document, waveform.duration, waveform.peaks]);

  const breadcrumbs = [
    {label: t('musicStudio.breadcrumbs.allProjects'), to: PathConstants.PROJECTS},
    {label: t('musicStudio.title'), to: musicStudioPath(projectId)},
    {label: track?.title ?? t('musicStudio.audioEditor.pageTitle')},
  ];

  const renderReturnAction = () => (
    <Button onClick={() => navigate(musicStudioPath(projectId))}>
      {t('musicStudio.audioEditor.errors.returnStudio')}
    </Button>
  );

  let content: React.ReactNode;
  if (!projectId || trackId == null) {
    content = (
      <Result
        status="404"
        title={t('musicStudio.audioEditor.errors.notFoundTitle')}
        subTitle={t('musicStudio.audioEditor.errors.notFoundDescription')}
        extra={renderReturnAction()}
      />
    );
  } else if (trackLoading) {
    content = <Skeleton active className="music-audio-editor__loading" paragraph={{rows: 8}} />;
  } else if (trackError) {
    const missing = trackError.status === 404 || trackError.code === 'MUSIC_TRACK_NOT_FOUND';
    content = (
      <Result
        status={missing ? '404' : 'error'}
        title={t(missing
          ? 'musicStudio.audioEditor.errors.notFoundTitle'
          : 'musicStudio.audioEditor.errors.loadTitle')}
        subTitle={missing
          ? t('musicStudio.audioEditor.errors.notFoundDescription')
          : trackError.message}
        extra={[
          <Button key="retry" type="primary" onClick={retryAudio}>
            {t('musicStudio.audioEditor.errors.retry')}
          </Button>,
          <React.Fragment key="back">{renderReturnAction()}</React.Fragment>,
        ]}
      />
    );
  } else if (!track || !activeVersion?.audioUrl) {
    content = (
      <Result
        status="info"
        title={t('musicStudio.audioEditor.errors.noAudioTitle')}
        subTitle={t('musicStudio.audioEditor.errors.noAudioDescription')}
        extra={renderReturnAction()}
      />
    );
  } else if (waveform.error) {
    content = (
      <Result
        status="error"
        title={t('musicStudio.audioEditor.errors.decodeTitle')}
        subTitle={t('musicStudio.audioEditor.errors.decodeDescription')}
        extra={[
          <Button key="retry" type="primary" onClick={retryAudio}>
            {t('musicStudio.audioEditor.errors.retry')}
          </Button>,
          <React.Fragment key="back">{renderReturnAction()}</React.Fragment>,
        ]}
      />
    );
  } else if (!waveform.loading && (waveform.duration <= 0 || waveform.peaks.length === 0)) {
    content = (
      <Result
        status="info"
        title={t('musicStudio.audioEditor.errors.noAudioTitle')}
        subTitle={t('musicStudio.audioEditor.errors.noAudioDescription')}
        extra={[
          <Button key="retry" type="primary" onClick={retryAudio}>
            {t('musicStudio.audioEditor.errors.retry')}
          </Button>,
          <React.Fragment key="back">{renderReturnAction()}</React.Fragment>,
        ]}
      />
    );
  } else {
    const selectionDuration = selection
      ? Math.max(0, selection.endSeconds - selection.startSeconds)
      : 0;
    const editorDisabled = !canEdit || !document || waveform.loading;
    const splitDisabled = editorDisabled || currentTime <= 0 || currentTime >= editedDuration;

    content = (
      <>
        <header className="music-audio-editor__header">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(returnTo)}>
            {t('musicStudio.audioEditor.back')}
          </Button>
          <div className="music-audio-editor__track-meta">
            <h1>{track.title}</h1>
            <p>
              <span>{t('musicStudio.audioEditor.duration', {duration: formatTime(editedDuration || waveform.duration)})}</span>
              <span aria-hidden="true">•</span>
              <span>{t(`musicStudio.audioEditor.source.${sourceLabelKey(track)}`)}</span>
            </p>
          </div>
          <div className="music-audio-editor__history-actions">
            <Button
              aria-label={t('musicStudio.audioEditor.undo')}
              disabled={history.past.length === 0}
              icon={<UndoOutlined />}
              onClick={undo}
            />
            <Button
              aria-label={t('musicStudio.audioEditor.redo')}
              disabled={history.future.length === 0}
              icon={<RedoOutlined />}
              onClick={redo}
            />
          </div>
          <Button
            className="music-audio-editor__save"
            disabled={!canEdit || !dirty || !document}
            icon={<SaveOutlined />}
            loading={saving}
            type="primary"
            onClick={() => void saveNewVersion()}
          >
            {t('musicStudio.audioEditor.save')}
          </Button>
        </header>

        {!canEdit && (
          <Alert showIcon type="info" message={t('musicStudio.audioEditor.status.readOnly')} />
        )}
        {canEdit && !audioEditorSaveAdapter.available && (
          <Alert
            showIcon
            type="info"
            message={t('musicStudio.audioEditor.errors.saveTitle')}
            description={t('musicStudio.audioEditor.errors.saveDescription')}
          />
        )}
        {saveError && (
          <Alert
            closable
            showIcon
            type="error"
            message={t('musicStudio.audioEditor.errors.saveTitle')}
            description={saveError}
            onClose={() => setSaveError(null)}
          />
        )}

        <section aria-label={t('musicStudio.audioEditor.tools.label')} className="music-audio-editor__toolbar">
          <Button
            disabled={editorDisabled}
            icon={<SelectOutlined />}
            type="primary"
            onClick={createKeyboardSelection}
          >
            {t('musicStudio.audioEditor.tools.select')}
          </Button>
          <Button disabled={editorDisabled || !validSelection} icon={<ScissorOutlined />} onClick={trimSelection}>
            {t('musicStudio.audioEditor.tools.trim')}
          </Button>
          <Button disabled={splitDisabled} icon={<SplitCellsOutlined />} onClick={splitAtPlayhead}>
            {t('musicStudio.audioEditor.tools.split')}
          </Button>
          <Button danger disabled={editorDisabled || !validSelection} icon={<DeleteOutlined />} onClick={deleteSelection}>
            {t('musicStudio.audioEditor.tools.delete')}
          </Button>
          <Button disabled={editorDisabled || !validSelection} icon={<RiseOutlined />} onClick={() => applyDefaultFade('in')}>
            {t('musicStudio.audioEditor.tools.fadeIn')}
          </Button>
          <Button disabled={editorDisabled || !validSelection} icon={<FallOutlined />} onClick={() => applyDefaultFade('out')}>
            {t('musicStudio.audioEditor.tools.fadeOut')}
          </Button>
          <Button
            disabled={editorDisabled || !validSelection}
            icon={<SoundOutlined />}
            onClick={() => selectionPanelRef.current?.scrollIntoView({block: 'nearest'})}
          >
            {t('musicStudio.audioEditor.tools.volume')}
          </Button>
          <span className="music-audio-editor__toolbar-spacer" />
          <Button
            aria-label={t('musicStudio.audioEditor.tools.zoomOut')}
            disabled={zoom <= MIN_ZOOM}
            icon={<ZoomOutOutlined />}
            onClick={() => setZoom((value) => clamp(value - 0.5, MIN_ZOOM, MAX_ZOOM))}
          />
          <span className="music-audio-editor__zoom-label">
            {t('musicStudio.audioEditor.transport.zoom', {zoom: Math.round(zoom * 100)})}
          </span>
          <Button
            aria-label={t('musicStudio.audioEditor.tools.zoomIn')}
            disabled={zoom >= MAX_ZOOM}
            icon={<ZoomInOutlined />}
            onClick={() => setZoom((value) => clamp(value + 0.5, MIN_ZOOM, MAX_ZOOM))}
          />
        </section>

        <section className="music-audio-editor__timeline-card">
          <div className="music-audio-editor__timeline-heading">
            <div>
              <h2>{t('musicStudio.audioEditor.pageTitle')}</h2>
              <p>{t('musicStudio.audioEditor.timeline.hint')}</p>
            </div>
            {dirty && <span className="music-audio-editor__dirty">{t('musicStudio.audioEditor.unsaved.title')}</span>}
          </div>
          {waveform.loading || !document ? (
            <div className="music-audio-editor__waveform-loading">
              <Spin />
              <span>{t('musicStudio.audioEditor.timeline.loading')}</span>
            </div>
          ) : editedDuration <= 0 ? (
            <Empty description={t('musicStudio.audioEditor.errors.noAudioTitle')} />
          ) : (
            <AudioWaveformTimeline
              ariaLabel={t('musicStudio.audioEditor.timeline.label')}
              currentTimeSeconds={currentTime}
              disabled={!canEdit}
              durationSeconds={editedDuration}
              peaks={displayPeaks}
              selection={selection}
              selectionEndLabel={t('musicStudio.audioEditor.selection.end')}
              selectionStartLabel={t('musicStudio.audioEditor.selection.start')}
              title={track.title}
              zoom={zoom}
              onSeek={seek}
              onSelectionChange={(nextSelection) => setSelection(
                normalizeAudioSelection(nextSelection, editedDuration),
              )}
            />
          )}
        </section>

        <section ref={selectionPanelRef} className="music-audio-editor__selection-panel">
          <h2>{t('musicStudio.audioEditor.selection.title')}</h2>
          {!validSelection || !selection ? (
            <p>{t('musicStudio.audioEditor.selection.empty')}</p>
          ) : (
            <div className="music-audio-editor__selection-fields">
              <dl>
                <div><dt>{t('musicStudio.audioEditor.selection.start')}</dt><dd>{formatPreciseTime(selection.startSeconds, t('musicStudio.units.seconds'))}</dd></div>
                <div><dt>{t('musicStudio.audioEditor.selection.end')}</dt><dd>{formatPreciseTime(selection.endSeconds, t('musicStudio.units.seconds'))}</dd></div>
                <div><dt>{t('musicStudio.audioEditor.selection.duration')}</dt><dd>{formatPreciseTime(selectionDuration, t('musicStudio.units.seconds'))}</dd></div>
              </dl>
              <label className="music-audio-editor__effect-control">
                <span>{t('musicStudio.audioEditor.selection.gain')}: {Math.round(draftGain * 100)}%</span>
                <Slider
                  disabled={!canEdit}
                  max={100}
                  min={0}
                  value={Math.round(draftGain * 100)}
                  onAfterChange={(value) => updateEffects({gain: Number(value) / 100})}
                  onChange={(value) => setDraftGain(Number(value) / 100)}
                />
              </label>
              <label className="music-audio-editor__effect-control">
                <span>{t('musicStudio.audioEditor.selection.fadeIn')}</span>
                <InputNumber
                  disabled={!canEdit}
                  max={selectionDuration}
                  min={0}
                  precision={2}
                  step={0.1}
                  value={selectedSegment?.fadeInSeconds ?? 0}
                  onChange={(value) => updateEffects({fadeInSeconds: Number(value ?? 0)})}
                />
              </label>
              <label className="music-audio-editor__effect-control">
                <span>{t('musicStudio.audioEditor.selection.fadeOut')}</span>
                <InputNumber
                  disabled={!canEdit}
                  max={selectionDuration}
                  min={0}
                  precision={2}
                  step={0.1}
                  value={selectedSegment?.fadeOutSeconds ?? 0}
                  onChange={(value) => updateEffects({fadeOutSeconds: Number(value ?? 0)})}
                />
              </label>
            </div>
          )}
        </section>

        <section aria-label={t('musicStudio.audioEditor.transport.label')} className="music-audio-editor__transport">
          <audio
            hidden
            ref={audioRef}
            preload="metadata"
            src={audioUrl ?? undefined}
            onEnded={() => {
              setPlaying(false);
              setCurrentTime(editedDuration);
            }}
            onError={() => {
              const refreshKey = activeVersion.versionId ?? activeVersion.audioUrl ?? 'legacy';
              if (signedUrlRefreshKeyRef.current !== refreshKey) {
                signedUrlRefreshKeyRef.current = refreshKey;
                setTrackRevision((revision) => revision + 1);
              }
            }}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          <Button
            aria-label={t('musicStudio.audioEditor.transport.toStart')}
            disabled={editedDuration <= 0}
            icon={<StepBackwardOutlined />}
            shape="circle"
            onClick={() => seek(0)}
          />
          <Button
            aria-label={t(playing
              ? 'musicStudio.audioEditor.transport.pause'
              : 'musicStudio.audioEditor.transport.play')}
            className="music-audio-editor__play"
            disabled={editedDuration <= 0}
            icon={playing ? <PauseCircleFilled /> : <PlayCircleFilled />}
            shape="circle"
            type="primary"
            onClick={togglePlayback}
          />
          <Button
            aria-label={t('musicStudio.audioEditor.transport.toEnd')}
            disabled={editedDuration <= 0}
            icon={<StepForwardOutlined />}
            shape="circle"
            onClick={() => {
              pause();
              seek(editedDuration);
            }}
          />
          <strong className="music-audio-editor__time">
            {formatTime(currentTime)} / {formatTime(editedDuration)}
          </strong>
          <label className="music-audio-editor__master-volume">
            <SoundOutlined aria-hidden="true" />
            <span>{t('musicStudio.audioEditor.transport.masterVolume')}</span>
            <Slider
              max={100}
              min={0}
              value={Math.round(masterVolume * 100)}
              onChange={(value) => setMasterVolume(Number(value) / 100)}
            />
          </label>
          <label className="music-audio-editor__transport-zoom">
            <span>{t('musicStudio.audioEditor.transport.zoom', {zoom: Math.round(zoom * 100)})}</span>
            <Slider
              max={MAX_ZOOM * 100}
              min={MIN_ZOOM * 100}
              step={50}
              value={zoom * 100}
              onChange={(value) => setZoom(Number(value) / 100)}
            />
          </label>
        </section>
      </>
    );
  }

  return (
    <div className="music-audio-editor-page">
      <DashboardHeader breadcrumbItems={breadcrumbs} />
      <main className="music-audio-editor">{content}</main>
    </div>
  );
}
