import {SaveOutlined} from '@ant-design/icons';
import {Button, Input, Tooltip} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

interface VisualReferenceHeaderProps {
  canSave: boolean;
  disabled: boolean;
  saveDisabledReason?: string;
  saving: boolean;
  title: string;
  onSave: () => void;
  onTitleChange: (value: string) => void;
}

export default function VisualReferenceHeader({
  canSave,
  disabled,
  saveDisabledReason,
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
        <Tooltip
          rootClassName="visual-reference-tooltip"
          title={saveDisabledReason}
        >
          <span
            className="visual-reference-header__save-wrap"
            aria-label={saveDisabledReason}
            tabIndex={saveDisabledReason ? 0 : undefined}
          >
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
          </span>
        </Tooltip>
      </div>
    </header>
  );
}
