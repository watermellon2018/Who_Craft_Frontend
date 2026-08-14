import {Alert, message, Result} from 'antd';
import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

import {backendAssetUrl} from '../../../api/http';
import {referenceEditPath} from '../../../routes/pathConstant';
import {useUnsavedChangesGuard} from '../../../utils/useUnsavedChangesGuard';
import {newReferenceIdempotencyKey, referenceApi} from '../api/referenceApi';
import VisualReferenceCanvas from '../components/visual-editor/VisualReferenceCanvas';
import VisualReferenceHeader from '../components/visual-editor/VisualReferenceHeader';
import VisualReferenceInspector from '../components/visual-editor/VisualReferenceInspector';
import type {
  GeneratedVisualPreview,
  UploadedVisualImage,
  VisualCanvasImage,
  VisualInspectorTab,
  VisualReferenceDraft,
  VisualReferenceType,
  VisualRelation,
  VisualRelationCandidate,
} from '../components/visual-editor/types';
import ReferenceLibraryShell from '../components/ReferenceLibraryShell';
import {referenceErrorDescriptor} from '../errors';
import {useReferenceGenerationJob} from '../hooks/useReferenceGenerationJob';
import type {
  ReferenceBrief,
  ReferenceCapabilities,
} from '../types';
import {referenceWorkspaceCreateCategory} from './ReferenceWorkspacePage';
import '../referenceLibrary.css';
import '../visualReferenceEditor.css';
import {
  GenerationCostPreview,
  runGenerationWithCredits,
} from '../../credits/components/GenerationCostGuard';

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp';
const EDITOR_DISPOSED = Symbol('visual-reference-editor-disposed');
const EMPTY_BRIEF: ReferenceBrief = {
  aspectRatio: '16:9',
  schemaVersion: 'reference_brief.v1',
};

interface DraftIdentity {
  id: string;
  version: number;
}

type CanvasSelection =
  | {kind: 'draft'; id: string}
  | {kind: 'generated-preview'}
  | {kind: 'uploaded'}
  | null;

