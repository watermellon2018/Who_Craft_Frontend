import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {CloseOutlined} from '@ant-design/icons';
import * as THREE from 'three';
import {Canvas, ThreeEvent, useFrame, useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass';
import {OutlinePass} from 'three/examples/jsm/postprocessing/OutlinePass';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass';
import type {Rig, ZoneParams} from './engine/rig';
import {MorphRig} from './engine/morphRig';
import {dragBindingFor} from './engine/dragBindings';
import {resolveSelectableZone} from './engine/zoneSelection';

// Canonical camera angles for reference-frame capture. The video pipeline
// needs the figure shot head-on / in profile / three-quarter so the same
// character stays consistent across generated frames.
export type ViewAngle = 'front' | 'threeQuarter' | 'side' | 'sideLeft' | 'back';

// Imperative escape hatch for actions that need the live GL context:
// PNG snapshots, GLB export, and canonical camera moves. The page receives
// it via onApiReady.
export interface ViewportApi {
  snapshotPng: () => string;
  exportGlb: () => Promise<Blob>;
  // Glide the camera onto a canonical reference angle (reuses the same lerp
  // as the zoom focus). Turning to a preset stops the turntable.
  setView: (angle: ViewAngle) => void;
  // Start/stop a slow continuous orbit around the figure (azimuth only).
  toggleTurntable: (on: boolean) => void;
}

interface Props {
  hoveredZoneId: string | null;
  selectedZoneId: string | null;
  zoomZoneId: string | null;
  ancestorIds: string[];
  onHoverZone: (zoneId: string | null) => void;
  onSelectZone: (zoneId: string | null) => void;
  onParameterChange?: (zoneId: string, paramId: string, value: number, side?: 'L' | 'R' | null) => void;
  // Non-null while asymmetric editing is active; drags then write per-side
  // overrides for the half that was actually grabbed.
  editSide?: 'L' | 'R' | null;
  onSideChange?: (side: 'L' | 'R') => void;
  onApiReady?: (api: ViewportApi | null) => void;
  zoneParams: ZoneParams;
  reconstructedHeadUrl: string | null;
  reconstructedHairUrl?: string | null;
  reconstructionStatus?: 'missing' | 'queued' | 'processing' | 'cancellation_requested' | 'ready' | 'failed';
  reconstructionProgress?: number;
  reconstructionError?: string;
  reconstructionRetryBusy?: boolean;
  onRetryReconstruction?: () => void;
}

// Real 3D viewport: React Three Fiber scene around the SMPL MorphRig.
// Raycasting comes from R3F's pointer events on the rig's
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
  editSide = null,
  onSideChange,
  onApiReady,
  zoneParams,
  reconstructedHeadUrl,
  reconstructedHairUrl = null,
  reconstructionStatus,
  reconstructionProgress = 0,
  reconstructionError,
  reconstructionRetryBusy = false,
  onRetryReconstruction,
}) => {
  const [rig, setRig] = useState<MorphRig | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const reconstructionInProgress =
    reconstructionStatus === 'queued' ||
    reconstructionStatus === 'processing' ||
    reconstructionStatus === 'cancellation_requested';
  const boundedReconstructionProgress = Math.max(
    0,
    Math.min(100, reconstructionProgress),
  );
  const visibleReconstructionProgress = Math.max(
    reconstructionStatus === 'queued' ? 3 : 0,
    boundedReconstructionProgress,
  );

  useEffect(() => {
    let alive = true;
    let loaded: MorphRig | null = null;
    setRig(null);
    setLoadFailed(false);
    // A null URL means the personalized reconstruction is still pending (or
    // failed). Never show the old shared demo head for a different character.
    if (!reconstructedHeadUrl) return undefined;
    MorphRig.create(undefined, reconstructedHeadUrl, reconstructedHairUrl)
      .then((morph) => {
        if (!alive) {
          morph.dispose();
          return;
        }
        loaded = morph;
        setRig(morph);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
      if (loaded) loaded.dispose();
    };
  }, [reconstructedHairUrl, reconstructedHeadUrl]);

  const controlsRef = useRef<OrbitControls | null>(null);
  const draggingRef = useRef(false);
  // True while the camera is being orbited/panned, so hover doesn't update
  // (and stick) mid-gesture. Cleared on the OrbitControls 'end' event.
  const orbitingRef = useRef(false);
  // The post-processing composer drives every frame (so the outline pass
  // runs); snapshots and the focus animation read it from here.
  const composerRef = useRef<EffectComposer | null>(null);
  // Imperative camera commands (preset views + turntable). CameraDirector
  // installs the handle; ApiBridge calls it from the page's buttons. A ref
  // (not state) so the buttons don't re-render the viewport.
  const cameraControlRef = useRef<CameraControl | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parameters → math. The rig mutates its own scene graph; no React re-render.
  useEffect(() => {
    rig?.applyParams(zoneParams);
  }, [rig, zoneParams]);

  useEffect(() => {
    rig?.setHighlight(hoveredZoneId, selectedZoneId);
  }, [rig, hoveredZoneId, selectedZoneId]);

  const selectedBinding = useMemo(() => dragBindingFor(selectedZoneId), [selectedZoneId]);
  const isZoomed = !!zoomZoneId;

  const resolveHit = useCallback(
    (object: THREE.Object3D | null) => {
      if (!rig) return null;
      return resolveSelectableZone(rig.resolveZoneFromObject(object), selectedZoneId, ancestorIds);
    },
    [rig, selectedZoneId, ancestorIds],
  );

  // ─── Hover ───
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      // Don't re-resolve hover while dragging a zone or orbiting the camera —
      // the latter would leave a stale highlight stuck under a moving figure.
      if (draggingRef.current || orbitingRef.current) return;
      const zone = resolveHit(event.object);
      if (zone !== hoveredZoneId) onHoverZone(zone);
    },
    [resolveHit, hoveredZoneId, onHoverZone],
  );

  const handlePointerOut = useCallback(() => {
    if (!draggingRef.current) onHoverZone(null);
  }, [onHoverZone]);

  // Pressing on the canvas starts a camera gesture (orbit/pan) by default;
  // suspend hover and clear the current highlight so it doesn't stick to a
  // moving figure. A zone-drag (handlePointerDown below) opts back out.
  const handleHostPointerDown = useCallback(() => {
    orbitingRef.current = true;
    if (hoveredZoneId) onHoverZone(null);
  }, [hoveredZoneId, onHoverZone]);

  const handleHostPointerUp = useCallback(() => {
    orbitingRef.current = false;
  }, []);

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
      if (!rig || !onParameterChange || !selectedZoneId || !selectedBinding) return;
      if (event.button !== 0) return;
      const zone = resolveHit(event.object);
      if (zone !== selectedZoneId) return;

      event.stopPropagation();
      // With symmetry off, the drag edits the half that was grabbed — pulling
      // the left arm changes the left arm. The side selector follows along.
      const grabbedSide = editSide ? rig.resolveSideFromObject() ?? editSide : null;
      if (grabbedSide && onSideChange && grabbedSide !== editSide) onSideChange(grabbedSide);
      const native = event.nativeEvent;
      const canvas = native.target as HTMLElement;
      const viewportHeight = Math.max(1, canvas.clientHeight || 600);
      const sensitivity = selectedBinding.sensitivity ?? 2.2;
      const startX = native.clientX;
      const startY = native.clientY;
      const startValues = {
        x: numberParam(zoneParams, selectedZoneId, selectedBinding.x, grabbedSide),
        y: numberParam(zoneParams, selectedZoneId, selectedBinding.y, grabbedSide),
      };

      // This press is a zone edit, not a camera gesture — undo the orbit
      // flag the host pointerdown set so hover resumes correctly afterwards.
      orbitingRef.current = false;
      draggingRef.current = true;
      setIsDragging(true);
      if (controlsRef.current) controlsRef.current.enabled = false;

      const onMove = (move: PointerEvent) => {
        const dx = ((move.clientX - startX) / viewportHeight) * sensitivity;
        const dy = ((startY - move.clientY) / viewportHeight) * sensitivity; // up = +
        if (selectedBinding.x && startValues.x !== null) {
          onParameterChange(selectedZoneId, selectedBinding.x, clamp01(startValues.x + dx), grabbedSide);
        }
        if (selectedBinding.y && startValues.y !== null) {
          onParameterChange(selectedZoneId, selectedBinding.y, clamp01(startValues.y + dy), grabbedSide);
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
    [onParameterChange, selectedZoneId, selectedBinding, resolveHit, zoneParams, editSide, onSideChange, rig],
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
  const dismissHintButton = (
    <button
      type="button"
      className="c3d-empty-hint__close"
      aria-label="Закрыть"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => setHintDismissed(true)}
    >
      <CloseOutlined />
    </button>
  );

  return (
    <div
      className={`c3d-viewport ${isZoomed ? 'c3d-viewport--zoomed' : ''}`}
      style={{cursor}}
      onPointerDown={handleHostPointerDown}
      onPointerUp={handleHostPointerUp}
      onPointerLeave={() => {
        handleHostPointerUp();
        handlePointerOut();
      }}
    >
      <div className="c3d-viewport__bg" />
      <div className="c3d-viewport__atmos" />

      <div className="c3d-canvas">
      <Canvas
        shadows
        // preserveDrawingBuffer keeps the last frame readable for snapshots.
        gl={{alpha: true, antialias: true, preserveDrawingBuffer: true}}
        camera={{position: [0, 1.45, 3.05], fov: 35}}
        onCreated={({gl}) => {
          // OutputPass at the end of the composer reads tone mapping settings
          // off the renderer and applies them once, so we keep ACES here.
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        onPointerMissed={() => onSelectZone(null)}
      >
        {/* IBL carries the fill light; direct lights only shape and rim. */}
        <SceneEnvironment />
        <hemisphereLight args={['#cfd8e8', '#1a1410', 0.45]} />
        <directionalLight
          position={[2.4, 3.8, 2.8]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-1.6}
          shadow-camera-right={1.6}
          shadow-camera-top={2.4}
          shadow-camera-bottom={-0.4}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-3, 2.4, -2.6]} intensity={0.4} color="#f5b400" />

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

        {rig ? (
          <primitive
            object={rig.root}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
          />
        ) : null}

        <Controls controlsRef={controlsRef} />
        {rig ? (
          <>
            <CameraDirector
              rig={rig}
              zoomZoneId={zoomZoneId}
              controlsRef={controlsRef}
              controlRef={cameraControlRef}
            />
            <IdleMotion rig={rig} />
            <HighlightOutline
              rig={rig}
              composerRef={composerRef}
              hoveredZoneId={hoveredZoneId}
              selectedZoneId={selectedZoneId}
            />
            <ApiBridge
              rig={rig}
              composerRef={composerRef}
              cameraControlRef={cameraControlRef}
              onApiReady={onApiReady}
            />
          </>
        ) : null}
      </Canvas>
      </div>

      {/* No overlays on the model itself — the floating zone label and the
          zoom badge both covered the part being edited; the contextual
          panel already communicates selection and zoom state. */}

      {/* Hints. */}
      {!hintDismissed && !rig ? (
        <div className="c3d-empty-hint c3d-empty-hint--model-status">
          <div className="c3d-empty-hint__copy">
            <span>
              {loadFailed
                ? 'Персональная модель готова, но GLB не удалось загрузить. Обновите страницу'
                : reconstructionStatus === 'cancellation_requested'
                  ? 'Отмена запрошена'
                : reconstructionStatus === 'failed'
                  ? reconstructionError || 'Не удалось создать 3D-модель по референсам'
                  : reconstructionStatus === 'missing'
                    ? 'Сначала завершите и подтвердите этап референсов'
                    : reconstructionStatus === 'ready'
                      ? 'Загружаем персональную 3D-модель…'
                      : `Воссоздаём лицо и волосы по референсам — ${boundedReconstructionProgress}%`}
            </span>
            {reconstructionInProgress ? (
              <>
                <div
                  className="c3d-model-progress"
                  role="progressbar"
                  aria-label="Создание персональной 3D-модели"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={boundedReconstructionProgress}
                >
                  <span style={{width: `${visibleReconstructionProgress}%`}} />
                </div>
                <small>
                  {reconstructionStatus === 'cancellation_requested'
                    ? 'Уже начатая реконструкция может завершиться, но результат не будет применён.'
                    : 'Создание продолжается в фоне и может занять несколько минут.'}
                </small>
              </>
            ) : null}
          </div>
          {reconstructionStatus === 'failed' && onRetryReconstruction ? (
            <button
              type="button"
              className="c3d-empty-hint__retry"
              disabled={reconstructionRetryBusy}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRetryReconstruction}
            >
              {reconstructionRetryBusy ? 'Перезапускаем…' : 'Повторить'}
            </button>
          ) : null}
          {dismissHintButton}
        </div>
      ) : !hintDismissed && rig && !selectedZoneId ? (
        <div className="c3d-empty-hint">
          <span>Кликните на часть персонажа, чтобы редактировать её · Вращайте сцену мышью</span>
          {dismissHintButton}
        </div>
      ) : !hintDismissed && rig && selectedBinding ? (
        <div className="c3d-empty-hint">
          <span>Тяните выбранную зону мышью прямо на модели</span>
          {dismissHintButton}
        </div>
      ) : null}
    </div>
  );
};

