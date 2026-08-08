import type {CharacterReference, ReferencesChecklist, ReferenceType} from '../../types/character.types';

export const REQUIRED_REFERENCE_TYPES_FOR_3D = [
  'portrait',
  'full_body',
  'three_quarter',
  'profile',
  'back_view',
] as const satisfies readonly ReferenceType[];

export const REQUIRED_REFERENCE_QUALITY_CHECKS = [
  'appearance_stable',
  'face_matches_base',
  'outfit_readable',
  'suitable_for_3d',
] as const satisfies readonly (keyof ReferencesChecklist)[];

export function isReferenceQualityChecklistComplete(checklist: ReferencesChecklist): boolean {
  return REQUIRED_REFERENCE_QUALITY_CHECKS.every((key) => checklist[key]);
}

type ActiveReferenceJobs = Partial<Record<ReferenceType, string | undefined>>;

export function isRequiredReferenceType(referenceType: ReferenceType): boolean {
  return REQUIRED_REFERENCE_TYPES_FOR_3D.some((requiredType) => requiredType === referenceType);
}

export function getRequiredReferencesProgress(references: readonly CharacterReference[]): {
  ready: number;
  total: number;
} {
  const ready = REQUIRED_REFERENCE_TYPES_FOR_3D.filter((referenceType) => {
    const reference = references.find((row) => row.reference_type === referenceType);
    return reference?.status === 'ready' && Boolean(reference.asset_id) && Boolean(reference.image_url);
  }).length;

  return {ready, total: REQUIRED_REFERENCE_TYPES_FOR_3D.length};
}

export function canProceedTo3DFromReferences({
  references,
  checklist,
  activeJobs,
  autoGenerationActive,
  serverAllowsProceed,
}: {
  references: readonly CharacterReference[];
  checklist: ReferencesChecklist;
  activeJobs: ActiveReferenceJobs;
  autoGenerationActive: boolean;
  serverAllowsProceed: boolean;
}): boolean {
  if (
    !serverAllowsProceed
    || autoGenerationActive
    || !isReferenceQualityChecklistComplete(checklist)
  ) return false;

  return REQUIRED_REFERENCE_TYPES_FOR_3D.every((referenceType) => {
    if (activeJobs[referenceType]) return false;
    const reference = references.find((row) => row.reference_type === referenceType);
    return reference?.status === 'ready' && Boolean(reference.asset_id) && Boolean(reference.image_url);
  });
}