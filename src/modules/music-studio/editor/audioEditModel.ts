const MAX_GAIN = 1;

export interface AudioEditSegment {
  fadeInOffsetSeconds?: number;
  fadeInSeconds: number;
  fadeOutOffsetSeconds?: number;
  fadeOutSeconds: number;
  gain: number;
  id: string;
  sourceEndSeconds: number;
  sourceStartSeconds: number;
}

export interface AudioEditDocument {
  segments: readonly AudioEditSegment[];
}

export interface AudioSelection {
  endSeconds: number;
  startSeconds: number;
}

export interface AudioSelectionEffects {
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  gain?: number;
}

export interface AudioSourcePosition {
  offsetInSegmentSeconds: number;
  segment: AudioEditSegment;
  segmentTimelineEndSeconds: number;
  segmentTimelineStartSeconds: number;
  sourceSeconds: number;
}

function finiteNonNegative(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function segmentDuration(segment: AudioEditSegment): number {
  const sourceStartSeconds = finiteNonNegative(segment.sourceStartSeconds);
  const sourceEndSeconds = finiteNonNegative(
    segment.sourceEndSeconds,
    sourceStartSeconds,
  );

  return Math.max(0, sourceEndSeconds - sourceStartSeconds);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampTimelineTime(value: number, duration: number): number {
  if (value === Number.POSITIVE_INFINITY) return duration;
  if (!Number.isFinite(value)) return 0;

  return clamp(value, 0, duration);
}

function clampEffectValue(
  value: number,
  maximum: number,
  fallback: number,
): number {
  if (value === Number.POSITIVE_INFINITY) return maximum;
  if (!Number.isFinite(value)) return clamp(fallback, 0, maximum);

  return clamp(value, 0, maximum);
}

function slicedSegmentId(
  segment: AudioEditSegment,
  sourceStartSeconds: number,
  sourceEndSeconds: number,
): string {
  return `${segment.id}@${sourceStartSeconds}-${sourceEndSeconds}`;
}

function sliceSegment(
  segment: AudioEditSegment,
  startOffsetSeconds: number,
  endOffsetSeconds: number,
): AudioEditSegment | null {
  const duration = segmentDuration(segment);
  const startOffset = clampTimelineTime(startOffsetSeconds, duration);
  const endOffset = clampTimelineTime(endOffsetSeconds, duration);
  const sliceStartOffset = Math.min(startOffset, endOffset);
  const sliceEndOffset = Math.max(startOffset, endOffset);
  const sliceDuration = sliceEndOffset - sliceStartOffset;

  if (sliceDuration <= 0) return null;
  if (sliceStartOffset === 0 && sliceEndOffset === duration) return segment;

  const sourceStart = finiteNonNegative(segment.sourceStartSeconds);
  const sourceStartSeconds = sourceStart + sliceStartOffset;
  const sourceEndSeconds = sourceStart + sliceEndOffset;

  return {
    fadeInOffsetSeconds:
      finiteNonNegative(segment.fadeInOffsetSeconds ?? 0) + sliceStartOffset,
    fadeInSeconds: finiteNonNegative(segment.fadeInSeconds),
    fadeOutOffsetSeconds:
      finiteNonNegative(segment.fadeOutOffsetSeconds ?? 0)
      + duration
      - sliceEndOffset,
    fadeOutSeconds: finiteNonNegative(segment.fadeOutSeconds),
    gain: clampEffectValue(segment.gain, MAX_GAIN, 1),
    id: slicedSegmentId(segment, sourceStartSeconds, sourceEndSeconds),
    sourceEndSeconds,
    sourceStartSeconds,
  };
}

function appendSlice(
  segments: AudioEditSegment[],
  segment: AudioEditSegment,
  startOffsetSeconds: number,
  endOffsetSeconds: number,
): void {
  const slice = sliceSegment(segment, startOffsetSeconds, endOffsetSeconds);
  if (slice) segments.push(slice);
}

export function createAudioEditDocument(duration: number): AudioEditDocument {
  const normalizedDuration = finiteNonNegative(duration);

  if (normalizedDuration === 0) return {segments: []};

  return {
    segments: [
      {
        fadeInOffsetSeconds: 0,
        fadeInSeconds: 0,
        fadeOutOffsetSeconds: 0,
        fadeOutSeconds: 0,
        gain: 1,
        id: 'segment-0',
        sourceEndSeconds: normalizedDuration,
        sourceStartSeconds: 0,
      },
    ],
  };
}

export function audioEditDuration(document: AudioEditDocument): number {
  return document.segments.reduce(
    (duration, segment) => duration + segmentDuration(segment),
    0,
  );
}

export function normalizeAudioSelection(
  selection: AudioSelection,
  duration: number,
): AudioSelection {
  const normalizedDuration = finiteNonNegative(duration);
  const first = clampTimelineTime(selection.startSeconds, normalizedDuration);
  const second = clampTimelineTime(selection.endSeconds, normalizedDuration);

  return {
    endSeconds: Math.max(first, second),
    startSeconds: Math.min(first, second),
  };
}

export function splitAudioAt(
  document: AudioEditDocument,
  timelineSeconds: number,
): AudioEditDocument {
  const duration = audioEditDuration(document);
  const splitTime = clampTimelineTime(timelineSeconds, duration);

  if (splitTime === 0 || splitTime === duration) return document;

  const segments: AudioEditSegment[] = [];
  let timelineOffset = 0;

  for (const segment of document.segments) {
    const currentDuration = segmentDuration(segment);
    const segmentEnd = timelineOffset + currentDuration;

    if (splitTime > timelineOffset && splitTime < segmentEnd) {
      const localSplitTime = splitTime - timelineOffset;
      appendSlice(segments, segment, 0, localSplitTime);
      appendSlice(segments, segment, localSplitTime, currentDuration);
    } else {
      segments.push(segment);
    }

    timelineOffset = segmentEnd;
  }

  if (segments.length === document.segments.length) return document;

  return {segments};
}

export function trimAudioToSelection(
  document: AudioEditDocument,
  selection: AudioSelection,
): AudioEditDocument {
  const duration = audioEditDuration(document);
  const normalizedSelection = normalizeAudioSelection(selection, duration);

  if (
    normalizedSelection.startSeconds === 0 &&
    normalizedSelection.endSeconds === duration
  ) {
    return document;
  }
  if (normalizedSelection.startSeconds === normalizedSelection.endSeconds) {
    return {segments: []};
  }

  const segments: AudioEditSegment[] = [];
  let timelineOffset = 0;

  for (const segment of document.segments) {
    const currentDuration = segmentDuration(segment);
    const segmentEnd = timelineOffset + currentDuration;
    const overlapStart = Math.max(
      timelineOffset,
      normalizedSelection.startSeconds,
    );
    const overlapEnd = Math.min(
      segmentEnd,
      normalizedSelection.endSeconds,
    );

    if (overlapStart < overlapEnd) {
      appendSlice(
        segments,
        segment,
        overlapStart - timelineOffset,
        overlapEnd - timelineOffset,
      );
    }

    timelineOffset = segmentEnd;
  }

  return {segments};
}

export function deleteAudioSelection(
  document: AudioEditDocument,
  selection: AudioSelection,
): AudioEditDocument {
  const duration = audioEditDuration(document);
  const normalizedSelection = normalizeAudioSelection(selection, duration);

  if (normalizedSelection.startSeconds === normalizedSelection.endSeconds) {
    return document;
  }

  const segments: AudioEditSegment[] = [];
  let timelineOffset = 0;

  for (const segment of document.segments) {
    const currentDuration = segmentDuration(segment);
    const segmentEnd = timelineOffset + currentDuration;

    if (
      segmentEnd <= normalizedSelection.startSeconds ||
      timelineOffset >= normalizedSelection.endSeconds
    ) {
      segments.push(segment);
    } else {
      if (timelineOffset < normalizedSelection.startSeconds) {
        appendSlice(
          segments,
          segment,
          0,
          normalizedSelection.startSeconds - timelineOffset,
        );
      }
      if (segmentEnd > normalizedSelection.endSeconds) {
        appendSlice(
          segments,
          segment,
          normalizedSelection.endSeconds - timelineOffset,
          currentDuration,
        );
      }
    }

    timelineOffset = segmentEnd;
  }

  return {segments};
}

function applyEffects(
  segment: AudioEditSegment,
  effects: AudioSelectionEffects,
  selectionDuration: number,
  selectionOffsetEnd: number,
  selectionOffsetStart: number,
): AudioEditSegment {
  return {
    ...segment,
    fadeInOffsetSeconds:
      effects.fadeInSeconds === undefined
        ? finiteNonNegative(segment.fadeInOffsetSeconds ?? 0)
        : selectionOffsetStart,
    fadeInSeconds:
      effects.fadeInSeconds === undefined
        ? finiteNonNegative(segment.fadeInSeconds)
        : clampEffectValue(effects.fadeInSeconds, selectionDuration, 0),
    fadeOutOffsetSeconds:
      effects.fadeOutSeconds === undefined
        ? finiteNonNegative(segment.fadeOutOffsetSeconds ?? 0)
        : Math.max(0, selectionDuration - selectionOffsetEnd),
    fadeOutSeconds:
      effects.fadeOutSeconds === undefined
        ? finiteNonNegative(segment.fadeOutSeconds)
        : clampEffectValue(effects.fadeOutSeconds, selectionDuration, 0),
    gain:
      effects.gain === undefined
        ? clampEffectValue(segment.gain, MAX_GAIN, 1)
        : clampEffectValue(effects.gain, MAX_GAIN, 1),
  };
}

export function updateSelectionEffects(
  document: AudioEditDocument,
  selection: AudioSelection,
  effects: AudioSelectionEffects,
): AudioEditDocument {
  const duration = audioEditDuration(document);
  const normalizedSelection = normalizeAudioSelection(selection, duration);
  const selectionDuration = normalizedSelection.endSeconds
    - normalizedSelection.startSeconds;

  if (
    normalizedSelection.startSeconds === normalizedSelection.endSeconds ||
    (effects.gain === undefined &&
      effects.fadeInSeconds === undefined &&
      effects.fadeOutSeconds === undefined)
  ) {
    return document;
  }

  const segments: AudioEditSegment[] = [];
  let timelineOffset = 0;

  for (const segment of document.segments) {
    const currentDuration = segmentDuration(segment);
    const segmentEnd = timelineOffset + currentDuration;
    const overlapStart = Math.max(
      timelineOffset,
      normalizedSelection.startSeconds,
    );
    const overlapEnd = Math.min(
      segmentEnd,
      normalizedSelection.endSeconds,
    );

    if (overlapStart >= overlapEnd) {
      segments.push(segment);
    } else {
      appendSlice(
        segments,
        segment,
        0,
        overlapStart - timelineOffset,
      );
      const selectedSlice = sliceSegment(
        segment,
        overlapStart - timelineOffset,
        overlapEnd - timelineOffset,
      );
      if (selectedSlice) {
        segments.push(applyEffects(
          selectedSlice,
          effects,
          selectionDuration,
          overlapEnd - normalizedSelection.startSeconds,
          overlapStart - normalizedSelection.startSeconds,
        ));
      }
      appendSlice(
        segments,
        segment,
        overlapEnd - timelineOffset,
        currentDuration,
      );
    }

    timelineOffset = segmentEnd;
  }

  return {segments};
}

export function timelineToSourcePosition(
  document: AudioEditDocument,
  timelineSeconds: number,
): AudioSourcePosition | null {
  const duration = audioEditDuration(document);
  if (duration === 0) return null;

  const timelinePosition = clampTimelineTime(timelineSeconds, duration);
  const playableSegments = document.segments.filter(
    (segment) => segmentDuration(segment) > 0,
  );
  let remainingSegments = playableSegments.length;
  let timelineOffset = 0;

  for (const segment of playableSegments) {
    remainingSegments -= 1;
    const currentDuration = segmentDuration(segment);
    const segmentEnd = timelineOffset + currentDuration;

    if (timelinePosition < segmentEnd || remainingSegments === 0) {
      const offsetInSegmentSeconds = clamp(
        timelinePosition - timelineOffset,
        0,
        currentDuration,
      );

      return {
        offsetInSegmentSeconds,
        segment,
        segmentTimelineEndSeconds: segmentEnd,
        segmentTimelineStartSeconds: timelineOffset,
        sourceSeconds:
          finiteNonNegative(segment.sourceStartSeconds) +
          offsetInSegmentSeconds,
      };
    }

    timelineOffset = segmentEnd;
  }

  return null;
}
