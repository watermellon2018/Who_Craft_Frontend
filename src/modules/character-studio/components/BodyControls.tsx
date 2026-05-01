import React from 'react';
import {Form, Select} from 'antd';
const labels: Record<string, string> = {
  short: 'Низкий',
  average: 'Средний',
  tall: 'Высокий',
  slim: 'Худощавое',
  athletic: 'Атлетичное',
  strong: 'Крепкое',
  soft: 'Мягкое',
  heavy: 'Крупное',
  relaxed: 'Расслабленная',
  confident: 'Уверенная',
  tense: 'Напряженная',
  closed: 'Закрытая',
  elegant: 'Элегантная',
  slouched: 'Сутулая',
};
const options = (items: string[]) => items.map((value) => ({value, label: labels[value] || value.replaceAll('_', ' ')}));
export default function BodyControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  return <Form layout="vertical">
    <Form.Item label="Рост"><Select value={value.height as string} options={options(['short', 'average', 'tall'])} onChange={(v) => onChange({...value, height: v})} /></Form.Item>
    <Form.Item label="Тип телосложения"><Select value={value.body_type as string} options={options(['slim', 'average', 'athletic', 'strong', 'soft', 'heavy'])} onChange={(v) => onChange({...value, body_type: v})} /></Form.Item>
    <Form.Item label="Осанка"><Select value={value.posture as string} options={options(['relaxed', 'confident', 'tense', 'closed', 'elegant', 'slouched'])} onChange={(v) => onChange({...value, posture: v})} /></Form.Item>
  </Form>;
}
