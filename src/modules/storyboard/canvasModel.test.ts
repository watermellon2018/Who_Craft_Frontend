import {randomFillSync} from 'crypto';
import {cloneCanvas, createCanvas, createCanvasObject, normalizeCanvas} from './canvasModel';

beforeAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: randomFillSync}}));

test('preserves editable geometry, motion and pinned library identity through JSON recovery', () => {
  const document = createCanvas();
  const object = createCanvasObject('person', 'Анчоус', 4, {id: 'character', type: 'character', title: 'Анчоус', assetId: 'asset'});
  object.rotation = -25; object.flipX = true;
  object.motion = {type: 'path', points: [{x: 10, y: 20}, {x: 40, y: 30}, {x: 90, y: 60}], start: 1, end: 3, facing: 'вправо'};
  document.objects = [object];
  document.markers = [{id: 'note', x: 15, y: 20, text: 'Взгляд на собеседника'}];
  document.cameraMotion = {type: 'Zoom In', targetId: object.id, intensity: 'medium', points: [], start: 0, end: 4};
  document.lighting.notes = 'Мягкий свет из окна';
  const restored = normalizeCanvas(JSON.parse(JSON.stringify(document)));
  expect(restored).toEqual(document);
  expect(restored?.objects[0]).not.toBe(object);
  expect(cloneCanvas(document).objects[0].motion.points).not.toBe(object.motion.points);
});

test('upgrades a legacy camera motion and preserves a custom camera path', () => {
  const legacy = createCanvas() as unknown as {cameraMotion: Record<string, unknown>};
  delete legacy.cameraMotion.points;
  expect(normalizeCanvas(legacy)?.cameraMotion.points).toEqual([]);

  const document = createCanvas();
  document.cameraMotion = {...document.cameraMotion, type: 'Custom', points: [
    {x: 10, y: 70}, {x: 45, y: 30}, {x: 80, y: 50},
  ]};
  expect(normalizeCanvas(document)?.cameraMotion.points).toEqual(document.cameraMotion.points);
});

test.each([
  (document: ReturnType<typeof createCanvas>) => {document.objects = [createCanvasObject('prop', 'Table')]; document.objects[0].width = Infinity;},
  (document: ReturnType<typeof createCanvas>) => {document.cameraMotion.end = -1;},
  (document: ReturnType<typeof createCanvas>) => {document.objects = Array.from({length: 81}, () => createCanvasObject('person', 'Person'));},
  (document: ReturnType<typeof createCanvas>) => {document.objects = [createCanvasObject('prop', 'Table')]; document.objects.push(document.objects[0]);},
])('rejects malformed or oversized recovery data', (corrupt) => {
  const document = createCanvas(); corrupt(document);
  expect(normalizeCanvas(document)).toBeNull();
});

test('rejects media URLs and unexpected content in the persistable document', () => {
  const document = createCanvas();
  expect(normalizeCanvas({...document, imageUrl: 'https://example.com/private.png'})).toBeNull();
  document.objects = [createCanvasObject('person', 'Person')];
  expect(normalizeCanvas({...document, objects: [{...document.objects[0], entity: {id: 'entity', type: 'character', title: 'Person', imageUrl: 'data:image/png;base64,abc'}}]})).toBeNull();
});
