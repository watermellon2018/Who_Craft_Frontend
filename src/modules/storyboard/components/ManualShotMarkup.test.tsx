import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createHash} from 'crypto';
import React, {useState} from 'react';
import {TextEncoder} from 'util';

import type {StoryboardScene} from '../model';
import type {StoryboardShotMetadataField} from '../storyboardService';
import {createShot} from '../useStoryboardWorkspace';
import type {NewShotInput} from '../useStoryboardWorkspace';
import ManualShotMarkup from './ManualShotMarkup';
import type {ScriptBlock} from '../../../page/script/types';

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

function Harness({onAdd, onComplete, startingScene = initialScene}: {
  onAdd: (input: NewShotInput) => void;
  onComplete: () => void;
  startingScene?: StoryboardScene;
}) {
  const [scene, setScene] = useState(startingScene);
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

test.each(['cleared', 'collapsed-outside', 'selected-outside'])(
  'disables creation when the native selection is %s',
  (selectionState) => {
    render(<>
      <p data-testid="outside">Вне сценария</p>
      <ManualShotMarkup scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()} />
    </>);
    selectCharacters(1, 3);
    const create = screen.getByRole('button', {name: 'Создать кадр из выделения'});
    expect(create).toBeEnabled();
    const outside = screen.getByTestId('outside');
    window.getSelection()?.removeAllRanges();
    if (selectionState !== 'cleared') {
      const range = document.createRange();
      range.selectNodeContents(outside);
      if (selectionState === 'collapsed-outside') range.collapse(true);
      window.getSelection()?.addRange(range);
    }
    fireEvent.click(outside);
    fireEvent(document, new Event('selectionchange'));
    expect(create).toBeDisabled();
    expect(screen.queryByText(/Выделено символов:/)).not.toBeInTheDocument();
  },
);

test('rechecks the current selection if creation is clicked before selectionchange arrives', () => {
  render(<ManualShotMarkup scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()} />);
  selectCharacters(1, 3);
  const create = screen.getByRole('button', {name: 'Создать кадр из выделения'});
  window.getSelection()?.removeAllRanges();
  fireEvent.click(create);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(create).toBeDisabled();
});

test.each([{key: 'o'}, {key: 'O', code: 'KeyO', shiftKey: true}, {key: 'щ', code: 'KeyO'}])(
  'opens the selected fragment with the O shortcut: %j',
  async (keyboardEvent) => {
    const onAdd = jest.fn();
    render(<ManualShotMarkup scene={initialScene} onAdd={onAdd} onComplete={jest.fn()} />);
    selectCharacters(1, 3);
    expect(fireEvent.keyDown(screen.getByRole('document'), keyboardEvent)).toBe(false);
    expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue('😀');
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0].source.ranges).toEqual([{start: 1, end: 2}]);
  },
);

test('requests editable AI suggestions for each field from the exact selection', async () => {
  const onSuggestMetadata = jest.fn(async (field) => (
    field === 'title' ? 'Реакция героя' : 'Герой замечает перемену.'
  ));
  render(<ManualShotMarkup scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()}
    onSuggestMetadata={onSuggestMetadata} />);
  selectCharacters(1, 3);
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));

  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать название с помощью ИИ'}));
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Название'})).toHaveValue('Реакция героя'));
  expect(onSuggestMetadata).toHaveBeenLastCalledWith('title', {start: 1, end: 2});

  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать описание с помощью ИИ'}));
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue('Герой замечает перемену.'));
  expect(onSuggestMetadata).toHaveBeenLastCalledWith('description', {start: 1, end: 2});
});

