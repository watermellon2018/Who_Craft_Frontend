import {SaveOutlined} from '@ant-design/icons';
import {Button, Input} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

interface VisualReferenceHeaderProps {
  canSave: boolean;
  disabled: boolean;
  saving: boolean;
  title: string;
  onSave: () => void;
  onTitleChange: (value: string) => void;
}

export default function VisualReferenceHeader({
  canSave,
  disabled,
  saving,
  title,
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
      </div>
      <div className="visual-reference-header__actions">
        <Button
          type="primary"
          icon={<SaveOutlined />}
          aria-label={t('referenceLibrary.editor.actions.save')}
          disabled={!canSave}
          loading={saving}
          onClick={onSave}
        >
          {t('referenceLibrary.editor.actions.save')}
        </Button>
      </div>
    </header>
  );
}
