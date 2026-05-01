import React from 'react';
import {Form, Select} from 'antd';
const labels: Record<string, string> = {
  cinematic_realism: 'Кинореализм',
  anime: 'Аниме',
  pixar_like: 'Pixar-подобный',
  stylized_3d: 'Стилизованное 3D',
  dark_fantasy: 'Темное фэнтези',
  cyberpunk: 'Киберпанк',
  noir: 'Нуар',
  watercolor: 'Акварель',
  comic_book: 'Комикс',
  neutral: 'Нейтральное',
  dramatic: 'Драматичное',
  soft: 'Мягкое',
  dark: 'Темное',
  colorful: 'Цветное',
  melancholic: 'Меланхоличное',
};
const options = (items: string[]) => items.map((value) => ({value, label: labels[value] || value.replaceAll('_', ' ')}));
export default function StyleControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  return <Form layout="vertical">
    <Form.Item label="Визуальный стиль"><Select value={value.visual_style as string} options={options(['cinematic_realism', 'anime', 'pixar_like', 'stylized_3d', 'dark_fantasy', 'cyberpunk', 'noir', 'watercolor', 'comic_book'])} onChange={(v) => onChange({...value, visual_style: v})} /></Form.Item>
    <Form.Item label="Настроение рендера"><Select value={value.render_mood as string} options={options(['neutral', 'dramatic', 'soft', 'dark', 'colorful', 'melancholic'])} onChange={(v) => onChange({...value, render_mood: v})} /></Form.Item>
  </Form>;
}
