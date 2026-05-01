import React from 'react';
import {Form, Input, Select} from 'antd';
const labels: Record<string, string> = {
  casual: 'Повседневный',
  school_uniform: 'Школьная форма',
  business: 'Деловой',
  fantasy: 'Фэнтези',
  sci_fi: 'Научная фантастика',
  cyberpunk: 'Киберпанк',
  formal: 'Формальный',
  home: 'Домашний',
  sport: 'Спортивный',
  historical: 'Исторический',
  military: 'Военный',
  streetwear: 'Уличный стиль',
};
const options = (items: string[]) => items.map((value) => ({value, label: labels[value] || value.replaceAll('_', ' ')}));
export default function OutfitControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  const layers = (value.layers || {}) as Record<string, string>;
  const updateLayer = (key: string, item: string) => onChange({...value, layers: {...layers, [key]: item}});
  return <Form layout="vertical">
    <Form.Item label="Пресет"><Select value={value.outfit_preset as string} options={options(['casual', 'school_uniform', 'business', 'fantasy', 'sci_fi', 'cyberpunk', 'formal', 'home', 'sport', 'historical', 'military', 'streetwear'])} onChange={(v) => onChange({...value, outfit_preset: v})} /></Form.Item>
    {[
      ['top', 'Верх'],
      ['bottom', 'Низ'],
      ['outerwear', 'Верхняя одежда'],
      ['shoes', 'Обувь'],
      ['accessories', 'Аксессуары'],
    ].map(([layer, label]) => <Form.Item key={layer} label={label}><Input value={layers[layer]} onChange={(event) => updateLayer(layer, event.target.value)} /></Form.Item>)}
  </Form>;
}
