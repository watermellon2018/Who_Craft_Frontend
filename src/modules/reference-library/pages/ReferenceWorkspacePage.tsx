import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  EditOutlined,
  InboxOutlined,
  PictureOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Result,
  Select,
  Skeleton,
  Space,
} from 'antd';
import {flushSync} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

import {backendAssetUrl} from '../../../api/http';
import {
  referenceDetailPath,
  referenceEditPath,
  referenceJobPath,
  referenceLibraryPath,
} from '../../../routes/pathConstant';
import {useUnsavedChangesGuard} from '../../../utils/useUnsavedChangesGuard';
import {newReferenceIdempotencyKey, referenceApi} from '../api/referenceApi';
import ReferenceBriefForm from '../components/ReferenceBriefForm';
import ReferenceJobState from '../components/ReferenceJobState';
import ReferenceLibraryShell from '../components/ReferenceLibraryShell';
import ReferenceStatusTag from '../components/ReferenceStatusTag';
import ReferenceUpload from '../components/ReferenceUpload';
import ReferenceVariantGrid from '../components/ReferenceVariantGrid';
import ReferenceVersionHistory from '../components/ReferenceVersionHistory';
import {referenceErrorDescriptor} from '../errors';
import {useReferenceGenerationJob} from '../hooks/useReferenceGenerationJob';
import type {
  ReferenceBrief,
  ReferenceCapabilities,
  ReferenceCategory,
  ReferenceDetail,
  ReferenceEnqueueRequest,
  ReferenceVersion,
} from '../types';
import '../referenceLibrary.css';

const FALLBACK_CATEGORIES: ReferenceCategory[] = ['location', 'prop', 'wardrobe', 'vehicle', 'symbol', 'other'];
const EMPTY_BRIEF: ReferenceBrief = {
  aspectRatio: '1:1',
  schemaVersion: 'reference_brief.v1',
};

function requiredTitle(value: string): string | null {
  const title = value.trim();
  if (!title) return 'title';
  if (title.length > 255) return 'titleLength';
  return null;
}

export function referenceWorkspaceRouteMode(pathname: string): 'create' | 'detail' | 'edit' {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath.endsWith('/create')) return 'create';
  if (normalizedPath.endsWith('/edit')) return 'edit';
  return 'detail';
}

export function referenceWorkspaceCreateCategory(search: string): ReferenceCategory {
  const requestedCategory = new URLSearchParams(search).get('category');
  return FALLBACK_CATEGORIES.find((category) => category === requestedCategory) ?? 'prop';
}

