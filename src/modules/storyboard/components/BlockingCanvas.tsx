import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {CANVAS_MARKER_LIMIT, CANVAS_PRIMITIVES, canvasId} from '../canvasModel';
import type {CanvasObject, CanvasPoint, CanvasPrimitive, StoryboardCanvasDocument} from '../canvasModel';
import {BlockingObjectArtwork, canvasDimensions, objectBounds, objectTransform} from './BlockingArtwork';
import {CAMERA_MOTION_LABELS, CameraMotionArtwork, motionPathData} from './BlockingMotionArtwork';
import './blockingCanvas.css';

export const STORYBOARD_OBJECT_MIME = 'application/x-craft-storyboard-object';
export type BlockingCanvasTool = 'select' | 'path' | 'camera-path' | 'comment';

interface BlockingCanvasProps {
  document: StoryboardCanvasDocument;
  selectedObjectId: string | null;
  tool: BlockingCanvasTool;
  overlays: boolean;
  disabled: boolean;
  onChange: (document: StoryboardCanvasDocument) => void;
  onSelect: (id: string | null) => void;
  onToolChange: (tool: BlockingCanvasTool) => void;
  onAdd: (kind: CanvasPrimitive, point: CanvasPoint, entityId?: string) => void;
  onOpenMarker: (id: string) => void;
}

interface DragOperation {
  kind: 'move' | 'resize' | 'rotate' | 'path' | 'camera-path' | 'camera-draw' | 'marker';
  id: string;
  index?: number;
  corner?: {x: -1 | 1; y: -1 | 1};
  pointerId: number;
  start: CanvasPoint;
  base: StoryboardCanvasDocument;
  next: StoryboardCanvasDocument;
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));
const degrees = (radians: number) => radians * 180 / Math.PI;
function updateObject(document: StoryboardCanvasDocument, id: string, patch: Partial<CanvasObject>) {
  return {...document, objects: document.objects.map((object) => object.id === id ? {...object, ...patch} : object)};
}

function moveObject(object: CanvasObject, dx: number, dy: number): Partial<CanvasObject> {
  const x = clamp(object.x + dx, 0, Math.max(0, 100 - object.width));
  const y = clamp(object.y + dy, 0, Math.max(0, 100 - object.height));
  return {x, y, motion: {...object.motion, points: object.motion.points.map((point) => ({
    x: clamp(point.x + x - object.x), y: clamp(point.y + y - object.y),
  }))}};
}

function dragDocument(drag: DragOperation, point: CanvasPoint, snap: boolean): StoryboardCanvasDocument {
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;
  if (drag.kind === 'camera-draw') return {...drag.base, cameraMotion: {...drag.base.cameraMotion, points: [
    drag.start, {x: (drag.start.x + point.x) / 2, y: (drag.start.y + point.y) / 2}, point,
  ]}};
  if (drag.kind === 'camera-path') return {...drag.base, cameraMotion: {...drag.base.cameraMotion,
    points: drag.base.cameraMotion.points.map((entry, index) => (
      index === drag.index ? {x: clamp(entry.x + dx), y: clamp(entry.y + dy)} : entry
    ))}};
  if (drag.kind === 'marker') return {...drag.base, markers: drag.base.markers.map((marker) => (
    marker.id === drag.id ? {...marker, x: clamp(marker.x + dx), y: clamp(marker.y + dy)} : marker
  ))};
  const object = drag.base.objects.find(({id}) => id === drag.id);
  if (!object || object.locked || object.hidden) return drag.base;
  if (drag.kind === 'move') return updateObject(drag.base, drag.id, moveObject(object, dx, dy));
  if (drag.kind === 'path') return updateObject(drag.base, drag.id, {
    motion: {...object.motion, points: object.motion.points.map((entry, index) => (
      index === drag.index ? {x: clamp(entry.x + dx), y: clamp(entry.y + dy)} : entry
    ))},
  });
  const size = canvasDimensions(drag.base.aspectRatio);
  const bounds = objectBounds(object, drag.base);
  const center = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
  if (drag.kind === 'rotate') {
    const startAngle = Math.atan2(drag.start.y * size.height / 100 - center.y, drag.start.x * size.width / 100 - center.x);
    const angle = Math.atan2(point.y * size.height / 100 - center.y, point.x * size.width / 100 - center.x);
    const rotation = object.rotation + degrees(angle - startAngle);
    return updateObject(drag.base, drag.id, {rotation: ((snap ? Math.round(rotation / 15) * 15 : rotation) % 360 + 360) % 360});
  }
  if (!drag.corner) return drag.base;
  const radians = object.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localDx = dx * size.width / 100 * cos + dy * size.height / 100 * sin;
  const localDy = -dx * size.width / 100 * sin + dy * size.height / 100 * cos;
  const width = clamp(bounds.width + localDx * drag.corner.x, size.width * 0.02, size.width);
  const height = clamp(bounds.height + localDy * drag.corner.y, size.height * 0.02, size.height);
  const changeX = (width - bounds.width) * drag.corner.x / 2;
  const changeY = (height - bounds.height) * drag.corner.y / 2;
  return updateObject(drag.base, drag.id, {
    width: width * 100 / size.width, height: height * 100 / size.height,
    x: clamp((center.x + changeX * cos - changeY * sin - width / 2) * 100 / size.width, 0, 100 - width * 100 / size.width),
    y: clamp((center.y + changeX * sin + changeY * cos - height / 2) * 100 / size.height, 0, 100 - height * 100 / size.height),
  });
}