function clamp01(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function numberParam(
  params: ZoneParams,
  zoneId: string,
  paramId?: string,
  side?: 'L' | 'R' | null,
): number | null {
  if (!paramId) return null;
  if (side) {
    const override = params[zoneId]?.[`${paramId}__${side}`];
    if (typeof override === 'number' && Number.isFinite(override)) return override;
  }
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
    // Right mouse button pans (OrbitControls default mapping) — lets the
    // user slide the view up/down the figure. Screen-space panning moves
    // along the view plane, which is what "вверх-вниз" means here.
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.9;
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

// Imperative camera handle installed by CameraDirector and called from the
// page (via ApiBridge). Same shape the page sees through ViewportApi.
interface CameraControl {
  setView: (angle: ViewAngle) => void;
  setTurntable: (on: boolean) => void;
}

// Azimuth (radians, around +Y) for each canonical reference angle. Front is
// the camera on +Z looking at the figure's face; positive azimuth swings
// toward +X. ¾ is the classic 45° hero angle.
const VIEW_AZIMUTH: Record<ViewAngle, number> = {
  front: 0,
  threeQuarter: Math.PI / 4,
  side: Math.PI / 2, // right profile (+X)
  sideLeft: -Math.PI / 2, // left profile (−X)
  back: Math.PI,
};

// Canonical framing: aim at the chest / centre of mass and stand back far
// enough to hold the whole figure, slightly above eye line (a touch of
// downward tilt reads better than dead-level).
const VIEW_TARGET = new THREE.Vector3(0, 1.0, 0);
const VIEW_DISTANCE = 3.05;
const VIEW_ELEVATION = 0.42; // camera y above the target
// Slow, calm orbit. ~12°/s reads as a turntable, not a spin.
const TURNTABLE_SPEED = (12 * Math.PI) / 180; // rad/s

// ─────────── Camera director: zoom focus + view presets + turntable ───────────
//
// One lerp loop drives every programmatic camera move (the old "Приблизить"
// focus, the new fas/profile/¾ presets, and the turntable), so there is a
// single animation mechanism — never two fighting over the camera. Manual
// OrbitControls gestures always win: a real user grab cancels any in-flight
// glide and stops the turntable.
const CameraDirector: React.FC<{
  rig: Rig;
  zoomZoneId: string | null;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
  controlRef: React.MutableRefObject<CameraControl | null>;
}> = ({rig, zoomZoneId, controlsRef, controlRef}) => {
  const {camera} = useThree();
  const desired = useRef<{target: THREE.Vector3; pos: THREE.Vector3} | null>(null);
  const animating = useRef(false);
  const turntable = useRef(false);
  // True while WE are driving the camera, so the 'start' event our own
  // controls.update() emits doesn't cancel the animation on its first frame.
  const selfDriving = useRef(false);

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

  // The user grabbing the controls cancels any in-flight glide AND the
  // turntable — manual control always wins. Only a real user gesture counts,
  // not the 'start' our own update() fires.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => {
      if (!selfDriving.current) {
        animating.current = false;
        turntable.current = false;
      }
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controlsRef]);

  // Install the imperative handle the page drives through ViewportApi.
  useEffect(() => {
    controlRef.current = {
      setView: (angle) => {
        // A preset is an explicit re-frame: stop the turntable so the two
        // don't both push the camera at once, then glide to the canonical pose.
        turntable.current = false;
        const az = VIEW_AZIMUTH[angle];
        const target = VIEW_TARGET.clone();
        const pos = target
          .clone()
          .add(new THREE.Vector3(Math.sin(az) * VIEW_DISTANCE, VIEW_ELEVATION, Math.cos(az) * VIEW_DISTANCE));
        desired.current = {target, pos};
        animating.current = true;
      },
      setTurntable: (on) => {
        turntable.current = on;
        // Starting the turntable cancels any in-flight preset glide so it
        // begins orbiting from wherever the camera actually is.
        if (on) animating.current = false;
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Preset / zoom glide takes priority while it's running.
    if (animating.current && desired.current) {
      const a = Math.min(1, 9 * delta);
      controls.target.lerp(desired.current.target, a);
      camera.position.lerp(desired.current.pos, a);
      selfDriving.current = true;
      controls.update();
      selfDriving.current = false;
      if (
        controls.target.distanceTo(desired.current.target) < 0.005 &&
        camera.position.distanceTo(desired.current.pos) < 0.005
      ) {
        animating.current = false;
      }
      return;
    }

    // Turntable: orbit the camera around the (fixed) target by azimuth only.
    // Rotate the target→camera offset in the XZ plane; elevation/distance
    // stay whatever the user last set, so it composes with manual orbiting.
    if (turntable.current) {
      const angle = TURNTABLE_SPEED * Math.min(delta, 0.05); // clamp huge tab-restore steps
      const offset = camera.position.clone().sub(controls.target);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = offset.x * cos + offset.z * sin;
      const z = -offset.x * sin + offset.z * cos;
      offset.x = x;
      offset.z = z;
      camera.position.copy(controls.target).add(offset);
      selfDriving.current = true;
      controls.update();
      selfDriving.current = false;
    }
  });
  return null;
};

// ─────────── Image-based lighting (no extra deps) ───────────
const SceneEnvironment: React.FC = () => {
  const {gl, scene} = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    return () => {
      scene.environment = null;
      env.texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

// ─────────── Idle motion (breathing) ───────────
const IdleMotion: React.FC<{rig: Rig}> = ({rig}) => {
  useFrame((state) => rig.tick(state.clock.elapsedTime));
  return null;
};

const OUTLINE_ACCENT = new THREE.Color('#f5b400');

// ─────────── Selection / hover outline (post-processing) ───────────
//
// Replaces the old emissive glow with a contour drawn around the
// hovered/selected zone's meshes. Two OutlinePass layers: the selection is
// thicker and stronger, the hover thinner and softer. A RenderPass feeds
// them and an OutputPass applies the renderer's ACES tone mapping once at
// the very end. Taking a positive-priority useFrame here makes R3F hand
// frame rendering to us, so the composer — not the default renderer —
// produces every frame.
const HighlightOutline: React.FC<{
  rig: Rig;
  composerRef: React.MutableRefObject<EffectComposer | null>;
  hoveredZoneId: string | null;
  selectedZoneId: string | null;
}> = ({rig, composerRef, hoveredZoneId, selectedZoneId}) => {
  const {gl, scene, camera, size} = useThree();
  const aoPass = useRef<GTAOPass | null>(null);
  const selectPass = useRef<OutlinePass | null>(null);
  const hoverPass = useRef<OutlinePass | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    // Ambient occlusion — contact shadows in the crevices (neck/chin,
    // armpits, groin, under hair) to add volume. Inserted right after the
    // RenderPass so AO lands on the lit color before the outlines, and the
    // OutputPass at the end still applies ACES once. GTAOPass builds its own
    // depth/normal G-buffer from the scene and blends the AO over the colour.
    //
    // The mesh is smooth and stylised, so AO is intentionally subtle: a small
    // world-space radius reads in the joints without dirtying flat cheeks/
    // forehead, and blendIntensity is held well below 1 to avoid a heavy look
    // or a halo around the silhouette.
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.output = GTAOPass.OUTPUT.Default; // blend AO over colour (not debug views)
    ao.blendIntensity = 0.55;
    ao.updateGtaoMaterial({
      radius: 0.12, // world units — the figure is ~2u tall, so this is crevice-scale
      distanceExponent: 1.0,
      thickness: 1.0,
      scale: 1.0,
      samples: 16,
    });
    // Gentle denoise so the low sample count doesn't leave noise on smooth skin.
    ao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
    composer.addPass(ao);
    aoPass.current = ao;

    const resolution = new THREE.Vector2(size.width, size.height);
    const sel = new OutlinePass(resolution, scene, camera);
    sel.edgeStrength = 6;
    sel.edgeGlow = 0;
    sel.edgeThickness = 1.6;
    sel.pulsePeriod = 0;
    sel.visibleEdgeColor.copy(OUTLINE_ACCENT);
    sel.hiddenEdgeColor.copy(OUTLINE_ACCENT).multiplyScalar(0.4);
    composer.addPass(sel);
    selectPass.current = sel;

    const hov = new OutlinePass(resolution, scene, camera);
    hov.edgeStrength = 3;
    hov.edgeGlow = 0;
    hov.edgeThickness = 1;
    hov.pulsePeriod = 0;
    hov.visibleEdgeColor.copy(OUTLINE_ACCENT);
    hov.hiddenEdgeColor.copy(OUTLINE_ACCENT).multiplyScalar(0.25);
    composer.addPass(hov);
    hoverPass.current = hov;

    // OutputPass applies the renderer's tone mapping + color space once at
    // the end of the chain (RenderPass renders linear into the HDR buffer).
    composer.addPass(new OutputPass());

    composerRef.current = composer;
    return () => {
      composerRef.current = null;
      aoPass.current = null;
      selectPass.current = null;
      hoverPass.current = null;
      ao.dispose();
      sel.dispose();
      hov.dispose();
      composer.dispose();
    };
  }, [gl, scene, camera, size.width, size.height, composerRef]);

  // Keep the composer sized to the canvas. EffectComposer.setSize fans out to
  // every pass's setSize, so the GTAOPass G-buffer targets resize with it.
  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size.width, size.height, composerRef]);

  // Feed the current hover/selection meshes into the two passes.
  useEffect(() => {
    rig.setHighlight(hoveredZoneId, selectedZoneId);
    const {selected, hovered} = rig.highlightedMeshes();
    if (selectPass.current) selectPass.current.selectedObjects = selected;
    if (hoverPass.current) hoverPass.current.selectedObjects = hovered;
  }, [rig, hoveredZoneId, selectedZoneId]);

  // Priority > 0 takes over rendering; the composer draws every frame. The
  // selection set is refreshed here too, because geometry rebuilds (hair,
  // torso, mouth) replace mesh instances and stale references must drop out.
  useFrame(() => {
    const composer = composerRef.current;
    if (!composer) return;
    if (selectPass.current) selectPass.current.selectedObjects = rig.highlightedMeshes().selected;
    if (hoverPass.current) hoverPass.current.selectedObjects = rig.highlightedMeshes().hovered;
    composer.render();
  }, 1);

  return null;
};

