import {calculateCoverage, selectionRangeWithin, sourceRangesForShot, splitSourceText} from './sourceSelection';
import type {StoryboardShot} from './model';

function select(start: Node, startOffset: number, end: Node, endOffset: number) {
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return selection;
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

test('converts selection crossing text and highlight nodes to exact Unicode code point offsets', () => {
  const root = document.createElement('div');
  root.append('Он ');
  const highlighted = document.createElement('mark');
  highlighted.textContent = '😀 идёт';
  root.append(highlighted, '.\nОна ждёт.');
  document.body.append(root);

  if (!highlighted.firstChild || !root.lastChild) throw new Error('Expected screenplay text.');
  const range = selectionRangeWithin(root, select(highlighted.firstChild, 0, root.lastChild, 2));
  expect(range).toEqual({start: 3, end: 11});
  if (!range) throw new Error('Expected source range.');
  expect(Array.from(root.textContent ?? '').slice(range.start, range.end).join('')).toBe('😀 идёт.\n');
});

test('never stores half a surrogate pair and rejects selections outside the screenplay', () => {
  const root = document.createElement('div');
  root.textContent = 'А😀Б';
  const outside = document.createElement('p');
  outside.textContent = 'Чужой текст';
  document.body.append(root, outside);

  if (!root.firstChild || !outside.firstChild) throw new Error('Expected screenplay text.');
  expect(selectionRangeWithin(root, select(root.firstChild, 2, root.firstChild, 3))).toEqual({start: 1, end: 2});
  expect(selectionRangeWithin(root, select(root.firstChild, 1, root.firstChild, 2))).toEqual({start: 1, end: 2});
  expect(selectionRangeWithin(root, select(root.firstChild, 0, outside.firstChild, 3))).toBeNull();
  expect(selectionRangeWithin(root, select(outside.firstChild, 0, outside.firstChild, 3))).toBeNull();
  root.textContent = ' \n\t ';
  expect(selectionRangeWithin(root, select(root.firstChild, 0, root.firstChild, 4))).toBeNull();
});

test('combines overlapping ranges without duplicating text or coverage and ignores whitespace', () => {
  const text = '  А😀Б\n\nВГ  ';
  const ranges = [{start: 2, end: 5}, {start: 3, end: 6}, {start: 7, end: 9}];
  const parts = splitSourceText(text, ranges);
  expect(parts.map((part) => part.text).join('')).toBe(text);
  expect(calculateCoverage(text, ranges)).toEqual({covered: 5, total: 5, percent: 100, complete: true});
  expect(calculateCoverage(text, ranges.slice(0, 2))).toEqual({covered: 3, total: 5, percent: 60, complete: false});
  expect(calculateCoverage(' \n ', [])).toEqual({covered: 0, total: 0, percent: 0, complete: false});
  expect(calculateCoverage(text, [{start: -1, end: 9}, {start: 0, end: 200}, {start: 1.5, end: 7}]).covered).toBe(0);
});

test('maps AI segment IDs and manual ranges only against the exact source text', () => {
  const shot: StoryboardShot = {
    characterIds: [], description: '', id: '1', keyframes: [], order: 1,
    referenceIds: [], sceneId: '1', title: 'Кадр', transitions: [],
    source: {
      document: {
        contentHash: 'hash', sceneId: 1, sceneVersion: 2, truncated: false,
        segments: [{id: 'a', text: 'А😀\n'}, {id: 'b', text: 'БВ'}],
      },
      segmentIds: ['b', 'unknown'],
      ranges: [{start: 1, end: 2}],
    },
  };
  expect(sourceRangesForShot(shot, 'А😀\nБВ')).toEqual([{start: 1, end: 2}, {start: 3, end: 5}]);
  expect(sourceRangesForShot(shot, 'Изменённый сценарий')).toEqual([]);
  expect(sourceRangesForShot({...shot, source: undefined}, 'А😀\nБВ')).toEqual([]);
});
