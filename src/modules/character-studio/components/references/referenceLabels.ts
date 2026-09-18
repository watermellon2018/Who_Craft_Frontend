import type {TFunction} from 'i18next';
import type {ReferenceType} from '../../types/character.types';

export const REFERENCE_LABEL_KEYS: Record<ReferenceType, {title: string; subtitle: string}> = {
  portrait: {title: 'characterStudio.references.portrait', subtitle: 'characterStudio.references.portraitDesc'},
  full_body: {title: 'characterStudio.references.fullBody', subtitle: 'characterStudio.references.fullBodyDesc'},
  three_quarter: {title: 'characterStudio.references.threequarter', subtitle: 'characterStudio.references.threequarterDesc'},
  profile: {title: 'characterStudio.references.profile', subtitle: 'characterStudio.references.profileDesc'},
  back_view: {title: 'characterStudio.references.backView', subtitle: 'characterStudio.references.backViewDesc'},
  emotions: {title: 'characterStudio.references.emotions', subtitle: 'characterStudio.references.emotionsDesc'},
  poses: {title: 'characterStudio.references.poses', subtitle: 'characterStudio.references.posesDesc'},
  outfit_details: {title: 'characterStudio.references.outfitDetails', subtitle: 'characterStudio.references.outfitDetailsDesc'},
  character_sheet: {title: 'characterStudio.references.characterSheet', subtitle: 'characterStudio.references.characterSheetDesc'},
};

export const STATUS_LABEL_KEYS = {
  ready: 'characterStudio.references.statusReady',
  generating: 'characterStudio.references.statusGenerating',
  failed: 'characterStudio.references.statusFailed',
  missing: 'characterStudio.references.statusMissing',
} as const;

const BLOCKER_MESSAGES: Record<string, string> = {
  missing_portrait: 'characterStudio.references.blockers.portrait',
  missing_full_body: 'characterStudio.references.blockers.fullBody',
  missing_profile_or_three_quarter: 'characterStudio.references.blockers.profile',
  missing_back_view: 'characterStudio.references.blockers.backView',
  generation_in_progress: 'characterStudio.references.blockers.generating',
  appearance_not_confirmed: 'characterStudio.references.blockers.appearance',
  face_not_confirmed: 'characterStudio.references.blockers.face',
  outfit_not_confirmed: 'characterStudio.references.blockers.outfit',
  suitability_for_3d_not_confirmed: 'characterStudio.references.blockers.suitable3d',
};

export function describeBlockers(blockers: string[], t: TFunction): string {
  if (!blockers || blockers.length === 0) return '';
  const parts = blockers.map((key) => BLOCKER_MESSAGES[key] ? t(BLOCKER_MESSAGES[key]) : key);
  return t('characterStudio.references.blockersSummary', {items: parts.join(', ')});
}
