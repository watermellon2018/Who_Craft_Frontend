import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {randomFillSync} from 'crypto';
import React, {useState} from 'react';

import {createCanvas, createCanvasObject} from '../canvasModel';
import type {StoryboardCanvasDocument} from '../canvasModel';
import {createInitialKeyframes} from '../model';
import type {StoryboardSceneEntity} from '../model';
import BlockingInspector from './BlockingInspector';
import BlockingPalette, {BLOCKING_OBJECT_MIME} from './BlockingPalette';

const originalCrypto = window.crypto;
beforeAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: randomFillSync}}));
afterAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: originalCrypto}));

const entity: StoryboardSceneEntity = {
  id: 'character-real-uuid', type: 'character', title: 'Анна из библиотеки',
  imageUrl: '/media/anna.jpg', versionId: 'version-uuid', assetId: 'asset-uuid',
};

function initialDocument(): StoryboardCanvasDocument {
  return {...createCanvas(), objects: [{...createCanvasObject('person', 'Человек 1'), id: 'object-1'}]};
}

function InspectorHarness({initial = initialDocument(), disabled = false, drawPath = jest.fn(), drawCameraPath = jest.fn(), entities = [entity]}: {
  initial?: StoryboardCanvasDocument;
  disabled?: boolean;
  drawPath?: () => void;
  drawCameraPath?: () => void;
  entities?: StoryboardSceneEntity[];
}) {
  const [document, setDocument] = useState(initial);
  const [intent, setIntent] = useState(createInitialKeyframes('shot')[0].cameraIntent);
  const [duration, setDuration] = useState(4);
  return <>
    <BlockingInspector document={document} selectedObjectId="object-1" intent={intent} entities={entities}
      duration={duration} disabled={disabled} onChange={setDocument} onIntentChange={setIntent}
      onDurationChange={setDuration} onDrawPath={drawPath} onDrawCameraPath={drawCameraPath} onAddComment={jest.fn()} />
    <output data-testid="document">{JSON.stringify(document)}</output>
    <output data-testid="intent">{JSON.stringify(intent)}</output>
  </>;
}

function currentDocument(): StoryboardCanvasDocument {
  return JSON.parse(screen.getByTestId('document').textContent ?? '{}');
}

async function choose(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', {name: label}));
  const choices = await screen.findAllByText(option);
  const choice = choices.find((element) => element.closest('.ant-select-item-option'));
  if (!choice) throw new Error(`Option not rendered: ${option}`);
  fireEvent.click(choice);
}

test('binds a primitive to the real library entity with version and asset IDs, without replacing custom text', async () => {
  render(<InspectorHarness />);
  expect(screen.getByRole('button', {name: 'Объект'})).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('textbox', {name: 'Название объекта'}), {target: {value: 'Анна у окна'}});
  await choose('Связь с библиотекой', 'Анна из библиотеки');
  expect(currentDocument().objects[0]).toEqual(expect.objectContaining({
    title: 'Анна у окна', entity: {id: entity.id, type: entity.type, title: entity.title, versionId: entity.versionId, assetId: entity.assetId},
  }));
  expect(screen.queryByText(entity.id)).not.toBeInTheDocument();
  expect(screen.queryByText(entity.versionId ?? '')).not.toBeInTheDocument();
});

