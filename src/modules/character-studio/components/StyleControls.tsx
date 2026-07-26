import React from 'react';
import {Form, Select} from 'antd';

const VISUAL_STYLE_OPTIONS = [
  {value: 'cinematic_realism', label: 'Кинематографичный реализм'},
  {value: 'anime', label: 'Аниме'},
  {value: 'pixar_like', label: 'В стиле Pixar'},
  {value: 'stylized_3d', label: 'Стилизованное 3D'},
  {value: 'dark_fantasy', label: 'Тёмное фэнтези'},
  {value: 'cyberpunk', label: 'Киберпанк'},
  {value: 'noir', label: 'Нуар'},
  {value: 'watercolor', label: 'Акварель'},
  {value: 'comic_book', label: 'Комикс'},
];

export default function StyleControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  return (
    <section className="character-settings-section character-settings-section--primary">
      <h3>Визуальный стиль</h3>
      <Form layout="vertical">
        <Form.Item>
          <Select
            value={value.visual_style as string}
            options={VISUAL_STYLE_OPTIONS}
            onChange={(v) => onChange({...value, visual_style: v})}
            placeholder="Выберите стиль"
            popupClassName="character-editor-select-dropdown"
          />
        </Form.Item>
      </Form>
    </section>
  );
}
