import {analyzeCharacterRelationships} from './characterAnalytics';
import type {CompactCharacter, Scene} from './types';

const character = (id: string, name: string): CompactCharacter => ({
  id,
  name,
  role: '',
  roleLabel: '',
  shortDescription: '',
  personality: {},
  backstory: '',
  speechStyle: '',
  imageUrl: '',
  sceneCount: 0,
  sceneIds: [],
});

const baseScene: Scene = {
  id: 1,
  title: 'Разговор',
  description: '',
  scriptText: '',
  scriptBlocks: [],
  status: 'draft',
  order: 1,
  act: 1,
  durationSeconds: 0,
  mood: '',
  sceneType: 'setup',
  notes: '',
  characters: [],
  version: 1,
  updatedAt: '2026-08-17T00:00:00Z',
};

test('counts speaker changes but does not create a relationship from co-presence alone', () => {
  const characters = [character('a', 'А'), character('b', 'Б'), character('c', 'В')];
  const analysis = analyzeCharacterRelationships(characters, [{
    ...baseScene,
    scriptBlocks: [
      {id: 'a-name', type: 'character', text: 'А', characterId: 'a'},
      {id: 'a-line-1', type: 'dialogue', text: 'Первая реплика', characterId: 'a'},
      {id: 'a-line-2', type: 'dialogue', text: 'Продолжение', characterId: 'a'},
      {id: 'a-empty-line', type: 'dialogue', text: '   ', characterId: 'a'},
      {id: 'b-name', type: 'character', text: 'Б', characterId: 'b'},
      {id: 'b-line', type: 'dialogue', text: 'Ответ', characterId: 'b'},
      {id: 'c-name', type: 'character', text: 'В', characterId: 'c'},
    ],
  }]);

  expect(analysis.dialogueCount).toBe(3);
  expect(analysis.wordCount).toBe(4);
  expect(analysis.relationships).toEqual([expect.objectContaining({
    sourceId: 'a',
    targetId: 'b',
    exchangeCount: 1,
    commonSceneIds: [1],
  })]);
  expect(analysis.characters.find((metric) => metric.character.id === 'c')).toEqual(expect.objectContaining({
    dialogueCount: 0,
    relationshipCount: 0,
  }));
});

test('reports dialogue without a linked or recognizable speaker separately', () => {
  const analysis = analyzeCharacterRelationships([character('a', 'Анна')], [{
    ...baseScene,
    scriptBlocks: [{id: 'line', type: 'dialogue', text: 'Кто здесь?'}],
  }]);

  expect(analysis.dialogueCount).toBe(0);
  expect(analysis.unlinkedDialogueCount).toBe(1);
  expect(analysis.relationships).toHaveLength(0);
});

test('does not infer an exchange across an unlinked speaker', () => {
  const analysis = analyzeCharacterRelationships([
    character('a', 'Анна'),
    character('b', 'Борис'),
  ], [{
    ...baseScene,
    scriptBlocks: [
      {id: 'a-name', type: 'character', text: 'АННА', characterId: 'a'},
      {id: 'a-line', type: 'dialogue', text: 'Начало', characterId: 'a'},
      {id: 'unknown-name', type: 'character', text: 'НЕИЗВЕСТНЫЙ'},
      {id: 'unknown-line', type: 'dialogue', text: 'Неизвестная реплика'},
      {id: 'b-name', type: 'character', text: 'БОРИС', characterId: 'b'},
      {id: 'b-line', type: 'dialogue', text: 'Ответ', characterId: 'b'},
    ],
  }]);

  expect(analysis.unlinkedDialogueCount).toBe(1);
  expect(analysis.relationships).toHaveLength(0);
});

test('resets the speaker after structural blocks and rejects an invalid explicit id', () => {
  const analysis = analyzeCharacterRelationships([character('a', 'Анна')], [{
    ...baseScene,
    scriptBlocks: [
      {id: 'a-name-1', type: 'character', text: 'АННА', characterId: 'a'},
      {id: 'a-line-1', type: 'dialogue', text: 'Первая реплика', characterId: 'a'},
      {id: 'action', type: 'action', text: 'Анна уходит.'},
      {id: 'orphan-line', type: 'dialogue', text: 'Кто это сказал?'},
      {id: 'a-name-2', type: 'character', text: 'АННА', characterId: 'a'},
      {id: 'a-line-2', type: 'dialogue', text: 'Вторая реплика', characterId: 'a'},
      {id: 'invalid-line', type: 'dialogue', text: 'Неизвестный автор', characterId: 'missing'},
    ],
  }]);

  expect(analysis.dialogueCount).toBe(2);
  expect(analysis.unlinkedDialogueCount).toBe(2);
  expect(analysis.relationships).toHaveLength(0);
});

test('does not guess a legacy cue when character names are duplicated', () => {
  const analysis = analyzeCharacterRelationships([
    character('anna-1', 'Анна'),
    character('anna-2', 'Анна'),
  ], [{
    ...baseScene,
    scriptBlocks: [
      {id: 'name', type: 'character', text: 'АННА'},
      {id: 'line', type: 'dialogue', text: 'Чья это реплика?'},
    ],
  }]);

  expect(analysis.dialogueCount).toBe(0);
  expect(analysis.unlinkedDialogueCount).toBe(1);
  expect(analysis.characters).toHaveLength(0);
});

test('includes persisted scene participants in common-scene facts without inventing an edge', () => {
  const anna = character('a', 'Анна');
  const boris = character('b', 'Борис');
  const toSceneCharacter = (item: CompactCharacter) => ({
    id: item.id,
    imageUrl: item.imageUrl,
    name: item.name,
    role: item.role,
    roleLabel: item.roleLabel,
  });
  const analysis = analyzeCharacterRelationships([anna, boris], [{
    ...baseScene,
    scriptBlocks: [
      {id: 'a-name', type: 'character', text: 'АННА', characterId: 'a'},
      {id: 'a-line', type: 'dialogue', text: 'Привет', characterId: 'a'},
      {id: 'b-name', type: 'character', text: 'БОРИС', characterId: 'b'},
      {id: 'b-line', type: 'dialogue', text: 'Привет', characterId: 'b'},
    ],
  }, {
    ...baseScene,
    id: 2,
    order: 2,
    title: 'Без диалога',
    characters: [toSceneCharacter(anna), toSceneCharacter(boris)],
  }]);

  expect(analysis.relationships[0]).toEqual(expect.objectContaining({
    commonSceneIds: [1, 2],
    dialogueSceneIds: [1],
    exchangeCount: 1,
  }));
  expect(analysis.characters.every((metric) => metric.sceneIds.length === 2)).toBe(true);
});

test('counts Unicode words while ignoring punctuation-only tokens', () => {
  const analysis = analyzeCharacterRelationships([character('a', 'Анна')], [{
    ...baseScene,
    scriptBlocks: [
      {id: 'name', type: 'character', text: 'АННА', characterId: 'a'},
      {id: 'line', type: 'dialogue', text: 'مرحبا κόσμος 你好 ... —', characterId: 'a'},
    ],
  }]);

  expect(analysis.wordCount).toBe(3);
});