test('runs title and description suggestions concurrently and resolves them independently', async () => {
  const resolvers = {} as Record<StoryboardShotMetadataField, (value: string) => void>;
  const onSuggestMetadata = jest.fn((field: StoryboardShotMetadataField) => new Promise<string>((resolve) => {
    resolvers[field] = resolve;
  }));
  render(<ManualShotMarkup scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()}
    onSuggestMetadata={onSuggestMetadata} />);
  selectCharacters(1, 3);
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));

  const titleButton = screen.getByRole('button', {name: 'Сгенерировать название с помощью ИИ'});
  const descriptionButton = screen.getByRole('button', {name: 'Сгенерировать описание с помощью ИИ'});
  fireEvent.click(titleButton);
  expect(descriptionButton).toBeEnabled();
  fireEvent.click(descriptionButton);

  expect(onSuggestMetadata).toHaveBeenCalledTimes(2);
  expect(titleButton).toBeEnabled();
  expect(descriptionButton).toBeEnabled();
  expect(titleButton).toHaveAttribute('aria-busy', 'true');
  expect(descriptionButton).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(titleButton);
  fireEvent.click(descriptionButton);
  expect(onSuggestMetadata).toHaveBeenCalledTimes(2);
  await act(async () => { resolvers.description('Герой замечает перемену.'); });
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue('Герой замечает перемену.');
  expect(titleButton).toHaveAttribute('aria-busy', 'true');
  expect(descriptionButton).toHaveAttribute('aria-busy', 'false');
  await act(async () => { resolvers.title('Реакция героя'); });
  expect(screen.getByRole('textbox', {name: 'Название'})).toHaveValue('Реакция героя');
  expect(titleButton).toHaveAttribute('aria-busy', 'false');
});

test('keeps the editable value and shows a retryable message when AI fails', async () => {
  const onSuggestMetadata = jest.fn().mockRejectedValue(new Error('provider unavailable'));
  render(<ManualShotMarkup scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()}
    onSuggestMetadata={onSuggestMetadata} />);
  selectCharacters(1, 3);
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));

  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать описание с помощью ИИ'}));

  expect(await screen.findByText('Не удалось предложить описание. Повторите попытку.')).toBeInTheDocument();
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue('😀');
  expect(screen.getByRole('button', {name: 'Сгенерировать описание с помощью ИИ'})).toBeEnabled();
});

test('does not intercept browser shortcuts, composition, repeats, or typing outside the screenplay', () => {
  render(<>
    <input aria-label="Внешнее поле" />
    <ManualShotMarkup scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()} />
  </>);
  const screenplay = screen.getByRole('document');
  expect(fireEvent.keyDown(screenplay, {key: 'o', code: 'KeyO'})).toBe(true);
  selectCharacters(1, 3);
  for (const modifier of [{ctrlKey: true}, {metaKey: true}, {altKey: true}, {isComposing: true}, {repeat: true}]) {
    expect(fireEvent.keyDown(screenplay, {key: 'o', code: 'KeyO', ...modifier})).toBe(true);
  }
  expect(fireEvent.keyDown(screen.getByRole('textbox', {name: 'Внешнее поле'}), {key: 'o', code: 'KeyO'})).toBe(true);
  expect(screen.queryByRole('textbox', {name: 'Описание'})).not.toBeInTheDocument();

  fireEvent.keyDown(screenplay, {key: 'o', code: 'KeyO'});
  const description = screen.getByRole('textbox', {name: 'Описание'});
  fireEvent.change(description, {target: {value: 'Своё описание'}});
  expect(fireEvent.keyDown(description, {key: 'o', code: 'KeyO'})).toBe(true);
  expect(description).toHaveValue('Своё описание');
  window.getSelection()?.removeAllRanges();
  fireEvent(document, new Event('selectionchange'));
  expect(description).toHaveValue('Своё описание');
  fireEvent.click(screen.getByRole('button', {name: 'Отменить выделение'}));
  expect(screen.getByRole('button', {name: 'Создать кадр из выделения'})).toBeDisabled();
});

