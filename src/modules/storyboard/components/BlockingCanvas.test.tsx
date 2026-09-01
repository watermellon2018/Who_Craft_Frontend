import {fireEvent, render, screen} from '@testing-library/react';
import {randomFillSync} from 'crypto';
import React from 'react';

import {createCanvas, createCanvasObject} from '../canvasModel';
import type {StoryboardCanvasDocument} from '../canvasModel';
import BlockingCanvas, {STORYBOARD_OBJECT_MIME} from './BlockingCanvas';
import type {BlockingCanvasTool} from './BlockingCanvas';

const originalCrypto = window.crypto;
beforeAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: randomFillSync}}));
afterAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: originalCrypto}));

function scene(): StoryboardCanvasDocument {
  const document = createCanvas();
  const object = createCanvasObject('person', 'Анчоус', 4, undefined, {x: 10, y: 20});
  return {...document, objects: [object]};
}

function setup(document = scene(), options: {disabled?: boolean; tool?: BlockingCanvasTool} = {}) {
  const onChange = jest.fn();
  const onSelect = jest.fn();
  const onToolChange = jest.fn();
  const onAdd = jest.fn();
  const onOpenMarker = jest.fn();
  const props = {document, selectedObjectId: document.objects[0]?.id ?? null, tool: options.tool ?? 'select' as BlockingCanvasTool,
    disabled: options.disabled ?? false, overlays: true, onChange, onSelect, onToolChange, onAdd, onOpenMarker};
  const view = render(<BlockingCanvas {...props} />);
  const surface = screen.getByRole('group', {name: 'Схема кадра — вид через камеру'});
  jest.spyOn(surface, 'getBoundingClientRect').mockReturnValue({x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 562.5,
    width: 1000, height: 562.5, toJSON: () => ({})});
  return {...view, props, surface, onChange, onSelect, onToolChange, onAdd, onOpenMarker};
}

function pointer(target: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, {bubbles: true, cancelable: true, clientX, clientY, button: 0});
  Object.defineProperty(event, 'pointerId', {value: 1});
  fireEvent(target, event);
}

test('moving an object previews locally and commits one completed drag', () => {
  const {surface, onChange, onSelect, props} = setup();
  pointer(screen.getByRole('button', {name: 'Анчоус'}), 'pointerdown', 100, 200);
  expect(onSelect).toHaveBeenCalledWith(props.document.objects[0].id);
  pointer(surface, 'pointermove', 200, 250);
  expect(onChange).not.toHaveBeenCalled();
  pointer(surface, 'pointerup', 200, 250);
  expect(onChange).toHaveBeenCalledTimes(1);
  const object = onChange.mock.calls[0][0].objects[0];
  expect(object.x).toBeCloseTo(20);
  expect(object.y).toBeCloseTo(28.8889);
  expect(props.document.objects[0].x).toBe(10);
});

test.each(['Escape', 'pointercancel', 'new-document'])('cancels the transaction on %s without saving stale geometry', (cancel) => {
  const {surface, onChange, props, rerender} = setup();
  pointer(screen.getByRole('button', {name: 'Анчоус'}), 'pointerdown', 100, 200);
  pointer(surface, 'pointermove', 300, 350);
  if (cancel === 'Escape') fireEvent.keyDown(surface, {key: 'Escape'});
  else if (cancel === 'pointercancel') pointer(surface, 'pointercancel', 300, 350);
  else rerender(<BlockingCanvas {...props} document={{...props.document, notes: 'Other keyframe'}} />);
  pointer(surface, 'pointerup', 300, 350);
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled and locked objects cannot be moved, resized, deleted or given motion', () => {
  const document = scene();
  document.objects[0].locked = true;
  const {surface, onChange, props, rerender} = setup(document);
  pointer(screen.getByRole('button', {name: 'Анчоус'}), 'pointerdown', 100, 200);
  pointer(surface, 'pointermove', 300, 350);
  pointer(surface, 'pointerup', 300, 350);
  fireEvent.keyDown(surface, {key: 'ArrowRight'});
  fireEvent.keyDown(surface, {key: 'Delete'});
  expect(screen.queryByRole('button', {name: 'Повернуть элемент'})).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  rerender(<BlockingCanvas {...props} disabled tool="comment" />);
  pointer(surface, 'pointerdown', 300, 350);
  fireEvent.keyDown(surface, {key: 'Enter'});
  expect(onChange).not.toHaveBeenCalled();
});

