import React from 'react';
import {Input} from 'antd';
import {CharacterRegion} from '../types/character.types';

const placeholders: Record<CharacterRegion, string> = {
  face: 'Опиши, что изменить в лице или выражении. Например: "сделай взгляд более уставшим".',
  hair: 'Опиши, что изменить в волосах. Например: "сделай волосы более растрёпанными".',
  outfit: 'Опиши, что изменить в одежде. Например: "добавь школьной форме готический стиль".',
  body: 'Опиши, что изменить в силуэте или осанке. Например: "сделай осанку более уверенной".',
  style: 'Опиши художественное направление. Например: "сделай стиль ближе к мрачной сказке".',
  full_character: 'Опиши общий контекст изменения, не заменяя структурные настройки.',
};

const MAX_LENGTH = 500;

export default function TextRefinementBox({region, value, onChange}: {region: CharacterRegion; value: string; onChange: (value: string) => void}) {
  return (
    <div className="textareaField">
      <Input.TextArea
        maxLength={MAX_LENGTH}
        rows={4}
        value={value}
        placeholder={placeholders[region]}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="charCounter">{value.length} / {MAX_LENGTH}</div>
    </div>
  );
}

