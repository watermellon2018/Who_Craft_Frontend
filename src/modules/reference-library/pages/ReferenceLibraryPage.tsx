import React, {useEffect, useMemo, useState} from 'react';
import {
  AppstoreOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {Alert, Button, Empty, Input, Pagination, Result, Select, Skeleton} from 'antd';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {
  referenceCreatePath,
  referenceDetailPath,
} from '../../../routes/pathConstant';
import {referenceApi} from '../api/referenceApi';
import ReferenceCard from '../components/ReferenceCard';
import ReferenceLibraryShell from '../components/ReferenceLibraryShell';
import {referenceErrorDescriptor} from '../errors';
import type {
  ReferenceCapabilities,
  ReferenceCategory,
  ReferenceListResponse,
  ReferenceStatus,
} from '../types';
import '../referenceLibrary.css';

const DEFAULT_PAGE_SIZE = 24;
const CATEGORY_VALUES: ReferenceCategory[] = ['location', 'prop', 'wardrobe', 'vehicle', 'symbol', 'other'];
const STATUS_VALUES: ReferenceStatus[] = ['draft', 'generating', 'ready', 'failed', 'archived'];

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function referenceCategory(value: string | null): ReferenceCategory | undefined {
  return CATEGORY_VALUES.find((category) => category === value);
}

function referenceStatus(value: string | null): ReferenceStatus | undefined {
  return STATUS_VALUES.find((status) => status === value);
}

export default function ReferenceLibraryPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {projectId = ''} = useParams<{projectId: string}>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '');
  const [capabilities, setCapabilities] = useState<ReferenceCapabilities | null>(null);
  const [data, setData] = useState<ReferenceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const page = positiveInteger(searchParams.get('page'), 1);
  const pageSize = Math.min(100, positiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE));
  const category = referenceCategory(searchParams.get('category'));
  const status = referenceStatus(searchParams.get('status'));
  const ordering = searchParams.get('ordering') === 'title'
    || searchParams.get('ordering') === 'updatedAt'
    ? searchParams.get('ordering') as 'title' | 'updatedAt'
    : '-updatedAt' as const;
  const search = searchParams.get('search')?.trim() || undefined;

  useEffect(() => {
    setSearchValue(searchParams.get('search') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = searchValue.trim();
      if (normalized === (searchParams.get('search') ?? '')) return;
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (normalized) next.set('search', normalized);
        else next.delete('search');
        next.delete('page');
        return next;
      }, {replace: true});
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchParams, searchValue, setSearchParams]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    referenceApi.getCapabilities(projectId, controller.signal)
      .then((response) => setCapabilities(response.data))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(referenceErrorDescriptor(requestError).message);
      });
    return () => controller.abort();
  }, [projectId, revision]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    referenceApi.list(projectId, {
      category,
      ordering,
      page,
      pageSize,
      search,
      status,
    }, controller.signal)
      .then((response) => setData(response.data))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(referenceErrorDescriptor(requestError).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, ordering, page, pageSize, projectId, revision, search, status]);

  const categories = useMemo(
    () => (capabilities?.categories.map(({key}) => key) ?? CATEGORY_VALUES).map((key) => ({
      key,
      label: t(`referenceLibrary.category.${key}`),
    })),
    [capabilities?.categories, t],
  );

  const updateFilter = (key: string, value?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, {replace: true});
  };

  const hasFilters = Boolean(search || category || status || ordering !== '-updatedAt');
  const canEdit = capabilities?.permissions.canEdit ?? false;

  if (!projectId) return <Result status="404" title={t('referenceLibrary.errors.projectMissing')} />;

  return (
    <ReferenceLibraryShell projectId={projectId}>
      <main className="reference-library-page">
        <header className="reference-page-heading">
          <div>
            <span className="reference-eyebrow">{t('referenceLibrary.eyebrow')}</span>
            <h1>{t('referenceLibrary.title')}</h1>
            <p>{t('referenceLibrary.subtitle')}</p>
          </div>
          {canEdit && (
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => navigate(referenceCreatePath(projectId))}
            >
              {t('referenceLibrary.actions.create')}
            </Button>
          )}
        </header>

        {capabilities && !capabilities.permissions.canEdit && (
          <Alert type="info" showIcon message={t('referenceLibrary.readOnly')} />
        )}

        <section className="reference-toolbar" aria-label={t('referenceLibrary.filters.title')}>
          <Input.Search
            allowClear
            className="reference-toolbar__search"
            placeholder={t('referenceLibrary.filters.search')}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <Select
            aria-label={t('referenceLibrary.filters.status')}
            allowClear
            className="reference-toolbar__select"
            placeholder={t('referenceLibrary.filters.status')}
            value={status}
            options={STATUS_VALUES.map((value) => ({
              label: t(`referenceLibrary.status.${value}`),
              value,
            }))}
            onChange={(value) => updateFilter('status', value)}
          />
          <Select
            aria-label={t('referenceLibrary.filters.ordering')}
            className="reference-toolbar__select"
            value={ordering}
            options={[
              {label: t('referenceLibrary.filters.updatedDesc'), value: '-updatedAt'},
              {label: t('referenceLibrary.filters.updatedAsc'), value: 'updatedAt'},
              {label: t('referenceLibrary.filters.titleAsc'), value: 'title'},
            ]}
            onChange={(value) => updateFilter('ordering', value)}
          />
        </section>

        <nav className="reference-category-chips" aria-label={t('referenceLibrary.filters.categories')}>
          <button
            type="button"
            className={!category ? 'reference-category-chip reference-category-chip--active' : 'reference-category-chip'}
            onClick={() => updateFilter('category')}
          >
            {t('referenceLibrary.filters.all')}
          </button>
          {categories.map((option) => (
            <button
              key={option.key}
              type="button"
              className={category === option.key ? 'reference-category-chip reference-category-chip--active' : 'reference-category-chip'}
              onClick={() => updateFilter('category', option.key)}
            >
              {option.label}
            </button>
          ))}
        </nav>

        {error ? (
          <Result
            status="error"
            title={t('referenceLibrary.errors.loadList')}
            subTitle={error}
            extra={(
              <Button icon={<ReloadOutlined />} onClick={() => setRevision((value) => value + 1)}>
                {t('common.retry')}
              </Button>
            )}
          />
        ) : loading ? (
          <div className="reference-grid" aria-label={t('referenceLibrary.loading')}>
            {Array.from({length: 8}, (_, index) => (
              <div key={index} className="reference-card reference-card--skeleton">
                <Skeleton.Image active />
                <Skeleton active paragraph={{rows: 2}} />
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="reference-grid">
              {!hasFilters && page === 1 && canEdit && (
                <button
                  type="button"
                  className="reference-create-card"
                  onClick={() => navigate(referenceCreatePath(projectId))}
                >
                  <PlusOutlined />
                  <strong>{t('referenceLibrary.actions.create')}</strong>
                  <span>{t('referenceLibrary.actions.createHint')}</span>
                </button>
              )}
              {data.items.map((item) => (
                <ReferenceCard
                  key={item.id}
                  item={item}
                  onOpen={() => navigate(referenceDetailPath(projectId, item.id))}
                />
              ))}
            </div>
            <Pagination
              responsive
              current={data.page}
              pageSize={data.pageSize}
              total={data.total}
              showSizeChanger={false}
              onChange={(nextPage) => updateFilter('page', String(nextPage))}
            />
          </>
        ) : (
          <Empty
            image={<AppstoreOutlined className="reference-empty-icon" />}
            description={hasFilters
              ? t('referenceLibrary.empty.filtered')
              : t('referenceLibrary.empty.description')}
          >
            {hasFilters ? (
              <Button onClick={() => setSearchParams({}, {replace: true})}>
                {t('referenceLibrary.empty.reset')}
              </Button>
            ) : canEdit ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(referenceCreatePath(projectId))}>
                {t('referenceLibrary.empty.create')}
              </Button>
            ) : undefined}
          </Empty>
        )}
      </main>
    </ReferenceLibraryShell>
  );
}
