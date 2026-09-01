import type {Scene} from './types';

export const SCRIPT_ACTS = [1, 2, 3] as const;

export interface ScenePlacement {
  id: number;
  order: number;
  act: number;
}

const WORD_PATTERN = /[A-Za-zА-Яа-яЁё0-9]+/g;

const clampAct = (act: number) => Math.min(3, Math.max(1, act));

export function moveScene(
  scenes: Scene[],
  sceneId: number,
  targetAct: number,
  targetIndex: number,
): Scene[] {
  const source = scenes.find((scene) => scene.id === sceneId);
  if (!source) return scenes;

  const columns = new Map<number, Scene[]>(SCRIPT_ACTS.map((act) => [act, []]));
  [...scenes]
    .sort((left, right) => left.order - right.order)
    .forEach((scene) => columns.get(clampAct(scene.act))?.push(scene));

  for (const act of SCRIPT_ACTS) {
    columns.set(act, (columns.get(act) ?? []).filter((scene) => scene.id !== sceneId));
  }

  const nextAct = clampAct(targetAct);
  const destination = columns.get(nextAct) ?? [];
  const insertionIndex = Math.min(destination.length, Math.max(0, targetIndex));
  destination.splice(insertionIndex, 0, source);
  columns.set(nextAct, destination);

  let order = 0;
  return SCRIPT_ACTS.flatMap((act) => (
    (columns.get(act) ?? []).map((scene) => ({...scene, act, order: ++order}))
  ));
}

export const toScenePlacements = (scenes: Scene[]): ScenePlacement[] => (
  [...scenes]
    .sort((left, right) => left.order - right.order)
    .map(({id, order, act}) => ({id, order, act}))
);

export function getSceneHeading(scene: Scene): string {
  return scene.scriptBlocks.find((block) => block.type === 'scene_heading')?.text.trim()
    || 'Заголовок сцены не указан';
}

export function getSceneLocation(scene: Scene): string {
  const heading = getSceneHeading(scene);
  if (heading === 'Заголовок сцены не указан') return 'Место не указано';
  const withoutPrefix = heading
    .replace(/^(?:ИНТ\.?\s*\/\s*НАТ\.?|НАТ\.?\s*\/\s*ИНТ\.?|ИНТ\.?|НАТ\.?|INT\.?|EXT\.?)\s*/i, '')
    .trim();
  const location = withoutPrefix.split(/\s+[—–-]\s+/)[0]?.trim();
  if (!location || /^ЛОКАЦИЯ$/i.test(location)) return 'Место не указано';
  return location;
}

const screenplayText = (scene: Scene) => {
  if (scene.scriptBlocks.length === 0) return scene.scriptText.trim();
  return scene.scriptBlocks
    .filter((block) => block.type !== 'scene_heading' && block.type !== 'note')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join(' ');
};

export const isSceneEmpty = (scene: Scene): boolean => screenplayText(scene).length === 0;

export function estimateSceneDurationSeconds(scene: Scene): number {
  const text = screenplayText(scene);
  if (!text) return 0;
  const wordCount = text.match(WORD_PATTERN)?.length ?? 0;
  const rawSeconds = wordCount / 140 * 60;
  return Math.max(15, Math.round(rawSeconds / 15) * 15);
}

export function formatEstimatedDuration(scene: Scene): string {
  const seconds = estimateSceneDurationSeconds(scene);
  if (seconds === 0) return '≈ 0 мин';
  if (seconds < 60) return '≈ < 1 мин';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `≈ ${minutes} мин ${remainder} сек` : `≈ ${minutes} мин`;
}
