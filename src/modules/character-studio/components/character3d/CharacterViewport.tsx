import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {Canvas, ThreeEvent, useFrame, useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {findZone} from './zones';
import {CharacterRig, ZoneParams} from './engine/rig';
import {dragBindingFor} from './engine/dragBindings';
import {resolveSelectableZone} from './engine/zoneSelection';

interface Props {
  hoveredZoneId: string | null;
  selectedZoneId: string | null;
  zoomZoneId: string | null;
  ancestorIds: string[];
  onHoverZone: (zoneId: string | null) => void;
  onSelectZone: (zoneId: string | null) => void;
  onParameterChange?: (zoneId: string, paramId: string, value: number) => void;
  zoneParams: ZoneParams;
}

// Real 3D viewport: React Three Fiber scene around the parametric
// CharacterRig. Raycasting comes from R3F's pointer events on the rig's
// meshes; hovering resolves to the zone the click would select (same
// drill-down rules as the old 2D overlays), and dragging on the selected
// zone edits its bound parameters directly (see engine/dragBindings.ts).
const CharacterViewport: React.FC<Props> = ({
  hoveredZoneId,
  selectedZoneId,
  zoomZoneId,
  ancestorIds,
  onHoverZone,
  onSelectZone,
  onParameterChange,
  zoneParams,
}) => {
  const rig = useMemo(() => new CharacterRig(), []);
  useEffect(() => () => rig.dispose(), [rig]);

  const controlsRef = useRef<OrbitControls | null>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [labelPos, setLabelPos] = useState<{left: number; top: number} | null>(null);

  // Parameters → math. The rig mutates its own scene graph; no React re-render.
  useEffect(() => {
    rig.applyParams(zoneParams);
  }, [rig, zoneParams]);

  useEffect(() => {
    rig.setHighlight(hoveredZoneId, selectedZoneId);
  }, [rig, hoveredZoneId, selectedZoneId]);

  const selectedZone = useMemo(() => findZone(selectedZoneId), [selectedZoneId]);
  const selectedBinding = useMemo(() => dragBindingFor(selectedZoneId), [selectedZoneId]);
  const isZoomed = !!zoomZoneId;

  const resolveHit = useCallback(
    (object: THREE.Object3D | null) =>
      resolveSelectableZone(rig.resolveZoneFromObject(object), selectedZoneId, ancestorIds),
    [rig, selectedZoneId, ancestorIds],
  );

  // ─── Hover ───
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (draggingRef.current) return;
      const zone = resolveHit(event.object);
      if (zone !== hoveredZoneId) onHoverZone(zone);
    },
    [resolveHit, hoveredZoneId, onHoverZone],
  );

  const handlePointerOut = useCallback(() => {
    if (!draggingRef.current) onHoverZone(null);
  }, [onHoverZone]);

  // ─── Click to select (R3F's e.delta filters out drags) ───
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (event.delta > 6) return;
      event.stopPropagation();
      const zone = resolveHit(event.object);
      if (zone) onSelectZone(zone);
    },
    [resolveHit, onSelectZone],
  );

  // ─── Direct manipulation: drag on the selected zone edits parameters ───
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!onParameterChange || !selectedZoneId || !selectedBinding) return;
      if (event.button !== 0) return;
      const zone = resolveHit(event.object);
      if (zone !== selectedZoneId) return;

      event.stopPropagation();
      const native = event.nativeEvent;
      const canvas = native.target as HTMLElement;
      const viewportHeight = Math.max(1, canvas.clientHeight || 600);
      const sensitivity = selectedBinding.sensitivity ?? 2.2;
      const startX = native.clientX;
      const startY = native.clientY;
      const startValues = {
        x: numberParam(zoneParams, selectedZoneId, selectedBinding.x),
        y: numberParam(zoneParams, selectedZoneId, selectedBinding.y),
      };

      draggingRef.current = true;
      setIsDragging(true);
      if (controlsRef.current) controlsRef.current.enabled = false;

      const onMove = (move: PointerEvent) => {
        const dx = ((move.clientX - startX) / viewportHeight) * sensitivity;
        const dy = ((startY - move.clientY) / viewportHeight) * sensitivity; // up = +
        if (selectedBinding.x && startValues.x !== null) {
          onParameterChange(selectedZoneId, selectedBinding.x, clamp01(startValues.x + dx));
        }
        if (selectedBinding.y && startValues.y !== null) {
          onParameterChange(selectedZoneId, selectedBinding.y, clamp01(startValues.y + dy));
        }
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        draggingRef.current = false;
        setIsDragging(false);
        if (controlsRef.current) controlsRef.current.enabled = true;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onParameterChange, selectedZoneId, selectedBinding, resolveHit, zoneParams],
  );

  const hoverIsDraggable =
    !!selectedBinding && !!hoveredZoneId && hoveredZoneId === selectedZoneId;
  const cursor = isDragging
    ? 'grabbing'
    : hoverIsDraggable
      ? 'grab'
      : hoveredZoneId
        ? 'pointer'
        : 'default';

  return (
    <div
      className={`c3d-viewport ${isZoomed ? 'c3d-viewport--zoomed' : ''}`}
      style={{cursor}}
      onPointerLeave={handlePointerOut}
    >
      <div className="c3d-viewport__bg" />
      <div className="c3d-viewport__atmos" />

      <div className="c3d-canvas">
      <Canvas
        shadows
        gl={{alpha: true, antialias: true}}
        camera={{position: [0, 1.45, 3.05], fov: 35}}
        onPointerMissed={() => onSelectZone(null)}
      >
        <hemisphereLight args={['#cfd8e8', '#1a1410', 0.85]} />
        <directionalLight
          position={[2.4, 3.8, 2.8]}
          intensity={1.7}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-1.6}
          shadow-camera-right={1.6}
          shadow-camera-top={2.4}
          shadow-camera-bottom={-0.4}
        />
        <directionalLight position={[-3, 2.4, -2.6]} intensity={0.55} color="#f5b400" />

        {/* Floor: platform disc + shadow catcher + grid. */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
          <circleGeometry args={[1.85, 48]} />
          <meshStandardMaterial color="#10141c" roughness={0.95} metalness={0} transparent opacity={0.9} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[1.85, 48]} />
          <shadowMaterial transparent opacity={0.38} />
        </mesh>
        <gridHelper args={[3.7, 26, '#4a3f1e', '#1d1a12']} position-y={0.001} />

        <primitive
          object={rig.root}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        />

        <Controls controlsRef={controlsRef} />
        <CameraFocus rig={rig} zoomZoneId={zoomZoneId} controlsRef={controlsRef} />
        <LabelTracker rig={rig} zoneId={selectedZoneId} onPosition={setLabelPos} />
      </Canvas>
      </div>

      {/* Selection label pinned to the projected top of the selected zone. */}
      {selectedZone && labelPos ? (
        <SelectionLabel label={selectedZone.label} pos={labelPos} onClose={() => onSelectZone(null)} />
      ) : null}

      {/* Zoom mode badge — pinned at top center of the stage. */}
      {isZoomed && selectedZone ? (
        <div className="c3d-zoom-badge" role="status">
          <span className="c3d-zoom-badge__dot" />
          <span>Режим детализации: {selectedZone.label}</span>
        </div>
      ) : null}

      {/* Hints. */}
      {!selectedZoneId ? (
        <div className="c3d-empty-hint">
          <span>Кликните на часть персонажа, чтобы редактировать её · Вращайте сцену мышью</span>
        </div>
      ) : selectedBinding ? (
        <div className="c3d-empty-hint">
          <span>Тяните выбранную зону мышью прямо на модели</span>
        </div>
      ) : null}
    </div>
  );
};