test('does not expose the legacy per-object comment field', () => {
  const document = initialDocument();
  document.objects[0].comment = 'Старая скрытая инструкция';
  render(<InspectorHarness initial={document} />);
  expect(screen.queryByText('Комментарий к объекту')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', {name: 'Комментарий'})).not.toBeInTheDocument();
});

test('persists object motion and timing while retaining its drawn path and supports frame mode with a selection', async () => {
  const document = initialDocument();
  document.objects[0].motion.points = [{x: 15, y: 20}, {x: 65, y: 35}];
  const drawPath = jest.fn();
  render(<InspectorHarness initial={document} drawPath={drawPath} />);
  fireEvent.click(screen.getByText('Движение объекта', {selector: 'summary'}));
  await choose('Тип движения', 'По траектории');
  fireEvent.change(screen.getByRole('spinbutton', {name: 'Начало, с'}), {target: {value: '1'}});
  fireEvent.change(screen.getByRole('spinbutton', {name: 'Конец, с'}), {target: {value: '3'}});
  fireEvent.change(screen.getByRole('textbox', {name: 'Куда смотрит объект'}), {target: {value: 'На дверь'}});
  fireEvent.click(screen.getByRole('button', {name: 'Нарисовать траекторию'}));
  expect(drawPath).toHaveBeenCalledTimes(1);
  expect(currentDocument().objects[0].motion).toEqual({type: 'path', start: 1, end: 3, facing: 'На дверь', points: document.objects[0].motion.points});
  fireEvent.click(screen.getByRole('button', {name: 'Кадр'}));
  expect(Number((screen.getByRole('spinbutton', {name: 'Длительность, с'}) as HTMLInputElement).value)).toBe(4);
  fireEvent.change(screen.getByRole('spinbutton', {name: 'Длительность, с'}), {target: {value: '2'}});
  expect(currentDocument().objects[0].motion.end).toBe(2);
  expect(currentDocument().cameraMotion.end).toBe(2);
  expect(screen.getByRole('button', {name: 'Кадр'})).toHaveAttribute('aria-pressed', 'true');
});

test('edits custom camera motion with tempo, tracking-object help and a draw action', async () => {
  const document = initialDocument();
  document.cameraMotion = {...document.cameraMotion, type: 'Custom'};
  const drawCameraPath = jest.fn();
  render(<InspectorHarness initial={document} drawCameraPath={drawCameraPath} />);
  fireEvent.click(screen.getByRole('button', {name: 'Кадр'}));
  expect(screen.getByRole('combobox', {name: 'Объект слежения'})).toHaveAccessibleDescription(
    'Объект, относительно которого работает камера.',
  );
  await choose('Темп', 'Быстрый');
  expect(currentDocument().cameraMotion.intensity).toBe('high');
  fireEvent.click(screen.getByRole('button', {name: 'Нарисовать траекторию камеры'}));
  expect(drawCameraPath).toHaveBeenCalledTimes(1);
});

test('blocks all object changes when locked until explicitly unlocked, while read-only mode cannot unlock', () => {
  const document = initialDocument();
  document.objects[0].locked = true;
  const view = render(<InspectorHarness initial={document} />);
  expect(screen.getByRole('textbox', {name: 'Название объекта'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Дублировать'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Удалить объект'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', {name: 'Заблокирован'}));
  expect(screen.getByRole('textbox', {name: 'Название объекта'})).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox', {name: 'Название объекта'}), {target: {value: 'Разблокирован'}});
  expect(currentDocument().objects[0].title).toBe('Разблокирован');
  view.unmount();

  render(<InspectorHarness initial={document} disabled />);
  expect(screen.getByRole('checkbox', {name: 'Заблокирован'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', {name: 'Заблокирован'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Название объекта'}), {target: {value: 'Не сохранять'}});
  expect(currentDocument().objects[0]).toEqual(document.objects[0]);
});

test('numeric position edits translate every path point and clamp them to the frame like canvas dragging', () => {
  const document = initialDocument();
  document.objects[0] = {...document.objects[0], x: 20.4, y: 15.4, width: 14.4, height: 55.4, rotation: 12.6,
    motion: {type: 'path', start: 0, end: 4, facing: 'На дверь',
      points: [{x: 27, y: 42.5}, {x: 65, y: 70}, {x: 95, y: 95}]}};
  render(<InspectorHarness initial={document} />);
  fireEvent.click(screen.getByText('Точные значения', {selector: 'summary'}));
  expect(screen.getByRole('spinbutton', {name: 'X, %'})).toHaveValue('20');
  expect(screen.getByRole('spinbutton', {name: 'Y, %'})).toHaveValue('15');
  expect(screen.getByRole('spinbutton', {name: 'Ширина, %'})).toHaveValue('14');
  expect(screen.getByRole('spinbutton', {name: 'Высота, %'})).toHaveValue('55');
  expect(screen.getByRole('spinbutton', {name: 'Поворот, °'})).toHaveValue('13');
  fireEvent.change(screen.getByRole('spinbutton', {name: 'X, %'}), {target: {value: '30'}});
  fireEvent.change(screen.getByRole('spinbutton', {name: 'Y, %'}), {target: {value: '25'}});
  const updated = currentDocument().objects[0];
  expect(updated).toEqual(expect.objectContaining({x: 30, y: 25}));
  expect(updated.motion).toMatchObject({type: 'path', start: 0, end: 4, facing: 'На дверь'});
  expect(updated.motion.points[0].x).toBeCloseTo(36.6);
  expect(updated.motion.points[0].y).toBeCloseTo(52.1);
  expect(updated.motion.points[1].x).toBeCloseTo(74.6);
  expect(updated.motion.points[1].y).toBeCloseTo(79.6);
  expect(updated.motion.points[2]).toEqual({x: 100, y: 100});
  expect(document.objects[0].motion.points).toEqual([{x: 27, y: 42.5}, {x: 65, y: 70}, {x: 95, y: 95}]);
});

test('keeps visibility with object content and removes marker coordinate fields', () => {
  const document = initialDocument();
  document.markers = [{id: 'marker-1', x: 23.4, y: 67.8, text: 'Свет'}];
  render(<InspectorHarness initial={document} />);
  const hidden = screen.getByRole('checkbox', {name: 'Скрыть объект'});
  expect(hidden.closest('details')?.querySelector('summary')).toHaveTextContent('Содержание');
  fireEvent.click(screen.getByRole('button', {name: 'Кадр'}));
  fireEvent.click(screen.getByText('Заметки к кадру', {selector: 'summary'}));
  expect(screen.getByRole('textbox', {name: 'Пометка 1'})).toBeVisible();
  expect(screen.queryByRole('spinbutton', {name: 'Пометка 1 · X, %'})).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton', {name: 'Пометка 1 · Y, %'})).not.toBeInTheDocument();
});

test('an external marker request switches to frame mode and opens notes', () => {
  const document = initialDocument();
  document.markers = [{id: 'marker-1', x: 50, y: 50, text: 'Свет'}];
  const props = {selectedObjectId: 'object-1', intent: createInitialKeyframes('shot')[0].cameraIntent,
    entities: [entity], duration: 4, disabled: false, onChange: jest.fn(), onIntentChange: jest.fn(),
    onDurationChange: jest.fn(), onDrawPath: jest.fn(), onDrawCameraPath: jest.fn(), onAddComment: jest.fn()};
  const {rerender} = render(<BlockingInspector {...props} document={document} notesOpenRequest={0} />);
  expect(screen.getByRole('button', {name: 'Объект'})).toHaveAttribute('aria-pressed', 'true');
  rerender(<BlockingInspector {...props} document={document} notesOpenRequest={1} />);
  expect(screen.getByRole('button', {name: 'Кадр'})).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('textbox', {name: 'Пометка 1'}).closest('details')).toHaveAttribute('open');
});

test('shows library thumbnails in the select and hides a failed preview without broken-image text', async () => {
  render(<InspectorHarness />);
  fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Связь с библиотекой'}));
  const option = (await screen.findAllByText(entity.title)).find((element) => element.closest('.ant-select-item-option'));
  const image = option?.closest('.ant-select-item-option')?.querySelector('img');
  expect(image).toHaveAttribute('src', entity.imageUrl);
  if (!image) throw new Error('Library thumbnail was not rendered');
  fireEvent.error(image);
  expect(image).toHaveAttribute('hidden');
});

test.each([
  {available: [{...entity, versionId: 'new-version'}], warning: 'Версия или ресурс библиотеки изменились.'},
  {available: [{...entity, assetId: 'new-asset'}], warning: 'Версия или ресурс библиотеки изменились.'},
  {available: [], warning: 'Элемент библиотеки недоступен.'},
])('warns about changed or missing library links without silently rebinding ($warning)', ({available, warning}) => {
  const document = initialDocument();
  const savedEntity = {id: entity.id, type: entity.type, title: entity.title, versionId: entity.versionId, assetId: entity.assetId};
  document.objects[0].entity = savedEntity;
  render(<InspectorHarness initial={document} entities={available} />);
  const inspector = screen.getByRole('complementary', {name: 'Параметры постановки'});
  expect(within(inspector).getByRole('status')).toHaveTextContent(warning);
  expect(screen.getByRole('combobox', {name: 'Связь с библиотекой'})).toHaveAccessibleDescription(new RegExp(warning));
  fireEvent.change(screen.getByRole('textbox', {name: 'Название объекта'}), {target: {value: 'Имя в кадре'}});
  expect(currentDocument().objects[0].entity).toEqual(savedEntity);
});

test('deleting a camera target removes its dangling motion reference', () => {
  const document = initialDocument();
  document.cameraMotion.targetId = 'object-1';
  render(<InspectorHarness initial={document} />);
  fireEvent.click(screen.getByRole('button', {name: 'Удалить объект'}));
  expect(currentDocument().objects).toEqual([]);
  expect(currentDocument().cameraMotion.targetId).toBeUndefined();
  expect(screen.getByRole('button', {name: 'Кадр'})).toHaveAttribute('aria-pressed', 'true');
});

test('adding a marker opens frame notes without stealing focus or overriding mode on later text edits', () => {
  const document = initialDocument();
  const props = {selectedObjectId: 'object-1', intent: createInitialKeyframes('shot')[0].cameraIntent,
    entities: [entity], duration: 4, disabled: false, onChange: jest.fn(), onIntentChange: jest.fn(),
    onDurationChange: jest.fn(), onDrawPath: jest.fn(), onDrawCameraPath: jest.fn(), onAddComment: jest.fn()};
  const {rerender} = render(<BlockingInspector {...props} document={document} />);
  expect(screen.getByRole('button', {name: 'Объект'})).toHaveAttribute('aria-pressed', 'true');
  const withMarker = {...document, markers: [{id: 'marker-1', x: 50, y: 50, text: ''}]};
  rerender(<BlockingInspector {...props} document={withMarker} />);
  expect(screen.getByRole('button', {name: 'Кадр'})).toHaveAttribute('aria-pressed', 'true');
  const marker = screen.getByRole('textbox', {name: 'Пометка 1'});
  expect(marker).toBeVisible();
  expect(marker.closest('details')).toHaveAttribute('open');
  act(() => marker.focus());
  const editedMarker = {...withMarker, markers: [{...withMarker.markers[0], text: 'Свет из окна'}]};
  rerender(<BlockingInspector {...props} document={editedMarker} />);
  expect(marker).toHaveFocus();
  expect(marker).toHaveValue('Свет из окна');
  fireEvent.click(screen.getByRole('button', {name: 'Объект'}));
  rerender(<BlockingInspector {...props} document={{...editedMarker, markers: [{...editedMarker.markers[0], text: 'Уточнённый свет'}]}} />);
  expect(screen.getByRole('button', {name: 'Объект'})).toHaveAttribute('aria-pressed', 'true');
});

test('palette adds and drags actual searchable library entries with their entity identity', async () => {
  const onAdd = jest.fn();
  render(<BlockingPalette document={createCanvas()} entities={[entity]} selectedObjectId={null} disabled={false}
    onAdd={onAdd} onSelect={jest.fn()} onChange={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', {name: 'Библиотека'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Найти элемент'}), {target: {value: 'Анна'}});
  const asset = screen.getByRole('button', {name: /Анна из библиотеки Персонаж/});
  fireEvent.click(asset);
  expect(onAdd).toHaveBeenCalledWith('person', entity);
  const dataTransfer = {effectAllowed: '', setData: jest.fn()};
  fireEvent.dragStart(asset, {dataTransfer});
  expect(dataTransfer.setData).toHaveBeenCalledWith(BLOCKING_OBJECT_MIME, JSON.stringify({kind: 'person', entityId: entity.id}));
  expect(asset.querySelector('img')).toHaveAttribute('src', '/media/anna.jpg');
  fireEvent.change(screen.getByRole('textbox', {name: 'Найти элемент'}), {target: {value: 'Нет такого'}});
  expect(screen.queryByRole('button', {name: /Анна из библиотеки/})).not.toBeInTheDocument();
});

test('palette respects edit permission and object locks while allowing layer selection', () => {
  const document = initialDocument();
  document.objects[0].locked = true;
  const onChange = jest.fn();
  const onSelect = jest.fn();
  const onAdd = jest.fn();
  render(<BlockingPalette document={document} entities={[entity]} selectedObjectId={null} disabled
    onChange={onChange} onSelect={onSelect} onAdd={onAdd} />);
  expect(screen.getByRole('button', {name: 'Человек'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Человек'})).toHaveAttribute('draggable', 'false');
  const layers = screen.getByRole('region', {name: 'Слои'});
  expect(within(layers).getByRole('button', {name: 'Скрыть: Человек 1'})).toBeDisabled();
  expect(within(layers).getByRole('button', {name: 'Разблокировать: Человек 1'})).toBeDisabled();
  fireEvent.click(within(layers).getByRole('button', {name: 'Человек 1'}));
  expect(onSelect).toHaveBeenCalledWith('object-1');
  fireEvent.click(screen.getByRole('button', {name: 'Человек'}));
  expect(onAdd).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test('palette visibility and lock controls persist independent layer states', async () => {
  function PaletteHarness() {
    const [document, setDocument] = useState(initialDocument());
    return <><BlockingPalette document={document} entities={[]} selectedObjectId="object-1" disabled={false}
      onAdd={jest.fn()} onSelect={jest.fn()} onChange={setDocument} />
      <output data-testid="document">{JSON.stringify(document)}</output></>;
  }
  render(<PaletteHarness />);
  fireEvent.click(screen.getByRole('button', {name: 'Скрыть: Человек 1'}));
  expect(currentDocument().objects[0].hidden).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: 'Заблокировать: Человек 1'}));
  expect(currentDocument().objects[0].locked).toBe(true);
  await waitFor(() => expect(screen.getByRole('button', {name: 'Показать: Человек 1'})).toBeDisabled());
});
