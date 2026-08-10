import React, {useMemo, useRef} from 'react';

import type {AudioWaveformPeak} from '../editor/audioWaveform';

const BASE_VIEWBOX_WIDTH = 1000;
const TIMELINE_HEIGHT = 184;
const RULER_HEIGHT = 28;
const WAVEFORM_TOP = 38;
const WAVEFORM_BOTTOM = 172;
const WAVEFORM_CENTER = (WAVEFORM_TOP + WAVEFORM_BOTTOM) / 2;
const WAVEFORM_AMPLITUDE = (WAVEFORM_BOTTOM - WAVEFORM_TOP) / 2 - 5;
const DRAG_THRESHOLD_PX = 3;

export interface AudioWaveformSelection {
  endSeconds: number;
  startSeconds: number;
}

export interface AudioWaveformTimelineProps {
  ariaLabel: string;
  currentTimeSeconds: number;
  disabled?: boolean;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  onSelectionChange: (selection: AudioWaveformSelection) => void;
  peaks: readonly AudioWaveformPeak[];
  selection: AudioWaveformSelection | null;
  selectionEndLabel: string;
  selectionStartLabel: string;
  title?: string;
  zoom?: number;
}

type DragKind = 'selection' | 'selection-end' | 'selection-start';

interface DragState {
  anchorSeconds: number;
  fixedBoundarySeconds: number;
  kind: DragKind;
  moved: boolean;
  originClientX: number;
  pointerId: number;
}

const clamp = (value: number, min: number, max: number) => (
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
);

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

const normaliseSelection = (
  selection: AudioWaveformSelection,
  durationSeconds: number,
): AudioWaveformSelection => {
  const startSeconds = clamp(selection.startSeconds, 0, durationSeconds);
  const endSeconds = clamp(selection.endSeconds, 0, durationSeconds);
  return startSeconds <= endSeconds
    ? {endSeconds, startSeconds}
    : {endSeconds: startSeconds, startSeconds: endSeconds};
};

