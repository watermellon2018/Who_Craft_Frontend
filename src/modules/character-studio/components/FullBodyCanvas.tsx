import React, {useEffect, useState} from 'react';

export interface FullBodyCanvasProps {
  imageUrl: string | null;
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
  onImageError,
  canvasRef,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  interactive = false,
}: FullBodyCanvasProps) {
  const [imageBroken, setImageBroken] = useState(false);

  const setRefs = (el: HTMLDivElement | null) => {
    if (typeof canvasRef === 'function') canvasRef(el);
    else if (canvasRef && 'current' in canvasRef) {
      (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  useEffect(() => {
    setImageBroken(false);
  }, [imageUrl]);

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: interactive ? 'crosshair' : undefined,
        userSelect: interactive ? 'none' : undefined,
        touchAction: interactive ? 'none' : undefined,
      }}
    >
      {showImage && (
        <img
          src={imageUrl}
          alt="Полный рост персонажа"
          onError={() => {
            setImageBroken(true);
            onImageError?.();
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      <div style={{position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none'}}>
        <div style={{position: 'relative', width: '100%', height: '100%', pointerEvents: 'auto'}}>
          {children}
        </div>
      </div>
    </div>
  );
}
