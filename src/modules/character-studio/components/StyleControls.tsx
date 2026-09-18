import React from 'react';
import {Form, Select} from 'antd';
import {useTranslation} from 'react-i18next';

const VISUAL_STYLES = ['cinematic_realism', 'anime', 'pixar_like', 'stylized_3d', 'dark_fantasy', 'cyberpunk', 'noir', 'watercolor', 'comic_book'] as const;

export default function StyleControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  const {t} = useTranslation();
  return (
    <section className="character-settings-section character-settings-section--primary">
      <h3>{t('characterStudio.create.visualStyle.title')}</h3>
      <Form layout="vertical">
        <Form.Item>
          <Select
            value={value.visual_style as string}
            options={VISUAL_STYLES.map((item) => ({value: item, label: t(`characterStudio.options.visualStyle.${item}`)}))}
            onChange={(v) => onChange({...value, visual_style: v})}
            placeholder={t('characterStudio.controls.stylePlaceholder')}
            popupClassName="character-editor-select-dropdown"
          />
        </Form.Item>
      </Form>
    </section>
  );
}
