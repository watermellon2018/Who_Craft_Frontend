import {fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';

import type {StoryboardScene, StoryboardShot, StoryboardShotSource, StoryboardSourceDocument} from '../model';
import {createShot} from '../useStoryboardWorkspace';
import ShotSourceDetails from './ShotSourceDetails';
import type {ScriptBlock} from '../../../page/script/types';

const scene: StoryboardScene = {
  entities: [], id: '1', locationIds: [], order: 1, shots: [], status: 'draft',
  text: 'Новая редакция сцены.', title: 'Встреча', version: 3,
};
const source: StoryboardSourceDocument = {
  contentHash: 'snapshot', sceneId: 1, sceneVersion: 3, truncated: false,
  segments: [
    {id: 'a', text: 'Анчоус открывает дверь.\n\n'},
    {id: 'b', text: 'Продавец замечает его. '},
    {id: 'c', text: 'Анчоус открывает дверь.\n🎬 Конец.'},
  ],
};
const link: StoryboardShotSource = {document: source, segmentIds: ['a', 'c']};
const shot: StoryboardShot = createShot(scene, {
  description: 'AI description, not an original quote.', title: 'Начало встречи',
  source: link,
}, 1);

test('offers one action without a duplicate screenplay excerpt', () => {
  const {container} = render(<ShotSourceDetails scene={scene} shot={shot} />);
  expect(container.querySelector('details')).toBeNull();
  expect(screen.queryByText('Фрагмент сценария')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Показать в сценарии'})).toBeInTheDocument();
});

test('highlights manually selected Unicode code points without expanding to an entire segment', async () => {
  const text = 'Он видит 🎬 и уходит.';
  render(<ShotSourceDetails scene={scene} shot={{...shot, source: {
    origin: 'manual', segmentIds: [], ranges: [{start: 9, end: 10}],
    document: {...source, segments: [{id: 'whole-scene', text}]},
  }}} />);
  fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));
  const dialog = await screen.findByRole('dialog');
  expect(dialog.querySelector('mark')?.textContent).toBe('🎬');
  expect(dialog.querySelector('.storyboard-source-viewer__text')?.textContent).toBe(text);
});

test('shows the whole snapshot and highlights multiple passages by ID, not by matching repeated text', async () => {
  render(<ShotSourceDetails scene={scene} shot={{
    ...shot, source: {document: source, segmentIds: ['c']},
  }} />);
  fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));
  const dialog = await screen.findByRole('dialog');
  const text = dialog.querySelector('.storyboard-source-viewer__text') as HTMLElement;
  expect(text.textContent).toBe(source.segments.map(({text}) => text).join(''));
  const highlights = text.querySelectorAll('mark');
  expect(highlights).toHaveLength(1);
  expect(highlights[0].textContent).toBe(source.segments[2].text);
  expect(dialog).not.toHaveTextContent(scene.text);
});

test('preserves all shared passages for another shot and warns when the screenplay changed or was truncated', async () => {
  render(<ShotSourceDetails scene={{...scene, version: 4}} shot={{
    ...shot, id: 'other-shot', source: {...link, document: {...source, truncated: true}},
  }} />);
  fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));
  const dialog = await screen.findByRole('dialog');
  expect(dialog.querySelectorAll('mark')).toHaveLength(2);
  expect(within(dialog).getByText(/Сценарий изменён после генерации/)).toBeInTheDocument();
  expect(within(dialog).getByText(/ИИ получил только начало/)).toBeInTheDocument();
});

test.each([undefined, {...link, document: {...source, sceneId: 2}}])(
  'shows the full current scene without fabricated highlights when no matching source was saved',
  async (link) => {
    render(<ShotSourceDetails scene={scene} shot={{...shot, source: link}} />);
    fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Связь со сценарием не сохранена/)).toBeInTheDocument();
    expect(dialog.querySelectorAll('mark')).toHaveLength(0);
    expect(dialog.querySelector('.storyboard-source-viewer__text')?.textContent).toBe(scene.text);
  },
);

test('formats screenplay paragraphs without changing Unicode text or highlights spanning several blocks', async () => {
  const blocks: ScriptBlock[] = [
    {id: 'heading', type: 'scene_heading', text: 'ИНТ. МАГАЗИН — ДЕНЬ'},
    {id: 'action', type: 'action', text: '🎬 Анчоус открывает дверь.'},
    {id: 'name', type: 'character', text: 'АНЧОУС'},
    {id: 'remark', type: 'remark', text: '(тихо)'},
    {id: 'line', type: 'dialogue', text: 'Здравствуйте.\nМожно войти?'},
    {id: 'pause', type: 'action', text: 'Продавец кивает.'},
    {id: 'name-again', type: 'character', text: 'АНЧОУС'},
    {id: 'line-again', type: 'dialogue', text: 'Спасибо.'},
  ];
  const prefix = blocks.slice(0, 2).map(({text}) => text).join('\n\n') + '\n\n';
  const selected = blocks.slice(2, 5).map(({text}) => text).join('\n\n');
  const suffix = '\n\n' + blocks.slice(5).map(({text}) => text).join('\n\n');
  const text = prefix + selected + suffix;
  render(<ShotSourceDetails scene={{...scene, scriptBlocks: blocks, text}} shot={{...shot, source: {
    document: {...source, segments: [
      {id: 'prefix', text: prefix}, {id: 'selected', text: selected}, {id: 'suffix', text: suffix},
    ]}, segmentIds: ['selected'],
  }}} />);
  fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));
  const dialog = await screen.findByRole('dialog');
  const screenplay = dialog.querySelector('.storyboard-source-viewer__text') as HTMLElement;
  expect(screenplay.textContent).toBe(text);
  const names = screenplay.querySelectorAll('.storyboard-script__block--character');
  expect(names).toHaveLength(2);
  expect(names[0].querySelector('mark')?.textContent).toBe('АНЧОУС');
  expect(names[1].querySelector('mark')).toBeNull();
  expect(screenplay.querySelector('.storyboard-script__block--dialogue')?.textContent).toBe('Здравствуйте.\nМожно войти?');
  expect(screenplay.querySelector('.storyboard-script__block--remark')?.textContent).toBe('(тихо)');
  expect(Array.from(screenplay.querySelectorAll('mark'), (mark) => mark.textContent).join('')).toBe(selected);
});

test('does not use edited screenplay paragraphs to reformat a different historical source', async () => {
  const blocks: ScriptBlock[] = [
    {id: 'name', type: 'character', text: 'АНЧОУС'},
    {id: 'line', type: 'dialogue', text: 'Новая реплика.'},
  ];
  const text = 'АНЧОУС\n\nСтарая реплика.';
  render(<ShotSourceDetails scene={{...scene, version: 4, scriptBlocks: blocks}} shot={{...shot, source: {
    document: {...source, segments: [{id: 'old', text}]}, segmentIds: ['old'],
  }}} />);
  fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));
  const dialog = await screen.findByRole('dialog');
  expect(dialog.querySelector('.storyboard-source-viewer__text')?.textContent).toBe(text);
  expect(dialog.querySelector('mark')?.textContent).toBe(text);
  expect(dialog.querySelector('.storyboard-script__block')).toBeNull();
});
