import React from 'react';
import {Form, Input, Select} from 'antd';
import {useTranslation} from 'react-i18next';

import type {ReferenceBrief, ReferenceCategory, ReferenceCategoryOption} from '../types';

const {TextArea} = Input;

function join(values?: string[]): string {
  return values?.join(', ') ?? '';
}

function split(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 20);
}

interface ReferenceBriefFormProps {
  brief: ReferenceBrief;
  categories: ReferenceCategoryOption[];
  category: ReferenceCategory;
  description: string;
  disabled?: boolean;
  tags: string[];
  title: string;
  onBriefChange: (brief: ReferenceBrief) => void;
  onCategoryChange: (category: ReferenceCategory) => void;
  onDescriptionChange: (description: string) => void;
  onTagsChange: (tags: string[]) => void;
  onTitleChange: (title: string) => void;
}

export default function ReferenceBriefForm({
  brief,
  categories,
  category,
  description,
  disabled = false,
  tags,
  title,
  onBriefChange,
  onCategoryChange,
  onDescriptionChange,
  onTagsChange,
  onTitleChange,
}: ReferenceBriefFormProps) {
  const {t} = useTranslation();
  const patchBrief = (patch: Partial<ReferenceBrief>) => onBriefChange({...brief, ...patch});

  return (
    <div className="reference-brief-form">
      <div className="reference-form-grid">
        <Form.Item label={t('referenceLibrary.form.title')} required>
          <Input
            disabled={disabled}
            maxLength={255}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </Form.Item>
        <Form.Item label={t('referenceLibrary.form.category')} required>
          <Select
            disabled={disabled}
            value={category}
            options={categories.map((option) => ({label: option.label, value: option.key}))}
            onChange={onCategoryChange}
          />
        </Form.Item>
        <Form.Item className="reference-form-grid__wide" label={t('referenceLibrary.form.description')}>
          <TextArea
            disabled={disabled}
            maxLength={4000}
            rows={4}
            showCount
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </Form.Item>
        <Form.Item label={t('referenceLibrary.form.materials')}>
          <Input
            disabled={disabled}
            value={join(brief.materials)}
            onChange={(event) => patchBrief({materials: split(event.target.value)})}
          />
        </Form.Item>
        <Form.Item label={t('referenceLibrary.form.palette')}>
          <Input
            disabled={disabled}
            value={join(brief.palette)}
            onChange={(event) => patchBrief({palette: split(event.target.value)})}
          />
        </Form.Item>
        <Form.Item label={t('referenceLibrary.form.condition')}>
          <Input
            disabled={disabled}
            maxLength={100}
            value={brief.condition ?? ''}
            onChange={(event) => patchBrief({condition: event.target.value})}
          />
        </Form.Item>
        <Form.Item label={t('referenceLibrary.form.scale')}>
          <Input
            disabled={disabled}
            maxLength={100}
            value={brief.dimensions ?? ''}
            onChange={(event) => patchBrief({dimensions: event.target.value})}
          />
        </Form.Item>
        <Form.Item className="reference-form-grid__wide" label={t('referenceLibrary.form.features')}>
          <Input
            disabled={disabled}
            value={join(brief.distinctiveFeatures)}
            onChange={(event) => patchBrief({distinctiveFeatures: split(event.target.value)})}
          />
        </Form.Item>
        <Form.Item className="reference-form-grid__wide" label={t('referenceLibrary.form.continuity')}>
          <TextArea
            disabled={disabled}
            maxLength={2000}
            rows={3}
            value={brief.continuityNotes ?? ''}
            onChange={(event) => patchBrief({continuityNotes: event.target.value})}
          />
        </Form.Item>
        <Form.Item className="reference-form-grid__wide" label={t('referenceLibrary.form.tags')}>
          <Input
            disabled={disabled}
            value={join(tags)}
            onChange={(event) => onTagsChange(split(event.target.value))}
          />
        </Form.Item>
      </div>
    </div>
  );
}