test('keyboard movement and deletion respect boundaries and clear camera target references', () => {
  const document = scene();
  document.cameraMotion.targetId = document.objects[0].id;
  const {surface, onChange, onSelect} = setup(document);
  fireEvent.keyDown(surface, {key: 'ArrowLeft', shiftKey: true});
  expect(onChange.mock.calls[0][0].objects[0].x).toBe(0);
  fireEvent.keyDown(surface, {key: 'Delete'});
  expect(onChange.mock.calls[1][0].objects).toEqual([]);
  expect(onChange.mock.calls[1][0].cameraMotion.targetId).toBeUndefined();
  expect(onSelect).toHaveBeenLastCalledWith(null);
});

test('resizing and rotating are available without a mouse', () => {
  const {onChange, props} = setup();
  fireEvent.keyDown(screen.getByRole('button', {name: 'Изменить размер: справа, снизу'}), {key: 'ArrowRight'});
  expect(onChange.mock.calls[0][0].objects[0].width).toBeCloseTo(props.document.objects[0].width + 1);
  fireEvent.keyDown(screen.getByRole('button', {name: 'Повернуть элемент'}), {key: 'ArrowRight', shiftKey: true});
  expect(onChange.mock.calls[1][0].objects[0].rotation).toBe(15);
});

test('path tool records editable scene coordinates and preserves movement timing', () => {
  const {surface, onChange, onToolChange, props, rerender} = setup(scene(), {tool: 'path'});
  pointer(surface, 'pointerdown', 800, 300);
  const document = onChange.mock.calls[0][0] as StoryboardCanvasDocument;
  expect(document.objects[0].motion).toMatchObject({type: 'path', start: 0, end: 4});
  expect(document.objects[0].motion.points).toHaveLength(3);
  expect(document.objects[0].motion.points[2].x).toBe(80);
  expect(onToolChange).toHaveBeenCalledWith('select');
  rerender(<BlockingCanvas {...props} document={document} tool="select" />);
  fireEvent.keyDown(screen.getByRole('button', {name: 'Точка траектории 2'}), {key: 'ArrowUp'});
  expect(onChange.mock.calls[1][0].objects[0].motion.points[1].y).toBeCloseTo(document.objects[0].motion.points[1].y - 1);
});

test.each([
  ['Dolly In', 'dolly'], ['Zoom Out', 'zoom'], ['Pan Left', 'pan'], ['Tilt Up', 'tilt'],
  ['Orbit Right', 'orbit'], ['Truck Left', 'truck'], ['Crane Down', 'crane'], ['Follow', 'follow'],
] as const)('shows an automatic directing symbol for %s', (type, symbol) => {
  const document = scene();
  document.cameraMotion = {...document.cameraMotion, type, targetId: document.objects[0].id};
  const {container} = setup(document);
  const guide = container.querySelector(`[data-camera-motion="${type}"]`);
  expect(guide).toHaveAttribute('data-motion-symbol', symbol);
  expect(guide?.querySelector('[data-guide-role="movement"]')).toBeInTheDocument();
});

test('draws a custom camera trajectory and lets every point be adjusted', () => {
  const initial = scene();
  initial.cameraMotion.type = 'Custom';
  const {surface, onChange, onToolChange, props, rerender} = setup(initial, {tool: 'camera-path'});
  pointer(surface, 'pointerdown', 200, 400);
  pointer(surface, 'pointermove', 800, 200);
  pointer(surface, 'pointerup', 800, 200);
  const document = onChange.mock.calls[0][0] as StoryboardCanvasDocument;
  expect(document.cameraMotion.points).toHaveLength(3);
  expect(document.cameraMotion.points[0]).toEqual(expect.objectContaining({x: 20}));
  expect(document.cameraMotion.points[2]).toEqual(expect.objectContaining({x: 80}));
  expect(onToolChange).toHaveBeenCalledWith('select');
  rerender(<BlockingCanvas {...props} document={document} tool="select" />);
  fireEvent.keyDown(screen.getByRole('button', {name: 'Точка траектории камеры 2'}), {key: 'ArrowUp'});
  expect(onChange.mock.calls[1][0].cameraMotion.points[1].y).toBeCloseTo(document.cameraMotion.points[1].y - 1);
});

