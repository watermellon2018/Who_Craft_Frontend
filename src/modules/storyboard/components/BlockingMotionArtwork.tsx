import React from 'react';

import type {CanvasPoint, StoryboardCanvasDocument} from '../canvasModel';

function canvasSize(aspectRatio: StoryboardCanvasDocument['aspectRatio']) {
  if (aspectRatio === '9:16') return {width: 900, height: 1600};
  if (aspectRatio === '1:1') return {width: 1200, height: 1200};
  return {width: 1600, height: 900};
}

export const CAMERA_MOTION_LABELS: Record<StoryboardCanvasDocument['cameraMotion']['type'], string> = {
  Static: 'Статично', 'Dolly In': 'Наезд', 'Dolly Out': 'Отъезд', 'Zoom In': 'Приближение зумом', 'Zoom Out': 'Отдаление зумом',
  Pan: 'Панорама', 'Pan Left': 'Панорама влево', 'Pan Right': 'Панорама вправо', 'Tilt Up': 'Наклон вверх', 'Tilt Down': 'Наклон вниз',
  'Orbit Left': 'Обход слева', 'Orbit Right': 'Обход справа', 'Truck Left': 'Проезд влево', 'Truck Right': 'Проезд вправо',
  'Crane Up': 'Подъём', 'Crane Down': 'Спуск', Follow: 'Следование', Custom: 'Другое',
};

export function motionPathData(points: CanvasPoint[], size: {width: number; height: number}) {
  const coordinates = points.map(({x, y}) => `${x * size.width / 100},${y * size.height / 100}`);
  if (coordinates.length < 2) return '';
  return coordinates.length === 3 ? `M${coordinates[0]} Q${coordinates[1]} ${coordinates[2]}` : `M${coordinates.join(' L')}`;
}

