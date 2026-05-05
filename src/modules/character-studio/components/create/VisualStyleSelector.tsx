import React, {useCallback, useState} from 'react';
import {CheckOutlined, BgColorsOutlined} from '@ant-design/icons';
import FormSectionCard from './FormSectionCard';

export const visualStyleOptions = [
  {
    value: 'cinematic_realism',
    label: 'Кинематографичный реализм',
    previewImage: '/assets/styles/cat_cinematic.png',
    tone: 'linear-gradient(135deg, #3d4857, #c08a3e)',
  },
  {
    value: 'anime',
    label: 'Аниме',
    previewImage: '/assets/styles/cat_anime.png',
    tone: 'linear-gradient(135deg, #251d38, #f26fa7)',
  },
  {
    value: 'pixar_like',
    label: 'В стиле Pixar',
    previewImage: '/assets/styles/cat_pixar.png',
    tone: 'linear-gradient(135deg, #1e4258, #f6b84d)',
  },
  {
    value: 'stylized_3d',
    label: 'Стилизованный 3D',
    previewImage: '/assets/styles/cat_stylized3d.png',
    tone: 'linear-gradient(135deg, #253749, #8fd1c7)',
  },
  {
    value: 'dark_fantasy',
    label: 'Темное фэнтези',
    previewImage: '/assets/styles/cat_darkfantasy.png',
    tone: 'linear-gradient(135deg, #15161d, #7d4a32)',
  },
  {
    value: 'cyberpunk',
    label: 'Киберпанк',
    previewImage: '/assets/styles/cat_cyberpunk.png',
    tone: 'linear-gradient(135deg, #15142c, #f7a600)',
  },
  {
    value: 'watercolor',
    label: 'Акварель',
    previewImage: '/assets/styles/cat_watercolor.png',
    tone: 'linear-gradient(135deg, #344b57, #d7b56d)',
  },
  {
    value: 'comic_book',
    label: 'Комикс',
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
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const handleImageError = useCallback((styleValue: string) => {
    setFailedImages((current) => ({...current, [styleValue]: true}));
  }, []);

  return (
    <FormSectionCard
      icon={<BgColorsOutlined />}
      title="Визуальный стиль"
      subtitle="Выберите визуальный стиль персонажа"
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
                    alt={style.label}
                    className="style-preview-image"
                    loading="lazy"
                    onError={() => handleImageError(style.value)}
                  />
                )}
                {selected && <span className="visual-style-card__check"><CheckOutlined /></span>}
              </span>
              <span className="visual-style-card__label">{style.label}</span>
            </button>
          );
        })}
      </div>
    </FormSectionCard>
  );
}
