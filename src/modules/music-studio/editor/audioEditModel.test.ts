import {
  audioEditDuration,
  createAudioEditDocument,
  deleteAudioSelection,
  normalizeAudioSelection,
  splitAudioAt,
  timelineToSourcePosition,
  trimAudioToSelection,
  updateSelectionEffects,
} from './audioEditModel';
import type {AudioEditDocument} from './audioEditModel';

function sourceRanges(document: AudioEditDocument): number[][] {
  return document.segments.map((segment) => [
    segment.sourceStartSeconds,
    segment.sourceEndSeconds,
  ]);
}

function createThreeSegmentDocument(): AudioEditDocument {
  return splitAudioAt(splitAudioAt(createAudioEditDocument(12), 4), 8);
}

test('creates a normalized document and reports its edited duration', () => {
  expect(createAudioEditDocument(-1)).toEqual({segments: []});
  expect(createAudioEditDocument(Number.NaN)).toEqual({segments: []});

  const document = createAudioEditDocument(12.5);

  expect(document.segments).toEqual([
    {
      fadeInOffsetSeconds: 0,
      fadeInSeconds: 0,
      fadeOutOffsetSeconds: 0,
      fadeOutSeconds: 0,
      gain: 1,
      id: 'segment-0',
      sourceEndSeconds: 12.5,
      sourceStartSeconds: 0,
    },
  ]);
  expect(audioEditDuration(document)).toBe(12.5);
});

test('normalizes reversed and out-of-range selections', () => {
  expect(
    normalizeAudioSelection({endSeconds: -3, startSeconds: 20}, 10),
  ).toEqual({endSeconds: 10, startSeconds: 0});
  expect(
    normalizeAudioSelection(
      {endSeconds: Number.NaN, startSeconds: Number.POSITIVE_INFINITY},
      10,
    ),
  ).toEqual({endSeconds: 10, startSeconds: 0});
});

test('splits a segment without changing its source mapping or input', () => {
  const document = createAudioEditDocument(10);
  Object.freeze(document.segments[0]);
  Object.freeze(document.segments);
  Object.freeze(document);

  const result = splitAudioAt(document, 4);

  expect(sourceRanges(result)).toEqual([
    [0, 4],
    [4, 10],
  ]);
  expect(audioEditDuration(result)).toBe(10);
  expect(document.segments).toHaveLength(1);
});

test('treats clamped ends and existing segment boundaries as split no-ops', () => {
  const document = splitAudioAt(createAudioEditDocument(10), 4);

  expect(splitAudioAt(document, -2)).toBe(document);
  expect(splitAudioAt(document, 4)).toBe(document);
  expect(splitAudioAt(document, 99)).toBe(document);
  expect(splitAudioAt(document, Number.NaN)).toBe(document);
});

test('trims across existing segments while retaining exact source ranges', () => {
  const document = createThreeSegmentDocument();

  const result = trimAudioToSelection(document, {
    endSeconds: 10,
    startSeconds: 2,
  });

  expect(sourceRanges(result)).toEqual([
    [2, 4],
    [4, 8],
    [8, 10],
  ]);
  expect(audioEditDuration(result)).toBe(8);
  expect(sourceRanges(document)).toEqual([
    [0, 4],
    [4, 8],
    [8, 12],
  ]);
  expect(trimAudioToSelection(document, {endSeconds: 99, startSeconds: -1})).toBe(
    document,
  );
});

test('deletes a range spanning segments and joins the remaining timeline', () => {
  const document = createThreeSegmentDocument();

  const result = deleteAudioSelection(document, {
    endSeconds: 9,
    startSeconds: 3,
  });

  expect(sourceRanges(result)).toEqual([
    [0, 3],
    [9, 12],
  ]);
  expect(audioEditDuration(result)).toBe(6);
  expect(timelineToSourcePosition(result, 3)?.sourceSeconds).toBe(9);
  expect(deleteAudioSelection(document, {endSeconds: 4, startSeconds: 4})).toBe(
    document,
  );
});