export function CameraMotionArtwork({document, markerId, label, showBadge = true}: {
  document: StoryboardCanvasDocument;
  markerId: string;
  label?: string;
  showBadge?: boolean;
}) {
  const size = canvasSize(document.aspectRatio);
  const type = document.cameraMotion.type;
  const extent = 0.23;
  const cameraTarget = document.objects.find(({id, hidden}) => id === document.cameraMotion.targetId && !hidden);
  const target = cameraTarget
    ? {x: (cameraTarget.x + cameraTarget.width / 2) * size.width / 100,
      y: (cameraTarget.y + cameraTarget.height / 2) * size.height / 100}
    : {x: size.width * 0.5, y: size.height * 0.5};
  const arrow = {markerEnd: `url(#${markerId})`};
  const cameraIcon = (x: number, y: number) => (
    <path d={`M${x} ${y} h27 v20 h-27 Z m27 5 l12 -5 v20 l-12 -5 Z`} className="blocking-canvas__camera-icon" />
  );
  let symbol = 'custom';
  let marks: React.ReactNode = null;

  if (type.startsWith('Dolly')) {
    symbol = 'dolly';
    const start = {x: target.x, y: size.height * 0.86};
    const from = type === 'Dolly In' ? start : target;
    const to = type === 'Dolly In' ? target : start;
    marks = <>
      <path d={`M${start.x - 38} ${start.y + 15} L${target.x - 16} ${target.y} M${start.x + 38} ${start.y + 15} L${target.x + 16} ${target.y}`} className="blocking-canvas__camera-rails" />
      <path d={`M${from.x} ${from.y} L${to.x} ${to.y}`} {...arrow} data-guide-role="movement" />
      {cameraIcon(start.x - 20, start.y - 12)}
    </>;
  } else if (type.startsWith('Zoom')) {
    symbol = 'zoom';
    const outer = {x: size.width * 0.14, y: size.height * 0.14, width: size.width * 0.72, height: size.height * 0.72};
    const inner = {x: size.width * 0.31, y: size.height * 0.29, width: size.width * 0.38, height: size.height * 0.42};
    const inward = type === 'Zoom In';
    const start = inward ? {x: outer.x, y: outer.y} : {x: inner.x, y: inner.y};
    const end = inward ? {x: inner.x, y: inner.y} : {x: outer.x, y: outer.y};
    marks = <>
      <rect {...outer} rx="4" className="blocking-canvas__camera-frame blocking-canvas__camera-frame--start" />
      <rect {...inner} rx="4" className="blocking-canvas__camera-frame blocking-canvas__camera-frame--end" />
      <path d={`M${start.x} ${start.y} L${end.x} ${end.y}`} {...arrow} data-guide-role="movement" />
      <path d={`M${start.x + (inward ? outer.width : inner.width)} ${start.y + (inward ? outer.height : inner.height)} L${end.x + (inward ? inner.width : outer.width)} ${end.y + (inward ? inner.height : outer.height)}`} {...arrow} />
    </>;
  } else if (type.startsWith('Orbit')) {
    symbol = 'orbit';
    const direction = type.endsWith('Left') ? -1 : 1;
    const radius = size.width * extent;
    marks = <path d={`M${target.x - radius * direction} ${target.y + 20} Q${target.x} ${target.y - radius * 0.72} ${target.x + radius * direction} ${target.y + 20}`}
      {...arrow} data-guide-role="movement" />;
  } else if (type.startsWith('Pan')) {
    symbol = 'pan';
    const direction = type.endsWith('Left') ? -1 : type.endsWith('Right') ? 1 : 0;
    const distance = size.width * extent;
    const startX = direction < 0 ? target.x + distance : target.x - distance;
    const endX = direction < 0 ? target.x - distance : target.x + distance;
    marks = <>
      <circle cx={target.x} cy={target.y} r="9" className="blocking-canvas__camera-pivot" />
      <path d={`M${startX} ${target.y + 35} Q${target.x} ${target.y - 35} ${endX} ${target.y + 35}`}
        markerStart={direction === 0 ? `url(#${markerId})` : undefined} {...arrow} data-guide-role="movement" />
    </>;
  } else if (type.startsWith('Tilt')) {
    symbol = 'tilt';
    const direction = type.endsWith('Up') ? -1 : 1;
    const distance = size.height * extent;
    marks = <>
      <circle cx={target.x} cy={target.y} r="9" className="blocking-canvas__camera-pivot" />
      <path d={`M${target.x + 45} ${target.y - distance * direction} Q${target.x + 85} ${target.y} ${target.x + 45} ${target.y + distance * direction}`}
        {...arrow} data-guide-role="movement" />
    </>;
  } else if (type.startsWith('Truck')) {
    symbol = 'truck';
    const direction = type.endsWith('Left') ? -1 : 1;
    const y = size.height * 0.82;
    const startX = size.width * 0.5 - size.width * extent * direction;
    const endX = size.width * 0.5 + size.width * extent * direction;
    marks = <>
      <path d={`M${startX} ${y + 26} H${endX}`} className="blocking-canvas__camera-rails" />
      <path d={`M${startX} ${y} H${endX}`} {...arrow} data-guide-role="movement" />
      {cameraIcon(startX - 20, y - 12)}
    </>;
  } else if (type.startsWith('Crane')) {
    symbol = 'crane';
    const direction = type.endsWith('Up') ? -1 : 1;
    const x = size.width * 0.12;
    const startY = size.height * 0.5 - size.height * extent * direction;
    const endY = size.height * 0.5 + size.height * extent * direction;
    marks = <>
      <path d={`M${x - 28} ${startY} V${endY}`} className="blocking-canvas__camera-rails" />
      <path d={`M${x} ${startY} V${endY}`} {...arrow} data-guide-role="movement" />
      {cameraIcon(x - 20, startY - 12)}
    </>;
  } else if (type === 'Follow') {
    symbol = 'follow';
    const start = {x: Math.max(70, target.x - size.width * extent), y: Math.min(size.height - 55, target.y + size.height * extent)};
    marks = <>
      <path d={`M${start.x} ${start.y} Q${(start.x + target.x) / 2} ${target.y} ${target.x} ${target.y}`} {...arrow} data-guide-role="movement" />
      {cameraIcon(start.x - 20, start.y - 12)}
    </>;
  } else if (type === 'Custom' && document.cameraMotion.points.length >= 2) {
    marks = <path d={motionPathData(document.cameraMotion.points, size)} {...arrow} data-guide-role="movement" />;
  }

  return <g className="blocking-canvas__camera-guide" aria-hidden="true"
    data-camera-motion={type} data-motion-symbol={symbol} data-motion-tempo={document.cameraMotion.intensity}>
    {marks}
    {showBadge && <>
      {cameraIcon(size.width * 0.04, size.height * 0.055)}
      {label && <text x={size.width * 0.04 + 50} y={size.height * 0.055 + 19}>{label}</text>}
    </>}
  </g>;
}
