import React from 'react';
import {Button, Checkbox, Tooltip} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleOutlined,
  CloudUploadOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  ReloadOutlined,
  StarOutlined,
} from '@ant-design/icons';
import {CharacterReference, ReferencesChecklist, ReferenceType} from '../../types/character.types';
import {REFERENCE_LABELS, describeBlockers} from './referenceLabels';

interface Props {
  references: CharacterReference[];
  selected: CharacterReference;
  checklist: ReferencesChecklist;
  onChecklistChange: (patch: Partial<ReferencesChecklist>) => void;
  blockers: string[];
  canProceed: boolean;
  isGenerating: boolean;
  autoGenerationActive: boolean;
  onRegenerate: () => void;
  onCorrect: () => void;
  onUpload: () => void;
  onMakePrimary: () => void;
  onBackToEditor: () => void;
}

const REQUIRED_TYPES: ReferenceType[] = ['portrait', 'full_body', 'profile', 'back_view'];

function statusIcon(status: CharacterReference['status']) {
  if (status === 'ready') return <CheckCircleFilled className="references-required__icon references-required__icon--ok" />;
  if (status === 'generating') return <LoadingOutlined spin className="references-required__icon references-required__icon--gen" />;
  if (status === 'failed') return <ExclamationCircleFilled className="references-required__icon references-required__icon--err" />;
  return <CloseCircleOutlined className="references-required__icon references-required__icon--miss" />;
}

const ReferenceRightPanel: React.FC<Props> = ({
  references,
  selected,
  checklist,
  onChecklistChange,
  blockers,
  canProceed,
  isGenerating,
  autoGenerationActive,
  onRegenerate,
  onCorrect,
  onUpload,
  onMakePrimary,
  onBackToEditor,
}) => {
  const blockerText = describeBlockers(blockers);
  const hasReadyAsset = selected.status === 'ready' && Boolean(selected.asset_id);

  // For the side requirement we surface either profile or three_quarter,
  // whichever is the most advanced.
  const profileRow = references.find((r) => r.reference_type === 'profile');
  const tqRow = references.find((r) => r.reference_type === 'three_quarter');
  const sideRow: CharacterReference = (() => {
    if (profileRow?.status === 'ready') return profileRow;
    if (tqRow?.status === 'ready') return tqRow;
    if (profileRow?.status === 'generating') return profileRow;
    if (tqRow?.status === 'generating') return tqRow;
    return profileRow || tqRow || {
      reference_type: 'profile', status: 'missing', asset_id: null, image_url: null,
      is_primary: false, version: 0, source: null,
    };
  })();

  const requiredRows: {label: string; row: CharacterReference}[] = REQUIRED_TYPES.map((type) => {
    if (type === 'profile') {
      return {label: 'Профиль или 3/4', row: sideRow};
    }
    return {
      label: REFERENCE_LABELS[type].title,
      row:
        references.find((r) => r.reference_type === type) || {
          reference_type: type,
          status: 'missing',
          asset_id: null,
          image_url: null,
          is_primary: false,
          version: 0,
          source: null,
        },
    };
  });

  const userItems: {key: keyof ReferencesChecklist; label: string}[] = [
    {key: 'appearance_stable', label: 'Внешность стабильна'},
    {key: 'face_matches_base', label: 'Лицо совпадает с базовым портретом'},
    {key: 'outfit_readable', label: 'Одежда читается'},
    {key: 'suitable_for_3d', label: 'Референсы подходят для 3D-модели'},
  ];

  const readyCount = requiredRows.filter(({row}) => row.status === 'ready').length;
  const generatingCount = requiredRows.filter(({row}) => row.status === 'generating').length;
  const failedCount = requiredRows.filter(({row}) => row.status === 'failed').length;
  const totalRequired = requiredRows.length;
  const allRequiredReady = readyCount === totalRequired;

  return (
    <section className="character-settings-panel references-side">
      <div className="character-settings-panel__header">
        <p>КОНТЕКСТНАЯ ПАНЕЛЬ</p>
        <h2>Проверка перед 3D</h2>
      </div>

      <div className="character-settings-panel__body">
        <p className="character-section-description">
          Убедитесь, что основные ракурсы готовы и персонаж выглядит стабильно.
        </p>

        <div className="character-settings-section character-settings-section--primary">
          <div className="references-required__header">
            <h3>Обязательные ракурсы</h3>
            <span className="references-required__progress">
              {readyCount} / {totalRequired} готово
            </span>
          </div>
          {(autoGenerationActive || generatingCount > 0) && !allRequiredReady && (
            <p className="references-auto-banner">
              Референсы готовятся автоматически. Это нужно для подготовки персонажа к 3D модели.
            </p>
          )}
          {failedCount > 0 && (
            <p className="references-failed-banner">
              Некоторые референсы не удалось создать. Их можно повторить вручную.
            </p>
          )}
          <ul className="references-required">
            {requiredRows.map(({label, row}) => (
              <li key={label} className="references-required__row">
                {statusIcon(row.status)}
                <span className="references-required__label">{label}</span>
                <span className={`references-required__status references-required__status--${row.status}`}>
                  {row.status === 'ready' && 'Готово'}
                  {row.status === 'generating' && 'Генерируется'}
                  {row.status === 'failed' && 'Ошибка'}
                  {row.status === 'missing' && 'Не создано'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="character-settings-section">
          <h3>Проверка качества</h3>
          <div className="references-quality-checklist">
            {userItems.map((item) => (
              <Checkbox
                key={item.key}
                checked={Boolean(checklist[item.key])}
                onChange={(event) =>
                  onChecklistChange({[item.key]: event.target.checked} as Partial<ReferencesChecklist>)
                }
              >
                {item.label}
              </Checkbox>
            ))}
          </div>
        </div>

        <div className="character-settings-section">
          <h3>Действия</h3>
          <div className="references-actions">
            <Button
              className="character-editor-button character-editor-button--outline"
              icon={<ReloadOutlined />}
              block
              onClick={onRegenerate}
              disabled={isGenerating}
            >
              Перегенерировать выбранный ракурс
            </Button>
            <Button
              className="character-editor-button character-editor-button--outline"
              icon={<EditOutlined />}
              block
              onClick={onCorrect}
              disabled={!hasReadyAsset || isGenerating}
            >
              Исправить через текст
            </Button>
            <Button
              className="character-editor-button character-editor-button--outline"
              icon={<CloudUploadOutlined />}
              block
              onClick={onUpload}
              disabled={isGenerating}
            >
              Заменить изображение
            </Button>
            <Tooltip title={selected.is_primary ? 'Этот ракурс уже основной.' : ''}>
              <Button
                className="character-editor-button character-editor-button--outline"
                icon={<StarOutlined />}
                block
                onClick={onMakePrimary}
                disabled={!hasReadyAsset || selected.is_primary}
              >
                {selected.is_primary ? 'Уже основной референс' : 'Пометить как основной референс'}
              </Button>
            </Tooltip>
          </div>
        </div>

        {!canProceed && (
          <div className="references-blockers">
            {generatingCount > 0 && readyCount + generatingCount === totalRequired && failedCount === 0 ? (
              'Референсы готовятся автоматически. Переход к 3D станет доступен после завершения генерации.'
            ) : blockerText}
          </div>
        )}

        <div className="character-settings-section references-bottom-actions">
          <Button
            className="character-editor-button character-editor-button--outline"
            block
            onClick={onBackToEditor}
          >
            Вернуться к редактору
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ReferenceRightPanel;
