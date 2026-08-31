import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createHash} from 'crypto';
import React, {useState} from 'react';
import {TextEncoder} from 'util';

import type {StoryboardScene} from '../model';
import {createShot} from '../useStoryboardWorkspace';
import type {NewShotInput} from '../useStoryboardWorkspace';
import ManualShotMarkup from './ManualShotMarkup';

const initialScene: StoryboardScene = {
  entities: [], id: '1', locationIds: [], order: 1, shots: [], status: 'empty',
  text: 'А😀Б\n\nВГ', title: 'Сцена 1', version: 3,
};
const hashBuffer = async (_algorithm: string, data: Uint8Array) => (
  Uint8Array.from(createHash('sha256').update(data).digest()).buffer
);
const digest = jest.fn(hashBuffer);
const originalEncoder = globalThis.TextEncoder;
const originalCrypto = globalThis.crypto;

beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', {configurable: true, value: TextEncoder, writable: true});
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {...originalCrypto, subtle: {digest}}, writable: true});
});

afterAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', {configurable: true, value: originalEncoder, writable: true});
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: originalCrypto, writable: true});
});

beforeEach(() => {
  digest.mockReset().mockImplementation(hashBuffer);
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
});

function Harness({onAdd, onComplete}: {onAdd: (input: NewShotInput) => void; onComplete: () => void}) {
  const [scene, setScene] = useState(initialScene);
  return <ManualShotMarkup scene={scene} onComplete={onComplete} onAdd={(input) => {
    onAdd(input);
    setScene((current) => ({...current, shots: [...current.shots, createShot(current, input, current.shots.length + 1)]}));
  }} />;
}

function selectCharacters(start: number, end: number) {
  const text = screen.getByRole('document', {name: 'Сценарий для разметки кадров'});
  if (!text.firstChild) throw new Error('Expected screenplay text.');
  const range = document.createRange();
  range.setStart(text.firstChild, start);
  range.setEnd(text.firstChild, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.mouseUp(text);
}

test('adds exact selected text, accepts overlapping shots, and enables completion only after full coverage', async () => {
  const onAdd = jest.fn();
  const onComplete = jest.fn();
  render(<Harness onAdd={onAdd} onComplete={onComplete} />);
  expect(screen.getByRole('button', {name: 'Перейти к списку кадров'})).toBeDisabled();

  selectCharacters(1, 3);
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  const description = screen.getByRole('textbox', {name: 'Описание'});
  expect(description).toHaveValue('😀');
  fireEvent.change(screen.getByRole('textbox', {name: 'Название'}), {target: {value: 'Реакция'}});
  window.getSelection()?.removeAllRanges();
  fireEvent.change(description, {target: {value: 'Герой улыбается.'}});
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));

  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  expect(onAdd.mock.calls[0][0]).toMatchObject({
    title: 'Реакция', description: 'Герой улыбается.',
    source: {
      origin: 'manual', ranges: [{start: 1, end: 2}], segmentIds: [],
      document: {sceneId: 1, sceneVersion: 3, segments: [{text: initialScene.text}], truncated: false},
    },
  });
  expect(onAdd.mock.calls[0][0].source.document.contentHash).toBe(createHash('sha256').update(initialScene.text).digest('hex'));
  expect(screen.getByText('Покрыто 20% сценария · Кадров: 1')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Перейти к списку кадров'})).toBeDisabled();

  fireEvent.click(screen.getByRole('button', {name: 'Выделить весь текст'}));
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(screen.getByText('Покрыто 100% сценария · Кадров: 2')).toBeInTheDocument());
  expect(onAdd.mock.calls[1][0].source.ranges).toEqual([{start: 0, end: 7}]);
  expect(screen.getByRole('document')).toHaveTextContent('А😀Б ВГ');
  expect(screen.getByRole('button', {name: 'Выделить весь текст'})).toBeEnabled();
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Перейти к списку кадров'}));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('retains long source selections fully while leaving the short description empty', async () => {
  const onAdd = jest.fn();
  const scene = {...initialScene, text: 'Длинный сценарий. '.repeat(300)};
  render(<ManualShotMarkup scene={scene} onAdd={onAdd} onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', {name: 'Выделить весь текст'}));
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue('');
  expect(screen.getByText(/Фрагмент сохранится полностью/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
  expect(onAdd.mock.calls[0][0].source.document.segments[0].text).toBe(scene.text);
  expect(onAdd.mock.calls[0][0].source.ranges[0].end).toBe(Array.from(scene.text).length);
});

test('rejects an asynchronous add when the same scene text changes, preserving the new scene', async () => {
  let finishDigest: (value: ArrayBuffer) => void = () => undefined;
  digest.mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => { finishDigest = resolve; }));
  const onAdd = jest.fn();
  const {rerender} = render(<ManualShotMarkup scene={initialScene} onAdd={onAdd} onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', {name: 'Выделить весь текст'}));
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(digest).toHaveBeenCalled());
  rerender(<ManualShotMarkup scene={{...initialScene, text: 'Новый текст.'}} onAdd={onAdd} onComplete={jest.fn()} />);
  await act(async () => { finishDigest(new Uint8Array(32).buffer); });
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('document')).toHaveTextContent('Новый текст.');
  expect(screen.getByRole('button', {name: 'Создать кадр из выделения'})).toBeDisabled();
});

test('rejects an empty title and keeps the selection after a hashing failure for retry', async () => {
  digest.mockRejectedValueOnce(new Error('unavailable'));
  const onAdd = jest.fn();
  render(<ManualShotMarkup scene={initialScene} onAdd={onAdd} onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', {name: 'Выделить весь текст'}));
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  const title = screen.getByRole('textbox', {name: 'Название'});
  fireEvent.change(title, {target: {value: '  '}});
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'));
  expect(digest).not.toHaveBeenCalled();

  fireEvent.change(title, {target: {value: 'Общий план'}});
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  expect(await screen.findByText(/Не удалось закрепить фрагмент/)).toBeInTheDocument();
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue(initialScene.text);
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
});
