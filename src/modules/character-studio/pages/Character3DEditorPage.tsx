import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {message} from 'antd';
import {useNavigate, useParams} from 'react-router-dom';
import BottomQuickBar from '../components/character3d/BottomQuickBar';
import CharacterCategoryRail from '../components/character3d/CharacterCategoryRail';
import CharacterViewport, {ViewportApi} from '../components/character3d/CharacterViewport';
import ContextualZonePanel from '../components/character3d/ContextualZonePanel';
import ReferenceDock from '../components/character3d/ReferenceDock';
import StepperHeader from '../components/character3d/StepperHeader';
import {ParamHistory} from '../components/character3d/engine/history';
import {
  buildInitialZoneParams,
  EditableZone,
  findZone,
  getAncestors,
  getTopLevelGroup,
  ZoneGroup,
} from '../components/character3d/zones';

const MOCK_CHARACTER_NAME = 'Персонаж';
import {characterApi} from '../api/characterApi';
import {
  applyAutofitSuggestions,
  collapseSideOverrides,
  mergeSavedParams,
} from '../components/character3d/engine/paramMerge';
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
// The viewport renders a parametric Three.js rig (engine/rig.ts): zone
// raycasting, drag-to-edit and camera focus are real; zoneParams is the
// single source of truth shared with the panel and persisted via
// characterApi.getModel3D / saveModel3D.
const Character3DEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const projectId = useProjectIdFromRoute();
  const characterId = String(params.characterId || '');
  const {character} = useCharacter(projectId ?? undefined, characterId);

  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoomZoneId, setZoomZoneId] = useState<string | null>(null);
  const [symmetryEnabled, setSymmetryEnabled] = useState<boolean>(true);
  type ZoneParamsState = Record<string, Record<string, number | string | boolean>>;
  const [zoneParams, setZoneParams] = useState<ZoneParamsState>(() => buildInitialZoneParams());
  // Baseline snapshot for the Cancel button; reset on Apply/Save.
  const [paramsBaseline, setParamsBaseline] = useState(zoneParams);
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
      const prev = zoneParamsRef.current;
      const next = producer(prev);
      if (next === prev) return;
      historyRef.current.record(prev, Date.now());
      commitParams(next);
    },
    [commitParams],
  );

  const handleUndo = useCallback(() => {
    const restored = historyRef.current.undo(zoneParamsRef.current);
    if (restored) commitParams(restored);
  }, [commitParams]);

  const handleRedo = useCallback(() => {
    const restored = historyRef.current.redo(zoneParamsRef.current);
    if (restored) commitParams(restored);
  }, [commitParams]);

  // ─── Load saved 3D state ───
  useEffect(() => {
    if (!projectId || !characterId) return;
    let alive = true;
    characterApi
      .getModel3D(projectId, characterId)
      .then((res) => {
        if (!alive) return;
        const saved = res.data?.params;
        if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
          const merged = mergeSavedParams(saved);
          zoneParamsRef.current = merged;
          setZoneParams(merged);
          setParamsBaseline(merged);
          // The loaded state is the new ground zero — nothing to undo into.
          historyRef.current.reset();
        }
      })
      .catch(() => {
        // No saved state (or transient error) — the registry defaults stand.
      });
    return () => {
      alive = false;
    };
  }, [projectId, characterId]);

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
    selectedZone?.isSymmetric && !symmetryEnabled ? selectedSide : null;
  const hasUnappliedChanges = useMemo(
    () => JSON.stringify(zoneParams) !== JSON.stringify(paramsBaseline),
    [zoneParams, paramsBaseline],
  );

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
      mutateParams((prev) => {
        const zone = {...(prev[zoneId] ?? {})};
        if (side) {
          // Asymmetric edit: write the per-side override, the shared value
          // keeps serving the other side.
          zone[`${paramId}__${side}`] = value;
        } else {
          // Symmetric edit: set the shared value and drop stale overrides so
          // both sides actually follow the slider.
          zone[paramId] = value;
          delete zone[`${paramId}__L`];
          delete zone[`${paramId}__R`];
        }
        return {...prev, [zoneId]: zone};
      });
    },
    [mutateParams],
  );

  const handleZoomToggle = useCallback(() => {
    if (!selectedZoneId) return;
    setZoomZoneId((prev) => (prev === selectedZoneId ? null : selectedZoneId));
  }, [selectedZoneId]);

  const handleSymmetryToggle = useCallback(() => {
    setSymmetryEnabled((prev) => {
      const next = !prev;
      if (next && selectedZoneId) {
        // Re-enabling symmetry folds the per-side values back into one:
        // both sides adopt the side the user was just editing.
        mutateParams((p) => collapseSideOverrides(p, selectedZoneId, selectedSide));
      }
      return next;
    });
  }, [selectedZoneId, selectedSide, mutateParams]);

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
    mutateParams(() => paramsBaseline);
  }, [paramsBaseline, mutateParams]);

  const handleApply = useCallback(() => {
    setParamsBaseline(zoneParams);
    message.success('Изменения применены');
  }, [zoneParams]);

  // ─── Snapshot / export ───
  const exportName = useCallback(
    (ext: string) => `${(character?.name || 'character').replace(/[^\wа-яА-ЯёЁ-]+/gu, '_')}_3d.${ext}`,
    [character?.name],
  );

  const handleSnapshot = useCallback(() => {
    if (!viewportApi) return;
    downloadUrl(viewportApi.snapshotPng(), exportName('png'));
    message.success('Снимок сохранён');
  }, [viewportApi, exportName]);

  const handleExportGlb = useCallback(() => {
    if (!viewportApi) return;
    viewportApi
      .exportGlb()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        downloadUrl(url, exportName('glb'));
        URL.revokeObjectURL(url);
        message.success('Модель экспортирована в GLB');
      })
      .catch(() => message.error('Не удалось экспортировать модель'));
  }, [viewportApi, exportName]);

  // ─── Autofit from references ───
  const handleAutofit = useCallback(() => {
    if (!projectId || !characterId) {
      message.info('Автоподгонка доступна, когда персонаж привязан к проекту');
      return;
    }
    setAutofitBusy(true);
    characterApi
      .autofitModel3D(projectId, characterId)
      .then((res) => {
        const suggested = res.data?.params as
          | Record<string, Record<string, number | string | boolean>>
          | undefined;
        const warnings: string[] = Array.isArray(res.data?.warnings) ? res.data.warnings : [];
        if (!suggested || Object.keys(suggested).length === 0) {
          message.warning('Не удалось извлечь параметры из референсов');
          return;
        }
        mutateParams((prev) => applyAutofitSuggestions(prev, suggested));
        if (warnings.includes('landmarks_unavailable')) {
          message.info('Лэндмарки лица недоступны на сервере — применены только цвета');
        } else {
          message.success('Параметры подогнаны по референсам — доработайте слайдерами');
        }
      })
      .catch(() => message.error('Автоподгонка не удалась — попробуйте позже'))
      .finally(() => setAutofitBusy(false));
  }, [projectId, characterId, mutateParams]);

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
    if (!projectId || !characterId) {
      setParamsBaseline(zoneParams);
      message.success('Изменения применены локально');
      return;
    }
    characterApi
      .saveModel3D(projectId, characterId, zoneParams)
      .then(() => {
        setParamsBaseline(zoneParams);
        message.success('Модель сохранена');
      })
      .catch(() => {
        message.error('Не удалось сохранить модель — попробуйте ещё раз');
      });
  }, [projectId, characterId, zoneParams]);

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

  const characterName = character?.name || MOCK_CHARACTER_NAME;

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
        onBack={handleBack}
        onStepClick={handleStepClick}
      />

      <div className="c3d-workspace">
        <CharacterCategoryRail active={activeGroup} onSelect={handleCategorySelect} />

        <main className="c3d-stage">
          <CharacterViewport
            hoveredZoneId={hoveredZoneId}
            selectedZoneId={selectedZoneId}
            zoomZoneId={zoomZoneId}
            ancestorIds={ancestorIds}
            onHoverZone={handleHoverZone}
            onSelectZone={handleSelectZone}
            onParameterChange={handleParameterChange}
            editSide={editSide}
            onSideChange={setSelectedSide}
            onApiReady={setViewportApi}
            zoneParams={zoneParams}
          />

          <ReferenceDock
            projectId={projectId}
            characterId={characterId}
            busy={autofitBusy}
            onAutofit={handleAutofit}
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
            />
          </div>
        </main>
      </div>

      <BottomQuickBar
        selectedZone={selectedZone}
        zoneParams={zoneParams[selectedZoneId ?? ''] ?? {}}
        hasChanges={hasUnappliedChanges}
        canUndo={historyRef.current.canUndo}
        canRedo={historyRef.current.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSnapshot={viewportApi ? handleSnapshot : undefined}
        onExportGlb={viewportApi ? handleExportGlb : undefined}
        onReset={handleGlobalReset}
        onParameterChange={handleParameterChange}
        onCancel={handleCancel}
        onApply={handleApply}
        onSave={handleSave}
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