function VisualReferenceCreateEditor() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {projectId = ''} = useParams<{projectId: string}>();
  const [capabilities, setCapabilities] = useState<ReferenceCapabilities | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VisualReferenceType>(() => (
    referenceWorkspaceCreateCategory(location.search)
  ));
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState<ReferenceBrief>(EMPTY_BRIEF);
  const [activeTab, setActiveTab] = useState<VisualInspectorTab>('main');
  const [drafts, setDrafts] = useState<VisualReferenceDraft[]>([]);
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedVisualPreview | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedVisualImage | null>(null);
  const [canvasSelection, setCanvasSelection] = useState<CanvasSelection>(null);
  const [primaryImageId, setPrimaryImageId] = useState<string | null>(null);
  const [relations, setRelations] = useState<VisualRelation[]>([]);
  const [relationCandidates, setRelationCandidates] = useState<VisualRelationCandidate[]>([]);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [addingToDrafts, setAddingToDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftIdentity, setDraftIdentity] = useState<DraftIdentity | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const mounted = useRef(true);
  const actionController = useRef<AbortController | null>(null);
  const addingToDraftsRef = useRef(false);
  const handledGenerationJob = useRef<string>();
  const persistedDraftFingerprint = useRef<string>();
  const generationIntent = useRef<{fingerprint: string; key: string}>();
  const generationPrompts = useRef(new Map<string, string>());
  const previewUrls = useRef(new Set<string>());
  const {allowNextNavigation} = useUnsavedChangesGuard(
    dirty,
    t('referenceLibrary.unsaved.description'),
  );
  const generation = useReferenceGenerationJob(
    projectId,
    draftIdentity?.id,
    generationJobId ?? undefined,
  );

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();

    const loadCapabilities = async () => {
      try {
        const response = await referenceApi.getCapabilities(projectId, controller.signal);
        if (controller.signal.aborted) return;
        setCapabilities(response.data);
        setBrief((current) => ({
          ...current,
          aspectRatio: response.data.generation.aspectRatios.includes(current.aspectRatio ?? '')
            ? current.aspectRatio
            : response.data.generation.aspectRatios[0] ?? current.aspectRatio,
        }));
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) {
          setError(referenceErrorDescriptor(requestError).message);
        }
      }
    };

    const loadLinkOptions = async () => {
      try {
        const response = await referenceApi.getLinkOptions(projectId, controller.signal);
        if (controller.signal.aborted) return;
        setRelationCandidates([
          ...response.data.characters.map(({id, name}) => ({id, kind: 'character' as const, name})),
          ...response.data.locations.map(({id, name}) => ({
            id: String(id),
            kind: 'location' as const,
            name,
          })),
        ]);
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) {
          setError(referenceErrorDescriptor(requestError).message);
        }
      }
    };

    void loadCapabilities();
    void loadLinkOptions();
    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    const ownedPreviewUrls = previewUrls.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      actionController.current?.abort();
      ownedPreviewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, []);

  useEffect(() => {
    const job = generation.job;
    if (!job || handledGenerationJob.current === job.id) return;
    if (job.status === 'failed' || job.status === 'cancelled') {
      handledGenerationJob.current = job.id;
      setError(job.error
        ? referenceErrorDescriptor(job.error).message
        : t('referenceLibrary.editor.generate.failed'));
      return;
    }
    if (job.status !== 'completed') return;

    handledGenerationJob.current = job.id;
    const variant = job.variants.find((item) => (
      item.status === 'generated' && Boolean(item.imageUrl || item.thumbnailUrl)
    ));
    if (!variant) {
      setError(t('referenceLibrary.editor.generate.noResult'));
      return;
    }
    const imageUrl = backendAssetUrl(variant.imageUrl || variant.thumbnailUrl || '');
    setGeneratedPreview({
      createdAt: job.completedAt || job.createdAt,
      id: `generated:${job.id}:${variant.id}`,
      imageUrl,
      isSavedToDrafts: false,
      jobId: job.id,
      name: t('referenceLibrary.editor.drafts.generatedName', {number: drafts.length + 1}),
      prompt: generationPrompts.current.get(job.id),
      source: 'generated',
      variantId: variant.id,
    });
    setCanvasSelection({kind: 'generated-preview'});
    setZoom(1);
  }, [drafts.length, generation.job, t]);

  useEffect(() => {
    if (generation.errorMessage) setError(generation.errorMessage);
  }, [generation.errorMessage]);

  const canEdit = capabilities?.permissions.canEdit ?? false;
  const canGenerate = Boolean(
    capabilities?.permissions.canRunGeneration
    && capabilities.generation.canGenerate,
  );
  const generationInProgress = generating || Boolean(
    generationJobId
    && !generation.errorMessage
    && (!generation.job || !generation.isTerminal),
  );
  const busy = saving || generationInProgress || addingToDrafts;
  const hasPrimaryImage = Boolean(
    primaryImageId && drafts.some(({id}) => id === primaryImageId),
  );
  const accept = capabilities?.upload.mimeTypes.join(',') || DEFAULT_ACCEPT;
  const activeImage: VisualCanvasImage | null = (() => {
    if (canvasSelection?.kind === 'generated-preview') return generatedPreview;
    if (canvasSelection?.kind === 'uploaded') return uploadedImage;
    if (canvasSelection?.kind === 'draft') {
      return drafts.find(({id}) => id === canvasSelection.id) ?? null;
    }
    return null;
  })();

  const markDirty = () => setDirty(true);
  const assertMounted = () => {
    if (!mounted.current) throw EDITOR_DISPOSED;
  };
  const changeTitle = (value: string) => { setTitle(value); markDirty(); };
  const changeCategory = (value: VisualReferenceType) => { setCategory(value); markDirty(); };
  const changeDescription = (value: string) => { setDescription(value); markDirty(); };
  const changeBrief = (value: ReferenceBrief) => { setBrief(value); markDirty(); };
  const changeRelations = (value: VisualRelation[]) => { setRelations(value); markDirty(); };

  const validateBeforeCreate = (requirePrompt = false): boolean => {
    if (!title.trim()) {
      setActiveTab('main');
      setError(t('referenceLibrary.validation.title'));
      return false;
    }
    if (requirePrompt && !brief.description?.trim()) {
      setActiveTab('main');
      setError(t('referenceLibrary.editor.generate.promptRequired'));
      return false;
    }
    return true;
  };

  const persistDraft = async (): Promise<DraftIdentity> => {
    const locationRelation = relations.find((relation) => relation.kind === 'location');
    const payload = {
      brief,
      category,
      characterLinks: relations
        .filter((relation) => relation.kind === 'character')
        .map((relation) => ({
          characterId: relation.id,
          relation: 'associated' as const,
        })),
      description: description.trim(),
      locationId: locationRelation ? Number(locationRelation.id) : null,
      tags: [],
      title: title.trim(),
    };
    const fingerprint = JSON.stringify(payload);
    if (draftIdentity && persistedDraftFingerprint.current === fingerprint) {
      return draftIdentity;
    }
    if (draftIdentity) {
      const response = await referenceApi.update(projectId, draftIdentity.id, {
        ...payload,
        version: draftIdentity.version,
      });
      assertMounted();
      const updated = {id: response.data.id, version: response.data.version};
      persistedDraftFingerprint.current = fingerprint;
      setDraftIdentity(updated);
      return updated;
    }
    const response = await referenceApi.create(projectId, payload);
    assertMounted();
    const created = {id: response.data.id, version: response.data.version};
    persistedDraftFingerprint.current = fingerprint;
    setDraftIdentity(created);
    return created;
  };

  const persistUploadedImages = async (
    draft: DraftIdentity,
    signal: AbortSignal,
  ): Promise<DraftIdentity> => {
    if (!capabilities) return draft;
    const uploadedDrafts = drafts.flatMap((item) => (
      item.source === 'uploaded' ? [item] : []
    ));
    const pendingImages = [
      ...uploadedDrafts,
      ...(uploadedImage ? [uploadedImage] : []),
    ]
      .filter((image) => !image.uploaded)
      .sort((left, right) => Number(left.id === primaryImageId) - Number(right.id === primaryImageId));
    let current = draft;
    for (const image of pendingImages) {
      const response = await referenceApi.uploadVersion(
        projectId,
        current.id,
        image.file,
        current.version,
        capabilities.upload.rightsStatementVersion,
        signal,
      );
      assertMounted();
      current = {id: current.id, version: response.data.referenceVersion};
      setDrafts((items) => items.map((item) => (
        item.id === image.id && item.source === 'uploaded'
          ? {...item, uploaded: true}
          : item
      )));
      setUploadedImage((item) => (
        item?.id === image.id ? {...item, uploaded: true} : item
      ));
    }
    setDraftIdentity(current);
    return current;
  };

  const persistGeneratedPrimary = async (
    draft: DraftIdentity,
  ): Promise<DraftIdentity> => {
    const primaryDraft = drafts.find(({id}) => id === primaryImageId);
    if (!primaryDraft || primaryDraft.source !== 'generated') return draft;
    const response = await referenceApi.applyVariant(
      projectId,
      draft.id,
      primaryDraft.jobId,
      primaryDraft.variantId,
      draft.version,
    );
    assertMounted();
    const current = {id: draft.id, version: response.data.referenceVersion};
    setDraftIdentity(current);
    return current;
  };

  const finishNavigation = (draft: DraftIdentity) => {
    if (!mounted.current) return;
    flushSync(() => setDirty(false));
    allowNextNavigation();
    navigate(referenceEditPath(projectId, draft.id));
  };

  const saveReference = async () => {
    if (!validateBeforeCreate()) return;
    if (!hasPrimaryImage) {
      setError(t('referenceLibrary.validation.primaryImage'));
      return;
    }
    const controller = new AbortController();
    actionController.current = controller;
    setSaving(true);
    setError(null);
    try {
      const draft = await persistDraft();
      const withUpload = await persistUploadedImages(draft, controller.signal);
      const saved = await persistGeneratedPrimary(withUpload);
      assertMounted();
      finishNavigation(saved);
    } catch (requestError: unknown) {
      if (mounted.current && requestError !== EDITOR_DISPOSED) {
        setError(referenceErrorDescriptor(requestError).message);
      }
    } finally {
      if (actionController.current === controller) actionController.current = null;
      if (mounted.current) setSaving(false);
    }
  };

  const generateReference = async () => {
    if (!validateBeforeCreate(true) || !capabilities || !canGenerate) return;
    const controller = new AbortController();
    actionController.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const draft = await persistDraft();
      const variantCounts = capabilities.generation.generateVariantCounts;
      const variantCount = variantCounts.includes(1) ? 1 : variantCounts[0] ?? 1;
      const jobPayload = {
        brief,
        expectedReferenceVersion: draft.version,
        imageModel: '',
        operation: 'generate' as const,
        sourceVersionId: null,
        variantCount,
      };
      const fingerprint = JSON.stringify(jobPayload);
      const intent = generationIntent.current?.fingerprint === fingerprint
        ? generationIntent.current
        : {fingerprint, key: newReferenceIdempotencyKey()};
      generationIntent.current = intent;
      const response = await runGenerationWithCredits(
        {
          domain: 'reference',
          modelKey: capabilities.generation.effectiveModel ?? undefined,
          operation: 'generate',
          variantCount,
          promptLength: String(brief.description ?? '').length,
        },
        (estimate) => referenceApi.enqueueJob(
          projectId,
          draft.id,
          {
            ...jobPayload,
            imageModel: estimate.modelKey,
            routingMode: estimate.routingMode,
          },
          intent.key,
        ),
      );
      if (!response) return;
      assertMounted();
      generationPrompts.current.set(response.data.id, brief.description?.trim() ?? '');
      generationIntent.current = undefined;
      handledGenerationJob.current = undefined;
      setGenerationJobId(response.data.id);
    } catch (requestError: unknown) {
      if (mounted.current && requestError !== EDITOR_DISPOSED) {
        setError(referenceErrorDescriptor(requestError).message);
      }
    } finally {
      if (actionController.current === controller) actionController.current = null;
      if (mounted.current) setGenerating(false);
    }
  };

  const handleUpload = (file: File) => {
    if (capabilities && file.size > capabilities.upload.maxBytes) {
      setError(t('referenceLibrary.editor.errors.fileTooLarge'));
      return;
    }
    if (capabilities && !capabilities.upload.mimeTypes.includes(file.type)) {
      setError(t('referenceLibrary.editor.errors.fileType'));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    if (uploadedImage) {
      previewUrls.current.delete(uploadedImage.imageUrl);
      URL.revokeObjectURL(uploadedImage.imageUrl);
    }
    const image: UploadedVisualImage = {
      createdAt: new Date().toISOString(),
      file,
      id: `uploaded:${previewUrl}`,
      imageUrl: previewUrl,
      name: file.name,
      source: 'uploaded',
      uploaded: false,
    };
    setUploadedImage(image);
    setCanvasSelection({kind: 'uploaded'});
    setZoom(1);
    setError(null);
    markDirty();
  };

  const handleAddToDrafts = async () => {
    const preview = canvasSelection?.kind === 'generated-preview'
      ? generatedPreview
      : canvasSelection?.kind === 'uploaded'
        ? uploadedImage
        : null;
    if (!preview || addingToDraftsRef.current) return;
    if (drafts.some(({id}) => id === preview.id)) return;
    addingToDraftsRef.current = true;
    setAddingToDrafts(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    if (!mounted.current) return;

    const draft: VisualReferenceDraft = preview.source === 'generated'
      ? {
        createdAt: preview.createdAt,
        id: preview.id,
        imageUrl: preview.imageUrl,
        jobId: preview.jobId,
        name: preview.name,
        prompt: preview.prompt,
        source: 'generated',
        variantId: preview.variantId,
      }
      : preview;
    setDrafts((items) => [...items, draft]);
    if (preview.source === 'generated') setGeneratedPreview(null);
    else setUploadedImage(null);
    setCanvasSelection({id: draft.id, kind: 'draft'});
    setZoom(1);
    markDirty();
    message.success(t('referenceLibrary.editor.drafts.added'));
    addingToDraftsRef.current = false;
    setAddingToDrafts(false);
  };

  const handleSelectDraft = (draftId: string) => {
    setCanvasSelection({id: draftId, kind: 'draft'});
    setZoom(1);
  };

  const handleSetPrimary = (imageId: string) => {
    setPrimaryImageId(imageId);
    markDirty();
  };

  const handleDeleteDraft = (draftId: string) => {
    const deletedDraft = drafts.find(({id}) => id === draftId);
    if (deletedDraft?.source === 'uploaded') {
      previewUrls.current.delete(deletedDraft.imageUrl);
      URL.revokeObjectURL(deletedDraft.imageUrl);
    }
    const remaining = drafts.filter(({id}) => id !== draftId);
    setDrafts(remaining);
    if (primaryImageId === draftId) setPrimaryImageId(null);
    if (canvasSelection?.kind === 'draft' && canvasSelection.id === draftId) {
      if (generatedPreview) setCanvasSelection({kind: 'generated-preview'});
      else if (uploadedImage) setCanvasSelection({kind: 'uploaded'});
      else if (remaining[0]) setCanvasSelection({id: remaining[0].id, kind: 'draft'});
      else setCanvasSelection(null);
      setZoom(1);
    }
    markDirty();
  };

  if (!projectId) {
    return <Result status="404" title={t('referenceLibrary.errors.projectMissing')} />;
  }

  return (
    <ReferenceLibraryShell
      projectId={projectId}
      currentTitle={t('referenceLibrary.editor.newTitle')}
    >
      <main className="visual-reference-editor">
        <VisualReferenceHeader
          canSave={canEdit && !busy && hasPrimaryImage}
          disabled={!canEdit || busy}
          saveDisabledReason={canEdit && !busy && !hasPrimaryImage
            ? t('referenceLibrary.validation.primaryImage')
            : undefined}
          saving={saving}
          title={title}
          onSave={() => void saveReference()}
          onTitleChange={changeTitle}
        />

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

        <div className="visual-reference-editor__workspace">
          <VisualReferenceCanvas
            accept={accept}
            activeImage={activeImage}
            addingToDrafts={addingToDrafts}
            canAddActiveToDrafts={canvasSelection?.kind === 'generated-preview'
              || canvasSelection?.kind === 'uploaded'}
            canGenerate={canGenerate}
            costPreview={<GenerationCostPreview intent={{
              domain: 'reference',
              operation: 'generate',
              modelKey: capabilities?.generation.effectiveModel ?? undefined,
              variantCount: capabilities?.generation.generateVariantCounts.includes(1)
                ? 1
                : capabilities?.generation.generateVariantCounts[0] ?? 1,
              promptLength: String(brief.description ?? '').length,
            }} />}
            disabled={!canEdit || busy}
            generating={generationInProgress}
            primaryImageId={primaryImageId}
            prompt={brief.description ?? ''}
            zoom={zoom}
            onAddToDrafts={() => void handleAddToDrafts()}
            onGenerate={() => void generateReference()}
            onPrimaryChange={handleSetPrimary}
            onPromptChange={(prompt) => changeBrief({...brief, description: prompt})}
            onUpload={handleUpload}
            onZoomChange={setZoom}
          />
          <VisualReferenceInspector
            activeTab={activeTab}
            activeImageId={activeImage?.id ?? null}
            brief={brief}
            category={category}
            description={description}
            disabled={!canEdit || busy}
            drafts={drafts}
            primaryImageId={primaryImageId}
            relationCandidates={relationCandidates}
            relations={relations}
            onBriefChange={changeBrief}
            onCategoryChange={changeCategory}
            onDescriptionChange={changeDescription}
            onDeleteDraft={handleDeleteDraft}
            onPrimaryChange={handleSetPrimary}
            onRelationsChange={changeRelations}
            onSelectDraft={handleSelectDraft}
            onTabChange={setActiveTab}
          />
        </div>
      </main>
    </ReferenceLibraryShell>
  );
}

export default function VisualReferenceCreatePage() {
  const location = useLocation();
  const {projectId = ''} = useParams<{projectId: string}>();

  return (
    <VisualReferenceCreateEditor key={`${projectId}:${location.search}`} />
  );
}
