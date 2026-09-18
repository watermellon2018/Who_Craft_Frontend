import React from 'react';
import {Form, Input, Select} from 'antd';
import {useTranslation} from 'react-i18next';

const OUTFIT_PRESETS = ['casual', 'school_uniform', 'business', 'fantasy', 'sci_fi', 'cyberpunk', 'formal', 'home', 'sport', 'historical', 'military', 'streetwear'] as const;
const LAYERS = ['top', 'bottom', 'outerwear', 'shoes', 'accessories'] as const;

export default function OutfitControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  const {t} = useTranslation();
  const layers = (value.layers || {}) as Record<string, string>;
  const updateLayer = (key: string, item: string) => onChange({...value, layers: {...layers, [key]: item}});
  return <Form layout="vertical">
    <Form.Item label={t('characterStudio.controls.outfit.preset')}><Select value={value.outfit_preset as string} options={OUTFIT_PRESETS.map((item) => ({value: item, label: t(`characterStudio.controls.outfit.presets.${item}`)}))} onChange={(v) => onChange({...value, outfit_preset: v})} /></Form.Item>
    {LAYERS.map((layer) => <Form.Item key={layer} label={t(`characterStudio.controls.outfit.layers.${layer}`)}><Input value={layers[layer]} onChange={(event) => updateLayer(layer, event.target.value)} /></Form.Item>)}
  </Form>;
}
