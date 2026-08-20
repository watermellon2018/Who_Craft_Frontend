import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Empty, Result, Segmented, Skeleton, Space, Spin} from 'antd';
import {PlusOutlined, ReloadOutlined, SoundOutlined, UploadOutlined} from '@ant-design/icons';
import {flushSync} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {
  musicJobPath,
  musicStudioCreatePath,
  musicTrackEditorPath,
  musicTrackPath,
  musicUploadDraftEditorPath,
} from '../../../routes/pathConstant';
import {currentReturnTo} from '../../../utils/auth/returnTo';
import {craftModal} from '../../../theme/CraftModalHost';
import type {AppliedTrackContext} from '../api/musicApi';
import {musicApi, newMusicIdempotencyKey} from '../api/musicApi';
import AudioReferenceField from '../components/AudioReferenceField';
import AudioUploadForm from '../components/AudioUploadForm';
import type {AudioUploadDraft} from '../components/AudioUploadForm';
import LyricsSectionEditor from '../components/LyricsSectionEditor';
import MusicBriefForm from '../components/MusicBriefForm';
import MusicCreationSummary from '../components/MusicCreationSummary';
import type {MusicCreationMode} from '../components/MusicCreationSummary';
import MusicFormatSelector from '../components/MusicFormatSelector';
import MusicJobState from '../components/MusicJobState';
import MusicLibraryPanel from '../components/MusicLibraryPanel';
import MusicModelSelector from '../components/MusicModelSelector';
import MusicStudioShell from '../components/MusicStudioShell';
import MusicVariantPlayer from '../components/MusicVariantPlayer';
import ScenePickerDialog from '../components/ScenePickerDialog';
import TrackInspector from '../components/TrackInspector';
import {musicErrorDescriptor} from '../errors';
import {
  getLatestMusicUploadEditorDraft,
  getMusicUploadEditorDraft,
  removeMusicUploadEditorDraft,
  saveMusicUploadEditorDraft,
} from '../editor/musicUploadDraftStore';
import {useMusicGenerationJob} from '../hooks/useMusicGenerationJob';
import {useUnsavedMusicGuard} from '../hooks/useUnsavedMusicGuard';
import {
  constrainMusicDraft,
  enqueueMusicModelKey,
  initialMusicModelKey,
  musicModelCatalog,
  selectedMusicModel,
} from '../modelCatalog';
import type {
  MusicBrief,
  MusicCapabilities,
  MusicEnqueueRequest,
  MusicGenerationJob,
  MusicLibraryItem,
  MusicPermissions,
  MusicReferenceAsset,
  MusicSceneOption,
  MusicTrackDetail,
} from '../types';
import '../musicStudio.css';
import {runGenerationWithCredits} from '../../credits/components/GenerationCostGuard';

const NO_PERMISSIONS: MusicPermissions = {canEdit: false, canRunGeneration: false};
const EMPTY_UPLOAD_DRAFT: AudioUploadDraft = {
  description: '',
  durationSeconds: null,
  file: null,
  status: 'empty',
  title: '',
};

function createDefaultBrief(capabilities: MusicCapabilities): MusicBrief {
  return {
    content: {mode: 'instrumental'},
    context: {type: 'project'},
    durationSeconds: capabilities.duration.defaultSeconds,
    energyCurve: capabilities.briefFields.energyCurves[0] ?? 'steady',
    exclude: [],
    genre: capabilities.briefFields.genres[0] ?? '',
    instruments: [],
    loopable: false,
    moods: capabilities.briefFields.moods.slice(0, 1),
    purpose: capabilities.briefFields.purposes.find((purpose) => purpose !== 'song') ?? '',
    tempo: {mode: capabilities.briefFields.tempoModes[0] ?? 'auto'},
    textRefinement: '',
    title: '',
  };
}

function normalizedJobId(response: MusicGenerationJob | {jobId?: string}) {
  return response.jobId;
}

function briefForCapabilities(brief: MusicBrief, supportsSeed: boolean): MusicBrief {
  if (supportsSeed) return brief;
  const sanitized = {...brief};
  delete sanitized.seed;
  return sanitized;
}

export function musicEnqueueIntentFingerprint(
  payload: MusicEnqueueRequest,
  expectedTrackVersion: number | null,
): string {
  return JSON.stringify({expectedTrackVersion, payload});
}

export function resetMusicCreateScroll(isCreateRoute: boolean) {
  if (isCreateRoute) window.scrollTo({behavior: 'auto', left: 0, top: 0});
}

function musicPathWithParams(
  path: string,
  params: Record<string, number | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? [path, query].join('?') : path;
}

