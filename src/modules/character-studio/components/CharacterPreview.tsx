import React, {useEffect, useState} from 'react';
import {Image} from 'antd';
import {
  BgColorsOutlined,
  CameraOutlined,
  CloudOutlined,
  CompressOutlined,
  FullscreenOutlined,
  MinusOutlined,
  PlusOutlined,
  RedoOutlined,
  RotateRightOutlined,
  SelectOutlined,
  SkinOutlined,
  ZoomInOutlined,
} from '@ant-design/icons';
import {CharacterImageType, CharacterVariant, CharacterViewMode, StudioCharacter} from '../types/character.types';

interface Props {
  character?: StudioCharacter | null;
  selectedVariant?: CharacterVariant | null;
  activeViewMode: CharacterViewMode;
  onViewModeChange: (value: CharacterViewMode) => void;
  onGenerateImage: () => void;
}

const viewTabs: Array<{label: string; value: CharacterViewMode}> = [
  {label: 'Портрет', value: 'portrait'},
  {label: 'Полный рост', value: 'fullBody'},
  {label: 'Сцена', value: 'scene'},
  {label: 'Референс-лист', value: 'sheet'},
];

const toolsByMode: Record<CharacterViewMode, Array<{label: string; icon: React.ReactNode}>> = {
  portrait: [
    {label: 'Выбрать', icon: <SelectOutlined />},
    {label: 'Переместить', icon: <CompressOutlined />},
    {label: 'Повернуть', icon: <RotateRightOutlined />},
    {label: 'Масштаб', icon: <ZoomInOutlined />},
    {label: 'Сброс', icon: <RedoOutlined />},
  ],
  fullBody: [
    {label: 'Выбрать', icon: <SelectOutlined />},
    {label: 'Переместить', icon: <CompressOutlined />},
    {label: 'Повернуть', icon: <RotateRightOutlined />},
    {label: 'Масштаб', icon: <ZoomInOutlined />},
    {label: 'Поза', icon: <SkinOutlined />},
    {label: 'Сброс', icon: <RedoOutlined />},
  ],
  scene: [
    {label: 'Камера', icon: <CameraOutlined />},
    {label: 'Свет', icon: <BgColorsOutlined />},
    {label: 'Фон', icon: <FullscreenOutlined />},
    {label: 'Эффекты', icon: <ZoomInOutlined />},
    {label: 'Погода', icon: <CloudOutlined />},
    {label: 'Сброс', icon: <RedoOutlined />},
  ],
  sheet: [
    {label: 'Сетка', icon: <FullscreenOutlined />},
    {label: 'Подписи', icon: <SelectOutlined />},
    {label: 'Экспорт', icon: <CompressOutlined />},
    {label: 'Сброс', icon: <RedoOutlined />},
  ],
};

const bodyViews = ['Фронт', 'Левый', 'Правый', 'Назад'];
const sceneCameraViews = ['Крупный план', 'Средний план', 'Общий план', 'Со спины', 'Сбоку'];

export default function CharacterPreview({character, selectedVariant, activeViewMode, onViewModeChange, onGenerateImage}: Props) {
  const imageType = viewModeToImageType(activeViewMode);
  const reference = getPreviewImage(character, selectedVariant, imageType);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [reference]);

  return (
    <section className={`character-preview character-preview--${activeViewMode}`}>
      <div className="character-preview-tabs" role="tablist" aria-label="Режим просмотра">
        {viewTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            className={`character-preview-tabs__item${activeViewMode === tab.value ? ' character-preview-tabs__item--active' : ''}`}
            onClick={() => onViewModeChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeViewMode === 'sheet' && reference && !imageBroken
        ? <ReferenceSheetPreview imageUrl={reference} onImageError={() => setImageBroken(true)} />
        : (
          <div className={`character-preview-stage character-preview-stage--${activeViewMode}`}>
            <PreviewToolbar tools={toolsByMode[activeViewMode]} />
            <div className="character-preview-zoom" aria-label="Масштаб">
              <button type="button" title="Увеличить"><PlusOutlined /></button>
              <button type="button" title="Уменьшить"><MinusOutlined /></button>
              <button type="button" title="На весь экран"><FullscreenOutlined /></button>
            </div>
            {activeViewMode === 'scene' ? <SceneCameraSwitch /> : <BodyViewSwitch />}
            {activeViewMode === 'fullBody' && <HeightScale />}
            {activeViewMode === 'scene' && <SceneBackdrop />}
            <div className={`character-preview-subject character-preview-subject--${activeViewMode}`}>
              {reference && !imageBroken ? (
                <Image src={reference} alt="Предпросмотр персонажа" preview={false} onError={() => setImageBroken(true)} />
              ) : (
                <div className={`character-preview-empty character-preview-empty--${activeViewMode}`}>
                  <div className="character-preview-empty__silhouette" />
                  <h3>{emptyCopyByMode[activeViewMode].title}</h3>
                  <p>{emptyCopyByMode[activeViewMode].text}</p>
                  <div className="character-preview-empty__actions">
                    <button type="button" onClick={onGenerateImage}>Сгенерировать этот режим</button>
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

function getPreviewImage(character?: StudioCharacter | null, selectedVariant?: CharacterVariant | null, imageType: CharacterImageType = 'portrait') {
  if (selectedVariant?.image_url) return selectedVariant.image_url;
  const modeImage = character?.images?.[imageType]?.image_url;
  if (modeImage) return modeImage;
  if (imageType !== 'portrait') return null;
  const references = character?.references || [];
  return references.find((reference) => reference.is_primary)?.image_url
    || references.find((reference) => reference.is_canonical)?.image_url
    || references[0]?.image_url
    || character?.outfits?.find((outfit) => outfit.is_default && outfit.reference_image)?.reference_image
    || character?.outfits?.find((outfit) => outfit.reference_image)?.reference_image
    || null;
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
    title: 'Референс-лист пока не создан',
    text: 'Сгенерируйте лист с фронтальным, боковым и задним видом',
  },
};

function PreviewToolbar({tools}: {tools: Array<{label: string; icon: React.ReactNode}>}) {
  return (
    <div className="character-preview-toolbar" aria-label="Инструменты">
      {tools.map((tool) => (
        <button key={tool.label} type="button" title={tool.label} className={tool === tools[0] ? 'is-active' : ''}>
          {tool.icon}
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}

function BodyViewSwitch() {
  return (
    <div className="character-preview-view-switch" aria-label="Вид персонажа">
      {bodyViews.map((view, index) => (
        <button key={view} type="button" className={index === 0 ? 'is-active' : ''}>
          {view}
        </button>
      ))}
    </div>
  );
}

function SceneCameraSwitch() {
  return (
    <div className="scene-camera-switch" aria-label="Ракурс камеры">
      {sceneCameraViews.map((view, index) => (
        <button key={view} type="button" className={index === 1 ? 'is-active' : ''}>
          {view}
        </button>
      ))}
    </div>
  );
}

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

function ReferenceSheetPreview({imageUrl, onImageError}: {imageUrl: string; onImageError: () => void}) {
  return (
    <div className="reference-sheet-preview">
      <div className="reference-sheet-preview__image">
        <Image src={imageUrl} alt="Референс-лист персонажа" preview={false} onError={onImageError} />
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
