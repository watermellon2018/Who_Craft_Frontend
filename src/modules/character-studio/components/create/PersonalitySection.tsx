import React from 'react';
import {BookOutlined, HeartOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import FormSectionCard, {TextareaWithCounter} from './FormSectionCard';

export default function PersonalitySection() {
  const {t} = useTranslation();
  return (
    <>
      <FormSectionCard
        icon={<HeartOutlined />}
        title={t('characterStudio.create.personality.title')}
        subtitle={t('characterStudio.create.personality.subtitle')}
      >
        <TextareaWithCounter
          id="description-character-personality"
          name="personality_description"
          label={t('characterStudio.create.personality.label')}
          maxLength={500}
          minRows={4}
          placeholder={t('characterStudio.create.personality.placeholder')}
        />
      </FormSectionCard>

      <FormSectionCard
        icon={<BookOutlined />}
        title={t('characterStudio.create.backstory.title')}
        subtitle={t('characterStudio.create.backstory.subtitle')}
      >
        <TextareaWithCounter
          id="description-character-backstory"
          name="backstory"
          label={t('characterStudio.create.backstory.label')}
          maxLength={500}
          minRows={4}
          placeholder={t('characterStudio.create.backstory.placeholder')}
        />
      </FormSectionCard>
    </>
  );
}
