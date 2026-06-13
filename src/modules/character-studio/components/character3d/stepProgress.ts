import type {StudioCharacter} from '../../types/character.types';

export type StepKey = 'parameters' | 'variants' | 'editor' | 'references' | 'model3d';
export type StepState = 'done' | 'active' | 'locked';

export interface StepDescriptor {
  key: StepKey;
  label: string;
  state: StepState;
}

// Signals that a stage has been reached, derived from the character GET
// payload alone (no extra requests). Kept deliberately simple — `status` is
// the spine of the lifecycle and a few id fields fill the gaps:
//   draft → only parameters touched
//   active → a variant was applied (canonical_reference_image set)
//   references_locked → user proceeded past references to the 3D stage
// `editor` is "done" once any content edit produced a revision.
//
// The stage the user is currently on (`current`) is always shown as active;
// any stage that is neither done nor current is locked (not yet reachable),
// so the header only ever lets the user jump to real, completed stages.
export function computeStepStates(
  character: Pick<
    StudioCharacter,
    'status' | 'canonical_reference_image_id' | 'current_revision_id' | 'model3d_params'
  > | null,
  current: StepKey,
): StepDescriptor[] {
  const status = character?.status;
  const done: Record<StepKey, boolean> = {
    parameters: !!character && status !== 'draft',
    variants: !!character?.canonical_reference_image_id,
    editor: !!character?.current_revision_id,
    references: status === 'references_locked',
    model3d: !!character?.model3d_params && Object.keys(character.model3d_params).length > 0,
  };

  const LABELS: Array<{key: StepKey; label: string}> = [
    {key: 'parameters', label: 'Параметры'},
    {key: 'variants', label: 'Варианты'},
    {key: 'editor', label: 'Редактор'},
    {key: 'references', label: 'Референсы'},
    {key: 'model3d', label: '3D модель'},
  ];

  return LABELS.map(({key, label}) => {
    let state: StepState;
    if (key === current) {
      state = 'active';
    } else if (done[key]) {
      state = 'done';
    } else {
      state = 'locked';
    }
    return {key, label, state};
  });
}
