import type {CharacterReference, ReferencesChecklist, ReferenceType} from '../../types/character.types';
import {
  canProceedTo3DFromReferences,
  getRequiredReferencesProgress,
  REQUIRED_REFERENCE_TYPES_FOR_3D,
} from './referenceReadiness';

function createReference(
  referenceType: ReferenceType,
  overrides: Partial<CharacterReference> = {},
): CharacterReference {
  return {
    reference_type: referenceType,
    status: 'ready',
    asset_id: referenceType + '-asset',
    image_url: '/media/' + referenceType + '.png',
    is_primary: referenceType === 'portrait',
    version: 1,
    source: 'generated',
    ...overrides,
  };
}

const readyReferences = REQUIRED_REFERENCE_TYPES_FOR_3D.map((referenceType) =>
  createReference(referenceType),
);

const completeChecklist: ReferencesChecklist = {
  appearance_stable: true,
  face_matches_base: true,
  outfit_readable: true,
  full_body_ready: true,
  front_side_back_ready: true,
  suitable_for_3d: true,
};

describe('references-to-3D readiness gate', () => {
  it('allows the transition only when every generated reference is ready', () => {
    expect(canProceedTo3DFromReferences({
      references: readyReferences,
      checklist: completeChecklist,
      activeJobs: {},
      autoGenerationActive: false,
      serverAllowsProceed: true,
    })).toBe(true);
    expect(getRequiredReferencesProgress(readyReferences)).toEqual({ready: 5, total: 5});
  });

  it('blocks the transition until every quality check is confirmed', () => {
    expect(canProceedTo3DFromReferences({
      references: readyReferences,
      checklist: {...completeChecklist, suitable_for_3d: false},
      activeJobs: {},
      autoGenerationActive: false,
      serverAllowsProceed: true,
    })).toBe(false);
  });

  it('blocks the transition while a non-selected reference job is active', () => {
    expect(canProceedTo3DFromReferences({
      references: readyReferences,
      checklist: completeChecklist,
      activeJobs: {back_view: 'job-42'},
      autoGenerationActive: false,
      serverAllowsProceed: true,
    })).toBe(false);
  });

  it('blocks the transition when a required reference is missing or incomplete', () => {
    const incomplete = readyReferences.map((reference) =>
      reference.reference_type === 'three_quarter'
        ? {...reference, status: 'generating' as const, asset_id: null, image_url: null}
        : reference,
    );

    expect(canProceedTo3DFromReferences({
      references: incomplete,
      checklist: completeChecklist,
      activeJobs: {},
      autoGenerationActive: false,
      serverAllowsProceed: true,
    })).toBe(false);
    expect(getRequiredReferencesProgress(incomplete)).toEqual({ready: 4, total: 5});
  });

  it('keeps the client gate closed when the server reports blockers', () => {
    expect(canProceedTo3DFromReferences({
      references: readyReferences,
      checklist: completeChecklist,
      activeJobs: {},
      autoGenerationActive: false,
      serverAllowsProceed: false,
    })).toBe(false);
  });
});