function clamp01(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function numberParam(params: ZoneParams, zoneId: string, paramId?: string): number | null {
  if (!paramId) return null;
  const v = params[zoneId]?.[paramId];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ─────────── Orbit controls (three/examples, no extra deps) ───────────
const Controls: React.FC<{controlsRef: React.MutableRefObject<OrbitControls | null>}> = ({controlsRef}) => {
  const {camera, gl} = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.minDistance = 0.4;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.target.set(0, 0.95, 0);
    controls.update();
    controlsRef.current = controls;
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, controlsRef]);
  useFrame(() => controlsRef.current?.update());
  return null;
};

// ─────────── Camera focus animation for "Приблизить" ───────────
const CameraFocus: React.FC<{
  rig: CharacterRig;
  zoomZoneId: string | null;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
}> = ({rig, zoomZoneId, controlsRef}) => {
  const {camera} = useThree();
  const desired = useRef<{target: THREE.Vector3; pos: THREE.Vector3} | null>(null);
  const animating = useRef(false);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    let target = new THREE.Vector3(0, 0.95, 0);
    let dist = 3.0;
    if (zoomZoneId) {
      const bounds = rig.zoneBounds(zoomZoneId);
      if (bounds) {
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        target = sphere.center.clone();
        dist = Math.max(0.42, sphere.radius * 2.8);
      }
    }
    // Approach along the current viewing direction — zoom shouldn't yank
    // the camera to a canonical angle the user didn't choose.
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.2, 1);
    dir.normalize();
    desired.current = {target, pos: target.clone().add(dir.multiplyScalar(dist))};
    animating.current = true;
  }, [zoomZoneId, rig, camera, controlsRef]);

  // The user grabbing the controls cancels any in-flight focus animation.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => {
      animating.current = false;
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controlsRef]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!animating.current || !desired.current || !controls) return;
    const a = Math.min(1, 9 * delta);
    controls.target.lerp(desired.current.target, a);
    camera.position.lerp(desired.current.pos, a);
    controls.update();
    if (
      controls.target.distanceTo(desired.current.target) < 0.005 &&
      camera.position.distanceTo(desired.current.pos) < 0.005
    ) {
      animating.current = false;
    }
  });
  return null;
};

