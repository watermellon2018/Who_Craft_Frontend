import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {message} from 'antd';
import {useNavigate, useParams} from 'react-router-dom';
import BottomQuickBar from '../components/character3d/BottomQuickBar';
import CharacterCategoryRail from '../components/character3d/CharacterCategoryRail';
import CharacterViewport from '../components/character3d/CharacterViewport';
import ContextualZonePanel from '../components/character3d/ContextualZonePanel';
import StepperHeader from '../components/character3d/StepperHeader';
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
  const [zoneParams, setZoneParams] = useState<Record<string, Record<string, number | string | boolean>>>(() =>
    buildInitialZoneParams(),
  );
  // Baseline snapshot for the Cancel button; reset on Apply/Save.
  const [paramsBaseline, setParamsBaseline] = useState(zoneParams);
  // Which mirrored half the user edits while «Применять симметрично» is off.
  const [selectedSide, setSelectedSide] = useState<'L' | 'R'>('L');

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
          setZoneParams(merged);
          setParamsBaseline(merged);
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
      setZoneParams((prev) => {
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
    [],
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
        setZoneParams((p) => collapseSideOverrides(p, selectedZoneId, selectedSide));
      }
      return next;
    });
  }, [selectedZoneId, selectedSide]);

  const handleReset = useCallback(() => {
    // Reset only the currently-selected zone's params to defaults — the
    // global reset is the bottom bar; this is panel-scoped.
    if (!selectedZoneId) return;
    const initial = buildInitialZoneParams();
    setZoneParams((prev) => ({...prev, [selectedZoneId]: initial[selectedZoneId] ?? {}}));
  }, [selectedZoneId]);

  const handleGlobalReset = useCallback(() => {
    setZoneParams(buildInitialZoneParams());
  }, []);

  const handleCancel = useCallback(() => {
    setZoneParams(paramsBaseline);
  }, [paramsBaseline]);

  const handleApply = useCallback(() => {
    setParamsBaseline(zoneParams);
    message.success('Изменения применены');
  }, [zoneParams]);

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
            zoneParams={zoneParams}
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
        onReset={handleGlobalReset}
        onParameterChange={handleParameterChange}
        onCancel={handleCancel}
        onApply={handleApply}
        onSave={handleSave}
      />
    </div>
  );
};

export default Character3DEditorPage;