export default function MusicStudioPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {projectId = '', jobId, trackId: trackIdParam} = useParams<{
    jobId?: string;
    projectId: string;
    trackId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const sceneIdParam = Number(searchParams.get('sceneId')) || null;
  const targetTrackIdParam = Number(searchParams.get('targetTrackId')) || null;
  const expectedTrackVersionParam = Number(searchParams.get('expectedTrackVersion')) || null;
  const uploadEditorDraftIdParam = searchParams.get('uploadDraftId');
  const requestedCreationMode = searchParams.get('mode') === 'upload' ? 'upload' : null;
  const isCreateRoute = location.pathname.endsWith('/create');
  const trackId = trackIdParam && /^\d+$/.test(trackIdParam) ? Number(trackIdParam) : null;
  const restoredCreateDraftEntry = isCreateRoute
    ? uploadEditorDraftIdParam
      ? getMusicUploadEditorDraft(projectId, uploadEditorDraftIdParam)
      : getLatestMusicUploadEditorDraft(projectId)
    : null;
  const restoredCreateDraft = restoredCreateDraftEntry?.snapshot ?? null;
  const activeUploadEditorDraftId = uploadEditorDraftIdParam
    ?? restoredCreateDraftEntry?.draftId
    ?? null;
  const restoredCreateDraftRef = useRef(restoredCreateDraft);

  const [capabilities, setCapabilities] = useState<MusicCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(
    restoredCreateDraft?.modelKey ?? null,
  );
  const [brief, setBrief] = useState<MusicBrief | null>(restoredCreateDraft?.brief ?? null);
  const [creationMode, setCreationMode] = useState<MusicCreationMode>(
    restoredCreateDraft?.creationMode ?? requestedCreationMode ?? 'ai',
  );
  const [variantCount, setVariantCount] = useState(restoredCreateDraft?.variantCount ?? 2);
  const [reference, setReference] = useState<MusicReferenceAsset | null>(
    restoredCreateDraft?.reference ?? null,
  );
  const [uploadDraft, setUploadDraft] = useState<AudioUploadDraft>(
    restoredCreateDraft?.uploadDraft ?? EMPTY_UPLOAD_DRAFT,
  );
  const [aiDirty, setAiDirty] = useState(restoredCreateDraft?.aiDirty ?? false);
  const [uploadDirty, setUploadDirty] = useState(restoredCreateDraft?.uploadDirty ?? false);
  const [selectedScene, setSelectedScene] = useState<MusicSceneOption | null>(
    restoredCreateDraft?.selectedScene ?? null,
  );
  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const [library, setLibrary] = useState<MusicLibraryItem[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [history, setHistory] = useState<MusicGenerationJob[]>([]);
  const [permissions, setPermissions] = useState<MusicPermissions>(NO_PERMISSIONS);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryMode, setLibraryMode] = useState<'library' | 'history'>('library');
  const [query, setQuery] = useState('');
  const [dataRevision, setDataRevision] = useState(0);
  const [track, setTrack] = useState<MusicTrackDetail | null>(null);
  const [targetTrack, setTargetTrack] = useState<MusicTrackDetail | null>(null);
  const [targetTrackLoading, setTargetTrackLoading] = useState(false);
  const [targetTrackError, setTargetTrackError] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [applyingVariantId, setApplyingVariantId] = useState<string | null>(null);
  const [appliedTrack, setAppliedTrack] = useState<AppliedTrackContext | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const signedUrlRefreshKeysRef = useRef(new Set<string>());
  const enqueueInFlightRef = useRef(false);
  const enqueueIntentRef = useRef<{fingerprint: string; key: string} | null>(null);
  const targetBriefInitializedRef = useRef<string | null>(null);
  const selectedModelKeyRef = useRef(selectedModelKey);

  const models = useMemo(
    () => capabilities ? musicModelCatalog(capabilities) : [],
    [capabilities],
  );
  const selectedModel = models.find((model) => model.key === selectedModelKey)
    ?? models.find((model) => model.configured)
    ?? models[0]
    ?? null;
  const selectedModelConfigured = Boolean(selectedModel?.configured);
  const effectiveCapabilities = selectedModel?.capabilities ?? null;

  useEffect(() => {
    selectedModelKeyRef.current = selectedModelKey;
  }, [selectedModelKey]);

  useLayoutEffect(() => {
    resetMusicCreateScroll(isCreateRoute);
  }, [isCreateRoute, location.key]);

  useUnsavedMusicGuard(isCreateRoute && (aiDirty || uploadDirty));
  const generation = useMusicGenerationJob(projectId, jobId);
  const refreshGeneration = generation.refresh;
  const jobSceneId = generation.job?.brief.context.type === 'scene'
    ? generation.job.brief.context.sceneId
    : null;
  const requestedTargetTrackId = isCreateRoute
    ? targetTrackIdParam
    : generation.job?.targetTrackId ?? null;

  const activateAudio = useCallback((audio: HTMLAudioElement) => {
    if (activeAudioRef.current && activeAudioRef.current !== audio) {
      activeAudioRef.current.pause();
    }
    activeAudioRef.current = audio;
  }, []);

  const refreshTrackSignedUrl = useCallback((refreshKey: string) => {
    const scopedKey = [projectId, 'track', refreshKey].join(':');
    if (signedUrlRefreshKeysRef.current.has(scopedKey)) return;
    signedUrlRefreshKeysRef.current.add(scopedKey);
    setDataRevision((revision) => revision + 1);
  }, [projectId]);

  const refreshVariantSignedUrl = useCallback((refreshKey: string) => {
    const scopedKey = [projectId, 'job', jobId ?? '', refreshKey].join(':');
    if (signedUrlRefreshKeysRef.current.has(scopedKey)) return;
    signedUrlRefreshKeysRef.current.add(scopedKey);
    refreshGeneration();
  }, [jobId, projectId, refreshGeneration]);

  useEffect(() => () => activeAudioRef.current?.pause(), []);

  useEffect(() => {
    activeAudioRef.current?.pause();
  }, [creationMode]);

  useEffect(() => {
    if (!isCreateRoute || !activeUploadEditorDraftId) return;
    if (!uploadDraft.file) {
      removeMusicUploadEditorDraft(projectId, activeUploadEditorDraftId);
      return;
    }
    saveMusicUploadEditorDraft(projectId, {
      aiDirty,
      brief,
      canEdit: permissions.canEdit,
      creationMode,
      modelKey: selectedModelKey,
      reference,
      selectedScene,
      uploadDirty,
      uploadDraft,
      variantCount,
    }, activeUploadEditorDraftId);
  }, [
    activeUploadEditorDraftId,
    aiDirty,
    brief,
    creationMode,
    isCreateRoute,
    permissions.canEdit,
    projectId,
    reference,
    selectedModelKey,
    selectedScene,
    uploadDirty,
    uploadDraft,
    variantCount,
  ]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    setCapabilitiesError(null);
    musicApi.getCapabilities(projectId, controller.signal)
      .then((response) => {
        setCapabilities(response.data);
        const modelKey = initialMusicModelKey(response.data, selectedModelKeyRef.current);
        const modelCapabilities = selectedMusicModel(response.data, modelKey).capabilities;
        setSelectedModelKey(modelKey);
        setBrief((current) => current ?? createDefaultBrief(modelCapabilities));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setCapabilitiesError(musicErrorDescriptor(error).message);
      });
    return () => controller.abort();
  }, [projectId, dataRevision]);

  useEffect(() => {
    if (!brief || !effectiveCapabilities) return;
    const constrained = constrainMusicDraft(
      brief,
      reference,
      variantCount,
      effectiveCapabilities,
      t('musicStudio.lyrics.defaultVerse'),
    );
    setBrief(constrained.brief);
    setReference(constrained.reference);
    setVariantCount(constrained.variantCount);
  }, [effectiveCapabilities, selectedModelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLibraryLoading(true);
      setLibraryError(null);
      try {
        const [libraryResponse, historyResponse] = await Promise.all([
          musicApi.listLibrary(projectId, {
            limit: 30,
            offset: 0,
            q: query.trim() || undefined,
            status: 'active',
          }, controller.signal),
          musicApi.listJobs(projectId, {limit: 30, offset: 0}, controller.signal),
        ]);
        setLibrary(libraryResponse.data.items);
        setLibraryTotal(libraryResponse.data.page.total);
        setPermissions(libraryResponse.data.permissions);
        setHistory(historyResponse.data.items);
      } catch (error: unknown) {
        if (!controller.signal.aborted) setLibraryError(musicErrorDescriptor(error).message);
      } finally {
        if (!controller.signal.aborted) setLibraryLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [dataRevision, projectId, query]);

  useEffect(() => {
    if (!projectId || !trackId) {
      setTrack(null);
      setTrackError(null);
      return;
    }
    const controller = new AbortController();
    setTrackLoading(true);
    setTrackError(null);
    musicApi.getTrack(projectId, trackId, controller.signal)
      .then((response) => setTrack(response.data))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setTrackError(musicErrorDescriptor(error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTrackLoading(false);
      });
    return () => controller.abort();
  }, [dataRevision, projectId, trackId]);

  useEffect(() => {
    if (!projectId || !requestedTargetTrackId) {
      setTargetTrack(null);
      setTargetTrackError(null);
      setTargetTrackLoading(false);
      return;
    }
    const controller = new AbortController();
    setTargetTrack(null);
    setTargetTrackLoading(true);
    setTargetTrackError(null);
    musicApi.getTrack(projectId, requestedTargetTrackId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setTargetTrack(response.data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setTargetTrack(null);
          setTargetTrackError(musicErrorDescriptor(error).message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTargetTrackLoading(false);
      });
    return () => controller.abort();
  }, [dataRevision, projectId, requestedTargetTrackId]);

  useEffect(() => {
    if (restoredCreateDraftRef.current) return;
    if (!isCreateRoute || !targetTrack || targetTrack.id !== targetTrackIdParam) return;
    const initializationKey = [targetTrack.id, targetTrack.version].join(':');
    if (targetBriefInitializedRef.current === initializationKey) return;
    const activeSnapshot = targetTrack.versions.find(
      (version) => version.versionId != null
        && version.versionId === targetTrack.activeVersion?.versionId,
    ) ?? targetTrack.versions[0];
    if (!activeSnapshot?.brief && !brief) return;
    setBrief((current) => {
      if (activeSnapshot?.brief) {
        const snapshot = activeSnapshot.brief;
        const content = snapshot.content.mode === 'song' && activeSnapshot.lyrics
          ? {
              ...snapshot.content,
              sections: activeSnapshot.lyrics.map((section) => ({...section})),
            }
          : snapshot.content;
        return {
          ...snapshot,
          content,
          title: snapshot.title || targetTrack.title,
        };
      }
      if (!current) return current;
      return {
        ...current,
        durationSeconds: activeSnapshot?.durationSeconds ?? current.durationSeconds,
        title: targetTrack.title,
      };
    });
    targetBriefInitializedRef.current = initializationKey;
    setAiDirty(false);
  }, [brief, isCreateRoute, targetTrack, targetTrackIdParam]);

  useEffect(() => {
    if (restoredCreateDraftRef.current) return;
    if (!projectId || !isCreateRoute || !sceneIdParam) return;
    const controller = new AbortController();
    musicApi.listSceneOptions(projectId, {limit: 20, sceneId: sceneIdParam}, controller.signal)
      .then((response) => {
        const scene = response.data.items.find((item) => item.sceneId === sceneIdParam);
        if (!scene) return;
        setSelectedScene(scene);
        setBrief((current) => {
          if (!current || !effectiveCapabilities) return current;
          const mood = effectiveCapabilities.briefFields.moods.includes(scene.mood) ? [scene.mood] : current.moods;
          const durationSeconds = scene.durationSeconds == null
            ? current.durationSeconds
            : Math.min(effectiveCapabilities.duration.maxSeconds, Math.max(effectiveCapabilities.duration.minSeconds, scene.durationSeconds));
          return {
            ...current,
            context: {sceneId: scene.sceneId, type: 'scene'},
            durationSeconds,
            moods: mood,
            title: scene.title || current.title,
          };
        });
        setAiDirty(false);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [effectiveCapabilities, isCreateRoute, projectId, sceneIdParam]);

  useEffect(() => {
    if (!projectId || !jobId) return;
    if (!jobSceneId) {
      setSelectedScene(null);
      return;
    }
    const controller = new AbortController();
    musicApi.listSceneOptions(projectId, {limit: 20, sceneId: jobSceneId}, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setSelectedScene(response.data.items.find((item) => item.sceneId === jobSceneId) ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSelectedScene(null);
      });
    return () => controller.abort();
  }, [jobId, jobSceneId, projectId]);

  const selectScene = (scenes: MusicSceneOption[]) => {
    const scene = scenes[0] ?? null;
    setSelectedScene(scene);
    setScenePickerOpen(false);
    setBrief((current) => {
      if (!current) return current;
      if (!scene) return {...current, context: {type: 'project'}};
      const moods = effectiveCapabilities?.briefFields.moods.includes(scene.mood) ? [scene.mood] : current.moods;
      const durationSeconds = scene.durationSeconds == null || !effectiveCapabilities
        ? current.durationSeconds
        : Math.min(effectiveCapabilities.duration.maxSeconds, Math.max(effectiveCapabilities.duration.minSeconds, scene.durationSeconds));
      return {
        ...current,
        context: {sceneId: scene.sceneId, type: 'scene'},
        durationSeconds,
        moods,
        title: scene.title || current.title,
      };
    });
    setAiDirty(true);
    if (creationMode === 'upload') setUploadDirty(true);
  };

  const changeBrief = (nextBrief: MusicBrief) => {
    setBrief(nextBrief);
    setAiDirty(true);
    setPageError(null);
  };

  const openUploadEditor = () => {
    if (!projectId || !uploadDraft.file || uploadDraft.status !== 'ready') return;
    const editorDraft = saveMusicUploadEditorDraft(projectId, {
      aiDirty,
      brief,
      canEdit: permissions.canEdit,
      creationMode,
      modelKey: selectedModelKey,
      reference,
      selectedScene,
      uploadDirty,
      uploadDraft,
      variantCount,
    }, activeUploadEditorDraftId);
    const returnSearch = new URLSearchParams(searchParams);
    returnSearch.set('mode', 'upload');
    returnSearch.set('uploadDraftId', editorDraft.draftId);
    const returnQuery = returnSearch.toString();
    const returnTo = [musicStudioCreatePath(projectId), returnQuery].filter(Boolean).join('?');
    const editorPath = musicUploadDraftEditorPath(projectId, editorDraft.draftId);
    flushSync(() => {
      setAiDirty(false);
      setUploadDirty(false);
    });
    navigate(editorPath, {
      state: {returnTo},
    });
  };

  const validateBrief = (): string | null => {
    if (!brief || !effectiveCapabilities || !selectedModel?.configured) {
      return t('musicStudio.validation.notReady');
    }
    if (!brief.title.trim()) return t('musicStudio.validation.title');
    if (!brief.purpose || !brief.genre) return t('musicStudio.validation.requiredSound');
    if (brief.moods.length < 1 || brief.moods.length > 3) return t('musicStudio.validation.moods');
    if (
      brief.durationSeconds < effectiveCapabilities.duration.minSeconds
      || brief.durationSeconds > effectiveCapabilities.duration.maxSeconds
    ) return t('musicStudio.validation.duration');
    if (brief.content.mode === 'song') {
      if (!effectiveCapabilities.lyrics.supported) return t('musicStudio.validation.songUnsupported');
      if (brief.content.sections.some((section) => !section.text.trim())) {
        return t('musicStudio.validation.lyrics');
      }
      const length = brief.content.sections.reduce((sum, section) => sum + section.text.length, 0);
      if (length > effectiveCapabilities.lyrics.maxChars) return t('musicStudio.validation.lyricsLength');
    }
    return null;
  };

  const enqueue = async () => {
    if (enqueueInFlightRef.current) return;
    const validationError = validateBrief();
    if (validationError || !brief || !effectiveCapabilities || !selectedModelKey) {
      setPageError(validationError);
      return;
    }
    if (targetTrackIdParam && (!targetTrack || targetTrackLoading)) {
      setPageError(targetTrackError ?? t('musicStudio.errors.loadTrack'));
      return;
    }
    enqueueInFlightRef.current = true;
    if (uploadDirty) {
      const discardUploadDraft = await new Promise<boolean>((resolve) => {
        craftModal.confirm({
          cancelText: t('musicStudio.upload.discardDraftCancel'),
          content: t('musicStudio.upload.discardDraftDescription'),
          okText: t('musicStudio.upload.discardDraftConfirm'),
          onCancel: () => resolve(false),
          onOk: () => resolve(true),
          title: t('musicStudio.upload.discardDraftTitle'),
        });
      });
      if (!discardUploadDraft) {
        enqueueInFlightRef.current = false;
        return;
      }
      flushSync(() => {
        setUploadDraft(EMPTY_UPLOAD_DRAFT);
        setUploadDirty(false);
      });
    }
    const payload: MusicEnqueueRequest = {
      brief: {
        ...briefForCapabilities(brief, effectiveCapabilities.supportsSeed),
        title: brief.title.trim(),
      },
      modelKey: enqueueMusicModelKey(selectedModelKey),
      referenceAssetId: reference?.assetId ?? null,
      targetTrackId: targetTrackIdParam,
      variantCount,
    };
    const expectedTrackVersion = targetTrackIdParam
      ? expectedTrackVersionParam ?? targetTrack?.version ?? null
      : null;
    setSubmitting(true);
    setPageError(null);
    try {
      const response = await runGenerationWithCredits(
        {
          domain: 'music',
          modelKey: payload.modelKey,
          operation: 'generate',
          variantCount,
          promptLength: JSON.stringify(payload.brief).length,
        },
        (approvedEstimate) => {
          const approvedPayload = {
            ...payload,
            modelKey: approvedEstimate.modelKey,
          };
          const fingerprint = musicEnqueueIntentFingerprint(
            approvedPayload,
            expectedTrackVersion,
          );
          const intent = enqueueIntentRef.current?.fingerprint === fingerprint
            ? enqueueIntentRef.current
            : {fingerprint, key: newMusicIdempotencyKey()};
          enqueueIntentRef.current = intent;
          return musicApi.enqueueJob(projectId, approvedPayload, intent.key);
        },
      );
      if (!response) return;
      flushSync(() => setAiDirty(false));
      navigate(musicPathWithParams(
        musicJobPath(projectId, response.data.jobId),
        {expectedTrackVersion},
      ));
    } catch (error: unknown) {
      setPageError(musicErrorDescriptor(error).message);
    } finally {
      enqueueInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const cancelJob = async () => {
    if (!jobId || !generation.job?.permissions.canRunGeneration) return;
    setActionLoading(true);
    setPageError(null);
    try {
      await musicApi.cancelJob(projectId, jobId);
      refreshGeneration();
    } catch (error: unknown) {
      setPageError(musicErrorDescriptor(error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const retryJob = async () => {
    const job = generation.job;
    if (!jobId || !job?.permissions.canRunGeneration) return;
    setActionLoading(true);
    setPageError(null);
    try {
      const response = await musicApi.retryJob(projectId, jobId);
      const nextJobId = normalizedJobId(response.data);
      if (!nextJobId) throw new Error('Missing job id');
      navigate(musicPathWithParams(
        musicJobPath(projectId, nextJobId),
        {
          expectedTrackVersion: job.targetTrackId
            ? expectedTrackVersionParam ?? targetTrack?.version
            : null,
        },
      ));
    } catch (error: unknown) {
      setPageError(musicErrorDescriptor(error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const applyVariant = async (variantId: string) => {
    const job = generation.job;
    if (!job?.permissions.canEdit) return;
    const matchingTargetTrack = job.targetTrackId != null
      && targetTrack?.id === job.targetTrackId
      && !targetTrackLoading
      ? targetTrack
      : null;
    const expectedTrackVersion = job.targetTrackId
      ? expectedTrackVersionParam ?? matchingTargetTrack?.version ?? null
      : null;
    if (job.targetTrackId && (!matchingTargetTrack || expectedTrackVersion == null)) {
      setPageError(targetTrackError ?? t('musicStudio.errors.loadTrack'));
      return;
    }
    setApplyingVariantId(variantId);
    setPageError(null);
    try {
      const response = await musicApi.applyVariant(projectId, job.jobId, variantId, {
        author: 'Craft AI',
        expectedTrackVersion,
        makeActive: true,
        tags: [job.brief.genre, ...job.brief.moods],
        targetTrackId: job.targetTrackId,
        title: job.brief.title,
      });
      setAppliedTrack(response.data);
      refreshGeneration();
      setDataRevision((revision) => revision + 1);
    } catch (error: unknown) {
      setPageError(musicErrorDescriptor(error).message);
    } finally {
      setApplyingVariantId(null);
    }
  };

  const canChangeCreationScene = creationMode === 'ai'
    ? permissions.canRunGeneration
    : permissions.canEdit;
  const contextScene = selectedScene;
  const contextInspector = (
    <div className="music-context-card">
      <span className="music-eyebrow">{t('musicStudio.scene.context')}</span>
      {contextScene ? (
        <>
          <h2>{t('musicStudio.scene.rowTitle', {
            act: contextScene.act ?? '—',
            number: contextScene.number ?? '—',
            title: contextScene.title || contextScene.location,
          })}</h2>
          <p>{contextScene.summary || t('musicStudio.scene.noSummary')}</p>
          <dl>
            <div><dt>{t('musicStudio.scene.location')}</dt><dd>{contextScene.location || '—'}</dd></div>
            <div><dt>{t('musicStudio.scene.mood')}</dt><dd>{contextScene.mood || '—'}</dd></div>
            <div><dt>{t('musicStudio.scene.duration')}</dt><dd>{contextScene.durationSeconds ?? '—'} {t('musicStudio.units.seconds')}</dd></div>
          </dl>
          {isCreateRoute && (
            <Space wrap>
              <Button disabled={!canChangeCreationScene} onClick={() => setScenePickerOpen(true)}>
                {t('musicStudio.scene.change')}
              </Button>
              <Button disabled={!canChangeCreationScene} onClick={() => selectScene([])}>
                {t('musicStudio.scene.projectWide')}
              </Button>
            </Space>
          )}
        </>
      ) : (
        <>
          <h2>{t('musicStudio.scene.projectWide')}</h2>
          <p>{t('musicStudio.scene.optional')}</p>
          {isCreateRoute && (
            <Button disabled={!canChangeCreationScene} onClick={() => setScenePickerOpen(true)}>
              {t('musicStudio.scene.choose')}
            </Button>
          )}
        </>
      )}
      {!canChangeCreationScene && <Alert type="info" showIcon message={t('musicStudio.readOnly')} />}
    </div>
  );

  const createView = !capabilities || !brief ? (
    capabilitiesError ? (
      <Result
        status="error"
        title={t('musicStudio.errors.loadCapabilities')}
        subTitle={capabilitiesError}
        extra={<Button icon={<ReloadOutlined />} onClick={() => setDataRevision((value) => value + 1)}>{t('common.retry')}</Button>}
      />
    ) : <Skeleton active />
  ) : (
    <div className="music-create-view">
      <div className="music-page-heading">
        <div>
          <h1>{t('musicStudio.title')}</h1>
        </div>
      </div>
      <Segmented
        block
        className="music-creation-tabs"
        aria-label={t('musicStudio.create.modeLabel')}
        value={creationMode}
        options={[
          {
            icon: <SoundOutlined />,
            label: t('musicStudio.create.mode.ai'),
            value: 'ai',
          },
          {
            icon: <UploadOutlined />,
            label: t('musicStudio.create.mode.upload'),
            value: 'upload',
          },
        ]}
        onChange={(mode) => setCreationMode(mode as MusicCreationMode)}
      />
      {creationMode === 'ai' && (
        <>
          <MusicModelSelector
            disabled={!permissions.canRunGeneration || Boolean(targetTrackIdParam && !targetTrack)}
            models={models}
            value={selectedModel?.key ?? ''}
            onChange={(modelKey) => {
              setSelectedModelKey(modelKey);
              setAiDirty(true);
              setPageError(null);
            }}
          />
          {models.length > 0 && !models.some((model) => model.configured) && (
            <Alert
              showIcon
              type="warning"
              message={t('musicStudio.model.noneConfigured')}
            />
          )}
          {effectiveCapabilities && (
            <MusicFormatSelector
              capabilities={effectiveCapabilities}
              disabled={!permissions.canRunGeneration || Boolean(targetTrackIdParam && !targetTrack)}
              value={brief}
              onChange={changeBrief}
            />
          )}
        </>
      )}
      {targetTrackLoading && <Spin size="small" />}
      {targetTrackError && <Alert type="error" showIcon message={targetTrackError} />}
      {targetTrack && (
        <Alert
          type="info"
          showIcon
          message={targetTrack.title}
          description={t('musicStudio.track.version', {number: targetTrack.version})}
        />
      )}
      <div className="music-creation-pane" hidden={creationMode !== 'ai'}>
          {effectiveCapabilities && <MusicBriefForm
            capabilities={effectiveCapabilities}
            disabled={!permissions.canRunGeneration || Boolean(targetTrackIdParam && !targetTrack)}
            scenePrefilled={Boolean(selectedScene)}
            value={brief}
            variantCount={variantCount}
            onVariantCountChange={(count) => {
              setVariantCount(count);
              setAiDirty(true);
              setPageError(null);
            }}
            onChange={changeBrief}
          />}
          {effectiveCapabilities?.audioReference.supported && (
            <AudioReferenceField
              capabilities={effectiveCapabilities.audioReference}
              disabled={!permissions.canRunGeneration}
              projectId={projectId}
              value={reference}
              onAudioPlay={activateAudio}
              onChange={(asset) => {
                setReference(asset);
                setAiDirty(true);
                setPageError(null);
              }}
            />
          )}
          {brief.content.mode === 'song' && (
            <LyricsSectionEditor
              disabled={!permissions.canRunGeneration}
              languages={effectiveCapabilities?.lyrics.languages ?? []}
              maxChars={effectiveCapabilities?.lyrics.maxChars ?? 0}
              sectionTypes={effectiveCapabilities?.lyrics.sectionTypes ?? []}
              selectedLanguage={brief.content.lyricsLanguage}
              sections={brief.content.sections}
              onLanguageChange={(lyricsLanguage) => {
                setBrief((current) => {
                  if (!current || current.content.mode !== 'song') return current;
                  return {...current, content: {...current.content, lyricsLanguage}};
                });
                setAiDirty(true);
                setPageError(null);
              }}
              onSectionsChange={(sections) => {
                setBrief((current) => {
                  if (!current || current.content.mode !== 'song') return current;
                  return {...current, content: {...current.content, sections}};
                });
                setAiDirty(true);
                setPageError(null);
              }}
            />
          )}
      </div>
      <div className="music-creation-pane" hidden={creationMode !== 'upload'}>
        <AudioUploadForm
          capabilities={capabilities.audioReference}
          disabled={!permissions.canEdit}
          value={uploadDraft}
          onAudioPlay={activateAudio}
          onEdit={openUploadEditor}
          onChange={(nextDraft) => {
            // TODO: send this draft to the ready-track upload API when that contract exists.
            setUploadDraft(nextDraft);
            setUploadDirty(true);
            setPageError(null);
          }}
        />
      </div>
      {pageError && <Alert type="error" showIcon message={pageError} />}
    </div>
  );

  const creationInspector = capabilities && brief ? (
    <MusicCreationSummary
      brief={brief}
      canEdit={permissions.canEdit}
      canGenerate={permissions.canRunGeneration && selectedModelConfigured}
      generateDisabled={Boolean(validateBrief()) || Boolean(
        targetTrackIdParam && (!targetTrack || targetTrackLoading),
      )}
      mode={creationMode}
      reference={reference}
      scene={selectedScene}
      submitting={submitting}
      uploadDraft={uploadDraft}
      variantCount={variantCount}
      modelKey={enqueueMusicModelKey(selectedModel?.key ?? '')}
      modelLabel={selectedModel?.label}
      onClearScene={() => selectScene([])}
      onGenerate={() => void enqueue()}
      onOpenScenePicker={() => setScenePickerOpen(true)}
    />
  ) : <Skeleton active />;

  const jobView = generation.loading ? (
    <div className="music-centered music-centered--page"><Spin size="large" /></div>
  ) : generation.errorMessage ? (
    <Result
      status="error"
      title={t('musicStudio.errors.loadJob')}
      subTitle={generation.errorMessage}
      extra={<Button onClick={generation.refresh}>{t('common.retry')}</Button>}
    />
  ) : generation.job ? (
    <div className="music-job-view">
      <div className="music-page-heading">
        <div>
          <span className="music-eyebrow">{t('musicStudio.job.title')}</span>
          <h1>{generation.job.brief.title}</h1>
          <p>{generation.job.brief.genre} · {generation.job.brief.durationSeconds} {t('musicStudio.units.seconds')}</p>
        </div>
        {generation.job.permissions.canRunGeneration && (
          <Button onClick={() => navigate(musicStudioCreatePath(projectId))}>
            {t('musicStudio.job.newBrief')}
          </Button>
        )}
      </div>
      <MusicJobState
        actionLoading={actionLoading}
        canMutate={generation.job.permissions.canRunGeneration}
        job={generation.job}
        onCancel={() => void cancelJob()}
        onRetry={() => void retryJob()}
      />
      {pageError && <Alert type="error" showIcon message={pageError} />}
      {generation.job.status === 'completed' && (
        <section className="music-card">
          <div className="music-section-heading">
            <div>
              <h2>{t('musicStudio.player.compareTitle')}</h2>
              <p>{t('musicStudio.player.compareHelper')}</p>
            </div>
          </div>
          <div className="music-variant-grid">
            {generation.job.variants.map((variant) => (
              <MusicVariantPlayer
                key={variant.variantId}
                applying={applyingVariantId === variant.variantId}
                disabled={!generation.job?.permissions.canEdit || Boolean(
                  generation.job?.targetTrackId
                  && (targetTrackLoading || targetTrack?.id !== generation.job.targetTrackId)
                )}
                variant={variant}
                onApply={() => void applyVariant(variant.variantId)}
                onAudioPlay={activateAudio}
                onSignedUrlExpired={refreshVariantSignedUrl}
              />
            ))}
          </div>
          {targetTrackError && <Alert type="error" showIcon message={targetTrackError} />}
          {appliedTrack && (
            <Alert
              type="success"
              showIcon
              message={t('musicStudio.apply.saved')}
              description={appliedTrack.activeVersion?.versionNumber == null
                ? t('musicStudio.track.noVersions')
                : t('musicStudio.apply.version', {number: appliedTrack.activeVersion.versionNumber})}
              action={(
                <Button onClick={() => navigate(musicTrackPath(projectId, appliedTrack.trackId))}>
                  {t('musicStudio.apply.useInScenes')}
                </Button>
              )}
            />
          )}
        </section>
      )}
    </div>
  ) : <Empty />;

  const trackView = trackLoading ? (
    <div className="music-centered music-centered--page"><Spin size="large" /></div>
  ) : trackError ? (
    <Result status="error" title={t('musicStudio.errors.loadTrack')} subTitle={trackError} />
  ) : track ? (
    <TrackInspector
      canEdit={track.permissions?.canEdit ?? permissions.canEdit}
      projectId={projectId}
      track={track}
      onAudioPlay={activateAudio}
      onChanged={() => setDataRevision((revision) => revision + 1)}
      onCreateVersion={() => navigate(musicPathWithParams(
        musicStudioCreatePath(projectId),
        {expectedTrackVersion: track.version, targetTrackId: track.id},
      ))}
      onEdit={() => navigate(musicTrackEditorPath(projectId, track.id), {
        state: {returnTo: currentReturnTo(location)},
      })}
      onSignedUrlExpired={refreshTrackSignedUrl}
    />
  ) : <Empty />;

  const landingView = (
    <Result
      icon={<span className="music-landing-icon" aria-hidden="true">♪</span>}
      title={library.length === 0 ? t('musicStudio.library.empty') : t('musicStudio.landing.title')}
      subTitle={t('musicStudio.landing.subtitle')}
      extra={permissions.canRunGeneration ? (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(musicStudioCreatePath(projectId))}>
          {library.length === 0 ? t('musicStudio.library.createFirst') : t('musicStudio.library.newTrack')}
        </Button>
      ) : undefined}
    />
  );

  const center = isCreateRoute ? createView : jobId ? jobView : trackId ? trackView : landingView;

  if (!projectId) return <Result status="404" title={t('musicStudio.errors.projectMissing')} />;

  return (
    <>
      <MusicStudioShell
        projectId={projectId}
        library={(
          <MusicLibraryPanel
            activeAudio={activateAudio}
            error={libraryError}
            history={history}
            items={library}
            loading={libraryLoading}
            mode={libraryMode}
            permissions={permissions}
            query={query}
            selectedJobId={jobId}
            selectedTrackId={trackId ?? undefined}
            total={libraryTotal}
            onCreate={() => navigate(musicStudioCreatePath(projectId))}
            onModeChange={setLibraryMode}
            onOpenJob={(id) => navigate(musicJobPath(projectId, id))}
            onOpenTrack={(id) => navigate(musicTrackPath(projectId, id))}
            onQueryChange={setQuery}
            onSignedUrlExpired={() => setDataRevision((revision) => revision + 1)}
          />
        )}
        center={center}
        inspector={isCreateRoute ? creationInspector : contextInspector}
      />
      <ScenePickerDialog
        open={scenePickerOpen}
        projectId={projectId}
        selected={selectedScene ? [selectedScene] : []}
        onClose={() => setScenePickerOpen(false)}
        onConfirm={selectScene}
      />
    </>
  );
}