export default function ReferenceWorkspacePage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {jobId, projectId = '', referenceId} = useParams<{
    jobId?: string;
    projectId: string;
    referenceId?: string;
  }>();
  const routeMode = referenceWorkspaceRouteMode(location.pathname);
  const isCreateRoute = routeMode === 'create';
  const isEditRoute = routeMode === 'edit';
  const [capabilities, setCapabilities] = useState<ReferenceCapabilities | null>(null);
  const [reference, setReference] = useState<ReferenceDetail | null>(null);
  const [versions, setVersions] = useState<ReferenceVersion[]>([]);
  const [loading, setLoading] = useState(!isCreateRoute);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReferenceCategory>(() => (
    isCreateRoute ? referenceWorkspaceCreateCategory(location.search) : 'prop'
  ));
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState<ReferenceBrief>(EMPTY_BRIEF);
  const [tags, setTags] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [revision, setRevision] = useState(0);
  const [operation, setOperation] = useState<'generate' | 'edit'>('generate');
  const [variantCount, setVariantCount] = useState(1);
  const [editInstruction, setEditInstruction] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const enqueueIntentRef = useRef<{fingerprint: string; key: string} | null>(null);
  const {allowNextNavigation} = useUnsavedChangesGuard(
    (isCreateRoute || isEditRoute) && dirty,
    t('referenceLibrary.unsaved.description'),
  );
  const generation = useReferenceGenerationJob(projectId, referenceId, jobId);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    referenceApi.getCapabilities(projectId, controller.signal)
      .then((response) => {
        setCapabilities(response.data);
        const counts = response.data.generation.generateVariantCounts;
        setVariantCount(counts.includes(4) ? 4 : counts[0] ?? 1);
        setBrief((current) => ({
          ...current,
          aspectRatio: current.aspectRatio || response.data.generation.aspectRatios[0] || '1:1',
        }));
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(referenceErrorDescriptor(requestError).message);
      });
    return () => controller.abort();
  }, [projectId, revision]);

  useEffect(() => {
    if (!projectId || !referenceId) {
      setReference(null);
      setVersions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      referenceApi.getReference(projectId, referenceId, controller.signal),
      referenceApi.listVersions(projectId, referenceId, controller.signal),
    ])
      .then(([referenceResponse, versionsResponse]) => {
        const nextReference = referenceResponse.data;
        setReference(nextReference);
        setVersions(versionsResponse.data.items);
        setTitle(nextReference.title);
        setCategory(nextReference.category);
        setDescription(nextReference.description ?? '');
        setBrief(nextReference.brief ?? EMPTY_BRIEF);
        setTags(nextReference.tags ?? []);
        setDirty(false);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(referenceErrorDescriptor(requestError).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [jobId, projectId, referenceId, revision]);

  useEffect(() => {
    setSelectedVariantId(null);
  }, [jobId]);

  useEffect(() => {
    if (generation.job?.status !== 'completed' || selectedVariantId) return;
    const firstGenerated = generation.job.variants.find((variant) => variant.status === 'generated');
    setSelectedVariantId(firstGenerated?.id ?? null);
  }, [generation.job, selectedVariantId]);

  const categories = useMemo(
    () => (capabilities?.categories.map(({key}) => key) ?? FALLBACK_CATEGORIES).map((key) => ({
      key,
      label: t(`referenceLibrary.category.${key}`),
    })),
    [capabilities?.categories, t],
  );
  const canEdit = capabilities?.permissions.canEdit ?? false;
  const canGenerate = capabilities?.permissions.canRunGeneration
    && capabilities.generation.canGenerate;
  const editable = (isCreateRoute || isEditRoute) && canEdit;
  const activeImage = reference?.activeVersion?.imageUrl || reference?.activeVersion?.thumbnailUrl || '';

  const markDirty = () => setDirty(true);
  const handleTitleChange = (value: string) => { setTitle(value); markDirty(); };
  const handleCategoryChange = (value: ReferenceCategory) => { setCategory(value); markDirty(); };
  const handleDescriptionChange = (value: string) => { setDescription(value); markDirty(); };
  const handleBriefChange = (value: ReferenceBrief) => { setBrief(value); markDirty(); };
  const handleTagsChange = (value: string[]) => { setTags(value); markDirty(); };

  const save = async () => {
    const validationKey = requiredTitle(title);
    if (validationKey) {
      setError(t(`referenceLibrary.validation.${validationKey}`));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isCreateRoute) {
        const response = await referenceApi.create(projectId, {
          brief,
          category,
          description: description.trim(),
          tags,
          title: title.trim(),
        });
        flushSync(() => setDirty(false));
        allowNextNavigation();
        navigate(referenceEditPath(projectId, response.data.id), {replace: true});
      } else if (referenceId && reference) {
        const response = await referenceApi.update(projectId, referenceId, {
          brief,
          category,
          description: description.trim(),
          tags,
          title: title.trim(),
          version: reference.version,
        });
        setReference(response.data);
        setDirty(false);
        message.success(t('referenceLibrary.actions.saved'));
      }
    } catch (requestError: unknown) {
      setError(referenceErrorDescriptor(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (!referenceId || !reference || !capabilities) return;
    if (dirty) {
      setError(t('referenceLibrary.validation.saveBeforeMediaAction'));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await referenceApi.uploadVersion(
        projectId,
        referenceId,
        file,
        reference.version,
        capabilities.upload.rightsStatementVersion,
      );
      message.success(t('referenceLibrary.upload.success'));
      setRevision((value) => value + 1);
    } catch (requestError: unknown) {
      setError(referenceErrorDescriptor(requestError).message);
    } finally {
      setUploading(false);
    }
  };

  const enqueue = async () => {
    if (!referenceId || !reference || !capabilities) return;
    if (dirty) {
      setError(t('referenceLibrary.validation.saveBeforeMediaAction'));
      return;
    }
    if (!description.trim()) {
      setError(t('referenceLibrary.validation.generateDescription'));
      return;
    }
    if (operation === 'edit' && (!reference.activeVersion || !editInstruction.trim())) {
      setError(t('referenceLibrary.validation.editInstruction'));
      return;
    }
    const payload: ReferenceEnqueueRequest = {
      brief: {...brief, description: description.trim()},
      editInstruction: operation === 'edit' ? editInstruction.trim() : undefined,
      expectedReferenceVersion: reference.version,
      imageModel: '',
      operation,
      sourceVersionId: operation === 'edit' ? reference.activeVersion?.id ?? null : null,
      variantCount: operation === 'edit' ? 1 : variantCount,
    };
    const fingerprint = JSON.stringify(payload);
    const intent = enqueueIntentRef.current?.fingerprint === fingerprint
      ? enqueueIntentRef.current
      : {fingerprint, key: newReferenceIdempotencyKey()};
    enqueueIntentRef.current = intent;
    setActionLoading(true);
    setError(null);
    try {
      const response = await referenceApi.enqueueJob(
        projectId,
        referenceId,
        payload,
        intent.key,
      );
      navigate(referenceJobPath(projectId, referenceId, response.data.id));
    } catch (requestError: unknown) {
      setError(referenceErrorDescriptor(requestError).message);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelJob = async () => {
    if (!referenceId || !jobId) return;
    setActionLoading(true);
    try {
      await referenceApi.cancelJob(projectId, referenceId, jobId);
      generation.refresh();
    } catch (requestError: unknown) {
      setError(referenceErrorDescriptor(requestError).message);
    } finally {
      setActionLoading(false);
    }
  };

  const retryJob = async () => {
    if (!referenceId || !jobId) return;
    setActionLoading(true);
    try {
      const response = await referenceApi.retryJob(projectId, referenceId, jobId);
      navigate(referenceJobPath(projectId, referenceId, response.data.id), {replace: true});
    } catch (requestError: unknown) {
      setError(referenceErrorDescriptor(requestError).message);
    } finally {
      setActionLoading(false);
    }
  };

  const applySelected = () => {
    if (!referenceId || !jobId || !reference || !selectedVariantId) return;
    Modal.confirm({
      cancelText: t('common.cancel'),
      content: t('referenceLibrary.variants.applyConfirmDescription'),
      okText: t('referenceLibrary.variants.apply'),
      title: t('referenceLibrary.variants.applyConfirmTitle'),
      onOk: async () => {
        setApplying(true);
        try {
          const response = await referenceApi.applyVariant(
            projectId,
            referenceId,
            jobId,
            selectedVariantId,
            reference.version,
          );
          message.success(t('referenceLibrary.variants.applied', {
            version: response.data.activeVersion.number,
          }));
          navigate(referenceDetailPath(projectId, referenceId), {replace: true});
        } catch (requestError: unknown) {
          setError(referenceErrorDescriptor(requestError).message);
          throw requestError;
        } finally {
          setApplying(false);
        }
      },
    });
  };

  const toggleArchive = () => {
    if (!referenceId || !reference) return;
    if (dirty) {
      setError(t('referenceLibrary.validation.saveBeforeMediaAction'));
      return;
    }
    const archived = reference.status === 'archived';
    const action = archived ? referenceApi.restore : referenceApi.archive;
    Modal.confirm({
      cancelText: t('common.cancel'),
      content: archived
        ? t('referenceLibrary.archive.restoreDescription')
        : t('referenceLibrary.archive.description'),
      okText: archived
        ? t('referenceLibrary.archive.restore')
        : t('referenceLibrary.archive.action'),
      title: archived
        ? t('referenceLibrary.archive.restoreTitle')
        : t('referenceLibrary.archive.title'),
      onOk: async () => {
        setActionLoading(true);
        try {
          await action(projectId, referenceId, reference.version);
          setRevision((value) => value + 1);
        } catch (requestError: unknown) {
          setError(referenceErrorDescriptor(requestError).message);
          throw requestError;
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  if (!projectId) return <Result status="404" title={t('referenceLibrary.errors.projectMissing')} />;

  const titleForBreadcrumb = isCreateRoute
    ? t('referenceLibrary.create.title')
    : reference?.title || t('referenceLibrary.detail.title');

  return (
    <ReferenceLibraryShell projectId={projectId} currentTitle={titleForBreadcrumb}>
      <main className="reference-workspace">
        {loading ? (
          <div className="reference-workspace__loading"><Skeleton active paragraph={{rows: 10}} /></div>
        ) : error && !reference && !isCreateRoute ? (
          <Result
            status="error"
            title={t('referenceLibrary.errors.loadDetail')}
            subTitle={error}
            extra={<Button icon={<ReloadOutlined />} onClick={() => setRevision((value) => value + 1)}>{t('common.retry')}</Button>}
          />
        ) : (
          <>
            <header className="reference-page-heading reference-workspace__heading">
              <div>
                <span className="reference-eyebrow">{isCreateRoute ? t('referenceLibrary.create.eyebrow') : t('referenceLibrary.detail.eyebrow')}</span>
                <h1>{isCreateRoute ? t('referenceLibrary.create.title') : reference?.title}</h1>
                <p>{
                  isCreateRoute
                    ? t('referenceLibrary.create.subtitle')
                    : reference
                      ? t(`referenceLibrary.category.${reference.category}`)
                      : ''
                }</p>
              </div>
              <Space wrap>
                {reference && <ReferenceStatusTag status={reference.status} />}
                {!isCreateRoute && !isEditRoute && referenceId && canEdit && (
                  <Button icon={<EditOutlined />} onClick={() => navigate(referenceEditPath(projectId, referenceId))}>
                    {t('referenceLibrary.actions.edit')}
                  </Button>
                )}
                {reference && canEdit && (
                  <Button
                    icon={reference.status === 'archived' ? <UndoOutlined /> : <InboxOutlined />}
                    disabled={dirty}
                    loading={actionLoading}
                    onClick={toggleArchive}
                  >
                    {reference.status === 'archived'
                      ? t('referenceLibrary.archive.restore')
                      : t('referenceLibrary.archive.action')}
                  </Button>
                )}
              </Space>
            </header>

            {!canEdit && capabilities && <Alert type="info" showIcon message={t('referenceLibrary.readOnly')} />}
            {error && <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} />}

            <div className="reference-workspace__grid">
              <section className="reference-preview-column">
                <div className="reference-preview">
                  {activeImage ? (
                    <img
                      src={backendAssetUrl(activeImage)}
                      alt={t('referenceLibrary.preview.alt', {title: reference?.title})}
                    />
                  ) : (
                    <div className="reference-preview__empty">
                      <PictureOutlined />
                      <span>{t('referenceLibrary.preview.empty')}</span>
                    </div>
                  )}
                  {reference?.activeVersion && (
                    <span className="reference-preview__version">v{reference.activeVersion.number}</span>
                  )}
                </div>

                {jobId && generation.loading && <Skeleton active paragraph={{rows: 4}} />}
                {jobId && generation.errorMessage && (
                  <Result
                    status="error"
                    title={t('referenceLibrary.errors.loadJob')}
                    subTitle={generation.errorMessage}
                    extra={<Button onClick={generation.refresh}>{t('common.retry')}</Button>}
                  />
                )}
                {generation.job && (
                  <>
                    <ReferenceJobState
                      actionLoading={actionLoading}
                      job={generation.job}
                      onCancel={() => void cancelJob()}
                      onRetry={() => void retryJob()}
                    />
                    {generation.job.status === 'completed' && (
                      <ReferenceVariantGrid
                        applying={applying}
                        canApply={canEdit}
                        selectedVariantId={selectedVariantId}
                        variants={generation.job.variants}
                        onApply={applySelected}
                        onSelect={setSelectedVariantId}
                      />
                    )}
                  </>
                )}

                {reference && !jobId && editable && capabilities && (
                  <>
                    {dirty && (
                      <Alert
                        showIcon
                        type="info"
                        message={t('referenceLibrary.validation.saveBeforeMediaAction')}
                      />
                    )}
                    <ReferenceUpload
                      accept={capabilities.upload.mimeTypes.join(',')}
                      disabled={!canEdit || dirty}
                      loading={uploading}
                      maxBytes={capabilities.upload.maxBytes}
                      onUpload={(file) => void upload(file)}
                    />
                    <section className="reference-card-panel">
                      <div className="reference-section-heading">
                        <div>
                          <h2>{t('referenceLibrary.generate.title')}</h2>
                          <p>{t('referenceLibrary.generate.helper')}</p>
                        </div>
                      </div>
                      <Radio.Group
                        value={operation}
                        disabled={!canGenerate}
                        onChange={(event) => setOperation(event.target.value)}
                      >
                        <Radio.Button value="generate">{t('referenceLibrary.generate.new')}</Radio.Button>
                        <Radio.Button
                          value="edit"
                          disabled={!reference.activeVersion || !capabilities.generation.canEdit}
                        >
                          {t('referenceLibrary.generate.edit')}
                        </Radio.Button>
                      </Radio.Group>
                      {operation === 'edit' && (
                        <Form.Item label={t('referenceLibrary.generate.editInstruction')} required>
                          <Input.TextArea
                            maxLength={2000}
                            rows={3}
                            value={editInstruction}
                            onChange={(event) => setEditInstruction(event.target.value)}
                          />
                        </Form.Item>
                      )}
                      <div className="reference-form-grid">
                        <Form.Item label={t('referenceLibrary.form.aspectRatio')}>
                          <Select
                            value={brief.aspectRatio}
                            options={capabilities.generation.aspectRatios.map((value) => ({label: value, value}))}
                            onChange={(value) => handleBriefChange({...brief, aspectRatio: value})}
                          />
                        </Form.Item>
                        <Form.Item label={t('referenceLibrary.generate.variantCount')}>
                          <Select
                            disabled={operation === 'edit'}
                            value={operation === 'edit' ? 1 : variantCount}
                            options={capabilities.generation.generateVariantCounts.map((value) => ({label: value, value}))}
                            onChange={setVariantCount}
                          />
                        </Form.Item>
                      </div>
                      <Button
                        type="primary"
                        size="large"
                        disabled={!canGenerate || dirty || reference.status === 'archived'}
                        loading={actionLoading}
                        onClick={() => void enqueue()}
                      >
                        {t('referenceLibrary.generate.action', {count: operation === 'edit' ? 1 : variantCount})}
                      </Button>
                    </section>
                  </>
                )}

                {reference && <ReferenceVersionHistory activeVersionId={reference.activeVersion?.id} versions={versions} />}
              </section>

              <aside className="reference-inspector">
                <section className="reference-card-panel reference-inspector__form">
                  <div className="reference-section-heading">
                    <div>
                      <h2>{t('referenceLibrary.form.heading')}</h2>
                      <p>{t('referenceLibrary.form.helper')}</p>
                    </div>
                  </div>
                  <Form layout="vertical">
                    <ReferenceBriefForm
                      brief={brief}
                      categories={categories}
                      category={category}
                      description={description}
                      disabled={!editable}
                      tags={tags}
                      title={title}
                      onBriefChange={handleBriefChange}
                      onCategoryChange={handleCategoryChange}
                      onDescriptionChange={handleDescriptionChange}
                      onTagsChange={handleTagsChange}
                      onTitleChange={handleTitleChange}
                    />
                  </Form>
                  {editable && (
                    <div className="reference-inspector__actions">
                      <Button
                        type="primary"
                        size="large"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={() => void save()}
                      >
                        {isCreateRoute ? t('referenceLibrary.actions.createDraft') : t('referenceLibrary.actions.save')}
                      </Button>
                      {!isCreateRoute && referenceId && (
                        <Button onClick={() => navigate(referenceDetailPath(projectId, referenceId))}>
                          {t('common.cancel')}
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
        <Button className="reference-back-link" onClick={() => navigate(referenceLibraryPath(projectId))}>
          {t('referenceLibrary.actions.backToLibrary')}
        </Button>
      </main>
    </ReferenceLibraryShell>
  );
}
