import {ReferenceType} from '../../types/character.types';

export const REFERENCE_LABELS: Record<ReferenceType, {title: string; subtitle: string}> = {
  portrait: {title: 'Портрет', subtitle: 'Основной вид лица'},
  full_body: {title: 'Полный рост', subtitle: 'Фигура и пропорции'},
  three_quarter: {title: '3/4 ракурс', subtitle: 'Объём лица и силуэт'},
  profile: {title: 'Профиль', subtitle: 'Вид сбоку'},
  back_view: {title: 'Вид со спины', subtitle: 'Одежда и силуэт сзади'},
  emotions: {title: 'Эмоции', subtitle: 'Мимика персонажа'},
  poses: {title: 'Позы', subtitle: 'Пластика и движение'},
  outfit_details: {title: 'Детали одежды', subtitle: 'Материалы и аксессуары'},
  character_sheet: {title: 'Character sheet', subtitle: 'Полный лист персонажа'},
};

export const STATUS_LABELS = {
  ready: 'Готово',
  generating: 'Генерируется',
  failed: 'Ошибка',
  missing: 'Не создано',
} as const;

const BLOCKER_MESSAGES: Record<string, string> = {
  missing_portrait: 'не готов портрет',
  missing_full_body: 'не готов полный рост',
  missing_profile_or_three_quarter: 'нет профиля или 3/4 ракурса',
  missing_back_view: 'не готов вид со спины',
  generation_in_progress: 'идёт активная генерация',
};

export function describeBlockers(blockers: string[]): string {
  if (!blockers || blockers.length === 0) return '';
  const parts = blockers.map((key) => BLOCKER_MESSAGES[key] || key);
  return `Для перехода к 3D модели требуется: ${parts.join(', ')}.`;
}
