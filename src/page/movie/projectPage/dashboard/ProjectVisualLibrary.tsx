import {ArrowRightOutlined, PictureOutlined, PlusOutlined} from '@ant-design/icons';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {referenceApi} from '../../../../modules/reference-library/api/referenceApi';
import ReferenceCard from '../../../../modules/reference-library/components/ReferenceCard';
import type {ReferenceListItem} from '../../../../modules/reference-library/types';

import '../../../../modules/reference-library/referenceLibrary.css';

const DASHBOARD_PAGE_SIZE = 5;

interface Props {
  canCreate?: boolean;
  onCreate?: () => void;
  onOpenLibrary: () => void;
  onOpenReference: (referenceId: string) => void;
  projectId: string;
}

const ProjectVisualLibrary: React.FC<Props> = ({
  canCreate = false,
  onCreate,
  onOpenLibrary,
  onOpenReference,
  projectId,
}) => {
  const {t} = useTranslation();
  const [items, setItems] = useState<ReferenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    void referenceApi.list(projectId, {
      ordering: '-updatedAt',
      page: 1,
      pageSize: DASHBOARD_PAGE_SIZE,
      status: 'ready',
    }, controller.signal).then(({data}) => {
      setItems(data.items.slice(0, DASHBOARD_PAGE_SIZE));
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [projectId]);

  const showCreateCard = canCreate && Boolean(onCreate);
  const visibleItems = items.slice(
    0,
    showCreateCard ? DASHBOARD_PAGE_SIZE - 1 : DASHBOARD_PAGE_SIZE,
  );

  return (
    <section className="proj-card proj-visual-library p-5 sm:p-6">
      <div className="proj-visual-library__header">
        <div>
          <h3 className="proj-section-title">{t('referenceLibrary.title')}</h3>
          <p>{t('referenceLibrary.dashboard.subtitle')}</p>
        </div>
        <button
          type="button"
          className="proj-btn proj-btn-secondary"
          onClick={onOpenLibrary}
          aria-label={t('referenceLibrary.dashboard.viewAll')}
        >
          {t('referenceLibrary.dashboard.viewAll')}
          <ArrowRightOutlined />
        </button>
      </div>

      {loading && (
        <div
          className="proj-reference-grid"
          role="status"
          aria-label={t('referenceLibrary.dashboard.loading')}
        >
          {Array.from({length: DASHBOARD_PAGE_SIZE}, (_, index) => (
            <div className="proj-reference-skeleton" key={index} aria-hidden="true">
              <span />
              <span />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (showCreateCard || visibleItems.length > 0) && (
        <div className="proj-reference-grid">
          {showCreateCard && onCreate && (
            <button
              type="button"
              className="proj-create-card proj-reference-create-card"
              onClick={onCreate}
              aria-label={t('referenceLibrary.dashboard.create')}
            >
              <span className="proj-reference-create-card__icon">
                <PlusOutlined />
              </span>
              <span className="proj-reference-create-card__label">
                {t('referenceLibrary.dashboard.create')}
              </span>
            </button>
          )}
          {visibleItems.map((item) => (
            <ReferenceCard
              item={item}
              key={item.id}
              onOpen={() => onOpenReference(item.id)}
            />
          ))}
        </div>
      )}

      {!loading && (error || (!showCreateCard && items.length === 0)) && (
        <div className="proj-visual-library__state" role={error ? 'alert' : undefined}>
          <PictureOutlined />
          <span>
            {t(error
              ? 'referenceLibrary.dashboard.error'
              : 'referenceLibrary.dashboard.empty')}
          </span>
        </div>
      )}
    </section>
  );
};

export default ProjectVisualLibrary;
