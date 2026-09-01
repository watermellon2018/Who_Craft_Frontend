import type {CompactCharacter, Scene} from './types';

export interface CharacterMetric {
  character: CompactCharacter;
  dialogueCount: number;
  exchangeCount: number;
  relationshipCount: number;
  sceneIds: number[];
  wordCount: number;
}

export interface RelationshipActMetric {
  act: number;
  exchangeCount: number;
}

export interface CharacterRelationshipMetric {
  actBreakdown: RelationshipActMetric[];
  commonSceneIds: number[];
  dialogueSceneIds: number[];
  exchangeCount: number;
  id: string;
  sourceId: string;
  targetId: string;
}

export interface CharacterAnalysis {
  characters: CharacterMetric[];
  dialogueCount: number;
  relationships: CharacterRelationshipMetric[];
  unlinkedDialogueCount: number;
  wordCount: number;
}

interface MutableCharacterMetric {
  character: CompactCharacter;
  dialogueCount: number;
  exchangeCount: number;
  relationshipCount: number;
  sceneIds: Set<number>;
  wordCount: number;
}

interface MutableRelationshipMetric {
  actBreakdown: Map<number, number>;
  dialogueSceneIds: Set<number>;
  exchangeCount: number;
  id: string;
  sourceId: string;
  targetId: string;
}

const relationshipId = (firstId: string, secondId: string) => (
  firstId.localeCompare(secondId) <= 0
    ? `${firstId}::${secondId}`
    : `${secondId}::${firstId}`
);

const WORD_CHARACTER_PATTERN = new RegExp('[\\p{L}\\p{N}]', 'u');

const countWords = (text: string) => text
  .trim()
  .split(/\s+/)
  .filter((word) => WORD_CHARACTER_PATTERN.test(word))
  .length;

const SPEAKER_RESET_BLOCK_TYPES = new Set([
  'action',
  'camera',
  'note',
  'scene_heading',
  'sound',
  'transition',
]);

const pairs = (characterIds: string[]) => {
  const result: Array<[string, string]> = [];
  characterIds.forEach((sourceId, sourceIndex) => {
    characterIds.slice(sourceIndex + 1).forEach((targetId) => {
      result.push([sourceId, targetId]);
    });
  });
  return result;
};

