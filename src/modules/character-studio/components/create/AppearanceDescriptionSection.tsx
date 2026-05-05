import React from 'react';
import {EyeOutlined, ProfileOutlined} from '@ant-design/icons';
import FormSectionCard, {TextareaWithCounter, TextField} from './FormSectionCard';

export default function AppearanceDescriptionSection() {
  return (
    <>
      <FormSectionCard
        icon={<EyeOutlined />}
        title="Описание внешности"
        subtitle="Опишите, как выглядит персонаж"
      >
        <TextareaWithCounter
          id="description-character-appearance"
          name="appearance_description"
          label="Внешность"
          maxLength={500}
          minRows={4}
          placeholder="Опишите форму тела, цвет, фактуру, лицо/морду, одежду, особенности, пропорции и общее впечатление персонажа..."
          required
          rules={[{required: true, message: 'Опишите внешность персонажа'}]}
        />

        <div className="description-form-grid description-form-grid--two">
          <TextField
            id="description-character-body-structure"
            name="body_structure"
            label="Тип тела / строение"
            maxLength={128}
            placeholder="Например: человекоподобное, четвероногое, крылатое, гибридное"
          />
          <TextField
            id="description-character-surface-material"
            name="surface_material"
            label="Покров / материал"
            maxLength={128}
            placeholder="Например: кожа, шерсть, чешуя, металл, светящаяся энергия"
          />
        </div>

        <TextareaWithCounter
          id="description-character-special-features"
          name="special_features"
          label="Особые признаки"
          maxLength={300}
          minRows={3}
          placeholder="Например: крылья, рога, светящиеся глаза, металлическая кожа, шерсть, чешуя, хвост, шрамы, аксессуары..."
        />
      </FormSectionCard>

      <FormSectionCard
        icon={<ProfileOutlined />}
        title="Краткое описание"
        subtitle="Коротко сформулируйте суть персонажа"
      >
        <TextareaWithCounter
          id="description-character-short-description"
          name="short_description"
          label="Описание"
          maxLength={300}
          minRows={3}
          placeholder="Например, рыжеволосая школьница с тревожным и саркастичным характером."
        />
      </FormSectionCard>
    </>
  );
}
