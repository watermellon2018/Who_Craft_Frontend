import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {message} from 'antd';
import {useTranslation} from 'react-i18next';
import {backendAssetUrl} from '../../../api/http';
import {useNavigate, useParams} from 'react-router-dom';
import {useUnsavedChangesGuard} from '../../../utils/useUnsavedChangesGuard';
import BottomQuickBar from '../components/character3d/BottomQuickBar';
import CharacterCategoryRail from '../components/character3d/CharacterCategoryRail';
import CharacterViewport from '../components/character3d/CharacterViewport';
import type {ViewAngle, ViewportApi} from '../components/character3d/CharacterViewport';
import ContextualZonePanel from '../components/character3d/ContextualZonePanel';
import ReferenceDock from '../components/character3d/ReferenceDock';
import StepperHeader from '../components/character3d/StepperHeader';
import {ParamHistory} from '../components/character3d/engine/history';
import GenerationJobHistory from '../components/GenerationJobHistory';
import {
  buildInitialZoneParams,
  findZone,
  getAncestors,
  getTopLevelGroup,
} from '../components/character3d/zones';
import type {EditableZone, ZoneGroup} from '../components/character3d/zones';

import {characterApi} from '../api/characterApi';
import type {CharacterRevision, GenerationJob, Model3DReconstruction} from '../types/character.types';
import {clampParameter} from '../components/character3d/engine/dragBindings';
import {collapseSideOverrides, mergeSavedParams} from '../components/character3d/engine/paramMerge';
import {useCharacter} from '../hooks/useCharacter';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import './Character3DEditorPage.css';

// Top-level page for the 3D character editor.
//
// State machine:
//   • hoveredZoneId       — viewport hover for soft outline
//   • selectedZoneId      — current focus; drives the right panel + rail
//   • zoomZoneId          — visual "detail mode" anchor; null = not zoomed
//   • symmetryEnabled     — whether edits mirror onto the opposite side
//   • zoneParams          — per-zone parameter values, keyed by paramId
//   • selectedSide        — reserved for future left/right side selection
//                          (kept here so side-aware parameter application
//                          can read it without a state shape migration)
//
// The viewport renders the SMPL morph rig (engine/morphRig.ts): zone
// raycasting, drag-to-edit and camera focus are real; zoneParams is the
// single source of truth shared with the panel and persisted via
// characterApi.getModel3D / saveModel3D.
const MODEL3D_AUTOFIT_VERSION = 7;

const MODEL3D_HISTORY_JOB_TYPES = ['model3d_reconstruction'] as const;
const versionedAssetUrl = (url: string, assetId?: string | null): string => {
  const resolved = backendAssetUrl(url);
  if (!assetId) return resolved;
  const separator = resolved.includes('?') ? '&' : '?';
  return `${resolved}${separator}asset=${encodeURIComponent(assetId)}`;
};
const Character3DEditorPage: React.FC = () => {
  const params = useParams();
  const projectId = useProjectIdFromRoute();
  const characterId = String(params.characterId || '');
  return <Character3DEditorPageContent key={`${projectId ?? ''}:${characterId}`} />;
};

