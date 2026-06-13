import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {Canvas, ThreeEvent, useFrame, useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass';
import {OutlinePass} from 'three/examples/jsm/postprocessing/OutlinePass';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass';
import {CharacterRig, ZoneParams} from './engine/rig';
import {dragBindingFor} from './engine/dragBindings';
import {resolveSelectableZone} from './engine/zoneSelection';

// Imperative escape hatch for actions that need the live GL context:
// PNG snapshots and GLB export. The page receives it via onApiReady.
export interface ViewportApi {
  snapshotPng: () => string;
  exportGlb: () => Promise<Blob>;
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
  editSide = null,
  onSideChange,
  onApiReady,
  zoneParams,
}) => {
  const rig = useMemo(() => new CharacterRig(), []);
  useEffect(() => () => rig.dispose(), [rig]);

  const controlsRef = useRef<OrbitControls | null>(null);
  const draggingRef = useRef(false);
  // True while the camera is being orbited/panned, so hover doesn't update
  // (and stick) mid-gesture. Cleared on the OrbitControls 'end' event.
  const orbitingRef = useRef(false);
  // The post-processing composer drives every frame (so the outline pass
  // runs); snapshots and the focus animation read it from here.
  const composerRef = useRef<EffectComposer | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parameters → math. The rig mutates its own scene graph; no React re-render.
  useEffect(() => {
    rig.applyParams(zoneParams);
  }, [rig, zoneParams]);

  useEffect(() => {
    rig.setHighlight(hoveredZoneId, selectedZoneId);
  }, [rig, hoveredZoneId, selectedZoneId]);

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
      if (!onParameterChange || !selectedZoneId || !selectedBinding) return;
      if (event.button !== 0) return;
      const zone = resolveHit(event.object);
      if (zone !== selectedZoneId) return;

      event.stopPropagation();
      // With symmetry off, the drag edits the half that was grabbed — pulling
      // the left arm changes the left arm. The side selector follows along.
      const grabbedSide = editSide ? rig.resolveSideFromObject(event.object) ?? editSide : null;
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

        <primitive
          object={rig.root}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        />

        <Controls controlsRef={controlsRef} />
        <CameraFocus rig={rig} zoomZoneId={zoomZoneId} controlsRef={controlsRef} />
        <IdleMotion rig={rig} />
        <HighlightOutline
          rig={rig}
          composerRef={composerRef}
          hoveredZoneId={hoveredZoneId}
          selectedZoneId={selectedZoneId}
        />
        <ApiBridge rig={rig} composerRef={composerRef} onApiReady={onApiReady} />
      </Canvas>
      </div>

      {/* No overlays on the model itself — the floating zone label and the
          zoom badge both covered the part being edited; the contextual
          panel already communicates selection and zoom state. */}

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

// ─────────── Camera focus animation for "Приблизить" ───────────
const CameraFocus: React.FC<{
  rig: CharacterRig;
  zoomZoneId: string | null;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
}> = ({rig, zoomZoneId, controlsRef}) => {
  const {camera} = useThree();
  const desired = useRef<{target: THREE.Vector3; pos: THREE.Vector3} | null>(null);
  const animating = useRef(false);
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

  // The user grabbing the controls cancels any in-flight focus animation —
  // but only a real user gesture, not the 'start' our own update() fires.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => {
      if (!selfDriving.current) animating.current = false;
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
    selfDriving.current = true;
    controls.update();
    selfDriving.current = false;
    if (
      controls.target.distanceTo(desired.current.target) < 0.005 &&
      camera.position.distanceTo(desired.current.pos) < 0.005
    ) {
      animating.current = false;
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
const IdleMotion: React.FC<{rig: CharacterRig}> = ({rig}) => {
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
  rig: CharacterRig;
  composerRef: React.MutableRefObject<EffectComposer | null>;
  hoveredZoneId: string | null;
  selectedZoneId: string | null;
}> = ({rig, composerRef, hoveredZoneId, selectedZoneId}) => {
  const {gl, scene, camera, size} = useThree();
  const selectPass = useRef<OutlinePass | null>(null);
  const hoverPass = useRef<OutlinePass | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

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
      selectPass.current = null;
      hoverPass.current = null;
      sel.dispose();
      hov.dispose();
      composer.dispose();
    };
  }, [gl, scene, camera, size.width, size.height, composerRef]);

  // Keep the composer sized to the canvas.
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

// ─────────── Snapshot / export bridge ───────────
const ApiBridge: React.FC<{
  rig: CharacterRig;
  composerRef: React.MutableRefObject<EffectComposer | null>;
  onApiReady?: (api: ViewportApi | null) => void;
}> = ({rig, composerRef, onApiReady}) => {
  const {gl, scene, camera} = useThree();
  useEffect(() => {
    if (!onApiReady) return undefined;
    onApiReady({
      snapshotPng: () => {
        // Render through the composer so the snapshot includes the outline
        // and the same tone mapping as the live view.
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
    });
    return () => onApiReady(null);
  }, [gl, scene, camera, rig, composerRef, onApiReady]);
  return null;
};

export default CharacterViewport;
