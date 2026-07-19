import {sceneToPlainText, toSceneMutation, toScenePatch} from './api';
import type {Scene} from './types';

const scene: Scene = {
  id: 17,
  title: 'Кафе / Опасный разговор',
  description: 'Разговор заходит слишком далеко.',
  scriptText: '',
  scriptBlocks: [
    {id: 'heading', type: 'scene_heading', text: 'ИНТ. КАФЕ — НОЧЬ'},
    {id: 'dialogue', type: 'dialogue', text: 'Ты всё знала.', characterId: 'anna'},
  ],
  status: 'draft',
  order: 3,
  act: 2,
  durationSeconds: 420,
  mood: 'tense',
  sceneType: 'turn',
  notes: 'Оставить паузу перед репликой.',
  characters: [
    {id: 'anna', name: 'Анна', role: 'main', roleLabel: 'Главная роль', imageUrl: ''},
  ],
  version: 6,
  updatedAt: '2026-07-19T12:00:00Z',
};

describe('script API mapping', () => {
  it('maps the shared scene model to the backend snake_case contract', () => {
    expect(toSceneMutation(scene)).toEqual(expect.objectContaining({
      act: 2,
      character_ids: ['anna'],
      duration_seconds: 420,
      scene_type: 'turn',
      script_blocks: scene.scriptBlocks,
      script_text: 'ИНТ. КАФЕ — НОЧЬ\n\nТы всё знала.',
    }));
  });

  it('always includes the current optimistic-lock version in patches', () => {
    expect(toScenePatch(scene).version).toBe(6);
  });

  it('exports a readable plain-text screenplay', () => {
    expect(sceneToPlainText(scene)).toContain('3. Кафе / Опасный разговор');
    expect(sceneToPlainText(scene)).toContain('DIALOGUE: Ты всё знала.');
  });
});
