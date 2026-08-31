import {fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';

import type {StoryboardScene, StoryboardShot, StoryboardShotSource, StoryboardSourceDocument} from '../model';
import {createShot} from '../useStoryboardWorkspace';
import ShotSourceDetails from './ShotSourceDetails';

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
