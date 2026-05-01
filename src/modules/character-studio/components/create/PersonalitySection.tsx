import React from 'react';
import {BookOutlined, HeartOutlined} from '@ant-design/icons';
import FormSectionCard, {TextareaWithCounter} from './FormSectionCard';

export default function PersonalitySection() {
  return (
    <>
      <FormSectionCard
        icon={<HeartOutlined />}
        title="Характер"
        subtitle="Опишите внутренний мир персонажа"
      >
        <TextareaWithCounter
          id="description-character-personality"
          name="personality_description"
          label="Черты характера"
          maxLength={500}
          minRows={4}
          placeholder="Например, саркастичная, тревожная, наблюдательная. Хочет казаться сильнее, чем чувствует себя на самом деле."
        />
      </FormSectionCard>

      <FormSectionCard
        icon={<BookOutlined />}
        title="Предыстория"
        subtitle="Добавьте прошлое и важные события"
      >
        <TextareaWithCounter
          id="description-character-backstory"
          name="backstory"
          label="Предыстория, опционально"
          maxLength={500}
          minRows={4}
          placeholder="Например, выросла в маленьком городе, потеряла старшую сестру, с трудом доверяет людям..."
        />
      </FormSectionCard>
    </>
  );
}