export const analyzeCharacterRelationships = (
  characters: CompactCharacter[],
  scenes: Scene[],
): CharacterAnalysis => {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const characterIdsByName = new Map<string, string[]>();
  characters.forEach((character) => {
    const normalizedName = character.name.trim().toLocaleLowerCase();
    characterIdsByName.set(
      normalizedName,
      [...(characterIdsByName.get(normalizedName) ?? []), character.id],
    );
  });
  const characterMetrics = new Map<string, MutableCharacterMetric>(characters.map((character) => [
    character.id,
    {
      character,
      dialogueCount: 0,
      exchangeCount: 0,
      relationshipCount: 0,
      sceneIds: new Set<number>(),
      wordCount: 0,
    },
  ]));
  const relationships = new Map<string, MutableRelationshipMetric>();
  const commonScenes = new Map<string, Set<number>>();
  let dialogueCount = 0;
  let unlinkedDialogueCount = 0;
  let wordCount = 0;

  for (const scene of scenes) {
    const sceneCharacterIds = new Set(scene.characters
      .map((character) => character.id)
      .filter((characterId) => characterById.has(characterId)));
    let activeSpeakerId: string | null = null;
    let previousSpeakerId: string | null = null;

    for (const block of scene.scriptBlocks) {
      const hasExplicitCharacterId = block.characterId !== undefined;
      const explicitCharacterId = block.characterId && characterById.has(block.characterId)
        ? block.characterId
        : null;

      if (block.type === 'character') {
        const nameCandidates = characterIdsByName.get(block.text.trim().toLocaleLowerCase()) ?? [];
        activeSpeakerId = hasExplicitCharacterId
          ? explicitCharacterId
          : nameCandidates.length === 1 ? nameCandidates[0] : null;
        if (activeSpeakerId) sceneCharacterIds.add(activeSpeakerId);
        continue;
      }

      if (SPEAKER_RESET_BLOCK_TYPES.has(block.type)) {
        activeSpeakerId = null;
        if (block.type === 'scene_heading' || block.type === 'transition') {
          previousSpeakerId = null;
        }
        continue;
      }

      if (hasExplicitCharacterId) {
        activeSpeakerId = explicitCharacterId;
        if (explicitCharacterId) sceneCharacterIds.add(explicitCharacterId);
      }
      if (block.type !== 'dialogue' || !block.text.trim()) continue;

      const speakerId = hasExplicitCharacterId ? explicitCharacterId : activeSpeakerId;
      if (!speakerId) {
        unlinkedDialogueCount += 1;
        previousSpeakerId = null;
        continue;
      }

      const metric = characterMetrics.get(speakerId);
      if (!metric) continue;
      const blockWordCount = countWords(block.text);
      metric.dialogueCount += 1;
      metric.wordCount += blockWordCount;
      sceneCharacterIds.add(speakerId);
      dialogueCount += 1;
      wordCount += blockWordCount;

      if (previousSpeakerId && previousSpeakerId !== speakerId) {
        const id = relationshipId(previousSpeakerId, speakerId);
        const [sourceId, targetId] = id.split('::');
        const relationship = relationships.get(id) ?? {
          actBreakdown: new Map<number, number>(),
          dialogueSceneIds: new Set<number>(),
          exchangeCount: 0,
          id,
          sourceId,
          targetId,
        };
        relationship.exchangeCount += 1;
        relationship.dialogueSceneIds.add(scene.id);
        relationship.actBreakdown.set(
          scene.act,
          (relationship.actBreakdown.get(scene.act) ?? 0) + 1,
        );
        relationships.set(id, relationship);
      }
      previousSpeakerId = speakerId;
    }

    sceneCharacterIds.forEach((characterId) => {
      characterMetrics.get(characterId)?.sceneIds.add(scene.id);
    });
    for (const [sourceId, targetId] of pairs(Array.from(sceneCharacterIds))) {
      const id = relationshipId(sourceId, targetId);
      const sceneIds = commonScenes.get(id) ?? new Set<number>();
      sceneIds.add(scene.id);
      commonScenes.set(id, sceneIds);
    }
  }

  const relationshipMetrics = Array.from(relationships.values())
    .map<CharacterRelationshipMetric>((relationship) => ({
      actBreakdown: Array.from(relationship.actBreakdown.entries())
        .sort(([firstAct], [secondAct]) => firstAct - secondAct)
        .map(([act, exchangeCount]) => ({act, exchangeCount})),
      commonSceneIds: Array.from(commonScenes.get(relationship.id) ?? []).sort((a, b) => a - b),
      dialogueSceneIds: Array.from(relationship.dialogueSceneIds).sort((a, b) => a - b),
      exchangeCount: relationship.exchangeCount,
      id: relationship.id,
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
    }))
    .sort((first, second) => (
      second.exchangeCount - first.exchangeCount
      || second.commonSceneIds.length - first.commonSceneIds.length
      || first.id.localeCompare(second.id)
    ));

  relationshipMetrics.forEach((relationship) => {
    const source = characterMetrics.get(relationship.sourceId);
    const target = characterMetrics.get(relationship.targetId);
    if (source) {
      source.exchangeCount += relationship.exchangeCount;
      source.relationshipCount += 1;
    }
    if (target) {
      target.exchangeCount += relationship.exchangeCount;
      target.relationshipCount += 1;
    }
  });

  const metrics = Array.from(characterMetrics.values())
    .filter((metric) => metric.sceneIds.size > 0)
    .map<CharacterMetric>((metric) => ({
      character: metric.character,
      dialogueCount: metric.dialogueCount,
      exchangeCount: metric.exchangeCount,
      relationshipCount: metric.relationshipCount,
      sceneIds: Array.from(metric.sceneIds).sort((a, b) => a - b),
      wordCount: metric.wordCount,
    }))
    .sort((first, second) => (
      second.dialogueCount - first.dialogueCount
      || second.exchangeCount - first.exchangeCount
      || second.sceneIds.length - first.sceneIds.length
      || first.character.name.localeCompare(second.character.name)
    ));

  return {
    characters: metrics,
    dialogueCount,
    relationships: relationshipMetrics,
    unlinkedDialogueCount,
    wordCount,
  };
};