test('does not open shot creation with O in read-only mode', () => {
  render(<ManualShotMarkup disabled scene={initialScene} onAdd={jest.fn()} onComplete={jest.fn()} />);
  selectCharacters(1, 3);
  expect(fireEvent.keyDown(screen.getByRole('document'), {key: 'o', code: 'KeyO'})).toBe(true);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

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

test('selects across formatted paragraphs without editing the screenplay or shifting source ranges', async () => {
  const scriptBlocks: ScriptBlock[] = [
    {id: 'heading', type: 'scene_heading', text: 'ИНТ. МАГАЗИН — ДЕНЬ'},
    {id: 'action', type: 'action', text: '😀 Дверь открыта.'},
    {id: 'character', type: 'character', text: 'АНЧОУС'},
    {id: 'remark', type: 'remark', text: '(тихо)'},
    {id: 'dialogue', type: 'dialogue', text: 'Можно войти?\nСпасибо.'},
    {id: 'character-again', type: 'character', text: 'АНЧОУС'},
    {id: 'dialogue-again', type: 'dialogue', text: 'Я здесь.'},
  ];
  const text = scriptBlocks.map((block) => block.text).join('\n\n');
  const prefix = scriptBlocks.slice(0, 2).map((block) => block.text).join('\n\n') + '\n\n';
  const selected = 'АНЧОУС\n\n(тихо)\n\nМожно';
  const onAdd = jest.fn();
  render(<Harness startingScene={{...initialScene, scriptBlocks, text}} onAdd={onAdd} onComplete={jest.fn()} />);
  const screenplay = screen.getByRole('document');
  expect(screenplay).toHaveAttribute('contenteditable', 'false');
  expect(screenplay.querySelector('textarea, input')).toBeNull();
  expect(screenplay.textContent).toBe(text);
  const character = screenplay.querySelector('.storyboard-script__block--character') as HTMLElement;
  const dialogue = screenplay.querySelector('.storyboard-script__block--dialogue') as HTMLElement;
  expect(screenplay.querySelector('.storyboard-script__block--remark')).toHaveTextContent('(тихо)');
  const range = document.createRange();
  range.setStart(character.firstChild as Text, 0);
  range.setEnd(dialogue.firstChild as Text, 'Можно'.length);
  window.getSelection()?.addRange(range);
  fireEvent.mouseUp(screenplay);
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue(selected);
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
  expect(onAdd.mock.calls[0][0].source.ranges).toEqual([{
    start: Array.from(prefix).length, end: Array.from(prefix + selected).length,
  }]);
  expect(onAdd.mock.calls[0][0].source.document.segments[0].text).toBe(text);
  expect(screenplay.textContent).toBe(text);
  expect(Array.from(screenplay.querySelectorAll('mark'), (mark) => mark.textContent).join('')).toBe(selected);
  expect(screenplay.querySelectorAll('.storyboard-script__block--character')[1].querySelector('mark')).toBeNull();

  // Keyboard selection still resolves exact offsets after highlights split the text nodes.
  const markedRange = document.createRange();
  markedRange.setStart(character.querySelector('mark')?.firstChild as Text, 1);
  markedRange.setEnd(dialogue.querySelector('mark')?.firstChild as Text, 2);
  window.getSelection()?.addRange(markedRange);
  fireEvent.keyUp(screenplay, {key: 'ArrowRight', shiftKey: true});
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue('НЧОУС\n\n(тихо)\n\nМо');
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole('button', {name: 'Выделить весь текст'}));
  fireEvent.click(screen.getByRole('button', {name: 'Создать кадр из выделения'}));
  expect(screen.getByRole('textbox', {name: 'Описание'})).toHaveValue(text);
  fireEvent.click(screen.getByRole('button', {name: 'Добавить кадр'}));
  await waitFor(() => expect(screen.getByText('Покрыто 100% сценария · Кадров: 3')).toBeInTheDocument());
  expect(screen.getByRole('button', {name: 'Перейти к списку кадров'})).toBeEnabled();
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
