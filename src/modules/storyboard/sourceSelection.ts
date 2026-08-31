import type {StoryboardScene, StoryboardShot, StoryboardSourceDocument} from './model';

/** Source offsets count Unicode code points, matching Python's string offsets. */
export interface SourceRange {
  start: number;
  end: number;
}

export interface SourceTextPart extends SourceRange {
  text: string;
  highlighted: boolean;
}

function validRanges(length: number, ranges: readonly SourceRange[]): SourceRange[] {
  return ranges.filter(({start, end}) => Number.isInteger(start)
    && Number.isInteger(end) && start >= 0 && start < end && end <= length);
}

/** Resolve both AI segment references and manually selected ranges in this exact snapshot. */
export function sourceRangesForShot(shot: StoryboardShot, text: string): SourceRange[] {
  const source = shot.source;
  if (!source || source.document.segments.map((segment) => segment.text).join('') !== text) {
    return [];
  }

  const ranges = [...(source.ranges ?? [])];
  const selectedIds = new Set(source.segmentIds);
  let offset = 0;
  for (const segment of source.document.segments) {
    const end = offset + Array.from(segment.text).length;
    if (selectedIds.has(segment.id)) ranges.push({start: offset, end});
    offset = end;
  }
  return validRanges(offset, ranges);
}

/** Keep every character, including newlines, while combining overlapping highlights. */
export function splitSourceText(text: string, ranges: readonly SourceRange[]): SourceTextPart[] {
  const characters = Array.from(text);
  const valid = validRanges(characters.length, ranges);
  const boundaries = Array.from(new Set([
    0, characters.length, ...valid.flatMap(({start, end}) => [start, end]),
  ])).sort((first, second) => first - second);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    return {
      start,
      end,
      text: characters.slice(start, end).join(''),
      highlighted: valid.some((range) => range.start <= start && range.end >= end),
    };
  });
}

/** Overlaps count once; whitespace never prevents finishing the scene. */
export function calculateCoverage(text: string, ranges: readonly SourceRange[]) {
  let covered = 0;
  let total = 0;
  for (const part of splitSourceText(text, ranges)) {
    const count = Array.from(part.text).filter((character) => /\S/u.test(character)).length;
    total += count;
    if (part.highlighted) covered += count;
  }
  return {
    covered,
    total,
    percent: total ? Math.floor(covered / total * 100) : 0,
    complete: total > 0 && covered === total,
  };
}

function codePointOffset(text: string, utf16Offset: number, edge: 'start' | 'end'): number {
  let offset = utf16Offset;
  const previous = text.charCodeAt(offset - 1);
  const current = text.charCodeAt(offset);
  if (previous >= 0xD800 && previous <= 0xDBFF && current >= 0xDC00 && current <= 0xDFFF) {
    offset += edge === 'start' ? -1 : 1;
  }
  return Array.from(text.slice(0, offset)).length;
}

/** DOM Ranges count UTF-16 units and may span several highlight/text nodes. */
export function selectionRangeWithin(root: HTMLElement, selection: Selection | null): SourceRange | null {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const prefix = root.ownerDocument.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const startOffset = prefix.toString().length;
  prefix.setEnd(range.endContainer, range.endOffset);
  const endOffset = prefix.toString().length;
  const text = root.textContent ?? '';
  const start = codePointOffset(text, startOffset, 'start');
  const end = codePointOffset(text, endOffset, 'end');
  if (start >= end || !Array.from(text).slice(start, end).join('').trim()) return null;
  return {start, end};
}

export async function createManualSourceDocument(scene: StoryboardScene): Promise<StoryboardSourceDocument> {
  const sceneId = Number(scene.id);
  if (!Number.isSafeInteger(sceneId) || sceneId <= 0 || !globalThis.crypto?.subtle) {
    throw new Error('Storyboard source snapshots require a scene ID and Web Crypto.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(scene.text));
  const contentHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    contentHash,
    sceneId,
    sceneVersion: scene.version ?? 1,
    segments: [{id: `${contentHash.slice(0, 12)}-1`, text: scene.text}],
    truncated: false,
  };
}
