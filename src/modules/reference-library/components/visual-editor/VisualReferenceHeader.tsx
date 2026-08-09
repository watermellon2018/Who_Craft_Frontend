import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {Button, Input, Tag} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

interface VisualReferenceHeaderProps {
  canCreate: boolean;
  canSave: boolean;
  creating: boolean;
  disabled: boolean;
  dirty: boolean;
  saving: boolean;
  title: string;
  onCreate: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
}

export default function VisualReferenceHeader({
  canCreate,
  canSave,
  creating,
  disabled,
  dirty,
  saving,
  title,
  onCreate,
  onSave,
  onTitleChange,
}: VisualReferenceHeaderProps) {
  const {t} = useTranslation();

  return (
    <header className="visual-reference-header">
      <div className="visual-reference-header__identity">
        <Input
          aria-label={t('referenceLibrary.editor.headerTitle')}
          className="visual-reference-header__title"
          maxLength={255}
          placeholder={t('referenceLibrary.editor.newTitle')}
          disabled={disabled}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <div className="visual-reference-header__status">
          <Tag className="visual-reference-header__draft">
            {t('referenceLibrary.editor.draft')}
          </Tag>
          <span className={dirty ? 'is-dirty' : ''}>
            {dirty ? <ClockCircleOutlined /> : <CheckCircleOutlined />}
            {t(dirty
              ? 'referenceLibrary.editor.unsaved'
              : 'referenceLibrary.editor.savedLocally')}
          </span>
        </div>
      </div>
      <div className="visual-reference-header__actions">
        <Button
          icon={<SaveOutlined />}
          disabled={!canSave}
          loading={saving}
          onClick={onSave}
        >
          {t('referenceLibrary.editor.actions.save')}
        </Button>
        <Button
          type="primary"
          disabled={!canCreate}
          loading={creating}
          onClick={onCreate}
        >
          {t('referenceLibrary.editor.actions.create')}
        </Button>
      </div>
    </header>
  );
}
