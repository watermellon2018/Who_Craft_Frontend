import React from 'react';
import {Checkbox, Form, Select} from 'antd';

const options = (items: string[]) => items.map((value) => ({value, label: value.replaceAll('_', ' ')}));

export default function FaceControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  return (
    <Form layout="vertical">
      <Form.Item label="Face shape"><Select value={value.face_shape as string} options={options(['oval', 'round', 'square', 'heart', 'diamond', 'long'])} onChange={(v) => onChange({...value, face_shape: v})} /></Form.Item>
      <Form.Item label="Skin tone"><Select value={value.skin_tone as string} options={options(['fair', 'light', 'medium', 'olive', 'tan', 'dark', 'custom_text'])} onChange={(v) => onChange({...value, skin_tone: v})} /></Form.Item>
      <Form.Item label="Eye shape"><Select value={value.eye_shape as string} options={options(['almond', 'round', 'narrow', 'hooded', 'upturned', 'downturned'])} onChange={(v) => onChange({...value, eye_shape: v})} /></Form.Item>
      <Form.Item label="Eye color"><Select value={value.eye_color as string} options={options(['brown', 'blue', 'green', 'gray', 'hazel', 'amber', 'black', 'custom'])} onChange={(v) => onChange({...value, eye_color: v})} /></Form.Item>
      <Form.Item label="Eyebrows"><Select value={value.eyebrow_shape as string} options={options(['thin', 'thick', 'straight', 'arched', 'soft', 'sharp'])} onChange={(v) => onChange({...value, eyebrow_shape: v})} /></Form.Item>
      <Form.Item label="Nose"><Select value={value.nose_shape as string} options={options(['straight', 'button', 'aquiline', 'wide', 'narrow', 'flat', 'sharp'])} onChange={(v) => onChange({...value, nose_shape: v})} /></Form.Item>
      <Form.Item label="Lips"><Select value={value.lips_shape as string} options={options(['thin', 'medium', 'full', 'sharp', 'soft'])} onChange={(v) => onChange({...value, lips_shape: v})} /></Form.Item>
      <Form.Item label="Jawline"><Select value={value.jawline as string} options={options(['soft', 'defined', 'angular', 'round'])} onChange={(v) => onChange({...value, jawline: v})} /></Form.Item>
      <Form.Item label="Distinctive features">
        <Checkbox.Group value={value.distinctive_features as string[]} options={options(['freckles', 'mole', 'scar', 'birthmark', 'glasses', 'piercings'])} onChange={(v) => onChange({...value, distinctive_features: v})} />
      </Form.Item>
    </Form>
  );
}

