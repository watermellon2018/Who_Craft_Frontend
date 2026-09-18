import React from 'react';
import {EyeOutlined, ProfileOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import FormSectionCard, {TextareaWithCounter, TextField} from './FormSectionCard';

export default function AppearanceDescriptionSection() {
  const {t} = useTranslation();
  return (
    <>
      <FormSectionCard
        icon={<EyeOutlined />}
        title={t('characterStudio.create.appearance.title')}
        subtitle={t('characterStudio.create.appearance.subtitle')}
      >
        <TextareaWithCounter
          id="description-character-appearance"
          name="appearance_description"
          label={t('characterStudio.create.appearance.label')}
          maxLength={500}
          minRows={4}
          placeholder={t('characterStudio.create.appearance.placeholder')}
          required
          rules={[{required: true, message: t('characterStudio.create.appearance.required')}]}
        />

        <div className="description-form-grid description-form-grid--two">
          <TextField
            id="description-character-body-structure"
            name="body_structure"
            label={t('characterStudio.create.appearance.bodyStructure')}
            maxLength={128}
            placeholder={t('characterStudio.create.appearance.bodyStructurePlaceholder')}
          />
          <TextField
            id="description-character-surface-material"
            name="surface_material"
            label={t('characterStudio.create.appearance.surfaceMaterial')}
            maxLength={128}
            placeholder={t('characterStudio.create.appearance.surfaceMaterialPlaceholder')}
          />
        </div>

        <TextareaWithCounter
          id="description-character-special-features"
          name="special_features"
          label={t('characterStudio.create.appearance.specialFeatures')}
          maxLength={300}
          minRows={3}
          placeholder={t('characterStudio.create.appearance.specialFeaturesPlaceholder')}
        />
      </FormSectionCard>

      <FormSectionCard
        icon={<ProfileOutlined />}
        title={t('characterStudio.create.shortDescription.title')}
        subtitle={t('characterStudio.create.shortDescription.subtitle')}
      >
        <TextareaWithCounter
          id="description-character-short-description"
          name="short_description"
          label={t('characterStudio.create.shortDescription.label')}
          maxLength={300}
          minRows={3}
          placeholder={t('characterStudio.create.shortDescription.placeholder')}
        />
      </FormSectionCard>
    </>
  );
}
