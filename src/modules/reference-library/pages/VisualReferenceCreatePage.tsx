import {Alert, Result} from 'antd';
import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams} from 'react-router-dom';

import {
  referenceDetailPath,
  referenceEditPath,
  referenceJobPath,
} from '../../../routes/pathConstant';
import {useUnsavedChangesGuard} from '../../../utils/useUnsavedChangesGuard';
import {newReferenceIdempotencyKey, referenceApi} from '../api/referenceApi';
import VisualReferenceCanvas from '../components/visual-editor/VisualReferenceCanvas';
import VisualReferenceHeader from '../components/visual-editor/VisualReferenceHeader';
import VisualReferenceInspector from '../components/visual-editor/VisualReferenceInspector';
import type {
  LocalVisualVariant,
  VisualInspectorTab,
  VisualReferenceType,
  VisualRelation,
} from '../components/visual-editor/types';
import ReferenceLibraryShell from '../components/ReferenceLibraryShell';
import {referenceErrorDescriptor} from '../errors';
import type {
  ReferenceBrief,
  ReferenceCapabilities,
} from '../types';
import {referenceWorkspaceCreateCategory} from './ReferenceWorkspacePage';
import '../referenceLibrary.css';
import '../visualReferenceEditor.css';

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

type SaveDestination = 'detail' | 'edit';

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
  const [variants, setVariants] = useState<LocalVisualVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [primaryVariantId, setPrimaryVariantId] = useState<string | null>(null);
  const [relations, setRelations] = useState<VisualRelation[]>([]);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftIdentity, setDraftIdentity] = useState<DraftIdentity | null>(null);
  const localVariantSequence = useRef(0);
  const mounted = useRef(true);
  const actionController = useRef<AbortController | null>(null);
  const persistedDraftFingerprint = useRef<string>();
  const generationIntent = useRef<{fingerprint: string; key: string}>();
  const previewUrls = useRef(new Set<string>());
  const {allowNextNavigation} = useUnsavedChangesGuard(
    dirty,
    t('referenceLibrary.unsaved.description'),
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

    void loadCapabilities();
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

  const canEdit = capabilities?.permissions.canEdit ?? false;
  const canGenerate = Boolean(
    capabilities?.permissions.canRunGeneration
    && capabilities.generation.canGenerate,
  );
  const busy = saving || creating || generating;
  const accept = capabilities?.upload.mimeTypes.join(',') || DEFAULT_ACCEPT;

  const markDirty = () => setDirty(true);
  const assertMounted = () => {
    if (!mounted.current) throw EDITOR_DISPOSED;
  };
  const changeTitle = (value: string) => { setTitle(value); markDirty(); };
  const changeCategory = (value: VisualReferenceType) => { setCategory(value); markDirty(); };
  const changeDescription = (value: string) => { setDescription(value); markDirty(); };
  const changeBrief = (value: ReferenceBrief) => { setBrief(value); markDirty(); };

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
    if (variants.length > 0 && !rightsConfirmed) {
      setError(t('referenceLibrary.editor.errors.uploadRights'));
      return false;
    }
    return true;
  };

  const persistDraft = async (): Promise<DraftIdentity> => {
    const payload = {
      brief,
      category,
      description: description.trim(),
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

  const persistLocalVariants = async (
    draft: DraftIdentity,
    signal: AbortSignal,
  ): Promise<DraftIdentity> => {
    if (!capabilities) return draft;
    const pending = variants.filter(({uploaded}) => !uploaded);
    const ordered = [...pending].sort((left, right) => {
      if (left.id === primaryVariantId) return 1;
      if (right.id === primaryVariantId) return -1;
      return 0;
    });
    let current = draft;
    for (const variant of ordered) {
      const response = await referenceApi.uploadVersion(
        projectId,
        current.id,
        variant.file,
        current.version,
        capabilities.upload.rightsStatementVersion,
        signal,
      );
      assertMounted();
      current = {id: current.id, version: response.data.referenceVersion};
      setDraftIdentity(current);
      setVariants((items) => items.map((item) => (
        item.id === variant.id ? {...item, uploaded: true} : item
      )));
    }
    return current;
  };

  const finishNavigation = (draft: DraftIdentity, destination: SaveDestination) => {
    if (!mounted.current) return;
    flushSync(() => setDirty(false));
    allowNextNavigation();
    navigate(destination === 'edit'
      ? referenceEditPath(projectId, draft.id)
      : referenceDetailPath(projectId, draft.id));
  };

  const saveReference = async (destination: SaveDestination) => {
    if (!validateBeforeCreate()) return;
    const setLoading = destination === 'edit' ? setSaving : setCreating;
    const controller = new AbortController();
    actionController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const draft = await persistDraft();
      const saved = await persistLocalVariants(draft, controller.signal);
      assertMounted();
      finishNavigation(saved, destination);
    } catch (requestError: unknown) {
      if (mounted.current && requestError !== EDITOR_DISPOSED) {
        setError(referenceErrorDescriptor(requestError).message);
      }
    } finally {
      if (actionController.current === controller) actionController.current = null;
      if (mounted.current) setLoading(false);
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
      const saved = await persistLocalVariants(draft, controller.signal);
      const variantCounts = capabilities.generation.generateVariantCounts;
      const variantCount = variantCounts.includes(4) ? 4 : variantCounts[0] ?? 1;
      const jobPayload = {
        brief,
        expectedReferenceVersion: saved.version,
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
      const response = await referenceApi.enqueueJob(
        projectId,
        saved.id,
        jobPayload,
        intent.key,
      );
      assertMounted();
      flushSync(() => setDirty(false));
      allowNextNavigation();
      navigate(referenceJobPath(projectId, saved.id, response.data.id));
    } catch (requestError: unknown) {
      if (mounted.current && requestError !== EDITOR_DISPOSED) {
        setError(referenceErrorDescriptor(requestError).message);
      }
    } finally {
      if (actionController.current === controller) actionController.current = null;
      if (mounted.current) setGenerating(false);
    }
  };

  const addLocalVariant = (file: File, replaceVariantId?: string) => {
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
    const replacedVariant = replaceVariantId
      ? variants.find(({id}) => id === replaceVariantId)
      : undefined;
    if (replacedVariant) {
      previewUrls.current.delete(replacedVariant.previewUrl);
      URL.revokeObjectURL(replacedVariant.previewUrl);
      setVariants((items) => items.map((item) => (
        item.id === replaceVariantId
          ? {...item, file, name: file.name, previewUrl, uploaded: false}
          : item
      )));
      setActiveVariantId(replaceVariantId ?? null);
      setRightsConfirmed(false);
      setZoom(1);
      setError(null);
      markDirty();
      return;
    }
    localVariantSequence.current += 1;
    const id = `local-variant-${localVariantSequence.current}`;
    const variant: LocalVisualVariant = {
      file,
      id,
      name: file.name,
      previewUrl,
      uploaded: false,
    };
    setVariants((items) => [...items, variant]);
    setActiveVariantId(id);
    setPrimaryVariantId((current) => current ?? id);
    setRightsConfirmed(false);
    setZoom(1);
    setError(null);
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
          canCreate={canEdit && !busy}
          canSave={canEdit && dirty && !busy}
          creating={creating}
          disabled={!canEdit || busy}
          dirty={dirty}
          saving={saving}
          title={title}
          onCreate={() => void saveReference('detail')}
          onSave={() => void saveReference('edit')}
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
            activeVariantId={activeVariantId}
            canGenerate={canGenerate}
            disabled={!canEdit || busy}
            generating={generating}
            primaryVariantId={primaryVariantId}
            prompt={brief.description ?? ''}
            rightsConfirmed={rightsConfirmed}
            variants={variants}
            zoom={zoom}
            onFileSelect={addLocalVariant}
            onGenerate={() => void generateReference()}
            onPrimaryChange={setPrimaryVariantId}
            onPromptChange={(prompt) => changeBrief({...brief, description: prompt})}
            onRightsChange={(checked) => { setRightsConfirmed(checked); markDirty(); }}
            onVariantSelect={(id) => { setActiveVariantId(id); setZoom(1); }}
            onZoomChange={setZoom}
          />
          <VisualReferenceInspector
            activeTab={activeTab}
            brief={brief}
            category={category}
            description={description}
            disabled={!canEdit || busy}
            relations={relations}
            onBriefChange={changeBrief}
            onCategoryChange={changeCategory}
            onDescriptionChange={changeDescription}
            onRelationsChange={setRelations}
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