// ─────────── Projects the selected zone's top into screen % ───────────
const LabelTracker: React.FC<{
  rig: CharacterRig;
  zoneId: string | null;
  onPosition: (pos: {left: number; top: number} | null) => void;
}> = ({rig, zoneId, onPosition}) => {
  const {camera} = useThree();
  const last = useRef<{left: number; top: number} | null>(null);
  useFrame(() => {
    if (!zoneId) {
      if (last.current) {
        last.current = null;
        onPosition(null);
      }
      return;
    }
    const bounds = rig.zoneBounds(zoneId);
    if (!bounds) return;
    const anchor = bounds.getCenter(new THREE.Vector3());
    anchor.y = bounds.max.y;
    const projected = anchor.project(camera);
    const left = (projected.x * 0.5 + 0.5) * 100;
    const top = (-projected.y * 0.5 + 0.5) * 100;
    // Re-render the overlay only on visible movement, not every frame.
    if (
      !last.current ||
      Math.abs(last.current.left - left) > 0.25 ||
      Math.abs(last.current.top - top) > 0.25
    ) {
      last.current = {left, top};
      onPosition(last.current);
    }
  });
  return null;
};

const SelectionLabel: React.FC<{
  label: string;
  pos: {left: number; top: number};
  onClose: () => void;
}> = ({label, pos, onClose}) => {
  return (
    <div
      className="c3d-selection-label"
      style={{left: `${pos.left}%`, top: `${pos.top}%`}}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="c3d-selection-label__pulse" />
      <span className="c3d-selection-label__text">{label}</span>
      <button type="button" className="c3d-selection-label__close" onClick={onClose} aria-label="Снять выделение">
        ×
      </button>
    </div>
  );
};

export default CharacterViewport;
