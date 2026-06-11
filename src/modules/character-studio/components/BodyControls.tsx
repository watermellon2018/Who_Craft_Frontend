import React from 'react';
import {Form, Select} from 'antd';

const labels: Record<string, string> = {
  relaxed: 'Расслабленная',
  confident: 'Уверенная',
  tense: 'Напряженная',
  closed: 'Закрытая',
  elegant: 'Элегантная',
  slouched: 'Сутулая',
};

const options = (items: string[]) =>
  items.map((value) => ({value, label: labels[value] || value.replaceAll('_', ' ')}));

export default function BodyControls({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  return (
    <Form layout="vertical">
      <Form.Item label="Поза">
        <Select
          value={value.posture as string}
          options={options(['relaxed', 'confident', 'tense', 'closed', 'elegant', 'slouched'])}
          onChange={(v) => onChange({...value, posture: v})}
        />
      </Form.Item>
    </Form>
  );
}
