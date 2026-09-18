import React from 'react';
import {Form, Select} from 'antd';
import {useTranslation} from 'react-i18next';

const HAIR_LENGTHS = ['bald', 'short', 'medium', 'long'] as const;

const HAIR_COLORS = ['black', 'brown', 'blonde', 'red', 'copper', 'white', 'gray', 'blue', 'pink'] as const;

const VALID_LENGTHS = new Set<string>(HAIR_LENGTHS);
const VALID_COLORS = new Set<string>(HAIR_COLORS);

export default function HairControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  const {t} = useTranslation();
  const lengthOptions = HAIR_LENGTHS.map((item) => ({value: item, label: t(`characterStudio.controls.hair.lengths.${item}`)}));
  const colorOptions = HAIR_COLORS.map((item) => ({value: item, label: t(`characterStudio.controls.hair.colors.${item}`)}));
  const rawLength = value.hair_length as string | undefined;
  const hairLength = rawLength && VALID_LENGTHS.has(rawLength) ? rawLength : undefined;

  const rawColor = value.hair_color as string | undefined;
  const hairColor = rawColor && VALID_COLORS.has(rawColor) ? rawColor : undefined;

  return (
    <Form layout="vertical">
      <Form.Item label={t('characterStudio.controls.hair.length')}>
        <Select
          value={hairLength}
          options={lengthOptions}
          placeholder={t('characterStudio.controls.hair.lengthPlaceholder')}
          onChange={(v) => onChange({...value, hair_length: v})}
        />
      </Form.Item>
      <Form.Item label={t('characterStudio.controls.hair.color')}>
        <Select
          value={hairColor}
          options={colorOptions}
          placeholder={t('characterStudio.controls.hair.colorPlaceholder')}
          onChange={(v) => onChange({...value, hair_color: v})}
        />
      </Form.Item>
    </Form>
  );
}
