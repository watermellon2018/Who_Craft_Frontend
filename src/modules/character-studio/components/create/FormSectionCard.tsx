import React from 'react';
import {Form, Input, InputNumber, Select} from 'antd';
import type {Rule} from 'antd/es/form';

type FieldName = string | number | (string | number)[];

interface FormSectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  helperText?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}

interface TextInputWithCounterProps {
  id: string;
  label: string;
  maxLength: number;
  name: FieldName;
  placeholder: string;
  required?: boolean;
  rules?: Rule[];
}

interface TextFieldProps {
  id: string;
  label: string;
  maxLength?: number;
  name: FieldName;
  placeholder: string;
}

interface TextareaWithCounterProps {
  id: string;
  label: string;
  maxLength: number;
  minRows?: number;
  name: FieldName;
  placeholder: string;
  required?: boolean;
  rules?: Rule[];
}

interface NumberFieldProps {
  id: string;
  label: string;
  max?: number;
  min?: number;
  name: FieldName;
  placeholder: string;
}

interface SelectFieldProps {
  allowClear?: boolean;
  id: string;
  label: string;
  name: FieldName;
  options: Array<{value: string; label: string}>;
  placeholder: string;
  required?: boolean;
  rules?: Rule[];
  value?: string;
  onChange?: (value: string) => void;
}

function getValueLength(value: unknown) {
  return typeof value === 'string' ? value.length : 0;
}

export default function FormSectionCard({icon, title, subtitle, children}: FormSectionCardProps) {
  return (
    <section className="character-create-section">
      <div className="character-create-section__header">
        <span className="character-create-section__icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="character-create-section__content">
        {children}
      </div>
    </section>
  );
}

export function FormField({children, error, helperText, htmlFor, label, required}: FormFieldProps) {
  return (
    <div className="description-form-field">
      <label className="description-form-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="description-form-field__error">{error}</p>}
      {!error && helperText && <p className="description-form-field__helper">{helperText}</p>}
    </div>
  );
}

export function TextInputWithCounter({
  id,
  label,
  maxLength,
  name,
  placeholder,
  required,
  rules,
}: TextInputWithCounterProps) {
  const form = Form.useFormInstance();

  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const value = form.getFieldValue(name);
        const error = form.getFieldError(name)[0];

        return (
          <FormField htmlFor={id} label={label} required={required} error={error}>
            <div className={`description-counter-input ${error ? 'description-counter-input--error' : ''}`}>
              <Form.Item name={name} rules={rules} noStyle validateTrigger="onBlur">
                <Input
                  id={id}
                  aria-invalid={Boolean(error)}
                  maxLength={maxLength}
                  placeholder={placeholder}
                />
              </Form.Item>
              <span className="description-counter-input__counter">
                {getValueLength(value)} / {maxLength}
              </span>
            </div>
          </FormField>
        );
      }}
    </Form.Item>
  );
}

export function TextField({id, label, maxLength, name, placeholder}: TextFieldProps) {
  return (
    <FormField htmlFor={id} label={label}>
      <Form.Item name={name} noStyle>
        <Input
          id={id}
          className="description-form-control"
          maxLength={maxLength}
          placeholder={placeholder}
        />
      </Form.Item>
    </FormField>
  );
}

export function TextareaWithCounter({
  id,
  label,
  maxLength,
  minRows = 4,
  name,
  placeholder,
  required,
  rules,
}: TextareaWithCounterProps) {
  const form = Form.useFormInstance();

  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const value = form.getFieldValue(name);
        const error = form.getFieldError(name)[0];

        return (
          <FormField htmlFor={id} label={label} required={required} error={error}>
            <Form.Item name={name} rules={rules} noStyle validateTrigger="onBlur">
              <Input.TextArea
                id={id}
                aria-invalid={Boolean(error)}
                className="description-textarea"
                maxLength={maxLength}
                placeholder={placeholder}
                rows={minRows}
              />
            </Form.Item>
            <div className="description-textarea-counter">
              {getValueLength(value)} / {maxLength}
            </div>
          </FormField>
        );
      }}
    </Form.Item>
  );
}

export function NumberField({id, label, max, min, name, placeholder}: NumberFieldProps) {
  return (
    <FormField htmlFor={id} label={label}>
      <Form.Item name={name} noStyle>
        <InputNumber
          id={id}
          className="description-form-control"
          min={min}
          max={max}
          placeholder={placeholder}
        />
      </Form.Item>
    </FormField>
  );
}

export function SelectField({
  allowClear,
  id,
  label,
  name,
  options,
  placeholder,
  required,
  rules,
  value,
  onChange,
}: SelectFieldProps) {
  const form = Form.useFormInstance();

  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const error = form.getFieldError(name)[0];

        return (
          <FormField htmlFor={id} label={label} required={required} error={error}>
            <Form.Item name={name} rules={rules} noStyle validateTrigger="onBlur">
        <Select
          id={id}
          className="description-form-control"
          allowClear={allowClear}
          placeholder={placeholder}
          options={options}
          value={value}
          onChange={onChange}
          popupClassName="character-studio-dropdown"
        />
            </Form.Item>
          </FormField>
        );
      }}
    </Form.Item>
  );
}
