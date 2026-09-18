import React from 'react';
import {Button} from 'antd';
import {
  CloudUploadOutlined,
  DownloadOutlined,
  ExpandOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {CharacterReference, REFERENCE_TYPE_ORDER} from '../../types/character.types';
import {REFERENCE_LABEL_KEYS, STATUS_LABEL_KEYS} from './referenceLabels';
import {isRequiredReferenceType} from './referenceReadiness';

interface Props {
  reference: CharacterReference;
  identityLocked: boolean;
  autoGenerationActive: boolean;
  requiredReadyCount: number;
  requiredTotal: number;
  onDownload: () => void;
  onOpen: () => void;
  onCompare: () => void;
  onGenerate: () => void;
  onUpload: () => void;
  onRetry: () => void;
}


const ReferencePreviewPanel: React.FC<Props> = ({
  reference,
  identityLocked,
  autoGenerationActive,
  requiredReadyCount,
  requiredTotal,
  onDownload,
  onOpen,
  onCompare,
  onGenerate,
  onUpload,
  onRetry,
}) => {
  const {t} = useTranslation();
  const labelKeys = REFERENCE_LABEL_KEYS[reference.reference_type];
  const title = t(labelKeys.title);
  const index = REFERENCE_TYPE_ORDER.indexOf(reference.reference_type) + 1;
  const total = REFERENCE_TYPE_ORDER.length;
  const isReady = reference.status === 'ready' && Boolean(reference.image_url);
  const isRequiredType = isRequiredReferenceType(reference.reference_type);
  // While the batch trigger is in flight, a required-but-still-`missing`
  // reference is conceptually about to become `generating` — render the
  // generating state immediately so the UI doesn't flash an empty CTA.
  const showAutoPending =
    reference.status === 'missing' && autoGenerationActive && isRequiredType;

  return (
    <div className="character-preview references-preview">
      <div className="character-preview-stage references-stage">
        {isReady ? (
          <div className="character-preview-subject">
            <img src={reference.image_url || undefined} alt={title} />
          </div>
        ) : reference.status === 'generating' || showAutoPending ? (
          <div className="character-preview-generating">
            <div className="character-preview-generating__spinner" />
            <h3>{t('characterStudio.references.generatingTitle', {label: title.toLocaleLowerCase()})}</h3>
            <p>
              {isRequiredType
                ? t('characterStudio.references.generatingRequiredHint')
                : t('characterStudio.references.generatingOptionalHint')}
            </p>
            {isRequiredType && requiredTotal > 0 ? (
              <>
                <div className="character-preview-generating__progress">
                  <div
                    className="character-preview-generating__progress-bar"
                    style={{width: `${Math.min(100, Math.round((requiredReadyCount / requiredTotal) * 100))}%`}}
                  />
                </div>
                <span className="character-preview-generating__progress-label">
                  {t('characterStudio.references.requiredProgress', {ready: requiredReadyCount, total: requiredTotal})}
                </span>
              </>
            ) : (
              <div className="character-preview-generating__progress">
                <div className="character-preview-generating__progress-bar character-preview-generating__progress-bar--indeterminate" />
              </div>
            )}
          </div>
        ) : reference.status === 'failed' ? (
          <div className="character-preview-failed">
            <div className="character-preview-failed__icon">!</div>
            <h3>{t('characterStudio.references.generationFailed')}</h3>
            <p>{reference.error_message || t('characterStudio.references.generationFailedHint')}</p>
            <button type="button" className="character-preview-failed__retry" onClick={onRetry}>
              {t('characterStudio.references.retryGeneration')}
            </button>
          </div>
        ) : (
          <div className="character-preview-empty">
            <div className="character-preview-empty__silhouette" />
            <h3>{t('characterStudio.references.notCreated')}</h3>
            <p>
              {isRequiredType
                ? t('characterStudio.references.requiredMissingHint')
                : t('characterStudio.references.optionalMissingHint')}
            </p>
            <div className="character-preview-empty__actions">
              <button type="button" onClick={onGenerate}>{t('characterStudio.references.generateAngle')}</button>
            </div>
          </div>
        )}

        {isReady && (
          <div className="references-stage__actions">
            <Button size="small" icon={<DownloadOutlined />} onClick={onDownload}>{t('characterStudio.references.download')}</Button>
            <Button size="small" icon={<ExpandOutlined />} onClick={onOpen}>{t('characterStudio.references.open')}</Button>
            <Button size="small" icon={<SwapOutlined />} onClick={onCompare}>{t('characterStudio.references.compare')}</Button>
          </div>
        )}

        {isReady && reference.is_primary && (
          <div className="references-stage__primary">{t('characterStudio.references.primaryLabel')}</div>
        )}

        {/* Index pinned to the top-left so it never collides with the
            centered empty/generating CTA. The actual status badge lives
            in the top-right corner; both decorative, both pointer-events:none. */}
        <div className="references-stage__index">
          <span>{index} / {total}</span>
          <em>·</em>
          <span>{title}</span>
        </div>

        <div className={`references-stage__status-badge references-stage__status-badge--${reference.status}`}>
          {t(STATUS_LABEL_KEYS[reference.status])}
          {reference.source && reference.status === 'ready' && (
            <>
              <em>·</em>
              <span>{reference.source === 'uploaded'
                ? t('characterStudio.references.sourceUploaded')
                : t('characterStudio.references.sourceGenerated')}</span>
            </>
          )}
        </div>

        {identityLocked && (
          <div className="references-stage__identity-lock">Identity Lock</div>
        )}
      </div>

      {isReady && (
        <div className="references-stage__quick-row">
          <Button size="small" icon={<ReloadOutlined />} onClick={onGenerate}>
            {t('characterStudio.references.regenerate')}
          </Button>
          <Button size="small" icon={<CloudUploadOutlined />} onClick={onUpload}>
            {t('characterStudio.references.uploadAction')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReferencePreviewPanel;
