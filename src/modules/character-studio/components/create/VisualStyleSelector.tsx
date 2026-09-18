import React, {useCallback, useState} from 'react';
import {CheckOutlined, BgColorsOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import FormSectionCard from './FormSectionCard';

export const visualStyleOptions = [
  {
    value: 'cinematic_realism',
    labelKey: 'characterStudio.options.visualStyle.cinematic_realism',
    previewImage: '/assets/styles/cat_cinematic.png',
    tone: 'linear-gradient(135deg, #3d4857, #c08a3e)',
  },
  {
    value: 'anime',
    labelKey: 'characterStudio.options.visualStyle.anime',
    previewImage: '/assets/styles/cat_anime.png',
    tone: 'linear-gradient(135deg, #251d38, #f26fa7)',
  },
  {
    value: 'pixar_like',
    labelKey: 'characterStudio.options.visualStyle.pixar_like',
    previewImage: '/assets/styles/cat_pixar.png',
    tone: 'linear-gradient(135deg, #1e4258, #f6b84d)',
  },
  {
    value: 'stylized_3d',
    labelKey: 'characterStudio.options.visualStyle.stylized_3d',
    previewImage: '/assets/styles/cat_stylized3d.png',
    tone: 'linear-gradient(135deg, #253749, #8fd1c7)',
  },
  {
    value: 'dark_fantasy',
    labelKey: 'characterStudio.options.visualStyle.dark_fantasy',
    previewImage: '/assets/styles/cat_darkfantasy.png',
    tone: 'linear-gradient(135deg, #15161d, #7d4a32)',
  },
  {
    value: 'cyberpunk',
    labelKey: 'characterStudio.options.visualStyle.cyberpunk',
    previewImage: '/assets/styles/cat_cyberpunk.png',
    tone: 'linear-gradient(135deg, #15142c, #f7a600)',
  },
  {
    value: 'watercolor',
    labelKey: 'characterStudio.options.visualStyle.watercolor',
    previewImage: '/assets/styles/cat_watercolor.png',
    tone: 'linear-gradient(135deg, #344b57, #d7b56d)',
  },
  {
    value: 'comic_book',
    labelKey: 'characterStudio.options.visualStyle.comic_book',
    previewImage: '/assets/styles/cat_comic.png',
    tone: 'linear-gradient(135deg, #2d2b35, #e85f3d)',
  },
] as const;

export type VisualStyleValue = typeof visualStyleOptions[number]['value'];

interface VisualStyleSelectorProps {
  value?: string;
  onChange: (value: VisualStyleValue) => void;
}

export default function VisualStyleSelector({value, onChange}: VisualStyleSelectorProps) {
  const {t} = useTranslation();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const handleImageError = useCallback((styleValue: string) => {
    setFailedImages((current) => ({...current, [styleValue]: true}));
  }, []);

  return (
    <FormSectionCard
      icon={<BgColorsOutlined />}
      title={t('characterStudio.create.visualStyle.title')}
      subtitle={t('characterStudio.create.visualStyle.subtitle')}
    >
      <div className="visual-style-grid">
        {visualStyleOptions.map((style) => {
          const selected = style.value === value;
          const showFallback = failedImages[style.value];
          return (
            <button
              key={style.value}
              type="button"
              className={`visual-style-card ${selected ? 'visual-style-card--selected' : ''}`}
              onClick={() => onChange(style.value)}
            >
              <span className="visual-style-card__thumb" style={{background: style.tone}}>
                {!showFallback && (
                  <img
                    src={style.previewImage}
                    alt={t(style.labelKey)}
                    className="style-preview-image"
                    loading="lazy"
                    onError={() => handleImageError(style.value)}
                  />
                )}
                {selected && <span className="visual-style-card__check"><CheckOutlined /></span>}
              </span>
              <span className="visual-style-card__label">{t(style.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </FormSectionCard>
  );
}
