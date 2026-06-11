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
//                          (kept here so future Three.js morph application
//                          can read it without a state shape migration)
//
// TODO: replace the SVG silhouette with a React Three Fiber scene; once
// the viewer raycasts onto the actual mesh, the EditableZone hierarchy
// already exposed here is what we'll wire morph/bone parameters into.
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
  // Reserved for a future "edit left side only / right side only" toggle.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedSide, _setSelectedSide] = useState<'left' | 'right' | 'both'>('both');

  // ─── Derived state ───
  const selectedZone: EditableZone | null = useMemo(() => findZone(selectedZoneId), [selectedZoneId]);
  const ancestors = useMemo(() => getAncestors(selectedZoneId), [selectedZoneId]);
  const ancestorIds = useMemo(() => ancestors.map((a) => a.id), [ancestors]);
  const activeGroup: ZoneGroup | null = useMemo(
    () => (selectedZoneId ? getTopLevelGroup(selectedZoneId) : null),
    [selectedZoneId],
  );
  const hasUnappliedChanges = useMemo(
    () => JSON.stringify(zoneParams) !== JSON.stringify(paramsBaseline),
    [zoneParams, paramsBaseline],
  );

  // ─── Handlers ───
  const handleSelectZone = useCallback((zoneId: string | null) => {
    setSelectedZoneId(zoneId);
    setHoveredZoneId(null);
    // Leaving zoom mode when you select a different zone keeps the
    // mental model simple: zoom is an opt-in modifier on the current
    // focus, never a sticky state.
    if (zoneId === null) {
      setZoomZoneId(null);
    } else {
      setZoomZoneId((prev) => (prev && prev !== zoneId ? null : prev));
    }
  }, []);

  const handleHoverZone = useCallback((zoneId: string | null) => {
    setHoveredZoneId(zoneId);
  }, []);

  const handleCategorySelect = useCallback((group: ZoneGroup) => {
    // Clicking a left-rail category jumps to that group's top-level zone.
    handleSelectZone(group);
  }, [handleSelectZone]);

  const handleParameterChange = useCallback(
    (zoneId: string, paramId: string, value: number | string | boolean) => {
      // TODO: when symmetry is on, apply the value to both left/right
      // morphs of the underlying rig. For now the mock just records the
      // value once; the UI explains the symmetry contract via helper text.
      setZoneParams((prev) => ({
        ...prev,
        [zoneId]: {...(prev[zoneId] ?? {}), [paramId]: value},
      }));
    },
    [],
  );

  const handleZoomToggle = useCallback(() => {
    if (!selectedZoneId) return;
    setZoomZoneId((prev) => (prev === selectedZoneId ? null : selectedZoneId));
    // TODO: replace CSS mock zoom with real Three.js camera focus on selected zone.
  }, [selectedZoneId]);

  const handleSymmetryToggle = useCallback(() => {
    setSymmetryEnabled((prev) => !prev);
  }, []);

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
    // TODO: POST to backend save endpoint with the resolved zoneParams.
    setParamsBaseline(zoneParams);
    message.success('Модель сохранена');
  }, [zoneParams]);

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