const Character3DEditorPageContent: React.FC = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const projectId = useProjectIdFromRoute();
  const characterId = String(params.characterId || '');
  const {character} = useCharacter(projectId ?? undefined, characterId);

  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoomZoneId, setZoomZoneId] = useState<string | null>(null);
  const [symmetryEnabled, setSymmetryEnabled] = useState<boolean>(true);
  const [asymmetricSupported, setAsymmetricSupported] = useState(false);
  type ZoneParamsState = Record<string, Record<string, number | string | boolean>>;
  const [zoneParams, setZoneParams] = useState<ZoneParamsState>(() => buildInitialZoneParams());
  // Apply changes the Cancel target, while Save alone changes persistence.
  // Keeping both snapshots ensures Apply never disguises unsaved work.
  const [cancelBaseline, setCancelBaseline] = useState(zoneParams);
  const [savedBaseline, setSavedBaseline] = useState(zoneParams);
  // Which mirrored half the user edits while «Применять симметрично» is off.
  const [selectedSide, setSelectedSide] = useState<'L' | 'R'>('L');

  // Undo/redo. The class owns the stacks; historyVersion only forces the
  // toolbar buttons to re-render after a mutation.
  //
  // The history stack and the params ref are mutated ONLY from event
  // handlers, never inside a setState updater: React invokes updaters twice
  // under StrictMode (and may discard renders in concurrent mode), which
  // would push duplicate history entries and desync the stacks. We mirror
  // the committed params in a ref and derive the next state explicitly.
  const historyRef = useRef(new ParamHistory());
  const zoneParamsRef = useRef(zoneParams);
  const [, setHistoryVersion] = useState(0);
  const [viewportApi, setViewportApi] = useState<ViewportApi | null>(null);
  const [autofitBusy, setAutofitBusy] = useState(false);
  const [reconstruction, setReconstruction] = useState<Model3DReconstruction | null>(null);
  const [reconstructionRetryBusy, setReconstructionRetryBusy] = useState(false);
  const [modelLoadState, setModelLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const pageActiveRef = useRef(true);
  // Turntable on/off — owned here so the toggle button reflects the state.
  const [turntableOn, setTurntableOn] = useState(false);
  const [revisions, setRevisions] = useState<CharacterRevision[]>([]);
  const [revisionId, setRevisionId] = useState('');
  const [revisionListBusy, setRevisionListBusy] = useState(false);
  const revisionListRequestRef = useRef(0);
  // A synchronous lock protects all model writes, including callbacks captured
  // before React renders a disabled button. Listing history never releases it.
  const modelMutationRef = useRef<'save' | 'restore' | 'retry' | null>(null);
  const [modelMutation, setModelMutation] = useState<'save' | 'restore' | 'retry' | null>(null);
  const modelEpochRef = useRef(0);
  const revisionBusy = modelMutation !== null;
  const [revisionError, setRevisionError] = useState(false);
  const [revisionReloadFailed, setRevisionReloadFailed] = useState(false);

  const loadRevisions = useCallback(async () => {
    if (!projectId || !characterId) return;
    const request = ++revisionListRequestRef.current;
    setRevisionListBusy(true);
    setRevisionError(false);
    try {
      const response = await characterApi.listRevisions(projectId, characterId);
      if (!pageActiveRef.current || request !== revisionListRequestRef.current) return;
      const data = response.data;
      const items: CharacterRevision[] = Array.isArray(data) ? data : data?.results ?? data?.revisions ?? [];
      setRevisions(items.filter((revision) => Object.prototype.hasOwnProperty.call(revision.after_snapshot ?? {}, 'model3d_params')));
    } catch {
      if (pageActiveRef.current && request === revisionListRequestRef.current) setRevisionError(true);
    } finally {
      if (pageActiveRef.current && request === revisionListRequestRef.current) setRevisionListBusy(false);
    }
  }, [projectId, characterId]);

  useEffect(() => {
    pageActiveRef.current = true;
    return () => {
      pageActiveRef.current = false;
    };
  }, []);

  // Commit a new params object: keep the ref mirror in sync and trigger a
  // toolbar re-render. Pure with respect to React state updaters.
  const commitParams = useCallback((next: ZoneParamsState) => {
    zoneParamsRef.current = next;
    setZoneParams(next);
    setHistoryVersion((v) => v + 1);
  }, []);

  // Single entry point for parameter mutations — records undo history.
  const mutateParams = useCallback(
    (producer: (prev: ZoneParamsState) => ZoneParamsState) => {
      if (modelMutationRef.current || modelLoadState !== 'ready' || autofitBusy) return;
      const prev = zoneParamsRef.current;
      const next = producer(prev);
      if (next === prev) return;
      historyRef.current.record(prev, Date.now());
      commitParams(next);
    },
    [commitParams, modelLoadState, autofitBusy],
  );

  const handleUndo = useCallback(() => {
    if (modelMutationRef.current) return;
    const restored = historyRef.current.undo(zoneParamsRef.current);
    if (restored) commitParams(restored);
  }, [commitParams]);

  const handleRedo = useCallback(() => {
    if (modelMutationRef.current) return;
    const restored = historyRef.current.redo(zoneParamsRef.current);
    if (restored) commitParams(restored);
  }, [commitParams]);

  const handleGestureStart = useCallback(() => {
    if (!modelMutationRef.current) historyRef.current.beginGesture();
  }, []);
  const handleGestureEnd = useCallback(() => historyRef.current.endGesture(), []);

  const handleRestoreRevision = useCallback(async () => {
    if (!projectId || !characterId || !revisionId || modelMutationRef.current
      || modelLoadState !== 'ready' || autofitBusy || reconstructionRetryBusy) return;
    if (JSON.stringify(zoneParamsRef.current) !== JSON.stringify(savedBaseline)) return;
    modelMutationRef.current = 'restore';
    setModelMutation('restore');
    modelEpochRef.current++;
    setRevisionError(false);
    setRevisionReloadFailed(false);
    let persisted = false;
    try {
      await characterApi.restoreRevision(projectId, characterId, revisionId);
      persisted = true;
      const response = await characterApi.getModel3D(projectId, characterId);
      if (!pageActiveRef.current) return;
      const restored = mergeSavedParams(response.data.params ?? {});
      historyRef.current.reset();
      commitParams(restored);
      setSavedBaseline(restored);
      setCancelBaseline(restored);
      setReconstruction(response.data.reconstruction ?? null);
      setHoveredZoneId(null);
      setTurntableOn(false);
      setModelLoadState('ready');
      setRevisionId('');
      message.success(t('characterStudio3d.revisions.restored'));
    } catch {
      if (pageActiveRef.current) {
        if (persisted) {
          setModelLoadState('failed');
          setRevisionReloadFailed(true);
        }
        setRevisionError(true);
        message.error(t(persisted ? 'characterStudio3d.revisions.restoreReloadError' : 'characterStudio3d.revisions.restoreError'));
      }
    } finally {
      modelMutationRef.current = null;
      if (pageActiveRef.current) setModelMutation(null);
    }
  }, [projectId, characterId, revisionId, modelLoadState, autofitBusy, reconstructionRetryBusy, commitParams, savedBaseline, t]);

  // ─── Open the 3D stage: load saved state, or auto-fit on the first open ───
  //
  // The editor seeds itself automatically. A newer character-aware autofit may
  // supplement a legacy sparse fit once; existing saved values remain intact.
  useEffect(() => {
    if (!projectId || !characterId) return;
    let alive = true;
    setModelLoadState('loading');

    const adopt = (saved: unknown) => {
      if (!saved || typeof saved !== 'object' || Object.keys(saved).length === 0) return;
      const merged = mergeSavedParams(saved);
      zoneParamsRef.current = merged;
      setZoneParams(merged);
      setCancelBaseline(merged);
      setSavedBaseline(merged);
      // The loaded state is the new ground zero — nothing to undo into.
      historyRef.current.reset();
    };

    characterApi
      .getModel3D(projectId, characterId)
      .then((res) => {
        if (!alive) return;
        setReconstruction(res.data?.reconstruction ?? null);
        const saved = res.data?.params;
        const hasSaved = saved && typeof saved === 'object' && Object.keys(saved).length > 0;
        if (hasSaved) adopt(saved);
        const autofitVersion = Number(res.data?.autofit_version ?? 0);
        if (res.data?.autofit_done && autofitVersion >= MODEL3D_AUTOFIT_VERSION) {
          // Current fit (including an intentional empty/reset state): keep it.
          setModelLoadState('ready');
          return;
        }
        // First open, or a one-time upgrade from the old image-only profile.
        setAutofitBusy(true);
        characterApi
          .autofitModel3D(projectId, characterId)
          .then((fit) => {
            if (!alive) return;
            adopt(fit.data?.params);
          })
          .catch(() => {
            // Autofit is best-effort; defaults stand if it fails.
          })
          .finally(() => {
            if (alive) {
              setAutofitBusy(false);
              setModelLoadState('ready');
            }
          });
      })
      .catch(() => {
        // No saved state (or transient error) — the registry defaults stand.
        if (alive) {
          setModelLoadState('failed');
          setReconstruction((current) => current ?? {
            status: 'failed',
            progress: 0,
            job_id: null,
            asset_id: null,
            model_url: null,
            error_message: '',
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [projectId, characterId]);

  // Hunyuan generation is a detached GPU job and can take several minutes.
  // Poll only while it is active; a ready URL stops polling and is loaded once.
  useEffect(() => {
    if (!projectId || !characterId) return;
    if (modelMutation) return;
    if (
      reconstruction?.status !== 'queued' &&
      reconstruction?.status !== 'processing'
    ) return;
    let alive = true;
    let timer: number | undefined;
    const poll = async () => {
      const epoch = modelEpochRef.current;
      try {
        const response = await characterApi.getModel3D(projectId, characterId);
        if (alive && epoch === modelEpochRef.current && !modelMutationRef.current) setReconstruction(response.data.reconstruction);
      } catch {
        // Keep the last known state; the next polling tick can recover.
      } finally {
        if (alive) timer = window.setTimeout(() => void poll(), 4000);
      }
    };
    void poll();
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [projectId, characterId, reconstruction?.status, modelMutation]);

  // ─── Derived state ───
  const selectedZone: EditableZone | null = useMemo(() => findZone(selectedZoneId), [selectedZoneId]);
  const ancestors = useMemo(() => getAncestors(selectedZoneId), [selectedZoneId]);
  const ancestorIds = useMemo(() => ancestors.map((a) => a.id), [ancestors]);
  const activeGroup: ZoneGroup | null = useMemo(
    () => (selectedZoneId ? getTopLevelGroup(selectedZoneId) : null),
    [selectedZoneId],
  );
  // Side-scoped editing is active only for symmetric zones with symmetry off.
  const editSide: 'L' | 'R' | null =
    asymmetricSupported && selectedZone?.isSymmetric && !symmetryEnabled ? selectedSide : null;
  const hasUnappliedChanges = useMemo(
    () => JSON.stringify(zoneParams) !== JSON.stringify(cancelBaseline),
    [cancelBaseline, zoneParams],
  );
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(zoneParams) !== JSON.stringify(savedBaseline),
    [savedBaseline, zoneParams],
  );
  useUnsavedChangesGuard(hasUnsavedChanges);

  // ─── Handlers ───
  const handleSelectZone = useCallback((zoneId: string | null) => {
    setSelectedZoneId(zoneId);
    setHoveredZoneId(null);
    // Camera follows the selection: face/hair zones are small, so the
    // camera zooms onto them automatically; body/pose/skin work at figure
    // scale, so selecting them returns the camera to the full view.
    if (zoneId === null) {
      setZoomZoneId(null);
      return;
    }
    const group = getTopLevelGroup(zoneId);
    setZoomZoneId(group === 'face' || group === 'hair' ? zoneId : null);
  }, []);

  const handleHoverZone = useCallback((zoneId: string | null) => {
    setHoveredZoneId(zoneId);
  }, []);

  const handleCategorySelect = useCallback((group: ZoneGroup) => {
    // Clicking a left-rail category jumps to that group's top-level zone.
    handleSelectZone(group);
  }, [handleSelectZone]);

  const handleParameterChange = useCallback(
    (zoneId: string, paramId: string, value: number | string | boolean, side?: 'L' | 'R' | null) => {
      if (modelMutationRef.current) return;
      if (side && !asymmetricSupported) return;
      const nextValue = typeof value === 'number' ? clampParameter(zoneId, paramId, value) : value;
      mutateParams((prev) => {
        const zone = {...(prev[zoneId] ?? {})};
        const key = side ? `${paramId}__${side}` : paramId;
        if (zone[key] === nextValue && (side || (zone[`${paramId}__L`] === undefined && zone[`${paramId}__R`] === undefined))) return prev;
        if (side) {
          // Asymmetric edit: write the per-side override, the shared value
          // keeps serving the other side.
          zone[`${paramId}__${side}`] = nextValue;
        } else {
          // Symmetric edit: set the shared value and drop stale overrides so
          // both sides actually follow the slider.
          zone[paramId] = nextValue;
          delete zone[`${paramId}__L`];
          delete zone[`${paramId}__R`];
        }
        return {...prev, [zoneId]: zone};
      });
    },
    [mutateParams, asymmetricSupported],
  );

  const handleZoomToggle = useCallback(() => {
    if (!selectedZoneId) return;
    setZoomZoneId((prev) => (prev === selectedZoneId ? null : selectedZoneId));
  }, [selectedZoneId]);

  const handleSymmetryToggle = useCallback(() => {
    if (modelMutationRef.current) return;
    if (!asymmetricSupported) return;
    setSymmetryEnabled((prev) => {
      const next = !prev;
      if (next && selectedZoneId) {
        // Re-enabling symmetry folds the per-side values back into one:
        // both sides adopt the side the user was just editing.
        mutateParams((p) => collapseSideOverrides(p, selectedZoneId, selectedSide));
      }
      return next;
    });
  }, [selectedZoneId, selectedSide, mutateParams, asymmetricSupported]);

  const handleReset = useCallback(() => {
    // Reset only the currently-selected zone's params to defaults — the
    // global reset is the bottom bar; this is panel-scoped.
    if (!selectedZoneId) return;
    const initial = buildInitialZoneParams();
    mutateParams((prev) => ({...prev, [selectedZoneId]: initial[selectedZoneId] ?? {}}));
  }, [selectedZoneId, mutateParams]);

  const handleGlobalReset = useCallback(() => {
    mutateParams(() => buildInitialZoneParams());
  }, [mutateParams]);

  const handleCancel = useCallback(() => {
    mutateParams(() => cancelBaseline);
  }, [cancelBaseline, mutateParams]);

  const handleApply = useCallback(() => {
    if (modelMutationRef.current) return;
    setCancelBaseline(zoneParams);
    message.success(t('characterStudio3d.messages.changesApplied'));
  }, [t, zoneParams]);

  // ─── Snapshot / export ───
  const exportName = useCallback(
    (ext: string) => `${(character?.name || 'character').replace(/[^\wа-яА-ЯёЁ-]+/gu, '_')}_3d.${ext}`,
    [character?.name],
  );

  const handleSnapshot = useCallback(() => {
    if (!viewportApi) return;
    downloadUrl(viewportApi.snapshotPng(), exportName('png'));
    message.success(t('characterStudio3d.messages.snapshotSaved'));
  }, [exportName, t, viewportApi]);

  const handleExportGlb = useCallback(() => {
    if (!viewportApi) return;
    viewportApi
      .exportGlb()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        downloadUrl(url, exportName('glb'));
        URL.revokeObjectURL(url);
        message.success(t('characterStudio3d.messages.glbExported'));
      })
      .catch(() => message.error(t('characterStudio3d.messages.glbExportFailed')));
  }, [exportName, t, viewportApi]);

  // ─── Camera presets / turntable ───
  // Snapping to a reference angle stops the turntable, mirroring the viewport:
  // a preset and the orbit must not push the camera at the same time.
  const handleSetView = useCallback(
    (angle: ViewAngle) => {
      if (!viewportApi) return;
      viewportApi.setView(angle);
      setTurntableOn(false);
    },
    [viewportApi],
  );

  const handleToggleTurntable = useCallback(() => {
    if (!viewportApi) return;
    setTurntableOn((prev) => {
      const next = !prev;
      viewportApi.toggleTurntable(next);
      return next;
    });
  }, [viewportApi]);

  // If the GL context drops (e.g. unmount/remount), reflect the turntable as
  // off so the button doesn't lie about a stopped orbit.
  useEffect(() => {
    if (!viewportApi) setTurntableOn(false);
  }, [viewportApi]);

  // ─── Undo/redo hotkeys ───
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  const handleSave = useCallback(() => {
    if (modelMutationRef.current) return;
    if (!projectId || !characterId || modelLoadState !== 'ready') {
      message.error(t('characterStudio3d.messages.saveUnavailable'));
      return;
    }
    const savedParams = zoneParams;
    modelMutationRef.current = 'save';
    setModelMutation('save');
    characterApi
      .saveModel3D(projectId, characterId, savedParams)
      .then(() => {
        if (!pageActiveRef.current) return;
        setCancelBaseline(savedParams);
        setSavedBaseline(savedParams);
        message.success(t('characterStudio3d.messages.modelSaved'));
      })
      .catch(() => {
        if (pageActiveRef.current) {
          message.error(t('characterStudio3d.messages.modelSaveFailed'));
        }
      })
      .finally(() => {
        modelMutationRef.current = null;
        if (pageActiveRef.current) setModelMutation(null);
      });
  }, [characterId, modelLoadState, projectId, t, zoneParams]);

  // ─── Esc clears selection ───
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (zoomZoneId) {
          // Esc unwinds zoom first, then selection (familiar layering).
          setZoomZoneId(null);
        } else if (selectedZoneId) {
          handleSelectZone(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomZoneId, selectedZoneId, handleSelectZone]);

  const handleRetryReconstruction = useCallback(() => {
    if (!projectId || !characterId || reconstructionRetryBusy || modelMutationRef.current) return;
    modelMutationRef.current = 'retry';
    setModelMutation('retry');
    modelEpochRef.current++;
    setReconstructionRetryBusy(true);
    characterApi
      .retryModel3DReconstruction(projectId, characterId)
      .then((response) => {
        if (pageActiveRef.current) setReconstruction(response.data.reconstruction);
      })
      .catch(() => {
        if (pageActiveRef.current) {
          message.error(t('characterStudio3d.messages.reconstructionRetryFailed'));
        }
      })
      .finally(() => {
        modelMutationRef.current = null;
        if (pageActiveRef.current) {
          setReconstructionRetryBusy(false);
          setModelMutation(null);
        }
      });
  }, [characterId, projectId, reconstructionRetryBusy, t]);


  const reconstructionGenerationJob = useMemo<GenerationJob | null>(() => {
    if (!reconstruction?.job_id) return null;
    const status: GenerationJob['status'] = reconstruction.status === 'ready'
      ? 'completed'
      : reconstruction.status === 'failed'
        ? 'failed'
        : reconstruction.status === 'cancellation_requested'
          ? 'cancellation_requested'
        : reconstruction.status === 'processing'
          ? 'processing'
          : 'queued';
    return {
      job_id: reconstruction.job_id,
      job_type: 'model3d_reconstruction',
      status,
      progress: reconstruction.progress,
      error_message: reconstruction.error_message,
      variants: [],
    };
  }, [reconstruction]);

  const handleGenerationJobStarted = useCallback((nextJobId: string, sourceJob: GenerationJob) => {
    if (modelMutationRef.current) return;
    if (sourceJob.job_id !== reconstruction?.job_id) return;
    setReconstruction((current) => ({
      status: 'queued',
      progress: 0,
      job_id: nextJobId,
      asset_id: current?.asset_id ?? null,
      model_url: current?.model_url ?? null,
      hair_url: current?.hair_url ?? null,
      assets: current?.assets,
      error_message: '',
    }));
  }, [reconstruction?.job_id]);
  const characterName = character?.name || t('characterStudio3d.defaultCharacterName');
  const reconstructedHeadUrl =
    reconstruction?.status === 'ready' && reconstruction.model_url
      ? versionedAssetUrl(reconstruction.model_url, reconstruction.asset_id)
      : null;
  const reconstructedHairUrl =
    reconstruction?.status === 'ready' && reconstruction.hair_url
      ? versionedAssetUrl(
        reconstruction.hair_url,
        reconstruction.assets?.hair?.asset_id,
      )
      : null;

  const handleBack = () => {
    if (characterId && projectId) {
      navigate(`/project/${projectId}/characters/${characterId}/references`);
    } else {
      navigate(-1);
    }
  };

  const handleStepClick = (stepKey: 'parameters' | 'variants' | 'editor' | 'references' | 'model3d') => {
    if (!characterId || !projectId) return;
    const base = `/project/${projectId}/characters/${characterId}`;
    if (stepKey === 'references') return navigate(`${base}/references`);
    if (stepKey === 'editor') return navigate(`${base}/edit`);
    if (stepKey === 'variants') return navigate(`${base}/variants`);
    if (stepKey === 'parameters') return navigate(`${base}`);
  };

  return (
    <div className="c3d-page">
      <StepperHeader
        characterName={characterName}
        character={character}
        onBack={handleBack}
        onStepClick={handleStepClick}
      />

      <div className="c3d-workspace">
        <CharacterCategoryRail active={activeGroup} onSelect={handleCategorySelect} />

        <main className="c3d-stage">
          <CharacterViewport
            key={reconstruction?.asset_id ?? 'pending'}
            hoveredZoneId={hoveredZoneId}

            selectedZoneId={selectedZoneId}
            zoomZoneId={zoomZoneId}
            ancestorIds={ancestorIds}
            onHoverZone={handleHoverZone}
            onSelectZone={handleSelectZone}
            onParameterChange={handleParameterChange}
            onGestureStart={handleGestureStart}
            onGestureEnd={handleGestureEnd}
            onAsymmetricCapabilityChange={setAsymmetricSupported}
            editSide={editSide}
            onSideChange={setSelectedSide}
            onApiReady={setViewportApi}
            zoneParams={zoneParams}
            reconstructedHeadUrl={reconstructedHeadUrl}
            reconstructedHairUrl={reconstructedHairUrl}
            reconstructionStatus={reconstruction?.status}
            reconstructionProgress={reconstruction?.progress ?? 0}
            reconstructionRetryBusy={reconstructionRetryBusy}
            onRetryReconstruction={handleRetryReconstruction}
          />

          <ReferenceDock
            projectId={projectId}
            characterId={characterId}
            fitting={autofitBusy}
          />

          <div
            className={`c3d-inspector-slot ${selectedZoneId ? 'c3d-inspector-slot--visible' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextualZonePanel
              zone={selectedZone}
              ancestors={ancestors}
              zoneParams={zoneParams[selectedZoneId ?? ''] ?? {}}
              symmetryEnabled={symmetryEnabled}
              asymmetricSupported={asymmetricSupported}
              supportsParameter={viewportApi?.supportsParameter}
              editSide={editSide}
              onSideChange={setSelectedSide}
              isZoomed={!!zoomZoneId && zoomZoneId === selectedZoneId}
              hasChanges={hasUnappliedChanges}
              onSelectZone={handleSelectZone}
              onClose={() => handleSelectZone(null)}
              onParameterChange={handleParameterChange}
              onZoomToggle={handleZoomToggle}
              onSymmetryToggle={handleSymmetryToggle}
              onReset={handleReset}
              onCancel={handleCancel}
              onApply={handleApply}
              onSave={handleSave}
              saveDisabled={modelLoadState !== 'ready' || revisionBusy}
            />
          </div>
        </main>
      </div>

      <details className="c3d-saved-revisions" onToggle={(event) => {
        if (event.currentTarget.open) void loadRevisions();
      }}>
        <summary>{t('characterStudio3d.revisions.title')}</summary>
        <p>{t('characterStudio3d.revisions.hint')}</p>
        <label>
          {t('characterStudio3d.revisions.select')}
          <select value={revisionId} disabled={revisionBusy || revisionListBusy} onChange={(event) => setRevisionId(event.target.value)}>
            <option value="">{t('characterStudio3d.revisions.placeholder')}</option>
            {revisions.map((revision) => <option key={revision.revision_id} value={revision.revision_id}>
              #{revision.revision_number} · {revision.change_summary || revision.created_at}
            </option>)}
          </select>
        </label>
        <button type="button" disabled={!revisionId || revisionBusy || hasUnsavedChanges || modelLoadState !== 'ready' || autofitBusy || reconstructionRetryBusy} onClick={handleRestoreRevision}>
          {t('characterStudio3d.revisions.restore')}
        </button>
        <button type="button" disabled={revisionListBusy} onClick={() => void loadRevisions()}>
          {t('characterStudio3d.revisions.refresh')}
        </button>
        {revisionId && !revisions.find((revision) => revision.revision_id === revisionId)?.after_snapshot?.model3d_reconstruction
          && !Object.prototype.hasOwnProperty.call(revisions.find((revision) => revision.revision_id === revisionId)?.after_snapshot ?? {}, 'model3d_asset_id')
          ? <p>{t('characterStudio3d.revisions.legacy')}</p> : null}
        {hasUnsavedChanges ? <p>{t('characterStudio3d.revisions.unsaved')}</p> : null}
        {revisionReloadFailed
          ? <p role="alert">{t('characterStudio3d.revisions.restoreReloadError')}</p>
          : revisionError ? <p role="alert">{t('characterStudio3d.revisions.error')}</p> : null}
      </details>

      <BottomQuickBar
        generationHistory={(
          <GenerationJobHistory
            allowedJobTypes={MODEL3D_HISTORY_JOB_TYPES}
            characterId={characterId}
            className="c3d-generation-history"
            currentJob={reconstructionGenerationJob}
            currentJobId={reconstruction?.job_id}
            onJobStarted={handleGenerationJobStarted}
            projectId={projectId ?? ''}
          />
        )}
        selectedZone={selectedZone}
        zoneParams={zoneParams[selectedZoneId ?? ''] ?? {}}
        hasChanges={hasUnappliedChanges}
        canUndo={!revisionBusy && historyRef.current.canUndo}
        canRedo={!revisionBusy && historyRef.current.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSnapshot={viewportApi ? handleSnapshot : undefined}
        onExportGlb={viewportApi ? handleExportGlb : undefined}
        onSetView={viewportApi ? handleSetView : undefined}
        onToggleTurntable={viewportApi ? handleToggleTurntable : undefined}
        turntableOn={turntableOn}
        onReset={handleGlobalReset}
        onParameterChange={handleParameterChange}
        onCancel={handleCancel}
        onApply={handleApply}
        onSave={handleSave}
        saveDisabled={modelLoadState !== 'ready' || revisionBusy}
      />
    </div>
  );
};

// Trigger a browser download for a data/object URL.
function downloadUrl(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

export default Character3DEditorPage;
