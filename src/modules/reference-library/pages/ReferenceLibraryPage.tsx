import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {Alert, Button, Empty, Input, message, Modal, Pagination, Result, Select, Skeleton} from 'antd';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {
  projectDashboardPath,
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
  ReferenceListItem,
  ReferenceListResponse,
} from '../types';
import '../referenceLibrary.css';

const DEFAULT_PAGE_SIZE = 24;
const CATEGORY_VALUES: ReferenceCategory[] = ['location', 'prop', 'wardrobe', 'vehicle', 'symbol', 'other'];

interface ReferenceListRequestState {
  data: ReferenceListResponse | null;
  error: string | null;
  loading: boolean;
  projectId: string;
  requestKey: string;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function referenceCategory(value: string | null): ReferenceCategory | undefined {
  return CATEGORY_VALUES.find((category) => category === value);
}

export default function ReferenceLibraryPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {projectId = ''} = useParams<{projectId: string}>();
  const [searchParams, setSearchParams] = useSearchParams();
  const listRequestIdRef = useRef(0);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '');
  const categoryFromUrl = referenceCategory(searchParams.get('category'));
  const [category, setCategory] = useState<ReferenceCategory | undefined>(categoryFromUrl);
  const [capabilities, setCapabilities] = useState<ReferenceCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [listState, setListState] = useState<ReferenceListRequestState | null>(null);
  const [deletingReferenceId, setDeletingReferenceId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const page = positiveInteger(searchParams.get('page'), 1);
  const pageSize = Math.min(100, positiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE));
  const search = searchParams.get('search')?.trim() || undefined;
  const listRequestKey = JSON.stringify({category, page, pageSize, projectId, revision, search});

  useLayoutEffect(() => {
    setCategory((current) => current === categoryFromUrl ? current : categoryFromUrl);
  }, [categoryFromUrl]);

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
    setCapabilitiesError(null);
    referenceApi.getCapabilities(projectId, controller.signal)
      .then((response) => setCapabilities(response.data))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setCapabilitiesError(referenceErrorDescriptor(requestError).message);
        }
      });
    return () => controller.abort();
  }, [projectId, revision]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    const requestId = ++listRequestIdRef.current;
    setListState((current) => ({
      data: current?.projectId === projectId ? current.data : null,
      error: null,
      loading: true,
      projectId,
      requestKey: listRequestKey,
    }));
    referenceApi.list(projectId, {
      category,
      page,
      pageSize,
      search,
    }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || listRequestIdRef.current !== requestId) return;
        setListState({
          data: response.data,
          error: null,
          loading: false,
          projectId,
          requestKey: listRequestKey,
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || listRequestIdRef.current !== requestId) return;
        setListState((current) => current?.requestKey === listRequestKey
          ? {
            ...current,
            error: referenceErrorDescriptor(requestError).message,
            loading: false,
          }
          : current);
      });
    return () => controller.abort();
  }, [category, listRequestKey, page, pageSize, projectId, search]);

  const categories = CATEGORY_VALUES.map((key) => ({
    key,
    label: t(`referenceLibrary.category.${key}`),
  }));

  const updateFilter = (key: string, value?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, {replace: true});
  };

  const handleCategoryChange = (value: ReferenceCategory | 'all') => {
    const nextCategory = value === 'all' ? undefined : value;
    setCategory(nextCategory);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextCategory) next.set('category', nextCategory);
      else next.delete('category');
      next.delete('page');
      return next;
    }, {replace: true});
  };

  const activeListState = listState?.requestKey === listRequestKey ? listState : null;
  const data = listState?.projectId === projectId ? listState.data : null;
  const items = data?.items;
  const error = capabilitiesError ?? activeListState?.error ?? null;
  const loading = !data && (activeListState?.loading ?? true);
  const visibleItems = useMemo(() => {
    const normalizedSearch = search?.toLocaleLowerCase() ?? '';
    return (items ?? []).filter((item) => {
      const matchesCategory = !category || item.category === category;
      const matchesSearch = !normalizedSearch
        || item.title.toLocaleLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [category, items, search]);

  const resetFilters = () => {
    setCategory(undefined);
    setSearchValue('');
    setSearchParams({}, {replace: true});
  };

  const confirmDelete = (item: ReferenceListItem) => {
    Modal.confirm({
      cancelText: t('common.cancel'),
      content: t('referenceLibrary.delete.description'),
      okButtonProps: {danger: true},
      okText: t('common.delete'),
      title: t('referenceLibrary.delete.title', {title: item.title}),
      onOk: async () => {
        setDeletingReferenceId(item.id);
        try {
          await referenceApi.archive(projectId, item.id, item.version);
          message.success(t('referenceLibrary.delete.success'));
          if (page > 1 && data?.items.length === 1) {
            updateFilter('page', String(page - 1));
          } else {
            setRevision((value) => value + 1);
          }
        } catch (requestError: unknown) {
          message.error(referenceErrorDescriptor(requestError).message);
        } finally {
          setDeletingReferenceId(null);
        }
      },
    });
  };

  const hasFilters = Boolean(search || category);
  const canEdit = capabilities?.permissions.canEdit ?? false;

  if (!projectId) return <Result status="404" title={t('referenceLibrary.errors.projectMissing')} />;

  return (
    <ReferenceLibraryShell projectId={projectId}>
      <main className="reference-library-page">
        <header className="reference-page-heading">
          <div>
            <h1>{t('referenceLibrary.title')}</h1>
            <p>{t('referenceLibrary.subtitle')}</p>
          </div>
          <div className="reference-page-heading__actions">
            <Button
              size="middle"
              className="craft-action-button craft-action-button--secondary"
              icon={<ArrowLeftOutlined />}
              aria-label={t('common.back')}
              onClick={() => navigate(projectDashboardPath(projectId))}
            >
              {t('common.back')}
            </Button>
            {canEdit && (
              <Button
                size="middle"
                type="primary"
                className="craft-action-button"
                icon={<PlusOutlined />}
                onClick={() => navigate(referenceCreatePath(projectId))}
              >
                {t('referenceLibrary.actions.create')}
              </Button>
            )}
          </div>
        </header>

        {capabilities && !capabilities.permissions.canEdit && (
          <Alert type="info" showIcon message={t('referenceLibrary.readOnly')} />
        )}

        <section className="reference-toolbar" aria-label={t('referenceLibrary.filters.title')}>
          <Select
            aria-label={t('referenceLibrary.filters.categories')}
            className="reference-toolbar__category"
            value={category ?? 'all'}
            options={[
              {label: t('referenceLibrary.filters.all'), value: 'all'},
              ...categories.map(({key, label}) => ({label, value: key})),
            ]}
            onChange={(value: ReferenceCategory | 'all') => {
              handleCategoryChange(value);
            }}
          />
          <Input
            allowClear
            className="reference-toolbar__search"
            placeholder={t('referenceLibrary.filters.search')}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </section>

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
        ) : data && visibleItems.length > 0 ? (
          <>
            <div className="reference-grid">
              {visibleItems.map((item) => (
                <ReferenceCard
                  compact
                  deleting={deletingReferenceId === item.id}
                  key={item.id}
                  item={item}
                  onDelete={canEdit ? () => confirmDelete(item) : undefined}
                  onOpen={() => navigate(referenceDetailPath(projectId, item.id))}
                />
              ))}
            </div>
            {data.total > data.pageSize && (
              <Pagination
                responsive
                current={data.page}
                pageSize={data.pageSize}
                total={data.total}
                showSizeChanger={false}
                onChange={(nextPage) => updateFilter('page', String(nextPage))}
              />
            )}
          </>
        ) : (
          <Empty
            image={<AppstoreOutlined className="reference-empty-icon" />}
            description={hasFilters
              ? t('referenceLibrary.empty.filtered')
              : t('referenceLibrary.empty.description')}
          >
            {hasFilters ? (
              <Button onClick={resetFilters}>
                {t('referenceLibrary.empty.reset')}
              </Button>
            ) : canEdit ? (
              <Button
                type="primary"
                className="craft-action-button"
                icon={<PlusOutlined />}
                onClick={() => navigate(referenceCreatePath(projectId))}
              >
                {t('referenceLibrary.empty.create')}
              </Button>
            ) : undefined}
          </Empty>
        )}
      </main>
    </ReferenceLibraryShell>
  );
}
