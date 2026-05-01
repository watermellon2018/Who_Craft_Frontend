import React from 'react';
import {IdcardOutlined} from '@ant-design/icons';
import FormSectionCard, {NumberField, SelectField, TextField, TextInputWithCounter} from './FormSectionCard';
import {characterTypeOptions, genderApplicabilityOptions} from './characterCreateOptions';

export default function BasicInformationSection() {
  return (
    <FormSectionCard
      icon={<IdcardOutlined />}
      title="Основная информация"
      subtitle="Укажите ключевые сведения о персонаже"
    >
      <TextInputWithCounter
        id="description-character-name"
        name="name"
        label="Имя персонажа"
        maxLength={80}
        placeholder="Введите имя персонажа"
        required
        rules={[{required: true, message: 'Укажите имя персонажа'}]}
      />

      <div className="description-form-grid description-form-grid--two">
        <SelectField
          id="description-character-type"
          name="character_type"
          label="Тип сущности"
          placeholder="Выберите тип сущности"
          options={characterTypeOptions}
          required
          rules={[{required: true, message: 'Выберите тип сущности'}]}
        />
        <TextField
          id="description-character-role"
          name="role"
          label="Роль"
          maxLength={120}
          placeholder="Например, главный герой, наставник, антагонист"
        />
      </div>

      <div className="description-form-grid description-form-grid--two">
        <NumberField
          id="description-character-age"
          name="age"
          label="Возраст"
          min={0}
          max={130}
          placeholder="Например: 35"
        />
        <TextField
          id="description-character-lifecycle-stage"
          name="lifecycle_stage"
          label="Стадия жизни"
          maxLength={128}
          placeholder="Например: взрослый, древний, неизвестно"
        />
      </div>

      <div className="description-form-grid description-form-grid--two">
        <SelectField
          id="description-character-gender"
          name="gender"
          label="Пол / применимость"
          allowClear
          placeholder="Выберите пол или применимость"
          options={genderApplicabilityOptions}
        />
      </div>
    </FormSectionCard>
  );
}
