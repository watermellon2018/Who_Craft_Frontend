import React from 'react';
import {Form, Select} from 'antd';
import {useTranslation} from 'react-i18next';

const POSTURES = ['relaxed', 'confident', 'tense', 'closed', 'elegant', 'slouched'] as const;

export default function BodyControls({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const {t} = useTranslation();
  return (
    <Form layout="vertical">
      <Form.Item label={t('characterStudio.editor.bodyPanel.pose')}>
        <Select
          value={value.posture as string}
          options={POSTURES.map((item) => ({value: item, label: t(`characterStudio.controls.postures.${item}`)}))}
          onChange={(v) => onChange({...value, posture: v})}
        />
      </Form.Item>
    </Form>
  );
}
