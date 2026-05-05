import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';

// Fraction of the image height the character occupies. MVP assumption:
// generator centers the subject with ~5% padding top/bottom (90% body, 10% pad).
// Replace with real bbox metadata from segmentation when available.
export const DEFAULT_CHARACTER_BOUNDING_FRACTION = 0.9;

const RULER_TICKS_CM = [0, 40, 80, 120, 160, 200, 220];
const RULER_LABELS_CM = new Set([0, 40, 80, 120, 160, 200, 220]);

export interface FullBodyCanvasProps {
  imageUrl: string | null;
  heightCm: number;
  imageBoundingFraction?: number;
  maxHeightCm?: number;
  onImageError?: () => void;
  /** Optional ref forwarded to the inner canvas div, used by zone-edit pointer handlers. */
  canvasRef?: React.Ref<HTMLDivElement>;
  /** Overlays (zone-edit selection rect, marker, popover, loading) rendered on top of the image. */
  children?: React.ReactNode;
  /** Fired when zone-edit pointer events should engage. Forwarded to the canvas div. */
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Style hooks for zone-edit interaction (cursor: crosshair etc.) */
  interactive?: boolean;
}

export default function FullBodyCanvas({
  imageUrl,
  heightCm,
  imageBoundingFraction = DEFAULT_CHARACTER_BOUNDING_FRACTION,
  maxHeightCm = 220,
  onImageError,
  canvasRef,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  interactive = false,
}: FullBodyCanvasProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasHeightPx, setCanvasHeightPx] = useState(0);
  const [imageNaturalLoaded, setImageNaturalLoaded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  // Forward inner ref to caller (so zone-edit handlers can compute coordinates).
  const setRefs = (el: HTMLDivElement | null) => {
    innerRef.current = el;
    if (typeof canvasRef === 'function') canvasRef(el);
    else if (canvasRef && 'current' in canvasRef) {
      (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  // Track canvas height for ruler + scaling math.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setCanvasHeightPx(el.clientHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset load state when image changes.
  useEffect(() => {
    setImageNaturalLoaded(false);
    setImageBroken(false);
  }, [imageUrl]);

  const pixelsPerCm = canvasHeightPx > 0 ? canvasHeightPx / maxHeightCm : 0;
  const targetCharPixelHeight = heightCm * pixelsPerCm;

  // Image is rendered at intrinsic display height equal to the canvas height
  // (height: 100%). The character occupies imageBoundingFraction of that.
  // We scale so the character's actual pixel height matches targetCharPixelHeight,
  // then translate so the bottom of the character (not the image) sits on the floor.
  const scale =
    imageNaturalLoaded && pixelsPerCm > 0 && imageBoundingFraction > 0
      ? targetCharPixelHeight / (canvasHeightPx * imageBoundingFraction)
      : 1;
  // Half of the empty padding on the bottom of the image (assuming symmetric padding).
  // After scaling, push the image down by this amount so the character's feet
  // align with the floor instead of the image's bottom edge.
  const bottomPaddingCanvasPx = canvasHeightPx * ((1 - imageBoundingFraction) / 2) * scale;
  const showImage = !!imageUrl && !imageBroken;

  return (
    <div
      ref={setRefs}
      className="full-body-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 480,
        overflow: 'hidden',
        cursor: interactive ? 'crosshair' : undefined,
        userSelect: interactive ? 'none' : undefined,
        touchAction: interactive ? 'none' : undefined,
      }}
    >
      {/* Floor line at 0 cm */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: 'rgba(250, 176, 5, 0.55)',
          boxShadow: '0 0 12px rgba(250, 176, 5, 0.35)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Ruler ticks + labels — left side */}
      <Ruler canvasHeightPx={canvasHeightPx} pixelsPerCm={pixelsPerCm} maxHeightCm={maxHeightCm} />

      {/* Character image, scaled and aligned to the floor */}
      {showImage && (
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Полный рост персонажа"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalHeight > 0) setImageNaturalLoaded(true);
            else setImageBroken(true);
          }}
          onError={() => {
            setImageBroken(true);
            onImageError?.();
          }}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            height: '100%',
            width: 'auto',
            transformOrigin: 'bottom center',
            // Translate first (in pre-scale pixels) by bottomPaddingCanvasPx / scale,
            // then scale. Order matters — write as scale * translateY in the
            // CSS string so scale is applied to the translation.
            transform: `translateX(-50%) translateY(${bottomPaddingCanvasPx / Math.max(scale, 0.0001)}px) scale(${scale})`,
            // Avoid sub-pixel jitter while resizing.
            willChange: 'transform',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Overlays (zone-edit etc.) — sit above the image */}
      <div style={{position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none'}}>
        <div style={{position: 'relative', width: '100%', height: '100%', pointerEvents: 'auto'}}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Ruler({
  canvasHeightPx,
  pixelsPerCm,
  maxHeightCm,
}: {
  canvasHeightPx: number;
  pixelsPerCm: number;
  maxHeightCm: number;
}) {
  if (canvasHeightPx <= 0 || pixelsPerCm <= 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 12,
        width: 60,
        zIndex: 4,
        pointerEvents: 'none',
        color: 'rgba(247, 239, 224, 0.65)',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {/* Vertical ruler line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 22,
          width: 1,
          background: 'linear-gradient(180deg, rgba(250,176,5,0.35), rgba(250,176,5,0.55))',
        }}
      />
      {RULER_TICKS_CM.filter((cm) => cm <= maxHeightCm).map((cm) => {
        const y = canvasHeightPx - cm * pixelsPerCm;
        const isMajor = RULER_LABELS_CM.has(cm);
        return (
          <div key={cm} style={{position: 'absolute', top: y - 0.5, left: 0, width: '100%', height: 1}}>
            <div
              style={{
                position: 'absolute',
                left: isMajor ? 14 : 18,
                top: 0,
                width: isMajor ? 16 : 8,
                height: 1,
                background: 'rgba(250,176,5,0.55)',
              }}
            />
            {isMajor && (
              <span style={{position: 'absolute', left: 34, top: -7}}>{cm} см</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