export default function AudioWaveformTimeline({
  ariaLabel,
  currentTimeSeconds,
  disabled = false,
  durationSeconds: rawDurationSeconds,
  onSeek,
  onSelectionChange,
  peaks,
  selection,
  selectionEndLabel,
  selectionStartLabel,
  title,
  zoom: rawZoom = 1,
}: AudioWaveformTimelineProps) {
  const durationSeconds = Math.max(
    0,
    Number.isFinite(rawDurationSeconds) ? rawDurationSeconds : 0,
  );
  const zoom = clamp(rawZoom, 1, 16);
  const viewBoxWidth = BASE_VIEWBOX_WIDTH * zoom;
  const dragRef = useRef<DragState | null>(null);
  const safeSelection = useMemo(
    () => selection ? normaliseSelection(selection, durationSeconds) : null,
    [durationSeconds, selection],
  );

  const waveformPath = useMemo(() => peaks.map((peak, index) => {
    const denominator = Math.max(1, peaks.length - 1);
    const x = peaks.length === 1
      ? viewBoxWidth / 2
      : (index / denominator) * viewBoxWidth;
    const max = clamp(peak.max, -1, 1);
    const min = clamp(peak.min, -1, 1);
    const upperY = WAVEFORM_CENTER - Math.max(max, min) * WAVEFORM_AMPLITUDE;
    const lowerY = WAVEFORM_CENTER - Math.min(max, min) * WAVEFORM_AMPLITUDE;
    return `M ${x.toFixed(2)} ${upperY.toFixed(2)} V ${lowerY.toFixed(2)}`;
  }).join(' '), [peaks, viewBoxWidth]);

  const tickCount = Math.min(160, Math.max(2, Math.round(10 * zoom)));
  const ticks = useMemo(() => Array.from({length: tickCount + 1}, (_, index) => {
    const ratio = index / tickCount;
    return {
      label: formatTime(durationSeconds * ratio),
      x: viewBoxWidth * ratio,
    };
  }), [durationSeconds, tickCount, viewBoxWidth]);

  const secondsFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || durationSeconds <= 0) return 0;
    return clamp(
      ((event.clientX - bounds.left) / bounds.width) * durationSeconds,
      0,
      durationSeconds,
    );
  };

  const emitDragChange = (
    drag: DragState,
    seconds: number,
    clientX: number,
  ) => {
    if (disabled) return;

    if (drag.kind === 'selection') {
      if (!drag.moved && Math.abs(clientX - drag.originClientX) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      onSelectionChange(normaliseSelection({
        endSeconds: seconds,
        startSeconds: drag.anchorSeconds,
      }, durationSeconds));
      return;
    }

    if (drag.kind === 'selection-start') {
      onSelectionChange({
        endSeconds: drag.fixedBoundarySeconds,
        startSeconds: Math.min(seconds, drag.fixedBoundarySeconds),
      });
      return;
    }

    onSelectionChange({
      endSeconds: Math.max(seconds, drag.fixedBoundarySeconds),
      startSeconds: drag.fixedBoundarySeconds,
    });
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;

    const seconds = secondsFromPointer(event);
    onSeek(seconds);
    if (disabled || durationSeconds <= 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      anchorSeconds: seconds,
      fixedBoundarySeconds: seconds,
      kind: 'selection',
      moved: false,
      originClientX: event.clientX,
      pointerId: event.pointerId,
    };
  };

  const beginHandleDrag = (
    kind: 'selection-end' | 'selection-start',
    event: React.PointerEvent<SVGRectElement>,
  ) => {
    event.stopPropagation();
    if (disabled || event.button !== 0 || !safeSelection) return;

    event.preventDefault();
    event.currentTarget.ownerSVGElement?.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      anchorSeconds: kind === 'selection-start'
        ? safeSelection.startSeconds
        : safeSelection.endSeconds,
      fixedBoundarySeconds: kind === 'selection-start'
        ? safeSelection.endSeconds
        : safeSelection.startSeconds,
      kind,
      moved: false,
      originClientX: event.clientX,
      pointerId: event.pointerId,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    emitDragChange(drag, secondsFromPointer(event), event.clientX);
  };

  const finishPointerDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    emitDragChange(drag, secondsFromPointer(event), event.clientX);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const changeHandleWithKeyboard = (
    kind: 'selection-end' | 'selection-start',
    event: React.KeyboardEvent<SVGRectElement>,
  ) => {
    if (disabled || !safeSelection || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;

    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const stepSeconds = Math.max(0.1, durationSeconds / 100);
    if (kind === 'selection-start') {
      onSelectionChange({
        endSeconds: safeSelection.endSeconds,
        startSeconds: clamp(
          safeSelection.startSeconds + direction * stepSeconds,
          0,
          safeSelection.endSeconds,
        ),
      });
      return;
    }

    onSelectionChange({
      endSeconds: clamp(
        safeSelection.endSeconds + direction * stepSeconds,
        safeSelection.startSeconds,
        durationSeconds,
      ),
      startSeconds: safeSelection.startSeconds,
    });
  };

  const selectionStartX = safeSelection && durationSeconds > 0
    ? (safeSelection.startSeconds / durationSeconds) * viewBoxWidth
    : 0;
  const selectionEndX = safeSelection && durationSeconds > 0
    ? (safeSelection.endSeconds / durationSeconds) * viewBoxWidth
    : 0;
  const playheadX = durationSeconds > 0
    ? (clamp(currentTimeSeconds, 0, durationSeconds) / durationSeconds) * viewBoxWidth
    : 0;

  return (
    <div
      className="music-audio-editor__timeline-scroll"
      style={{overflowX: 'auto', width: '100%'}}
    >
      <svg
        aria-label={ariaLabel}
        className="music-audio-editor__timeline"
        preserveAspectRatio="none"
        role="group"
        style={{
          display: 'block',
          height: TIMELINE_HEIGHT,
          minWidth: '100%',
          touchAction: 'none',
          userSelect: 'none',
          width: `${zoom * 100}%`,
        }}
        viewBox={`0 0 ${viewBoxWidth} ${TIMELINE_HEIGHT}`}
        onPointerCancel={finishPointerDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
      >
        {title && <title>{title}</title>}
        <rect
          className="music-audio-editor__timeline-background"
          fill="var(--craft-surface-raised)"
          height={TIMELINE_HEIGHT}
          width={viewBoxWidth}
        />
        <g aria-hidden="true" className="music-audio-editor__time-ruler">
          {ticks.map((tick, index) => (
            <g key={`${index}-${tick.x}`}>
              <line
                stroke="var(--craft-border)"
                x1={tick.x}
                x2={tick.x}
                y1={RULER_HEIGHT - 5}
                y2={TIMELINE_HEIGHT}
              />
              <text
                fill="var(--craft-text-muted)"
                fontSize={11}
                textAnchor={index === 0 ? 'start' : index === tickCount ? 'end' : 'middle'}
                x={tick.x}
                y={15}
              >
                {tick.label}
              </text>
            </g>
          ))}
        </g>
        <path
          aria-hidden="true"
          className="music-audio-editor__waveform"
          d={waveformPath}
          fill="none"
          stroke="var(--craft-text-muted)"
          strokeLinecap="round"
          strokeWidth={1.4}
        />
        {safeSelection && (
          <g className="music-audio-editor__selection">
            <rect
              aria-hidden="true"
              className="music-audio-editor__selection-range"
              fill="var(--craft-accent-soft)"
              height={WAVEFORM_BOTTOM - WAVEFORM_TOP}
              stroke="var(--craft-accent)"
              width={Math.max(0, selectionEndX - selectionStartX)}
              x={selectionStartX}
              y={WAVEFORM_TOP}
            />
            <rect
              aria-disabled={disabled}
              aria-label={selectionStartLabel}
              aria-valuemax={safeSelection.endSeconds}
              aria-valuemin={0}
              aria-valuenow={safeSelection.startSeconds}
              className="music-audio-editor__selection-handle music-audio-editor__selection-handle--start"
              fill="var(--craft-accent)"
              height={WAVEFORM_BOTTOM - WAVEFORM_TOP + 8}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              width={6}
              x={selectionStartX - 3}
              y={WAVEFORM_TOP - 4}
              onKeyDown={(event) => changeHandleWithKeyboard('selection-start', event)}
              onPointerDown={(event) => beginHandleDrag('selection-start', event)}
            />
            <rect
              aria-disabled={disabled}
              aria-label={selectionEndLabel}
              aria-valuemax={durationSeconds}
              aria-valuemin={safeSelection.startSeconds}
              aria-valuenow={safeSelection.endSeconds}
              className="music-audio-editor__selection-handle music-audio-editor__selection-handle--end"
              fill="var(--craft-accent)"
              height={WAVEFORM_BOTTOM - WAVEFORM_TOP + 8}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              width={6}
              x={selectionEndX - 3}
              y={WAVEFORM_TOP - 4}
              onKeyDown={(event) => changeHandleWithKeyboard('selection-end', event)}
              onPointerDown={(event) => beginHandleDrag('selection-end', event)}
            />
          </g>
        )}
        <line
          aria-hidden="true"
          className="music-audio-editor__playhead"
          stroke="var(--craft-accent)"
          strokeWidth={2}
          x1={playheadX}
          x2={playheadX}
          y1={RULER_HEIGHT}
          y2={TIMELINE_HEIGHT}
        />
      </svg>
    </div>
  );
}