export default function BlockingCanvas({document, selectedObjectId, tool, overlays, disabled,
  onChange, onSelect, onToolChange, onAdd, onOpenMarker}: BlockingCanvasProps) {
  const {t} = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragOperation | null>(null);
  const latestDocument = useRef(document);
  latestDocument.current = document;
  const [preview, setPreview] = useState<StoryboardCanvasDocument | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [identifier] = useState(canvasId);
  const artwork = dragRef.current?.base === document && preview ? preview : document;
  const size = canvasDimensions(artwork.aspectRatio);
  const selected = artwork.objects.find(({id, hidden}) => id === selectedObjectId && !hidden);
  const markerId = `${identifier}-object-arrow`;

  const cancelDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    if (drag && svgRef.current?.hasPointerCapture?.(drag.pointerId)) svgRef.current.releasePointerCapture(drag.pointerId);
  };

  useEffect(() => {
    if (dragRef.current && (disabled || dragRef.current.base !== document)) {
      const drag = dragRef.current;
      dragRef.current = null;
      setPreview(null);
      if (svgRef.current?.hasPointerCapture?.(drag.pointerId)) svgRef.current.releasePointerCapture(drag.pointerId);
    }
  }, [document, disabled]);

  const toPoint = (clientX: number, clientY: number): CanvasPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rectangle = svg.getBoundingClientRect();
    if (!rectangle.width || !rectangle.height) return null;
    // The SVG uses xMidYMid meet: account for any letterboxing before converting coordinates.
    const ratio = Math.min(rectangle.width / size.width, rectangle.height / size.height);
    const offsetX = (rectangle.width - size.width * ratio) / 2;
    const offsetY = (rectangle.height - size.height * ratio) / 2;
    return {
      x: clamp((clientX - rectangle.left - offsetX) / (size.width * ratio) * 100),
      y: clamp((clientY - rectangle.top - offsetY) / (size.height * ratio) * 100),
    };
  };

  const startDrag = (event: React.PointerEvent<SVGElement>, operation: Pick<DragOperation, 'kind' | 'id' | 'index' | 'corner'>) => {
    if (disabled || event.button !== 0 || dragRef.current) return;
    const point = toPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current?.focus();
    dragRef.current = {...operation, start: point, base: document, next: document, pointerId: event.pointerId};
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const addAt = (point: CanvasPoint) => {
    if (disabled) return;
    if (tool === 'comment') {
      if (document.markers.length >= CANVAS_MARKER_LIMIT) return;
      const id = canvasId();
      onChange({...document, markers: [...document.markers, {id, ...point, text: ''}]});
      onToolChange('select');
      onOpenMarker(id);
      setAnnouncement(t('storyboard.canvas.markerAdded', {defaultValue: 'Метка добавлена. Напишите комментарий в панели заметок.'}));
    } else if (tool === 'path' && selected && !selected.locked) {
      const start = {x: clamp(selected.x + selected.width / 2), y: clamp(selected.y + selected.height / 2)};
      onChange(updateObject(document, selected.id, {motion: {...selected.motion, type: 'path', points: [
        start, {x: (start.x + point.x) / 2, y: (start.y + point.y) / 2}, point,
      ]}}));
      onToolChange('select');
      setAnnouncement(t('storyboard.canvas.pathAdded', {defaultValue: 'Траектория добавлена. Переместите её точки, чтобы изменить путь.'}));
    } else if (tool === 'camera-path' && document.cameraMotion.type === 'Custom') {
      const start = {x: clamp(point.x - 25), y: clamp(point.y + 20)};
      onChange({...document, cameraMotion: {...document.cameraMotion, points: [
        start, {x: (start.x + point.x) / 2, y: (start.y + point.y) / 2}, point,
      ]}});
      onToolChange('select');
      setAnnouncement(t('storyboard.canvas.cameraPathAdded', {defaultValue: 'Траектория камеры добавлена. Переместите её точки, чтобы изменить путь.'}));
    } else if (tool === 'select') onSelect(null);
  };

  const handleKeyboard = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelDrag();
      onToolChange('select');
      return;
    }
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target !== event.currentTarget && (event.target as SVGElement).dataset.canvasHandle) return;
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget && tool !== 'select') {
      event.preventDefault();
      addAt(tool === 'path' && selected
        ? {x: clamp(selected.x + selected.width + 15), y: clamp(selected.y + selected.height / 2)}
        : tool === 'camera-path' ? {x: 70, y: 40} : {x: 50, y: 50});
      return;
    }
    if (!selected || selected.locked || dragRef.current) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onChange({...document, objects: document.objects.filter(({id}) => id !== selected.id),
        cameraMotion: document.cameraMotion.targetId === selected.id ? {...document.cameraMotion, targetId: undefined} : document.cameraMotion});
      onSelect(null);
      return;
    }
    const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (direction) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      onChange(updateObject(document, selected.id, moveObject(selected, direction[0] * step, direction[1] * step)));
    }
  };

  const moveHandleWithKeyboard = (event: React.KeyboardEvent<SVGElement>, operation: Pick<DragOperation, 'kind' | 'id' | 'index' | 'corner'>) => {
    if (event.key === 'Escape') return;
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (operation.kind === 'marker' && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); event.stopPropagation();
      onChange({...document, markers: document.markers.filter(({id}) => id !== operation.id)});
      svgRef.current?.focus();
    } else if (direction) {
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 10 : 1;
      if (operation.kind === 'rotate' && selected) {
        onChange(updateObject(document, selected.id, {rotation: (selected.rotation + (direction[0] || direction[1]) * (event.shiftKey ? 15 : 1) + 360) % 360}));
      } else {
        onChange(dragDocument({...operation, start: {x: 0, y: 0}, base: document, next: document, pointerId: -1},
          {x: direction[0] * step, y: direction[1] * step}, false));
      }
    }
  };

  const renderHandle = (x: number, y: number, label: string,
    operation: Pick<DragOperation, 'kind' | 'id' | 'index' | 'corner'>, rotate = false) => (
    <g key={`${operation.kind}-${operation.index ?? `${operation.corner?.x}-${operation.corner?.y}`}`}
      className={`blocking-canvas__handle${rotate ? ' blocking-canvas__handle--rotate' : ''}`}
      role="button" tabIndex={disabled ? -1 : 0} aria-label={label} data-canvas-handle="true"
      onKeyDown={(event) => moveHandleWithKeyboard(event, operation)}
      onPointerDown={(event) => startDrag(event, operation)}>
      <circle cx={x} cy={y} r="23" fill="transparent" stroke="none" />
      <circle className="blocking-canvas__handle-dot" cx={x} cy={y} r={rotate ? 10 : 8} />
    </g>
  );

  return <div className={`blocking-canvas${dragOver ? ' blocking-canvas--drop' : ''}${disabled ? ' blocking-canvas--disabled' : ''}`}>
    <svg ref={svgRef} viewBox={`0 0 ${size.width} ${size.height}`} className={`blocking-canvas__surface blocking-canvas__surface--${tool}`}
      style={{aspectRatio: `${size.width} / ${size.height}`}} tabIndex={0} role="group"
      aria-label={t('storyboard.canvas.surface', {defaultValue: 'Схема кадра — вид через камеру'})}
      aria-describedby={`${identifier}-instructions`} aria-disabled={disabled}
      onKeyDown={handleKeyboard}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        if (tool === 'camera-path' && document.cameraMotion.type === 'Custom') {
          startDrag(event, {kind: 'camera-draw', id: 'camera'});
          return;
        }
        const point = toPoint(event.clientX, event.clientY);
        if (point) {event.currentTarget.focus(); addAt(point);}
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || drag.base !== document || disabled) return;
        const point = toPoint(event.clientX, event.clientY);
        if (point) {drag.next = dragDocument(drag, point, event.shiftKey); setPreview(drag.next);}
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const next = drag.next;
        cancelDrag();
        if (!disabled && drag.base === latestDocument.current && JSON.stringify(next) !== JSON.stringify(drag.base)) {
          onChange(next);
          if (drag.kind === 'camera-draw') {
            onToolChange('select');
            setAnnouncement(t('storyboard.canvas.cameraPathAdded', {defaultValue: 'Траектория камеры добавлена. Переместите её точки, чтобы изменить путь.'}));
          }
        }
      }}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onDragOver={(event) => {
        if (disabled || !Array.from(event.dataTransfer.types).includes(STORYBOARD_OBJECT_MIME)) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOver(true);
      }}
      onDragLeave={(event) => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);}}
      onDrop={(event) => {
        setDragOver(false);
        if (disabled) return;
        const raw = event.dataTransfer.getData(STORYBOARD_OBJECT_MIME);
        if (!raw) return;
        event.preventDefault();
        try {
          const value: unknown = JSON.parse(raw);
          if (!value || typeof value !== 'object' || !('kind' in value)) return;
          const data = value as {kind: unknown; entityId?: unknown};
          if (!CANVAS_PRIMITIVES.includes(data.kind as CanvasPrimitive)) return;
          if (data.entityId !== undefined && typeof data.entityId !== 'string') return;
          const point = toPoint(event.clientX, event.clientY);
          if (point) onAdd(data.kind as CanvasPrimitive, point, data.entityId as string | undefined);
        } catch { /* Ignore unrelated or malformed drag payloads; never modify the document. */ }
      }}>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#26696b" />
        </marker>
        <marker id={`${identifier}-camera-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#7a4b00" />
        </marker>
      </defs>
      <rect width={size.width} height={size.height} fill="#f3f0e7" />
      {overlays && <g className="blocking-canvas__guides" aria-hidden="true">
        {[1, 2].map((index) => <React.Fragment key={index}>
          <path d={`M${size.width * index / 3} 0 V${size.height}`} />
          <path d={`M0 ${size.height * index / 3} H${size.width}`} />
        </React.Fragment>)}
      </g>}
      {artwork.objects.filter(({hidden}) => !hidden).map((object) => {
        const bounds = objectBounds(object, artwork);
        return <g key={object.id} role="button" tabIndex={disabled ? -1 : 0}
          aria-label={object.title || object.entity?.title || t(`storyboard.canvas.primitive.${object.kind}`, {defaultValue: 'Элемент'})}
          aria-pressed={object.id === selectedObjectId} aria-disabled={disabled}
          className={`blocking-canvas__object${object.locked ? ' blocking-canvas__object--locked' : ''}`}
          onFocus={() => onSelect(object.id)}
          onKeyDown={(event) => {if (event.key === ' ' || event.key === 'Enter') {event.preventDefault(); onSelect(object.id);}}}
          onPointerDown={(event) => {
            if (tool !== 'select' || disabled) return;
            event.stopPropagation(); onSelect(object.id);
            if (!object.locked) startDrag(event, {kind: 'move', id: object.id});
          }}>
          <BlockingObjectArtwork document={artwork} object={object} />
          <rect transform={objectTransform(object, artwork)} width={bounds.width} height={bounds.height} fill="transparent" />
          {overlays && <text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.height + 27} className="blocking-canvas__object-label">
            {object.title || object.entity?.title || t(`storyboard.canvas.primitive.${object.kind}`, {defaultValue: 'Элемент'})}
          </text>}
        </g>;
      })}
      {overlays && artwork.objects.filter((object) => !object.hidden && object.motion.type === 'path').map((object) => (
        <g key={`path-${object.id}`}>
          <path d={motionPathData(object.motion.points, size)} className="blocking-canvas__motion" markerEnd={`url(#${markerId})`} />
          {object.id === selectedObjectId && !object.locked && !disabled && object.motion.points.map((point, index) => (
            renderHandle(point.x * size.width / 100, point.y * size.height / 100,
              t('storyboard.canvas.pathPoint', {defaultValue: 'Точка траектории {{number}}', number: index + 1}),
              {kind: 'path', id: object.id, index})
          ))}
        </g>
      ))}
      {overlays && artwork.cameraMotion.type !== 'Static' && <CameraMotionArtwork document={artwork}
        markerId={`${identifier}-camera-arrow`}
        label={t('storyboard.canvas.cameraOverlay', {defaultValue: 'Движение камеры: {{movement}}',
          movement: t(`storyboard.canvas.cameraMotionOptions.${artwork.cameraMotion.type}`,
            {defaultValue: CAMERA_MOTION_LABELS[artwork.cameraMotion.type]})})} />}
      {overlays && artwork.cameraMotion.type === 'Custom' && !disabled && artwork.cameraMotion.points.map((point, index) => (
        renderHandle(point.x * size.width / 100, point.y * size.height / 100,
          t('storyboard.canvas.cameraPathPoint', {defaultValue: 'Точка траектории камеры {{number}}', number: index + 1}),
          {kind: 'camera-path', id: 'camera', index})
      ))}
      {overlays && artwork.markers.map((marker, index) => <g key={marker.id} role="button"
        className="blocking-canvas__marker" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} data-canvas-handle="true"
        aria-label={t('storyboard.canvas.commentMarker', {defaultValue: 'Комментарий {{number}}: {{text}}', number: index + 1, text: marker.text})}
        onPointerDown={(event) => {onOpenMarker(marker.id); startDrag(event, {kind: 'marker', id: marker.id});}}
        onClick={() => onOpenMarker(marker.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); event.stopPropagation(); onOpenMarker(marker.id);
          } else moveHandleWithKeyboard(event, {kind: 'marker', id: marker.id});
        }}>
        <title>{marker.text || t('storyboard.canvas.emptyComment', {defaultValue: 'Добавьте текст комментария в панели заметок'})}</title>
        <circle cx={marker.x * size.width / 100} cy={marker.y * size.height / 100} r="24" />
        <text x={marker.x * size.width / 100} y={marker.y * size.height / 100 + 1}>{index + 1}</text>
      </g>)}
      {selected && tool === 'select' && !disabled && (() => {
        const bounds = objectBounds(selected, artwork);
        return <g transform={objectTransform(selected, artwork)} className="blocking-canvas__selection">
          <rect width={bounds.width} height={bounds.height} className="blocking-canvas__selection-box" />
          {!selected.locked && <>
            {([-1, 1] as const).flatMap((x) => ([-1, 1] as const).map((y) => renderHandle(
              x === -1 ? 0 : bounds.width, y === -1 ? 0 : bounds.height,
              t('storyboard.canvas.resizeCorner', {defaultValue: 'Изменить размер: {{horizontal}}, {{vertical}}',
                horizontal: x === -1 ? t('storyboard.canvas.left', {defaultValue: 'слева'}) : t('storyboard.canvas.right', {defaultValue: 'справа'}),
                vertical: y === -1 ? t('storyboard.canvas.top', {defaultValue: 'сверху'}) : t('storyboard.canvas.bottom', {defaultValue: 'снизу'})}),
              {kind: 'resize', id: selected.id, corner: {x, y}},
            )))}
            <path d={`M${bounds.width / 2} 0 V-38`} className="blocking-canvas__selection-box" />
            {renderHandle(bounds.width / 2, -38, t('storyboard.canvas.rotate', {defaultValue: 'Повернуть элемент'}), {kind: 'rotate', id: selected.id}, true)}
          </>}
        </g>;
      })()}
    </svg>
    <p id={`${identifier}-instructions`} className="blocking-canvas__hint">
      {tool === 'path'
        ? t('storyboard.canvas.drawPathHint', {defaultValue: 'Укажите конец пути на схеме. Enter добавляет путь вправо; точки можно перемещать стрелками.'})
        : tool === 'comment'
          ? t('storyboard.canvas.commentHint', {defaultValue: 'Нажмите на схему, чтобы добавить комментарий. Enter добавляет метку в центре.'})
          : t('storyboard.canvas.keyboardHint', {defaultValue: 'Перетаскивайте элементы. Стрелки — перемещение, Shift — крупный шаг, Delete — удалить, Esc — отменить действие.'})}
    </p>
    <span className="blocking-canvas__sr-only" role="status">{announcement}</span>
  </div>;
}