test('maps edited timeline positions across source discontinuities', () => {
  const document = deleteAudioSelection(createAudioEditDocument(12), {
    endSeconds: 8,
    startSeconds: 4,
  });

  expect(timelineToSourcePosition(document, -5)).toMatchObject({
    offsetInSegmentSeconds: 0,
    segmentTimelineEndSeconds: 4,
    segmentTimelineStartSeconds: 0,
    sourceSeconds: 0,
  });
  expect(timelineToSourcePosition(document, 4)).toMatchObject({
    offsetInSegmentSeconds: 0,
    segmentTimelineEndSeconds: 8,
    segmentTimelineStartSeconds: 4,
    sourceSeconds: 8,
  });
  expect(timelineToSourcePosition(document, 99)).toMatchObject({
    offsetInSegmentSeconds: 4,
    sourceSeconds: 12,
  });
  expect(timelineToSourcePosition({segments: []}, 0)).toBeNull();
});

test('splits at selection boundaries and clamps selection effects', () => {
  const document = splitAudioAt(createAudioEditDocument(10), 5);
  const originalRanges = sourceRanges(document);
  for (const segment of document.segments) Object.freeze(segment);
  Object.freeze(document.segments);
  Object.freeze(document);

  const result = updateSelectionEffects(
    document,
    {endSeconds: 8, startSeconds: 3},
    {fadeInSeconds: 10, fadeOutSeconds: -4, gain: 0.6},
  );

  expect(sourceRanges(result)).toEqual([
    [0, 3],
    [3, 5],
    [5, 8],
    [8, 10],
  ]);
  expect(
    result.segments.map(({fadeInSeconds, fadeOutSeconds, gain}) => ({
      fadeInSeconds,
      fadeOutSeconds,
      gain,
    })),
  ).toEqual([
    {fadeInSeconds: 0, fadeOutSeconds: 0, gain: 1},
    {fadeInSeconds: 5, fadeOutSeconds: 0, gain: 0.6},
    {fadeInSeconds: 5, fadeOutSeconds: 0, gain: 0.6},
    {fadeInSeconds: 0, fadeOutSeconds: 0, gain: 1},
  ]);
  expect(result.segments[1]).toMatchObject({fadeInOffsetSeconds: 0});
  expect(result.segments[2]).toMatchObject({fadeInOffsetSeconds: 2});
  expect(sourceRanges(document)).toEqual(originalRanges);
});

test('preserves the phase of inherited fades when an edit creates slices', () => {
  const document: AudioEditDocument = {
    segments: [
      {
        fadeInSeconds: 8,
        fadeOutSeconds: 8,
        gain: 1,
        id: 'with-fades',
        sourceEndSeconds: 10,
        sourceStartSeconds: 0,
      },
    ],
  };

  const result = splitAudioAt(document, 2);

  expect(result.segments[0]).toMatchObject({
    fadeInOffsetSeconds: 0,
    fadeInSeconds: 8,
    fadeOutOffsetSeconds: 8,
    fadeOutSeconds: 8,
  });
  expect(result.segments[1]).toMatchObject({
    fadeInOffsetSeconds: 2,
    fadeInSeconds: 8,
    fadeOutOffsetSeconds: 0,
    fadeOutSeconds: 8,
  });
});

test('returns empty edits for empty selections and fully deleted audio', () => {
  const document = createAudioEditDocument(5);

  expect(trimAudioToSelection(document, {endSeconds: 2, startSeconds: 2})).toEqual({
    segments: [],
  });
  expect(deleteAudioSelection(document, {endSeconds: 10, startSeconds: -1})).toEqual(
    {segments: []},
  );
  expect(
    updateSelectionEffects(
      document,
      {endSeconds: 2, startSeconds: 2},
      {gain: 0},
    ),
  ).toBe(document);
});
