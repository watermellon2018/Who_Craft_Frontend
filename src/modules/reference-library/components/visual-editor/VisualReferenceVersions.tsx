import {PictureOutlined} from '@ant-design/icons';
import {Tooltip} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

export interface VisualReferenceVersionItem {
  id: string;
  imageUrl: string;
  label: string;
  primary?: boolean;
}

interface VisualReferenceVersionsProps {
  items: VisualReferenceVersionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function VisualReferenceVersions({
  items,
  selectedId,
  onSelect,
}: VisualReferenceVersionsProps) {
  const {t} = useTranslation();

  return (
    <section className="visual-reference-inspector__drafts visual-reference-inspector__versions">
      <div className="visual-reference-drafts__header">
        <Tooltip
          rootClassName="visual-reference-tooltip"
          title={t('referenceLibrary.versions.helper')}
        >
          <span>{t('referenceLibrary.versions.title')}</span>
        </Tooltip>
        <span className="visual-reference-drafts__count">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div
          className="visual-reference-drafts__list"
          aria-label={t('referenceLibrary.versions.title')}
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <article key={item.id} className="visual-reference-draft-card">
                <Tooltip rootClassName="visual-reference-tooltip" title={item.label}>
                  <button
                    type="button"
                    className={`visual-reference-draft-card__preview${selected ? ' is-selected' : ''}`}
                    aria-label={item.label}
                    aria-pressed={selected}
                    onClick={() => onSelect(item.id)}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <i className="visual-reference-version-card__empty"><PictureOutlined /></i>
                    )}
                    {item.primary && <span>{t('referenceLibrary.versions.active')}</span>}
                  </button>
                </Tooltip>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="visual-reference-drafts__empty">
          <PictureOutlined />
          <strong>{t('referenceLibrary.versions.empty')}</strong>
        </div>
      )}
    </section>
  );
}
