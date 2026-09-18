import React from 'react';
import {IdcardOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import FormSectionCard, {NumberField, SelectField, TextField, TextInputWithCounter} from './FormSectionCard';
import {getCharacterTypeOptions, getGenderApplicabilityOptions, getRoleOptions} from './characterCreateOptions';

export default function BasicInformationSection() {
  const {t} = useTranslation();
  return (
    <FormSectionCard
      icon={<IdcardOutlined />}
      title={t('characterStudio.create.basicInfo.title')}
      subtitle={t('characterStudio.create.basicInfo.subtitle')}
    >
      <TextInputWithCounter
        id="description-character-name"
        name="name"
        label={t('characterStudio.create.basicInfo.name')}
        maxLength={80}
        placeholder={t('characterStudio.create.basicInfo.namePlaceholder')}
        required
        rules={[{required: true, message: t('characterStudio.create.basicInfo.nameRequired')}]}
      />

      <div className="description-form-grid description-form-grid--two">
        <SelectField
          id="description-character-type"
          name="character_type"
          label={t('characterStudio.create.basicInfo.type')}
          placeholder={t('characterStudio.create.basicInfo.typePlaceholder')}
          options={getCharacterTypeOptions(t)}
          required
          rules={[{required: true, message: t('characterStudio.create.basicInfo.typeRequired')}]}
        />
        <SelectField
          id="description-character-role"
          name="role"
          label={t('characterStudio.create.basicInfo.role')}
          placeholder={t('characterStudio.create.basicInfo.rolePlaceholder')}
          options={getRoleOptions(t)}
        />
      </div>

      <div className="description-form-grid description-form-grid--two">
        <NumberField
          id="description-character-age"
          name="age"
          label={t('characterStudio.create.basicInfo.age')}
          min={0}
          max={130}
          placeholder={t('characterStudio.create.basicInfo.agePlaceholder')}
        />
        <TextField
          id="description-character-lifecycle-stage"
          name="lifecycle_stage"
          label={t('characterStudio.create.basicInfo.lifecycle')}
          maxLength={128}
          placeholder={t('characterStudio.create.basicInfo.lifecyclePlaceholder')}
        />
      </div>

      <div className="description-form-grid description-form-grid--two">
        <SelectField
          id="description-character-gender"
          name="gender"
          label={t('characterStudio.create.basicInfo.gender')}
          allowClear
          placeholder={t('characterStudio.create.basicInfo.genderPlaceholder')}
          options={getGenderApplicabilityOptions(t)}
        />
      </div>
    </FormSectionCard>
  );
}
