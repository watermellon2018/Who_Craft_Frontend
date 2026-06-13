import {computeStepStates, StepKey} from './stepProgress';
import type {StudioCharacter} from '../../types/character.types';

type Partial3D = Pick<
  StudioCharacter,
  'status' | 'canonical_reference_image_id' | 'current_revision_id' | 'model3d_params'
>;

const char = (over: Partial<Partial3D>): Partial3D => ({
  status: 'draft',
  canonical_reference_image_id: null,
  current_revision_id: null,
  model3d_params: {},
  ...over,
});

const stateOf = (steps: ReturnType<typeof computeStepStates>, key: StepKey) =>
  steps.find((s) => s.key === key)?.state;

describe('computeStepStates', () => {
  it('locks every other stage for a fresh draft on the 3D step', () => {
    const steps = computeStepStates(char({status: 'draft'}), 'model3d');
    expect(stateOf(steps, 'parameters')).toBe('locked');
    expect(stateOf(steps, 'variants')).toBe('locked');
    expect(stateOf(steps, 'editor')).toBe('locked');
    expect(stateOf(steps, 'references')).toBe('locked');
    expect(stateOf(steps, 'model3d')).toBe('active');
  });

  it('marks parameters done once the character is no longer a draft', () => {
    expect(stateOf(computeStepStates(char({status: 'active'}), 'model3d'), 'parameters')).toBe('done');
  });

  it('marks variants done when a canonical reference was applied', () => {
    const steps = computeStepStates(
      char({status: 'active', canonical_reference_image_id: 'abc'}),
      'model3d',
    );
    expect(stateOf(steps, 'variants')).toBe('done');
  });

  it('marks editor done when a revision exists', () => {
    const steps = computeStepStates(char({current_revision_id: 'rev-1'}), 'model3d');
    expect(stateOf(steps, 'editor')).toBe('done');
  });

  it('marks references done only when the character is references_locked', () => {
    expect(stateOf(computeStepStates(char({status: 'active'}), 'model3d'), 'references')).toBe('locked');
    expect(
      stateOf(computeStepStates(char({status: 'references_locked'}), 'model3d'), 'references'),
    ).toBe('done');
  });

  it('keeps the current stage active even if its done-signal is set', () => {
    // On the references stage, references must read active, not done.
    const steps = computeStepStates(char({status: 'references_locked'}), 'references');
    expect(stateOf(steps, 'references')).toBe('active');
  });

  it('treats a fully progressed character as all-done except the current step', () => {
    const steps = computeStepStates(
      char({
        status: 'references_locked',
        canonical_reference_image_id: 'ref',
        current_revision_id: 'rev',
        model3d_params: {torso: {chestWidth: 0.2}},
      }),
      'model3d',
    );
    expect(stateOf(steps, 'parameters')).toBe('done');
    expect(stateOf(steps, 'variants')).toBe('done');
    expect(stateOf(steps, 'editor')).toBe('done');
    expect(stateOf(steps, 'references')).toBe('done');
    expect(stateOf(steps, 'model3d')).toBe('active');
  });

  it('locks everything when there is no character yet', () => {
    const steps = computeStepStates(null, 'model3d');
    expect(stateOf(steps, 'parameters')).toBe('locked');
    expect(stateOf(steps, 'model3d')).toBe('active');
  });
});
