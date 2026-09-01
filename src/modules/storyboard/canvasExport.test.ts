import {createCanvas, createCanvasObject} from './canvasModel';
import {exportCanvasSvg} from './canvasExport';

// CRA's browser resolver picks the streaming browser server entry, which requires a TextEncoder
// missing in jsdom. The Node entry provides the same static renderer used by this export.
jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'));

const originalCrypto = window.crypto;
beforeAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: randomFillSync}}));
afterAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: originalCrypto}));

test('exports only visible artwork, never editing annotations, identifiers or reference details', () => {
  const document = createCanvas();
  const visible = createCanvasObject('person', '<script>alert(1)</script>');
  visible.entity = {id: 'private-entity', type: 'character', title: 'Sensitive title', assetId: 'private-asset'};
  visible.motion = {...visible.motion, type: 'path', points: [{x: 10, y: 20}, {x: 80, y: 90}]};
  const hidden = {...createCanvasObject('rectangle', 'Hidden object'), hidden: true};
  document.objects = [visible, hidden];
  document.markers = [{id: 'private-marker', x: 50, y: 50, text: 'Internal camera note'}];
  document.notes = 'Internal shot note';
  const markup = exportCanvasSvg(document);
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml');
  expect(svg.querySelector('parsererror')).toBeNull();
  expect(svg.documentElement.getAttribute('viewBox')).toBe('0 0 1600 900');
  expect(svg.querySelectorAll('rect')).toHaveLength(1);
  expect(svg.querySelector('ellipse')).not.toBeNull();
  expect(markup).not.toMatch(/private-|Sensitive|Internal|script|Hidden|marker|arrow|foreignObject|href/);
});

test.each([['16:9', '0 0 1600 900'], ['9:16', '0 0 900 1600'], ['1:1', '0 0 1200 1200']] as const)(
  'preserves the %s composition aspect ratio', (aspectRatio, viewBox) => {
    const markup = exportCanvasSvg({...createCanvas(), aspectRatio});
    expect(new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement.getAttribute('viewBox')).toBe(viewBox);
  },
);

test('includes object and camera trajectory arrows in the downloadable layout', () => {
  const document = createCanvas();
  const moving = createCanvasObject('person', 'Персонаж');
  moving.motion = {...moving.motion, type: 'path', points: [{x: 10, y: 20}, {x: 50, y: 40}, {x: 80, y: 70}]};
  document.objects = [moving];
  document.cameraMotion = {...document.cameraMotion, type: 'Custom', points: [
    {x: 20, y: 80}, {x: 45, y: 25}, {x: 75, y: 45},
  ]};
  const markup = exportCanvasSvg(document, {includeMotionGuides: true});
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml');
  expect(svg.querySelector('.blocking-canvas__motion')?.getAttribute('marker-end')).toContain('object-arrow');
  expect(svg.querySelector('[data-camera-motion="Custom"] [data-guide-role="movement"]')?.getAttribute('marker-end')).toContain('camera-arrow');
});
import {randomFillSync} from 'crypto';
