import React from 'react';
import {Form, Select} from 'antd';

const HAIR_LENGTH_OPTIONS = [
  {value: 'bald',           label: 'Лысый'},
  {value: 'short',          label: 'Короткие'},
  {value: 'medium',         label: 'Средние'},
  {value: 'long',           label: 'Длинные'},
];

// Map legacy hair_length values that no longer exist in the simplified list.
const HAIR_LENGTH_LEGACY: Record<string, string> = {
  buzz:            'short',
  bob:             'short',
  shoulder_length: 'medium',
  very_long:       'long',
};

const HAIR_COLOR_OPTIONS = [
  {value: 'black',   label: 'Черный'},
  {value: 'brown',   label: 'Коричневый'},
  {value: 'blonde',  label: 'Блонд'},
  {value: 'red',     label: 'Рыжий'},
  {value: 'copper',  label: 'Медный'},
  {value: 'white',   label: 'Белый'},
  {value: 'gray',    label: 'Серый'},
  {value: 'blue',    label: 'Синий'},
  {value: 'pink',    label: 'Розовый'},
];

const VALID_LENGTHS = new Set(HAIR_LENGTH_OPTIONS.map((o) => o.value));
const VALID_COLORS = new Set(HAIR_COLOR_OPTIONS.map((o) => o.value));

export default function HairControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  const rawLength = value.hair_length as string | undefined;
  // Normalize legacy values on-the-fly; unknown values fall back to undefined so
  // the placeholder shows and the user can pick a valid option.
  const hairLength = rawLength
    ? (HAIR_LENGTH_LEGACY[rawLength] ?? (VALID_LENGTHS.has(rawLength) ? rawLength : undefined))
    : undefined;

  const rawColor = value.hair_color as string | undefined;
  const hairColor = rawColor && VALID_COLORS.has(rawColor) ? rawColor : undefined;

  return (
    <Form layout="vertical">
      <Form.Item label="Длина">
        <Select
          value={hairLength}
          options={HAIR_LENGTH_OPTIONS}
          placeholder="Выберите длину"
          onChange={(v) => onChange({...value, hair_length: v})}
        />
      </Form.Item>
      <Form.Item label="Цвет">
        <Select
          value={hairColor}
          options={HAIR_COLOR_OPTIONS}
          placeholder="Выберите цвет"
          onChange={(v) => onChange({...value, hair_color: v})}
        />
      </Form.Item>
    </Form>
  );
}
