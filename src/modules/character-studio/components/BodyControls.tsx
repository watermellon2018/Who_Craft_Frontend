import React from 'react';
import {Form, InputNumber, Select, Slider} from 'antd';

const labels: Record<string, string> = {
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

const options = (items: string[]) =>
  items.map((value) => ({value, label: labels[value] || value.replaceAll('_', ' ')}));

const HEIGHT_MIN = 120;
const HEIGHT_MAX = 220;
const HEIGHT_DEFAULT = 170;

export default function BodyControls({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const rawHeight = typeof value.height_cm === 'number' ? value.height_cm : undefined;
  const displayHeight = rawHeight ?? HEIGHT_DEFAULT;

  const setHeight = (v: number | null) => {
    if (v == null || Number.isNaN(v)) {
      onChange({...value, height_cm: undefined});
      return;
    }
    const clamped = Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, Math.round(v)));
    onChange({...value, height_cm: clamped});
  };

  return (
    <Form layout="vertical">
      <Form.Item label={`Рост, см: ${displayHeight}`}>
        <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
          <Slider
            style={{flex: 1}}
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            step={1}
            value={displayHeight}
            onChange={setHeight}
          />
          <InputNumber
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            step={1}
            value={rawHeight}
            placeholder={`${HEIGHT_DEFAULT}`}
            onChange={(v) => setHeight(typeof v === 'number' ? v : null)}
            style={{width: 88}}
          />
        </div>
      </Form.Item>
      <Form.Item label="Тип телосложения">
        <Select
          value={value.body_type as string}
          options={options(['slim', 'athletic', 'strong', 'soft', 'heavy'])}
          onChange={(v) => onChange({...value, body_type: v})}
        />
      </Form.Item>
      <Form.Item label="Осанка">
        <Select
          value={value.posture as string}
          options={options(['relaxed', 'confident', 'tense', 'closed', 'elegant', 'slouched'])}
          onChange={(v) => onChange({...value, posture: v})}
        />
      </Form.Item>
    </Form>
  );
}
