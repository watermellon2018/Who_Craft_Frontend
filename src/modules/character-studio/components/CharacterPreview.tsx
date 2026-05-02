import React, {useEffect, useState} from 'react';
import {Image} from 'antd';

import {CharacterImageType, CharacterVariant, CharacterViewMode, StudioCharacter} from '../types/character.types';
import {AssetJobsMap, AssetJobStatus} from '../hooks/useCharacterAssetJobs';

interface Props {
  character?: StudioCharacter | null;
  selectedVariant?: CharacterVariant | null;
  activeViewMode: CharacterViewMode;
  onViewModeChange: (value: CharacterViewMode) => void;
  onGenerateImage: () => void;
  generatingImageType?: CharacterImageType | null;
  jobProgress?: number;
  secondaryJobs?: AssetJobsMap;
  onRetrySecondary?: (type: CharacterImageType) => void;
}

const viewTabs: Array<{label: string; value: CharacterViewMode}> = [
  {label: 'Портрет', value: 'portrait'},
  {label: 'Полный рост', value: 'fullBody'},
  {label: 'Сцена', value: 'scene'},
  {label: 'Ракурсы', value: 'sheet'},
];


export default function CharacterPreview({character, selectedVariant, activeViewMode, onViewModeChange, onGenerateImage, generatingImageType, jobProgress, secondaryJobs, onRetrySecondary}: Props) {
  const imageType = viewModeToImageType(activeViewMode);
  const reference = getPreviewImage(character, selectedVariant, imageType);
  const previewKey = (selectedVariant?.region === REGION_BY_IMAGE_TYPE[imageType] && selectedVariant?.variant_id)
    || character?.images?.[imageType]?.asset_id
    || reference
    || 'empty';
  const [imageBroken, setImageBroken] = useState(false);
  const currentSecondaryJob = secondaryJobs?.[imageType];
  const secondaryStatus: AssetJobStatus | undefined = currentSecondaryJob?.status;
  const isSecondaryActive = secondaryStatus === 'queued' || secondaryStatus === 'processing';
  const isSecondaryFailed = secondaryStatus === 'failed';
  const isGeneratingCurrent = generatingImageType === imageType || (imageType !== 'portrait' && isSecondaryActive);

  useEffect(() => {
    setImageBroken(false);
  }, [reference]);

  return (
    <section className={`character-preview character-preview--${activeViewMode}`}>
      <div className="character-preview-tabs" role="tablist" aria-label="Режим просмотра">
        {viewTabs.map((tab) => {
          const tabImageType = viewModeToImageType(tab.value);
          const tabStatus = getTabStatus(tabImageType, character, secondaryJobs, generatingImageType);
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              className={`character-preview-tabs__item${activeViewMode === tab.value ? ' character-preview-tabs__item--active' : ''}`}
              onClick={() => onViewModeChange(tab.value)}
            >
              <span>{tab.label}</span>
              <TabStatusDot status={tabStatus} />
            </button>
          );
        })}
      </div>
      {activeViewMode === 'sheet' && reference && !imageBroken
        ? <ReferenceSheetPreview imageUrl={reference} imageKey={previewKey} onImageError={() => setImageBroken(true)} />
        : (
          <div className={`character-preview-stage character-preview-stage--${activeViewMode}`}>

            {activeViewMode === 'fullBody' && <HeightScale />}
            {activeViewMode === 'scene' && <SceneBackdrop />}
            <div className={`character-preview-subject character-preview-subject--${activeViewMode}`}>
              {reference && !imageBroken ? (
                <Image key={previewKey} src={reference} alt="Предпросмотр персонажа" preview={false} onError={() => setImageBroken(true)} />
              ) : isGeneratingCurrent ? (
                <GeneratingState viewMode={activeViewMode} progress={jobProgress ?? currentSecondaryJob?.progress} />
              ) : isSecondaryFailed ? (
                <FailedState
                  viewMode={activeViewMode}
                  errorMessage={currentSecondaryJob?.errorMessage}
                  onRetry={() => onRetrySecondary?.(imageType)}
                />
              ) : (
                <div className={`character-preview-empty character-preview-empty--${activeViewMode}`}>
                  <div className="character-preview-empty__silhouette" />
                  <h3>{emptyCopyByMode[activeViewMode].title}</h3>
                  <p>{emptyCopyByMode[activeViewMode].text}</p>
                  <div className="character-preview-empty__actions">
                    <button type="button" onClick={onGenerateImage} disabled={!!generatingImageType}>
                      Сгенерировать этот режим
                    </button>
                    <button type="button">Добавить референс</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </section>
  );
}

export function viewModeToImageType(mode: CharacterViewMode): CharacterImageType {
  if (mode === 'fullBody') return 'full_body';
  if (mode === 'scene') return 'scene';
  if (mode === 'sheet') return 'reference_sheet';
  return 'portrait';
}

const REGION_BY_IMAGE_TYPE: Record<CharacterImageType, string> = {
  portrait: 'face',
  full_body: 'body',
  scene: 'style',
  reference_sheet: 'full_character',
};

function withCacheBust(url: string, key?: string | null) {
  if (!key) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${encodeURIComponent(key)}`;
}

function getPreviewImage(character?: StudioCharacter | null, selectedVariant?: CharacterVariant | null, imageType: CharacterImageType = 'portrait') {
  // Only honor selectedVariant when it actually belongs to the current view's image type;
  // otherwise a stale portrait variant would leak into full_body / scene / reference tabs.
  if (selectedVariant?.image_url && selectedVariant.region === REGION_BY_IMAGE_TYPE[imageType]) {
    return selectedVariant.image_url;
  }
  const modeAsset = character?.images?.[imageType];
  const modeImage = modeAsset?.image_url;
  if (modeImage) return withCacheBust(modeImage, modeAsset?.asset_id ?? null);
  if (imageType !== 'portrait') return null;
  const references = character?.references || [];
  return references.find((reference) => reference.is_primary)?.image_url
    || references.find((reference) => reference.is_canonical)?.image_url
    || references[0]?.image_url
    || character?.outfits?.find((outfit) => outfit.is_default && outfit.reference_image)?.reference_image
    || character?.outfits?.find((outfit) => outfit.reference_image)?.reference_image
    || null;
}

const generatingCopyByMode: Record<CharacterViewMode, {title: string; text: string}> = {
  portrait: {
    title: 'Генерируем портрет…',
    text: 'Создаём изображение лица и плеч персонажа.',
  },
  fullBody: {
    title: 'Генерируем полный рост…',
    text: 'Создаём изображение персонажа в полный рост.',
  },
  scene: {
    title: 'Генерируем сцену…',
    text: 'Создаём персонажа в сцене с фоном и окружением.',
  },
  sheet: {
    title: 'Генерируем ракурсы…',
    text: 'Создаём виды спереди, сбоку и сзади.',
  },
};

type TabStatus = 'ready' | 'generating' | 'failed' | 'idle';

function getTabStatus(
  imageType: CharacterImageType,
  character?: StudioCharacter | null,
  secondaryJobs?: AssetJobsMap,
  generatingImageType?: CharacterImageType | null,
): TabStatus {
  if (generatingImageType === imageType) return 'generating';
  if (character?.images?.[imageType]?.image_url) return 'ready';
  const job = secondaryJobs?.[imageType];
  if (!job) return 'idle';
  if (job.status === 'queued' || job.status === 'processing') return 'generating';
  if (job.status === 'failed') return 'failed';
  if (job.status === 'completed') return 'ready';
  return 'idle';
}

function TabStatusDot({status}: {status: TabStatus}) {
  if (status === 'idle') return null;
  return <span className={`character-preview-tabs__status character-preview-tabs__status--${status}`} aria-hidden="true" />;
}

function FailedState({viewMode, errorMessage, onRetry}: {viewMode: CharacterViewMode; errorMessage?: string; onRetry: () => void}) {
  const copy = generatingCopyByMode[viewMode];
  return (
    <div className="character-preview-failed">
      <div className="character-preview-failed__icon">!</div>
      <h3>Ошибка генерации</h3>
      <p>{errorMessage || `Не удалось сгенерировать «${copy.title.replace('Генерируем ', '').replace('…', '')}». Попробуйте ещё раз.`}</p>
      <button type="button" onClick={onRetry} className="character-preview-failed__retry">
        Повторить генерацию
      </button>
    </div>
  );
}

function GeneratingState({viewMode, progress}: {viewMode: CharacterViewMode; progress?: number}) {
  const copy = generatingCopyByMode[viewMode];
  const hasProgress = typeof progress === 'number' && progress > 0;
  return (
    <div className="character-preview-generating">
      <div className="character-preview-generating__spinner" />
      <h3>{copy.title}</h3>
      <p>{copy.text}</p>
      {hasProgress ? (
        <div className="character-preview-generating__progress">
          <div className="character-preview-generating__progress-bar" style={{width: `${progress}%`}} />
          <span className="character-preview-generating__progress-label">{progress}%</span>
        </div>
      ) : (
        <div className="character-preview-generating__progress">
          <div className="character-preview-generating__progress-bar character-preview-generating__progress-bar--indeterminate" />
        </div>
      )}
      <button type="button" className="character-preview-generating__btn" disabled>
        Генерируется…
      </button>
    </div>
  );
}

const emptyCopyByMode: Record<CharacterViewMode, {title: string; text: string}> = {
  portrait: {
    title: 'Портрет пока не создан',
    text: 'Добавьте референс или сгенерируйте первый вариант',
  },
  fullBody: {
    title: 'Модель полного роста пока не создана',
    text: 'Сгенерируйте полный рост на основе портрета',
  },
  scene: {
    title: 'Сцена пока не создана',
    text: 'Выберите фон, свет и камеру для первого кадра',
  },
  sheet: {
    title: 'Ракурсы пока не созданы',
    text: 'Сгенерируйте виды персонажа спереди, сбоку и сзади',
  },
};

function HeightScale() {
  return (
    <div className="height-scale" aria-hidden="true">
      {[200, 180, 160, 140, 120].map((height) => (
        <span key={height}>{height} см</span>
      ))}
    </div>
  );
}

function SceneBackdrop() {
  return (
    <div className="scene-backdrop" aria-hidden="true">
      <span className="scene-backdrop__sun" />
      <span className="scene-backdrop__floor" />
    </div>
  );
}

function ReferenceSheetPreview({imageUrl, imageKey, onImageError}: {imageUrl: string; imageKey?: string; onImageError: () => void}) {
  return (
    <div className="reference-sheet-preview">
      <div className="reference-sheet-preview__image">
        <Image key={imageKey || imageUrl} src={imageUrl} alt="Ракурсы персонажа" preview={false} onError={onImageError} />
      </div>
      <ReferenceSheetSection title="Ортогональные виды" items={['Фронт', 'Профиль слева', 'Спина', 'Профиль справа']} />
      <ReferenceSheetSection title="Дополнительные ракурсы" items={['3/4 слева', '3/4 справа', 'Сверху', 'Снизу / низкий ракурс']} />
      <ReferenceSheetSection title="Детали" compact items={['Лицо', 'Глаза', 'Волосы', 'Кожа', 'Руки', 'Обувь']} />
    </div>
  );
}

function ReferenceSheetSection({title, items, compact = false}: {title: string; items: string[]; compact?: boolean}) {
  return (
    <section className="reference-sheet-section">
      <div className="reference-sheet-section__header">
        <h3>{title}</h3>
        <span>{items.length} кадров</span>
      </div>
      <div className={`reference-sheet-grid${compact ? ' reference-sheet-grid--compact' : ''}`}>
        {items.map((item, index) => (
          <article key={item} className="reference-sheet-card">
            <div className="reference-sheet-card__placeholder">
              <span>{index + 1}</span>
            </div>
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
