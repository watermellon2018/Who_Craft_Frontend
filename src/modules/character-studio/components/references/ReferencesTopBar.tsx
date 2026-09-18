import React from 'react';
import {Button, Dropdown} from 'antd';
import {ArrowLeftOutlined, MoreOutlined, SaveOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

interface Props {
  characterName: string;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  hasUnsavedChanges?: boolean;
  onProceed: () => void;
  proceedDisabled: boolean;
  proceedLoading: boolean;
  onMenuAction?: (key: string) => void;
}

const STEPS: {labelKey: string; state: 'done' | 'active' | 'pending'}[] = [
  {labelKey: 'characterStudio.references.stepper.description', state: 'done'},
  {labelKey: 'characterStudio.references.stepper.editor', state: 'done'},
  {labelKey: 'characterStudio.references.stepper.references', state: 'active'},
  {labelKey: 'characterStudio.references.stepper.model3d', state: 'pending'},
];

const ReferencesTopBar: React.FC<Props> = ({
  characterName,
  onBack,
  onSave,
  saving,
  hasUnsavedChanges,
  onProceed,
  proceedDisabled,
  proceedLoading,
  onMenuAction,
}) => {
  const {t} = useTranslation();
  const saveLabel = saving
    ? t('characterStudio.editor.saving')
    : hasUnsavedChanges
      ? t('characterStudio.editor.edited')
      : t('characterStudio.editor.saved');

  return (
    <>
      <div className="character-editor-title">
        <button type="button" className="character-editor-back-button" onClick={onBack}>
          <ArrowLeftOutlined />
          <span>{t('characterStudio.references.creationTitle')}</span>
        </button>
        <div>
          <h1>{characterName}</h1>
          <div className="character-editor-save-state">
            <span />
            <strong>{saveLabel}</strong>
          </div>
        </div>
      </div>

      <ol className="references-stepper" aria-label={t('characterStudio.references.stepper.title')}>
        {STEPS.map((step, index) => (
          <li
            key={step.labelKey}
            className={`references-stepper__item references-stepper__item--${step.state}`}
          >
            <span className="references-stepper__index">{index + 1}</span>
            <span className="references-stepper__label">{t(step.labelKey)}</span>
          </li>
        ))}
      </ol>

      <div className="character-editor-actions">
        <Button
          className="character-editor-button character-editor-button--outline"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={onSave}
        >
          {t('characterStudio.references.save')}
        </Button>
        <Button
          className="character-editor-button character-editor-button--primary"
          loading={proceedLoading}
          disabled={proceedDisabled}
          onClick={onProceed}
        >
          {t('characterStudio.references.proceed')}
        </Button>
        {onMenuAction && (
          <Dropdown
            menu={{
              items: [{key: 'back-to-editor', label: t('characterStudio.references.backToEditor')}],
              onClick: ({key}) => onMenuAction(key),
            }}
            trigger={['click']}
          >
            <Button className="character-editor-icon-button" icon={<MoreOutlined />} aria-label={t('characterStudio.references.menu')} />
          </Dropdown>
        )}
      </div>
    </>
  );
};

export default ReferencesTopBar;
