import React from 'react';
import {Button, Dropdown} from 'antd';
import {ArrowLeftOutlined, MoreOutlined, SaveOutlined} from '@ant-design/icons';

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

const STEPS: {label: string; state: 'done' | 'active' | 'pending'}[] = [
  {label: 'Описание', state: 'done'},
  {label: 'Редактор', state: 'done'},
  {label: 'Референсы', state: 'active'},
  {label: '3D модель', state: 'pending'},
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
  const saveLabel = saving ? 'Сохраняем' : hasUnsavedChanges ? 'Есть изменения' : 'Сохранено';

  return (
    <>
      <div className="character-editor-title">
        <button type="button" className="character-editor-back-button" onClick={onBack}>
          <ArrowLeftOutlined />
          <span>Создание персонажа</span>
        </button>
        <div>
          <h1>{characterName}</h1>
          <div className="character-editor-save-state">
            <span />
            <strong>{saveLabel}</strong>
          </div>
        </div>
      </div>

      <ol className="references-stepper" aria-label="Шаги создания персонажа">
        {STEPS.map((step, index) => (
          <li
            key={step.label}
            className={`references-stepper__item references-stepper__item--${step.state}`}
          >
            <span className="references-stepper__index">{index + 1}</span>
            <span className="references-stepper__label">{step.label}</span>
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
          Сохранить
        </Button>
        <Button
          className="character-editor-button character-editor-button--primary"
          loading={proceedLoading}
          disabled={proceedDisabled}
          onClick={onProceed}
        >
          Перейти к 3D модели
        </Button>
        {onMenuAction && (
          <Dropdown
            menu={{
              items: [{key: 'back-to-editor', label: 'Вернуться к редактору'}],
              onClick: ({key}) => onMenuAction(key),
            }}
            trigger={['click']}
          >
            <Button className="character-editor-icon-button" icon={<MoreOutlined />} aria-label="Меню" />
          </Dropdown>
        )}
      </div>
    </>
  );
};

export default ReferencesTopBar;
