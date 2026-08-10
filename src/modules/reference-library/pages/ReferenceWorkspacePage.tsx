import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeftOutlined,
  EditOutlined,
  InboxOutlined,
  PictureOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
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
import VisualInspectorShell from '../components/visual-editor/VisualInspectorShell';
import {
  AppearanceSettingsTab,
  MainSettingsTab,
} from '../components/visual-editor/VisualReferenceInspector';
import VisualReferenceHeader from '../components/visual-editor/VisualReferenceHeader';
import VisualReferenceVersions from '../components/visual-editor/VisualReferenceVersions';
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
import '../visualReferenceEditor.css';

type EditInspectorTab = 'main' | 'appearance';
type PreviewLoadState = 'empty' | 'error' | 'loading' | 'ready';

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
  return FALLBACK_CATEGORIES.find((category) => category === requestedCategory) ?? 'location';
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
  const isReferenceEditorRoute = isEditRoute || Boolean(jobId);
  const [capabilities, setCapabilities] = useState<ReferenceCapabilities | null>(null);
  const [reference, setReference] = useState<ReferenceDetail | null>(null);
  const usesEditLayout = isReferenceEditorRoute && reference?.category === 'location';
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
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<EditInspectorTab>('main');
  const [previewLoadState, setPreviewLoadState] = useState<PreviewLoadState>('empty');
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadRightsConfirmed, setUploadRightsConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const enqueueIntentRef = useRef<{fingerprint: string; key: string} | null>(null);
  const initializedGenerationJobRef = useRef<string | null>(null);
  const {allowNextNavigation} = useUnsavedChangesGuard(
    (isCreateRoute || isReferenceEditorRoute) && dirty,
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
      setSelectedVersionId(null);
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
        const nextVersions = versionsResponse.data.items;
        setVersions(nextVersions);
        setSelectedVersionId((current) => (
          current && (
            nextVersions.some(({id}) => id === current)
            || (Boolean(jobId) && current.startsWith('variant:'))
          )
            ? current
            : nextReference.activeVersion?.id ?? nextVersions[0]?.id ?? null
        ));
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
  }, [jobId, projectId, referenceId, revision, routeMode]);

  useEffect(() => {
    setSelectedVariantId(null);
    setSelectedVersionId(null);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      initializedGenerationJobRef.current = null;
      return;
    }
    if (
      generation.job?.status !== 'completed'
      || initializedGenerationJobRef.current === jobId
    ) return;
    initializedGenerationJobRef.current = jobId;
    const firstGenerated = generation.job.variants.find((variant) => variant.status === 'generated');
    setSelectedVariantId(firstGenerated?.id ?? null);
    if (firstGenerated) setSelectedVersionId(`variant:${firstGenerated.id}`);
  }, [generation.job, jobId]);

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
  const editable = (isCreateRoute || isReferenceEditorRoute) && canEdit;
  const selectedGeneratedVariant = generation.job?.variants.find((variant) => (
    `variant:${variant.id}` === selectedVersionId && variant.status === 'generated'
  )) ?? null;
  const selectedVersion = versions.find(({id}) => id === selectedVersionId)
    ?? (selectedGeneratedVariant ? null : reference?.activeVersion)
    ?? null;
  const activeImage = usesEditLayout
    ? selectedGeneratedVariant?.imageUrl
      || selectedGeneratedVariant?.thumbnailUrl
      || selectedVersion?.imageUrl
      || selectedVersion?.thumbnailUrl
      || ''
    : reference?.activeVersion?.imageUrl || reference?.activeVersion?.thumbnailUrl || '';

  useEffect(() => {
    setPreviewLoadState(activeImage ? 'loading' : 'empty');
  }, [activeImage, previewReloadKey]);

  const markDirty = () => setDirty(true);
  const handleTitleChange = (value: string) => { setTitle(value); markDirty(); };
  const handleCategoryChange = (value: ReferenceCategory) => { setCategory(value); markDirty(); };
  const handleDescriptionChange = (value: string) => { setDescription(value); markDirty(); };
  const handleBriefChange = (value: ReferenceBrief) => { setBrief(value); markDirty(); };
  const handleTagsChange = (value: string[]) => { setTags(value); markDirty(); };
  const handlePreviewSelect = (value: string) => {
    setSelectedVersionId(value);
    setSelectedVariantId(value.startsWith('variant:') ? value.slice('variant:'.length) : null);
  };
  const cancelEdit = () => {
    if (!reference) return;
    setTitle(reference.title);
    setCategory(reference.category);
    setDescription(reference.description ?? '');
    setBrief(reference.brief ?? EMPTY_BRIEF);
    setTags(reference.tags ?? []);
    setDirty(false);
    setError(null);
  };

  const save = async () => {
    const validationKey = requiredTitle(title);
    if (validationKey) {
      setActiveInspectorTab('main');
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

  const upload = async (file: File): Promise<boolean> => {
    if (!referenceId || !reference || !capabilities) return false;
    if (dirty) {
      setError(t('referenceLibrary.validation.saveBeforeMediaAction'));
      return false;
    }
    setUploading(true);
    setError(null);
    try {
      const response = await referenceApi.uploadVersion(
        projectId,
        referenceId,
        file,
        reference.version,
        capabilities.upload.rightsStatementVersion,
      );
      setSelectedVersionId(response.data.activeVersion.id);
      message.success(t('referenceLibrary.upload.success'));
      setRevision((value) => value + 1);
      return true;
    } catch (requestError: unknown) {
      setError(referenceErrorDescriptor(requestError).message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  const confirmUpload = async () => {
    if (!pendingUploadFile || !uploadRightsConfirmed) return;
    const uploaded = await upload(pendingUploadFile);
    if (uploaded) {
      setPendingUploadFile(null);
      setUploadRightsConfirmed(false);
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
          navigate(referenceEditPath(projectId, referenceId), {replace: true});
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
  const generationInProgress = Boolean(jobId && !generation.errorMessage && !generation.isTerminal);
  const busy = saving || uploading || actionLoading || generationInProgress;
  const editDisabled = !editable || busy;
  const persistedVersionItems = versions.map((version) => {
    const imageUrl = version.thumbnailUrl || version.imageUrl || '';
    return {
      id: version.id,
      imageUrl: imageUrl ? backendAssetUrl(imageUrl) : '',
      label: `v${version.number} · ${t(`referenceLibrary.versions.origin.${version.origin ?? 'upload'}`)}`,
      primary: version.id === reference?.activeVersion?.id,
    };
  });
  const generatedVersionItems = generation.job?.status === 'completed'
    ? generation.job.variants.flatMap((variant, index) => {
      const imageUrl = variant.thumbnailUrl || variant.imageUrl || '';
      return variant.status === 'generated' && imageUrl ? [{
        id: `variant:${variant.id}`,
        imageUrl: backendAssetUrl(imageUrl),
        label: t('referenceLibrary.variants.item', {number: index + 1}),
      }] : [];
    })
    : [];
  const versionItems = [...persistedVersionItems, ...generatedVersionItems];
  const editInspectorItems = [
    {
      key: 'main',
      label: t('referenceLibrary.editor.tabs.main'),
      children: (
        <MainSettingsTab
          category={category}
          description={description}
          disabled={editDisabled}
          onCategoryChange={handleCategoryChange}
          onDescriptionChange={handleDescriptionChange}
        />
      ),
    },
    {
      key: 'appearance',
      label: t('referenceLibrary.editor.tabs.appearance'),
      children: (
        <AppearanceSettingsTab
          brief={brief}
          category={category}
          disabled={editDisabled}
          onBriefChange={handleBriefChange}
        />
      ),
    },
  ];

  return (
    <ReferenceLibraryShell projectId={projectId} currentTitle={titleForBreadcrumb}>
      <main className={usesEditLayout
        ? 'visual-reference-editor visual-reference-edit-page'
        : 'reference-workspace'}
      >
        {loading ? (
          <div className="reference-workspace__loading"><Skeleton active paragraph={{rows: 10}} /></div>
        ) : error && !reference && !isCreateRoute ? (
          <Result
            status="error"
            title={t('referenceLibrary.errors.loadDetail')}
            subTitle={error}
            extra={<Button icon={<ReloadOutlined />} onClick={() => setRevision((value) => value + 1)}>{t('common.retry')}</Button>}
          />
        ) : usesEditLayout && reference && referenceId ? (
          <>
            <div className="visual-reference-edit-page__top">
              <VisualReferenceHeader
                beforeSaveActions={(
                  <>
                  <Button
                    size="middle"
                    className="craft-action-button craft-action-button--secondary"
                    icon={<ArrowLeftOutlined />}
                    aria-label={t('common.back')}
                    onClick={() => navigate(referenceLibraryPath(projectId))}
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    size="middle"
                    className="craft-action-button craft-action-button--secondary"
                    disabled={busy}
                    onClick={cancelEdit}
                  >
                    {t('common.clear')}
                  </Button>
                  </>
                )}
                canSave={editable && dirty && !busy}
                disabled={!editable || busy}
                saving={saving}
                title={title}
                onSave={() => void save()}
                onTitleChange={handleTitleChange}
              />

              {(error || (!canEdit && capabilities)) && (
                <div className="visual-reference-edit-page__messages">
                {!canEdit && capabilities && (
                  <Alert type="info" showIcon message={t('referenceLibrary.readOnly')} />
                )}
                {error && (
                  <Alert
                    type="error"
                    showIcon
                    closable
                    message={error}
                    onClose={() => setError(null)}
                  />
                )}
                </div>
              )}
            </div>

            <div className="visual-reference-editor__workspace">
              <section
                className="visual-reference-stage visual-reference-edit-stage"
                aria-label={t('referenceLibrary.editor.canvas.label')}
              >
                <input
                  ref={fileInputRef}
                  className="visual-reference-file-input"
                  type="file"
                  accept={capabilities?.upload.mimeTypes.join(',')}
                  disabled={editDisabled || dirty}
                  aria-label={t('referenceLibrary.editor.empty.upload')}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setPendingUploadFile(file);
                      setUploadRightsConfirmed(false);
                    }
                    event.target.value = '';
                  }}
                />

                <div className="visual-reference-canvas visual-reference-edit-canvas">
                  {activeImage ? (
                    <>
                      <div className={`visual-reference-canvas__image-wrap is-${previewLoadState}`}>
                        <img
                          key={`${activeImage}:${previewReloadKey}`}
                          src={backendAssetUrl(activeImage)}
                          alt={t('referenceLibrary.preview.alt', {title})}
                          onLoad={() => setPreviewLoadState('ready')}
                          onError={() => setPreviewLoadState('error')}
                        />
                      </div>
                      {previewLoadState === 'loading' && (
                        <div className="visual-reference-edit-canvas__state" role="status">
                          <ReloadOutlined spin />
                          <span>{t('common.loading')}</span>
                        </div>
                      )}
                      {previewLoadState === 'error' && (
                        <div className="visual-reference-edit-canvas__state" role="alert">
                          <PictureOutlined />
                          <span>{t('referenceLibrary.errors.loadDetail')}</span>
                          <Button
                            icon={<ReloadOutlined />}
                            onClick={() => setPreviewReloadKey((value) => value + 1)}
                          >
                            {t('common.retry')}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="visual-reference-empty">
                      <span className="visual-reference-empty__icon"><PictureOutlined /></span>
                      <h2>{t('referenceLibrary.preview.empty')}</h2>
                    </div>
                  )}
                  {selectedVersion && (
                    <span className="visual-reference-edit-canvas__version">v{selectedVersion.number}</span>
                  )}
                  {!selectedVersion && selectedGeneratedVariant && (
                    <span className="visual-reference-edit-canvas__version">
                      {t('referenceLibrary.variants.item', {
                        number: selectedGeneratedVariant.index + 1,
                      })}
                    </span>
                  )}
                </div>

                <div className="visual-reference-edit-stage__actions">
                  <Button
                    type="primary"
                    size="middle"
                    icon={<ReloadOutlined />}
                    aria-label={t('referenceLibrary.editor.generate.more')}
                    disabled={!canGenerate || dirty || reference.status === 'archived' || busy}
                    loading={actionLoading}
                    onClick={() => void enqueue()}
                  >
                    {t('referenceLibrary.editor.generate.more')}
                  </Button>
                  <Button
                    size="middle"
                    icon={<UploadOutlined />}
                    aria-label={t('referenceLibrary.editor.empty.upload')}
                    disabled={editDisabled || dirty}
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('referenceLibrary.editor.empty.upload')}
                  </Button>
                  {selectedGeneratedVariant && generation.job?.status === 'completed' && (
                    <Button
                      type="primary"
                      size="middle"
                      disabled={!canEdit || applying}
                      loading={applying}
                      onClick={applySelected}
                    >
                      {t('referenceLibrary.variants.apply')}
                    </Button>
                  )}
                </div>

                {jobId && generation.loading && (
                  <div className="visual-reference-edit-stage__job"><Skeleton active paragraph={{rows: 2}} /></div>
                )}
                {jobId && generation.errorMessage && (
                  <div className="visual-reference-edit-stage__job">
                    <Alert
                      type="error"
                      showIcon
                      message={generation.errorMessage}
                      action={<Button onClick={generation.refresh}>{t('common.retry')}</Button>}
                    />
                  </div>
                )}
                {generation.job && (
                  <div className="visual-reference-edit-stage__job">
                    <ReferenceJobState
                      actionLoading={actionLoading}
                      job={generation.job}
                      onCancel={() => void cancelJob()}
                      onRetry={() => void retryJob()}
                    />
                  </div>
                )}
              </section>

              <VisualInspectorShell
                activeTab={activeInspectorTab}
                items={editInspectorItems}
                onTabChange={(value) => {
                  if (value === 'main' || value === 'appearance') setActiveInspectorTab(value);
                }}
                bottomContent={(
                  <VisualReferenceVersions
                    items={versionItems}
                    selectedId={selectedVersionId}
                    onSelect={handlePreviewSelect}
                  />
                )}
              />
            </div>
            <Modal
              open={Boolean(pendingUploadFile)}
              title={t('referenceLibrary.upload.title')}
              okText={t('referenceLibrary.upload.action')}
              cancelText={t('common.cancel')}
              confirmLoading={uploading}
              okButtonProps={{disabled: !uploadRightsConfirmed}}
              onCancel={() => {
                if (uploading) return;
                setPendingUploadFile(null);
                setUploadRightsConfirmed(false);
              }}
              onOk={() => void confirmUpload()}
            >
              <p>{t('referenceLibrary.upload.helper', {
                maxMb: Math.round((capabilities?.upload.maxBytes ?? 0) / 1024 / 1024),
              })}</p>
              <Checkbox
                checked={uploadRightsConfirmed}
                disabled={uploading}
                onChange={(event) => setUploadRightsConfirmed(event.target.checked)}
              >
                {t('referenceLibrary.upload.rights')}
              </Checkbox>
            </Modal>
          </>
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
                        <Button onClick={cancelEdit}>
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
        {!usesEditLayout && (
          <Button className="reference-back-link" onClick={() => navigate(referenceLibraryPath(projectId))}>
            {t('referenceLibrary.actions.backToLibrary')}
          </Button>
        )}
      </main>
    </ReferenceLibraryShell>
  );
}
