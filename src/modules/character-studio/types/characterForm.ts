import type {StudioCharacter} from './character.types';

export interface CharacterCreateFormValues {
  name?: string;
  character_type?: string;
  age?: number;
  lifecycle_stage?: string;
  gender?: string;
  role?: string;
  appearance_description?: string;
  body_structure?: string;
  surface_material?: string;
  special_features?: string;
  short_description?: string;
  personality_description?: string;
  backstory?: string;
  visual_style?: string;
}

export function characterToFormValues(character: StudioCharacter): CharacterCreateFormValues {
  const personalityDescription = character.personality?.description;
  return {
    name: character.name,
    character_type: character.character_type,
    age: character.age ?? undefined,
    lifecycle_stage: character.lifecycle_stage,
    gender: character.gender,
    role: character.role,
    appearance_description: character.appearance?.appearance_prompt
      || character.appearance?.source_description
      || character.short_description,
    body_structure: character.appearance?.body_structure,
    surface_material: character.appearance?.surface_material,
    special_features: character.appearance?.special_features,
    short_description: character.short_description,
    personality_description: typeof personalityDescription === 'string'
      ? personalityDescription
      : undefined,
    backstory: character.backstory,
    visual_style: character.visual_style,
  };
}