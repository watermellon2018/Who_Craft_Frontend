import React from 'react';

import type {CanvasObject, StoryboardCanvasDocument} from '../canvasModel';
import {CameraMotionArtwork, motionPathData} from './BlockingMotionArtwork';

export function canvasDimensions(aspectRatio: StoryboardCanvasDocument['aspectRatio']) {
  if (aspectRatio === '9:16') return {width: 900, height: 1600};
  if (aspectRatio === '1:1') return {width: 1200, height: 1200};
  return {width: 1600, height: 900};
}

export function objectBounds(object: CanvasObject, document: StoryboardCanvasDocument) {
  const size = canvasDimensions(document.aspectRatio);
  return {
    x: object.x * size.width / 100, y: object.y * size.height / 100,
    width: object.width * size.width / 100, height: object.height * size.height / 100,
  };
}

export function objectTransform(object: CanvasObject, document: StoryboardCanvasDocument) {
  const {x, y, width, height} = objectBounds(object, document);
  return `translate(${x} ${y}) rotate(${object.rotation} ${width / 2} ${height / 2})`;
}

/** Generic silhouettes deliberately contain no reference photographs or editing overlays. */
export function BlockingObjectArtwork({object, document}: {
  object: CanvasObject; document: StoryboardCanvasDocument;
}) {
  const {width, height} = objectBounds(object, document);
  const artwork = (() => {
    if (object.kind === 'person') {
      if (object.pose === 'sitting') return <>
        <ellipse cx="47" cy="12" rx="13" ry="11" />
        <path d="M36 27 Q48 22 58 29 L64 54 L87 57 L89 69 L60 68 Q48 66 45 53 L37 51 Z" />
        <path d="M59 63 L74 67 L67 88 L86 91 L86 97 L53 96 L55 84 Z" />
        <path d="M39 31 L27 51 L49 58 L52 52 L38 45 L47 36 Z" />
      </>;
      if (object.pose === 'profile') return <>
        <path d="M42 3 Q63 0 64 15 L70 19 L63 23 L62 29 L43 28 Q31 20 34 11 Q36 5 42 3 Z" />
        <path d="M40 31 Q54 27 59 36 L62 61 L53 64 L48 88 L59 94 L58 98 L40 98 L37 91 L40 60 L35 45 Z" />
        <path d="M52 34 L61 52 L75 58 L72 64 L54 58 L44 39 Z" />
        <path d="M41 61 L48 65 L33 90 L37 97 L24 97 L23 90 Z" />
      </>;
      return <>
        <ellipse cx="50" cy="12" rx="13" ry="11" />
        <path d="M34 28 Q50 23 66 28 L72 58 L59 61 L64 97 L53 97 L50 70 L47 97 L36 97 L41 61 L28 58 Z" />
        <path d="M34 29 L27 30 L13 58 L20 62 L36 40 Z M66 29 L73 30 L87 58 L80 62 L64 40 Z" />
        {object.pose === 'front' && <path d="M45 13 L45 14 M55 13 L55 14" stroke="#f3f0e7" strokeWidth="3" />}
        {object.pose === 'back' && <path d="M43 29 Q50 34 57 29" fill="none" stroke="#9ca3af" strokeWidth="2" />}
      </>;
    }
    if (object.kind === 'animal') return <>
      <path d="M23 32 Q43 20 68 31 L82 29 L90 37 L98 40 L94 49 L80 50 L76 64 L73 94 L63 94 L61 66 L40 64 L31 93 L20 93 L24 64 L17 47 L4 31 L8 25 Z" />
      <path d="M79 32 L74 10 L87 28 Z" />
      <circle cx="87" cy="38" r="2" fill="#f3f0e7" />
    </>;
    if (object.kind === 'prop') return <>
      <path d="M8 25 L74 12 L95 31 L30 48 Z" fill="#a7afb9" />
      <path d="M8 25 L30 48 L30 91 L8 70 Z" fill="#7d8896" />
      <path d="M30 48 L95 31 L95 75 L30 91 Z" fill="#8c97a5" />
      <path d="M8 25 L74 12 L95 31 L95 75 L30 91 L8 70 Z M8 25 L30 48 L95 31 M30 48 L30 91" fill="none" stroke="#455366" strokeWidth="1.6" />
    </>;
    if (object.kind === 'ellipse') return <ellipse cx="50" cy="50" rx="48" ry="48" fill="#b4bdc5" stroke="#526172" strokeWidth="1.5" />;
    if (object.kind === 'line') return <path d="M1 50 H99" fill="none" stroke="#58687a" strokeWidth="8" strokeLinecap="round" />;
    return <rect x="1" y="1" width="98" height="98" rx="2" fill="#b4bdc5" stroke="#526172" strokeWidth="1.5" />;
  })();
  return <g transform={objectTransform(object, document)}>
    <g transform={`translate(${object.flipX ? width : 0} 0) scale(${(object.flipX ? -width : width) / 100} ${height / 100})`} fill="#546375">
      {artwork}
    </g>
  </g>;
}

