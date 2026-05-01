import React from 'react';
import {Checkbox, Form, Select} from 'antd';
const labels: Record<string, string> = {
  bald: 'Лысый',
  buzz: 'Ежик',
  short: 'Короткие',
  bob: 'Каре',
  shoulder_length: 'До плеч',
  long: 'Длинные',
  very_long: 'Очень длинные',
  straight: 'Прямые',
  wavy: 'Волнистые',
  curly: 'Кудрявые',
  messy: 'Небрежные',
  ponytail: 'Хвост',
  braid: 'Коса',
  bun: 'Пучок',
  layered: 'Слоями',
  bangs: 'Челка',
  black: 'Черный',
  brown: 'Коричневый',
  blonde: 'Блонд',
  red: 'Рыжий',
  copper: 'Медный',
  white: 'Белый',
  gray: 'Серый',
  blue: 'Синий',
  pink: 'Розовый',
  custom: 'Свой цвет',
  highlights: 'Мелирование',
  gradient: 'Градиент',
  dyed_roots: 'Окрашенные корни',
  wet_look: 'Мокрый эффект',
  windblown: 'Ветер в волосах',
};
const options = (items: string[]) => items.map((value) => ({value, label: labels[value] || value.replaceAll('_', ' ')}));
export default function HairControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  return <Form layout="vertical">
    <Form.Item label="Длина"><Select value={value.hair_length as string} options={options(['bald', 'buzz', 'short', 'bob', 'shoulder_length', 'long', 'very_long'])} onChange={(v) => onChange({...value, hair_length: v})} /></Form.Item>
    <Form.Item label="Форма"><Select value={value.hair_style as string} options={options(['straight', 'wavy', 'curly', 'messy', 'ponytail', 'braid', 'bun', 'layered', 'bangs'])} onChange={(v) => onChange({...value, hair_style: v})} /></Form.Item>
    <Form.Item label="Цвет"><Select value={value.hair_color as string} options={options(['black', 'brown', 'blonde', 'red', 'copper', 'white', 'gray', 'blue', 'pink', 'custom'])} onChange={(v) => onChange({...value, hair_color: v})} /></Form.Item>
    <Form.Item label="Детали"><Checkbox.Group value={value.hair_details as string[]} options={options(['highlights', 'gradient', 'dyed_roots', 'wet_look', 'windblown'])} onChange={(v) => onChange({...value, hair_details: v})} /></Form.Item>
  </Form>;
}
