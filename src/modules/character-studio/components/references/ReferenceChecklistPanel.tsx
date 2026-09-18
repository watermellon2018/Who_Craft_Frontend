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
import {useTranslation} from 'react-i18next';
import {CharacterReference, ReferencesChecklist} from '../../types/character.types';
import {REFERENCE_LABEL_KEYS, STATUS_LABEL_KEYS, describeBlockers} from './referenceLabels';
import {REQUIRED_REFERENCE_TYPES_FOR_3D} from './referenceReadiness';

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
  const {t} = useTranslation();
  const blockerText = describeBlockers(blockers, t);
  const hasReadyAsset = selected.status === 'ready' && Boolean(selected.asset_id);

  const requiredRows: {label: string; row: CharacterReference}[] = REQUIRED_REFERENCE_TYPES_FOR_3D.map((type) => {
    return {
      label: t(REFERENCE_LABEL_KEYS[type].title),
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
    {key: 'appearance_stable', label: t('characterStudio.references.appearance')},
    {key: 'face_matches_base', label: t('characterStudio.references.faceMatch')},
    {key: 'outfit_readable', label: t('characterStudio.references.outfitReadable')},
    {key: 'suitable_for_3d', label: t('characterStudio.references.suitable3d')},
  ];

  const readyCount = requiredRows.filter(({row}) => row.status === 'ready').length;
  const generatingCount = requiredRows.filter(({row}) => row.status === 'generating').length;
  const failedCount = requiredRows.filter(({row}) => row.status === 'failed').length;
  const totalRequired = requiredRows.length;
  const allRequiredReady = readyCount === totalRequired;

  return (
    <section className="character-settings-panel references-side">
      <div className="character-settings-panel__header">
        <p>{t('characterStudio.references.contextPanelLabel')}</p>
        <h2>{t('characterStudio.references.checklistTitle')}</h2>
      </div>

      <div className="character-settings-panel__body">
        <div className="character-settings-section">
          <h3>{t('characterStudio.references.qualityCheck')}</h3>
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

        <div className="character-settings-section character-settings-section--primary">
          <div className="references-required__header">
            <h3>{t('characterStudio.references.requiredAngles')}</h3>
            <span className="references-required__progress">
              {t('characterStudio.references.progress', {ready: readyCount, total: totalRequired})}
            </span>
          </div>
          {(autoGenerationActive || generatingCount > 0) && !allRequiredReady && (
            <p className="references-auto-banner">
              {t('characterStudio.references.autoBanner')}
            </p>
          )}
          {failedCount > 0 && (
            <p className="references-failed-banner">
              {t('characterStudio.references.failedBanner')}
            </p>
          )}
          <ul className="references-required">
            {requiredRows.map(({label, row}) => (
              <li key={label} className="references-required__row">
                {statusIcon(row.status)}
                <span className="references-required__label">{label}</span>
                <span className={`references-required__status references-required__status--${row.status}`}>
                  {t(STATUS_LABEL_KEYS[row.status])}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="character-settings-section">
          <h3>{t('characterStudio.references.actions')}</h3>
          <div className="references-actions">
            <Button
              className="character-editor-button character-editor-button--outline"
              icon={<ReloadOutlined />}
              block
              onClick={onRegenerate}
              disabled={isGenerating}
            >
              {t('characterStudio.references.regenerateAction')}
            </Button>
            <Button
              className="character-editor-button character-editor-button--outline"
              icon={<EditOutlined />}
              block
              onClick={onCorrect}
              disabled={!hasReadyAsset || isGenerating}
            >
              {t('characterStudio.references.correctAction')}
            </Button>
            <Button
              className="character-editor-button character-editor-button--outline"
              icon={<CloudUploadOutlined />}
              block
              onClick={onUpload}
              disabled={isGenerating}
            >
              {t('characterStudio.references.uploadAction')}
            </Button>
            <Tooltip title={selected.is_primary ? t('characterStudio.references.alreadyPrimaryTooltip') : ''}>
              <Button
                className="character-editor-button character-editor-button--outline"
                icon={<StarOutlined />}
                block
                onClick={onMakePrimary}
                disabled={!hasReadyAsset || selected.is_primary}
              >
                {selected.is_primary
                  ? t('characterStudio.references.alreadyPrimary')
                  : t('characterStudio.references.makePrimaryAction')}
              </Button>
            </Tooltip>
          </div>
        </div>

        {!canProceed && (
          <div className="references-blockers">
            {generatingCount > 0 && readyCount + generatingCount === totalRequired && failedCount === 0 ? (
              t('characterStudio.references.blockersAutoGen')
            ) : blockerText}
          </div>
        )}

        <div className="character-settings-section references-bottom-actions">
          <Button
            className="character-editor-button character-editor-button--outline"
            block
            onClick={onBackToEditor}
          >
            {t('characterStudio.references.backToEditor')}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ReferenceRightPanel;