interface BlockingArtworkProps {
  document: StoryboardCanvasDocument;
  className?: string;
  title?: string;
  responsive?: boolean;
  includeMotionGuides?: boolean;
}

/** Read-only composition; thumbnails/conditions stay clean while downloads may opt into motion guides. */
export default function BlockingArtwork({document, className, title, responsive = true,
  includeMotionGuides = false}: BlockingArtworkProps) {
  const {width, height} = canvasDimensions(document.aspectRatio);
  const objectArrowId = 'blocking-export-object-arrow';
  const cameraArrowId = 'blocking-export-camera-arrow';
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`}
    width={width} height={height} className={className} role={title ? 'img' : undefined} aria-label={title}
    aria-hidden={title ? undefined : true} style={responsive ? {display: 'block', width: '100%', height: '100%'} : undefined}>
    {title && <title>{title}</title>}
    {includeMotionGuides && <>
      <style>{`
        .blocking-canvas__motion{fill:none;stroke:#26696b;stroke-width:3}
        .blocking-canvas__camera-guide{pointer-events:none}
        .blocking-canvas__camera-guide rect,.blocking-canvas__camera-guide path,.blocking-canvas__camera-guide circle{fill:none;stroke:#7a4b00;stroke-width:2;stroke-dasharray:12 10}
        .blocking-canvas__camera-guide .blocking-canvas__camera-icon{stroke-dasharray:none}
        .blocking-canvas__camera-guide .blocking-canvas__camera-rails{stroke-width:1.5;stroke-dasharray:5 8;opacity:.7}
        .blocking-canvas__camera-guide .blocking-canvas__camera-frame--start{opacity:.55}
        .blocking-canvas__camera-guide .blocking-canvas__camera-frame--end{stroke-width:3;stroke-dasharray:none}
        .blocking-canvas__camera-guide .blocking-canvas__camera-pivot{fill:#f3f0e7;stroke-dasharray:none}
      `}</style>
      <defs>
        <marker id={objectArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#26696b" />
        </marker>
        <marker id={cameraArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#7a4b00" />
        </marker>
      </defs>
    </>}
    <rect width={width} height={height} fill="#f3f0e7" />
    {document.objects.filter(({hidden}) => !hidden).map((object) => (
      <BlockingObjectArtwork key={object.id} object={object} document={document} />
    ))}
    {includeMotionGuides && document.objects.filter(({hidden, motion}) => !hidden && motion.type === 'path').map((object) => (
      <path key={`path-${object.id}`} d={motionPathData(object.motion.points, {width, height})}
        className="blocking-canvas__motion" markerEnd={`url(#${objectArrowId})`} />
    ))}
    {includeMotionGuides && document.cameraMotion.type !== 'Static' && <CameraMotionArtwork document={document}
      markerId={cameraArrowId} showBadge={false} />}
  </svg>;
}
