import React from 'react';
import {Input} from 'antd';
import {useTranslation} from 'react-i18next';
import {CharacterRegion} from '../types/character.types';

const MAX_LENGTH = 500;

export default function TextRefinementBox({region, value, onChange}: {region: CharacterRegion; value: string; onChange: (value: string) => void}) {
  const {t} = useTranslation();
  return (
    <div className="textareaField">
      <Input.TextArea
        maxLength={MAX_LENGTH}
        rows={4}
        value={value}
        placeholder={t(`characterStudio.controls.refinement.${region}`)}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="charCounter">{value.length} / {MAX_LENGTH}</div>
    </div>
  );
}

