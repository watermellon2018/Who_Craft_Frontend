import {
  estimateSceneDurationSeconds,
  formatEstimatedDuration,
  getSceneHeading,
  getSceneLocation,
  isSceneEmpty,
  moveScene,
  toScenePlacements,
} from './sceneStructure';
import type {Scene} from './types';

const makeScene = (overrides: Partial<Scene> = {}): Scene => ({
  id: 1,
  title: 'Кафе',
  description: '',
  scriptText: '',
  scriptBlocks: [
    {id: 'heading', type: 'scene_heading', text: 'ИНТ. КАФЕ — НОЧЬ'},
    {id: 'action', type: 'action', text: 'Анна входит.'},
  ],
  status: 'draft',
  order: 1,
  act: 1,
  durationSeconds: 0,
  mood: 'calm',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '',
  ...overrides,
});

describe('scene structure helpers', () => {
  it('moves scenes between acts and rebuilds one continuous order', () => {
    const scenes = [
      makeScene(),
      makeScene({id: 2, order: 2, title: 'Коридор'}),
      makeScene({id: 3, order: 3, act: 2, title: 'Улица'}),
    ];

    expect(toScenePlacements(moveScene(scenes, 2, 2, 1))).toEqual([
      {id: 1, order: 1, act: 1},
      {id: 3, order: 2, act: 2},
      {id: 2, order: 3, act: 2},
    ]);
    expect(toScenePlacements(moveScene(scenes, 2, 1, 0))).toEqual([
      {id: 2, order: 1, act: 1},
      {id: 1, order: 2, act: 1},
      {id: 3, order: 3, act: 2},
    ]);
  });

  it('extracts a compact heading and location', () => {
    const scene = makeScene();
    expect(getSceneHeading(scene)).toBe('ИНТ. КАФЕ — НОЧЬ');
    expect(getSceneLocation(scene)).toBe('КАФЕ');
    expect(getSceneLocation(makeScene({
      scriptBlocks: [{id: 'heading', type: 'scene_heading', text: 'ИНТ. ЛОКАЦИЯ — ДЕНЬ'}],
    }))).toBe('Место не указано');
  });

  it('marks heading-only scenes as empty and estimates duration from screenplay text', () => {
    const empty = makeScene({
      scriptBlocks: [{id: 'heading', type: 'scene_heading', text: 'ИНТ. КАФЕ — НОЧЬ'}],
    });
    const minute = makeScene({
      scriptBlocks: [{id: 'action', type: 'action', text: Array(140).fill('слово').join(' ')}],
    });

    expect(isSceneEmpty(empty)).toBe(true);
    expect(formatEstimatedDuration(empty)).toBe('≈ 0 мин');
    expect(isSceneEmpty(minute)).toBe(false);
    expect(estimateSceneDurationSeconds(minute)).toBe(60);
    expect(formatEstimatedDuration(minute)).toBe('≈ 1 мин');
  });
});
