import {useMemo, useState} from 'react';
import {CharacterRegion, EditRequest} from '../types/character.types';

const defaultsByRegion: Record<CharacterRegion, Record<string, boolean>> = {
  face: {hair: true, outfit: true, style: true, face: false, identity: false},
  hair: {face: true, outfit: true, style: true, identity: false},
  body: {face: true, hair: true, outfit: true, style: true, identity: false},
  outfit: {face: true, hair: true, identity: true, style: false},
  style: {identity: true, face: true, hair: true, outfit: true},
  full_character: {identity: true, face: false, hair: false, outfit: false, style: false},
};

export function useCharacterEditor(identityLocked = false) {
  const [region, setRegion] = useState<CharacterRegion>('face');
  const [controls, setControls] = useState<Record<string, unknown>>({});
  const [textRefinement, setTextRefinement] = useState('');

  const preserve = useMemo(() => {
    const value = {...defaultsByRegion[region]};
    if (identityLocked) value.identity = true;
    return value;
  }, [region, identityLocked]);

  const request: EditRequest = {
    region,
    controls,
    text_refinement: textRefinement,
    preserve,
    variant_count: 4,
  };

  return {region, setRegion, controls, setControls, textRefinement, setTextRefinement, preserve, request};
}

