import React from 'react';
import {PictureOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import type {ReferenceListItem} from '../types';
import ReferenceStatusTag from './ReferenceStatusTag';

interface ReferenceCardProps {
  item: ReferenceListItem;
  onOpen: () => void;
}

export default function ReferenceCard({item, onOpen}: ReferenceCardProps) {
  const {t} = useTranslation();
  const imageUrl = item.activeVersion?.thumbnailUrl || item.activeVersion?.imageUrl || '';
  const categoryLabel = t(`referenceLibrary.category.${item.category}`);
  const characterNames = item.usage.characters.slice(0, 2).map((link) => link.name).filter(Boolean);
  return (
    <article className="reference-card">
      <button
        type="button"
        className="reference-card__button"
        aria-label={t('referenceLibrary.card.open', {title: item.title})}
        onClick={onOpen}
      >
        <div className="reference-card__image">
          {imageUrl ? (
            <img
              src={backendAssetUrl(imageUrl)}
              alt={t('referenceLibrary.card.imageAlt', {
                category: categoryLabel,
                title: item.title,
                version: item.activeVersion?.number,
              })}
            />
          ) : (
            <div className="reference-card__placeholder" aria-hidden="true"><PictureOutlined /></div>
          )}
          <div className="reference-card__status"><ReferenceStatusTag status={item.status} /></div>
        </div>
        <div className="reference-card__content">
          <div className="reference-card__heading">
            <h2 title={item.title}>{item.title}</h2>
            {item.activeVersion && <span className="reference-version-badge">v{item.activeVersion.number}</span>}
          </div>
          <span className="reference-card__category">{categoryLabel}</span>
          <div className="reference-card__usage">
            <span>{t('referenceLibrary.card.sceneCount', {count: item.usage.sceneCount})}</span>
            {characterNames.length > 0 && <span>{characterNames.join(', ')}</span>}
          </div>
          {item.tags.length > 0 && (
            <div className="reference-card__tags">
              {item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
              {item.tags.length > 2 && <span>+{item.tags.length - 2}</span>}
            </div>
          )}
        </div>
      </button>
    </article>
  );
}