// ─────────── Snapshot / export / camera bridge ───────────
const ApiBridge: React.FC<{
  rig: Rig;
  composerRef: React.MutableRefObject<EffectComposer | null>;
  cameraControlRef: React.MutableRefObject<CameraControl | null>;
  onApiReady?: (api: ViewportApi | null) => void;
}> = ({rig, composerRef, cameraControlRef, onApiReady}) => {
  const {gl, scene, camera} = useThree();
  useEffect(() => {
    if (!onApiReady) return undefined;
    onApiReady({
      snapshotPng: () => {
        // Render through the composer so the snapshot includes the outline
        // and the same tone mapping as the live view. The camera is wherever
        // the user (or a view preset) left it, so the snapshot captures that
        // reference angle — which is the whole point of the presets.
        if (composerRef.current) composerRef.current.render();
        else gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      },
      exportGlb: () =>
        new Promise<Blob>((resolve, reject) => {
          const exporter = new GLTFExporter();
          exporter.parse(
            rig.root,
            (result) => resolve(new Blob([result as ArrayBuffer], {type: 'model/gltf-binary'})),
            (error) => reject(error),
            {binary: true},
          );
        }),
      setView: (angle) => cameraControlRef.current?.setView(angle),
      toggleTurntable: (on) => cameraControlRef.current?.setTurntable(on),
    });
    return () => onApiReady(null);
  }, [gl, scene, camera, rig, composerRef, cameraControlRef, onApiReady]);
  return null;
};

export default CharacterViewport;
