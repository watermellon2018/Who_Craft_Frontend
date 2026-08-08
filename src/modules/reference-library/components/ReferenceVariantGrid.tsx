import React from 'react';
import {CheckOutlined, PictureOutlined} from '@ant-design/icons';
import {Button} from 'antd';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import type {ReferenceVariant} from '../types';

interface ReferenceVariantGridProps {
  applying?: boolean;
  canApply: boolean;
  selectedVariantId: string | null;
  variants: ReferenceVariant[];
  onApply: () => void;
  onSelect: (variantId: string) => void;
}

export default function ReferenceVariantGrid({
  applying = false,
  canApply,
  selectedVariantId,
  variants,
  onApply,
  onSelect,
}: ReferenceVariantGridProps) {
  const {t} = useTranslation();
  return (
    <section className="reference-card-panel">
      <div className="reference-section-heading">
        <div>
          <h2>{t('referenceLibrary.variants.title')}</h2>
          <p>{t('referenceLibrary.variants.helper')}</p>
        </div>
      </div>
      <div className="reference-variant-grid">
        {variants.map((variant) => {
          const selected = selectedVariantId === variant.id;
          const imageUrl = variant.thumbnailUrl || variant.imageUrl || '';
          return (
            <button
              key={variant.id}
              type="button"
              className={`reference-variant${selected ? ' reference-variant--selected' : ''}`}
              disabled={variant.status !== 'generated'}
              aria-pressed={selected}
              onClick={() => onSelect(variant.id)}
            >
              {imageUrl ? (
                <img src={backendAssetUrl(imageUrl)} alt={t('referenceLibrary.variants.alt', {number: variant.index + 1})} />
              ) : <span className="reference-card__placeholder"><PictureOutlined /></span>}
              <span>{t('referenceLibrary.variants.item', {number: variant.index + 1})}</span>
              {selected && <CheckOutlined className="reference-variant__check" />}
            </button>
          );
        })}
      </div>
      <Button
        type="primary"
        size="large"
        disabled={!canApply || !selectedVariantId}
        loading={applying}
        onClick={onApply}
      >
        {t('referenceLibrary.variants.apply')}
      </Button>
    </section>
  );
}
