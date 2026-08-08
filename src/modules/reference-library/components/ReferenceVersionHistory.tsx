import React from 'react';
import {HistoryOutlined} from '@ant-design/icons';
import {Empty, Tag} from 'antd';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import type {ReferenceVersion} from '../types';

interface ReferenceVersionHistoryProps {
  activeVersionId?: string | null;
  versions: ReferenceVersion[];
}

export default function ReferenceVersionHistory({
  activeVersionId,
  versions,
}: ReferenceVersionHistoryProps) {
  const {t} = useTranslation();
  return (
    <section className="reference-card-panel">
      <div className="reference-section-heading">
        <div>
          <h2><HistoryOutlined /> {t('referenceLibrary.versions.title')}</h2>
          <p>{t('referenceLibrary.versions.helper')}</p>
        </div>
      </div>
      {versions.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('referenceLibrary.versions.empty')} />
      ) : (
        <div className="reference-version-list">
          {versions.map((version) => (
            <article key={version.id} className="reference-version-row">
              <div>
                <strong>v{version.number}</strong>
                <span>{t(`referenceLibrary.versions.origin.${version.origin ?? 'upload'}`)}</span>
                {version.createdAt && <small>{new Date(version.createdAt).toLocaleString()}</small>}
              </div>
              <div className="reference-version-row__meta">
                {version.id === activeVersionId && <Tag color="gold">{t('referenceLibrary.versions.active')}</Tag>}
                {(version.modelName || version.provider) && <small>{version.modelName || version.provider}</small>}
                {version.imageUrl && (
                  <a href={backendAssetUrl(version.imageUrl)} target="_blank" rel="noreferrer">
                    {t('referenceLibrary.versions.open')}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