test('hides camera movement symbols with other editor overlays', () => {
  const document = scene();
  document.cameraMotion.type = 'Pan Right';
  const {container, props, rerender} = setup(document);
  expect(container.querySelector('[data-camera-motion="Pan Right"]')).toBeInTheDocument();
  rerender(<BlockingCanvas {...props} document={document} overlays={false} />);
  expect(container.querySelector('[data-camera-motion]')).not.toBeInTheDocument();
});

test('comment tool adds separate markers that can be moved and deleted with the keyboard', () => {
  const {surface, onChange, onOpenMarker, props, rerender} = setup(scene(), {tool: 'comment'});
  fireEvent.keyDown(surface, {key: 'Enter'});
  const document = onChange.mock.calls[0][0] as StoryboardCanvasDocument;
  expect(document.markers[0]).toMatchObject({x: 50, y: 50, text: ''});
  expect(onOpenMarker).toHaveBeenCalledWith(document.markers[0].id);
  expect(document.objects).toBe(props.document.objects);
  rerender(<BlockingCanvas {...props} document={document} tool="select" />);
  const marker = screen.getByRole('button', {name: 'Комментарий 1:'});
  fireEvent.keyDown(marker, {key: 'ArrowRight'});
  expect(onChange.mock.calls[1][0].markers[0].x).toBe(51);
  fireEvent.keyDown(marker, {key: 'Delete'});
  expect(onChange.mock.calls[2][0].markers).toEqual([]);
  expect(onChange.mock.calls[2][0].objects).toHaveLength(1);
});

test('clicking or activating a marker opens its frame notes', () => {
  const document = scene();
  document.markers = [{id: 'marker-1', x: 50, y: 50, text: 'Свет'}];
  const {onOpenMarker} = setup(document);
  const marker = screen.getByRole('button', {name: 'Комментарий 1: Свет'});
  pointer(marker, 'pointerdown', 500, 280);
  expect(onOpenMarker).toHaveBeenLastCalledWith('marker-1');
  fireEvent.keyDown(marker, {key: 'Enter'});
  expect(onOpenMarker).toHaveBeenLastCalledWith('marker-1');
});

test('accepts a library object drop and rejects unknown or malformed payloads', () => {
  const {surface, onAdd} = setup();
  const drop = (value: string) => {
    const event = new MouseEvent('drop', {bubbles: true, cancelable: true, clientX: 400, clientY: 200});
    Object.defineProperty(event, 'dataTransfer', {value: {getData: (type: string) => type === STORYBOARD_OBJECT_MIME ? value : ''}});
    fireEvent(surface, event);
  };
  drop(JSON.stringify({kind: 'person', entityId: 'library-character'}));
  expect(onAdd).toHaveBeenCalledWith('person', {x: 40, y: 200 / 562.5 * 100}, 'library-character');
  drop('{'); drop(JSON.stringify({kind: 'script'})); drop(JSON.stringify({kind: 'person', entityId: {bad: true}}));
  expect(onAdd).toHaveBeenCalledTimes(1);
});

test('hidden elements cannot be selected or moved', () => {
  const document = scene();
  document.objects[0].hidden = true;
  const {surface, onChange} = setup(document);
  expect(screen.queryByRole('button', {name: 'Анчоус'})).not.toBeInTheDocument();
  fireEvent.keyDown(surface, {key: 'Delete'});
  fireEvent.keyDown(surface, {key: 'ArrowRight'});
  expect(onChange).not.toHaveBeenCalled();
});
