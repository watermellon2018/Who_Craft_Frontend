import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {Alert, Button, message, Spin} from 'antd';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router-dom';

import {getApiErrorCode} from '../../api/errors';
import DashboardHeader from '../profile/components/DashboardHeader';
import {projectDashboardPath} from '../../routes/pathConstant';
import CameraIntentPanel from './components/CameraIntentPanel';
import GenerationDrawer from './components/GenerationDrawer';
import KeyframeTimeline from './components/KeyframeTimeline';
import SceneOverview from './components/SceneOverview';
import type {ManualShotValues, SceneEntity} from './components/SceneOverview';
import SceneSidebar from './components/SceneSidebar';
import {chooseShotListAiConfiguration} from './components/ShotListAiModal';
import ShotListBuilder from './components/ShotListBuilder';
import ShotSidebar from './components/ShotSidebar';
import StoryboardPreview from './components/StoryboardPreview';
import StoryboardViewport from './components/StoryboardViewport';
import VisualReferenceDrawer from './components/VisualReferenceDrawer';
import {normalizeStoryboardImageUrl} from './model';
import type {GenerationReference, StoryboardScene} from './model';
import {storyboardService} from './storyboardService';
import type {StoryboardFrontendService} from './storyboardService';
import {useStoryboardWorkspace} from './useStoryboardWorkspace';
import './storyboard.css';

function sceneEntities(scene: StoryboardScene): SceneEntity[] {
  return scene.entities.map((entity) => ({
    available: Boolean(entity.imageUrl),
    id: entity.id,
    kind: entity.type,
    title: entity.title,
  }));
}

function frameLabel(scene: StoryboardScene | null) {
  if (!scene) return 'Storyboard';
  return `${scene.title} · Storyboard`;
}

interface StoryboardPageProps {
  service?: StoryboardFrontendService;
}

const shotListErrorKeys: Record<string, string> = {
  STORYBOARD_AI_BAD_RESPONSE: 'storyboard.errors.aiBadResponse',
  STORYBOARD_AI_MODEL_UNAVAILABLE: 'storyboard.errors.aiModelUnavailable',
  STORYBOARD_AI_NOT_CONFIGURED: 'storyboard.errors.aiNotConfigured',
  STORYBOARD_AI_PROVIDER_REJECTED: 'storyboard.errors.aiProviderRejected',
  STORYBOARD_AI_RATE_LIMITED: 'storyboard.errors.aiRateLimited',
  STORYBOARD_AI_TIMEOUT: 'storyboard.errors.aiTimeout',
};

export default function StoryboardPage({service = storyboardService}: StoryboardPageProps) {
  const {t} = useTranslation();
  const {projectId = ''} = useParams<{projectId: string}>();
  const workspace = useStoryboardWorkspace(projectId, service.loadScenes);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratingSceneId, setAiGeneratingSceneId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<{sceneId: string; message: string} | null>(null);
  const [generationDrawerOpen, setGenerationDrawerOpen] = useState(false);
  const [referenceDrawerOpen, setReferenceDrawerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingKeyframeId, setGeneratingKeyframeId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<{
    keyframeId: string;
    message: string;
  } | null>(null);
  const pendingTimersRef = useRef<Set<number>>(new Set());
  const aiModalAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const schedule = useCallback((callback: () => void, delay: number) => {
    const timerId = window.setTimeout(() => {
      pendingTimersRef.current.delete(timerId);
      callback();
    }, delay);
    pendingTimersRef.current.add(timerId);
  }, []);

  useEffect(() => {
    const pendingTimers = pendingTimersRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      aiModalAbortRef.current?.abort();
      aiModalAbortRef.current = null;
      pendingTimers.forEach((timerId) => window.clearTimeout(timerId));
      pendingTimers.clear();
    };
  }, []);
  const entities = useMemo(
    () => workspace.selectedScene ? sceneEntities(workspace.selectedScene) : [],
    [workspace.selectedScene],
  );

  const selectedReferenceIds = workspace.selectedShot ? [
    ...workspace.selectedShot.characterIds,
    ...workspace.selectedShot.referenceIds,
    ...(workspace.selectedShot.locationId ? [workspace.selectedShot.locationId] : []),
  ] : [];

  const handleSuggestShotList = async () => {
    const scene = workspace.selectedScene;
    if (!scene || aiLoading) return;
    let modalAbortController: AbortController | null = null;
    setAiError(null);
    setAiLoading(true);
    try {
      const options = await service.loadShotListOptions(scene, projectId);
      if (!mountedRef.current) return;
      modalAbortController = new AbortController();
      aiModalAbortRef.current = modalAbortController;
      const configuration = await chooseShotListAiConfiguration(
        options,
        modalAbortController.signal,
      );
      if (!configuration || !mountedRef.current) return;
      setAiGeneratingSceneId(scene.id);
      const shots = await service.suggestShotList(scene, projectId, configuration);
      if (mountedRef.current) workspace.setSceneShotList(scene.id, shots);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const code = getApiErrorCode(error);
      setAiError({
        message: t((code && shotListErrorKeys[code]) || 'storyboard.errors.aiShotList'),
        sceneId: scene.id,
      });
    } finally {
      if (aiModalAbortRef.current === modalAbortController) {
        aiModalAbortRef.current = null;
      }
      if (mountedRef.current) {
        setAiLoading(false);
        setAiGeneratingSceneId(null);
      }
    }
  };

  const handleCreateManual = (values: ManualShotValues) => {
    workspace.addShot(values);
    message.success(t('storyboard.messages.shotAdded'));
  };

  const handleAddShot = (afterShotId?: string) => {
    workspace.addShot({
      characterIds: workspace.selectedShot?.characterIds ?? [],
      description: t('storyboard.newShot.description'),
      locationId: workspace.selectedShot?.locationId,
      referenceIds: workspace.selectedShot?.referenceIds ?? [],
      title: t('storyboard.newShot.title'),
    }, afterShotId);
  };

  const handleDeleteShot = (shotId: string) => {
    workspace.deleteShot(shotId);
    message.info(t('storyboard.messages.shotDeleted'));
  };

  const handleGenerate = (references: GenerationReference[]) => {
    if (!workspace.selectedKeyframe || !workspace.selectedShot || generatingKeyframeId) return;
    const keyframe = workspace.selectedKeyframe;
    const shot = workspace.selectedShot;
    setGenerationError(null);
    setGeneratingKeyframeId(workspace.selectedKeyframe.id);
    schedule(() => {
      void Promise.resolve()
        .then(() => service.generateFrame({keyframe, references, shot}))
        .then(({imageUrl}) => {
          if (!mountedRef.current) return;
          const normalizedImageUrl = normalizeStoryboardImageUrl(imageUrl);
          if (!normalizedImageUrl) throw new Error('Unsafe storyboard image URL');
          workspace.generateSelectedKeyframe(references, normalizedImageUrl);
          setGenerationDrawerOpen(false);
          message.success(t('storyboard.messages.frameCreated'));
        })
        .catch(() => {
          if (mountedRef.current) {
            setGenerationError({
              keyframeId: keyframe.id,
              message: t('storyboard.errors.frameGeneration'),
            });
          }
        })
        .finally(() => {
          if (mountedRef.current) setGeneratingKeyframeId(null);
        });
    }, 720);
  };

  const handleRegenerate = () => {
    handleGenerate(workspace.selectedKeyframe?.generationReferences ?? []);
  };

  const handleDuplicateSettings = () => {
    if (!workspace.selectedShot || !workspace.selectedKeyframe) return;
    const sourceIntent = workspace.selectedKeyframe.cameraIntent;
    const ordered = [...workspace.selectedShot.keyframes].sort((a, b) => a.position - b.position);
    const currentIndex = ordered.findIndex(({id}) => id === workspace.selectedKeyframe?.id);
    const target = ordered[currentIndex + 1] ?? ordered[currentIndex - 1];
    if (!target) return;
    workspace.updateSelectedShot((shot) => ({
      ...shot,
      keyframes: shot.keyframes.map((keyframe) => keyframe.id === target.id ? {
        ...keyframe,
        cameraIntent: {
          ...sourceIntent,
          composition: sourceIntent.composition?.map((subject) => ({...subject})),
        },
      } : keyframe),
    }));
    message.success(t('storyboard.messages.settingsDuplicated'));
  };

  const handleResetCamera = () => {
    workspace.updateCameraIntent({
      azimuth: 'front',
      composition: workspace.selectedKeyframe?.cameraIntent.targetId ? [{
        height: 48,
        subjectId: workspace.selectedKeyframe.cameraIntent.targetId,
        width: 28,
        x: 58,
        y: 27,
      }] : undefined,
      distance: 'medium',
      elevation: 'eye-level',
      framing: 'medium',
      lens: 50,
      targetId: workspace.selectedKeyframe?.cameraIntent.targetId,
    });
    message.info(t('storyboard.messages.cameraReset'));
  };

  const handleApplyReferences = (ids: string[]) => {
    if (!workspace.selectedShot || !workspace.selectedScene) return;
    const entityById = new Map(workspace.selectedScene.entities.map((entity) => [entity.id, entity]));
    workspace.updateSelectedShot((shot) => ({
      ...shot,
      characterIds: ids.filter((id) => entityById.get(id)?.type === 'character'),
      locationId: ids.find((id) => entityById.get(id)?.type === 'location'),
      referenceIds: ids.filter((id) => {
        const type = entityById.get(id)?.type;
        return Boolean(type && type !== 'character' && type !== 'location');
      }),
    }));
    setReferenceDrawerOpen(false);
    message.success(t('storyboard.messages.referencesUpdated'));
  };

  const renderSelectionMode = () => (
    <div className="storyboard-workspace">
      <main className="storyboard-main">
        {workspace.loading && (
          <div className="storyboard-empty">
            <div className="storyboard-empty__inner">
              <Spin size="large" />
              <h2>{t('storyboard.loadingWorkspace')}</h2>
            </div>
          </div>
        )}
        {!workspace.loading && workspace.loadError && (
          <div className="storyboard-empty">
            <Alert
              action={<Button onClick={() => void workspace.reload()}>{t('common.retry')}</Button>}
              message={t(workspace.loadError)}
              showIcon
              type="error"
            />
          </div>
        )}
        {!workspace.loading && !workspace.loadError && !workspace.selectedScene && (
          <div className="storyboard-empty">
            <div className="storyboard-empty__inner">
              <div className="storyboard-empty__icon"><AppstoreOutlined aria-hidden="true" /></div>
              <h2>{t(workspace.scenes.length
                ? 'storyboard.empty.selectScene'
                : 'storyboard.empty.noScenes')}</h2>
              <p>{t(workspace.scenes.length
                ? 'storyboard.empty.selectSceneDescription'
                : 'storyboard.empty.noScenesDescription')}</p>
            </div>
          </div>
        )}
        {workspace.selectedScene && workspace.mode === 'overview' && (
          <>
            {aiError?.sceneId === workspace.selectedScene.id && (
              <Alert
                action={<Button onClick={handleSuggestShotList}>{t('common.retry')}</Button>}
                closable
                message={aiError.message}
                onClose={() => setAiError(null)}
                showIcon
                type="error"
              />
            )}
            <SceneOverview
              aiGenerating={aiGeneratingSceneId === workspace.selectedScene.id}
              aiLoading={aiLoading}
              entities={entities}
              onAddMissingAsset={() => setReferenceDrawerOpen(true)}
              onCreateManual={handleCreateManual}
              onKeepScene={() => message.info(t('storyboard.messages.sceneKept'))}
              onSplitScene={() => message.info(t('storyboard.messages.splitMock'))}
              onSuggest={handleSuggestShotList}
              scene={workspace.selectedScene}
            />
          </>
        )}
        {workspace.selectedScene && workspace.mode === 'builder' && (
          <ShotListBuilder
            onAdd={handleAddShot}
            onConfirm={workspace.enterEditor}
            onDelete={handleDeleteShot}
            onDuplicate={(shotId) => workspace.duplicateShot(shotId, t('storyboard.copySuffix'))}
            onMove={workspace.moveShot}
            onUpdate={(shotId, patch) => workspace.updateShot(shotId, patch)}
            scene={workspace.selectedScene}
          />
        )}
      </main>
      <SceneSidebar
        onSelect={workspace.selectScene}
        scenes={workspace.scenes}
        selectedSceneId={workspace.selectedSceneId}
      />
    </div>
  );

  const renderEditor = () => (
    <main className="storyboard-editor">
      <div className="storyboard-editor__viewport">
        <StoryboardViewport
          error={generationError?.keyframeId === workspace.selectedKeyframeId
            ? generationError.message
            : null}
          keyframe={workspace.selectedKeyframe}
          loading={generatingKeyframeId === workspace.selectedKeyframeId}
          onEditReferences={() => setGenerationDrawerOpen(true)}
          onGenerate={() => setGenerationDrawerOpen(true)}
          onRegenerate={handleRegenerate}
          shot={workspace.selectedShot}
        />
      </div>
      <div className="storyboard-editor__shots">
        <ShotSidebar
          entities={workspace.selectedScene?.entities ?? []}
          onAdd={() => handleAddShot(workspace.selectedShotId ?? undefined)}
          onDelete={handleDeleteShot}
          onDuplicate={(shotId) => workspace.duplicateShot(shotId, t('storyboard.copySuffix'))}
          onEditContext={() => setReferenceDrawerOpen(true)}
          onMove={workspace.moveShot}
          onSelect={workspace.selectShot}
          onUpdateDuration={(shotId, duration) => workspace.updateShot(shotId, {
            duration: duration ?? undefined,
          })}
          selectedShotId={workspace.selectedShotId}
          shots={workspace.selectedScene?.shots ?? []}
        />
      </div>
      <div className="storyboard-editor__timeline">
        <KeyframeTimeline
          onAddIntermediate={workspace.addIntermediate}
          onDelete={workspace.deleteKeyframe}
          onReposition={workspace.repositionKeyframe}
          onSelect={workspace.setSelectedKeyframeId}
          selectedKeyframeId={workspace.selectedKeyframeId}
          shot={workspace.selectedShot}
        />
      </div>
      <div className="storyboard-editor__camera">
        <CameraIntentPanel
          keyframe={workspace.selectedKeyframe}
          onDuplicateSettings={handleDuplicateSettings}
          onReset={handleResetCamera}
          onUpdateIntent={workspace.updateCameraIntent}
          onUpdateTransition={workspace.updateTransition}
          shot={workspace.selectedShot}
        />
      </div>
    </main>
  );

  return (
    <div className="storyboard-page">
      <DashboardHeader hideSubnav />
      <div className="storyboard-shell">
        <header className="storyboard-toolbar">
          <div className="storyboard-toolbar__identity">
            <Link
              aria-label={t('storyboard.backToProject')}
              className="storyboard-back"
              to={projectDashboardPath(projectId)}
            >
              <ArrowLeftOutlined aria-hidden="true" />
            </Link>
            <div className="storyboard-toolbar__title">
              <h1>{frameLabel(workspace.selectedScene)}</h1>
              <p>{t('storyboard.subtitle')}</p>
            </div>
          </div>
          <div className="storyboard-toolbar__actions">
            <span className={`storyboard-autosave storyboard-autosave--${workspace.autosaveState}`} role="status">
              {t(`storyboard.autosave.${workspace.autosaveState}`)}
            </span>
            <Button
              disabled={!workspace.selectedScene?.shots.length}
              icon={<EyeOutlined aria-hidden="true" />}
              onClick={() => setPreviewOpen(true)}
            >
              {t('storyboard.preview.action')}
            </Button>
          </div>
        </header>

        {workspace.mode === 'editor' && workspace.selectedScene
          ? renderEditor()
          : renderSelectionMode()}
      </div>

      <GenerationDrawer
        error={generationError?.keyframeId === workspace.selectedKeyframeId
          ? generationError.message
          : null}
        keyframe={workspace.selectedKeyframe}
        loading={generatingKeyframeId === workspace.selectedKeyframeId}
        onClose={() => setGenerationDrawerOpen(false)}
        onGenerate={handleGenerate}
        open={generationDrawerOpen}
        previousShot={workspace.previousShot}
        scene={workspace.selectedScene}
        shot={workspace.selectedShot}
      />
      <VisualReferenceDrawer
        entities={workspace.selectedScene?.entities ?? []}
        onApply={handleApplyReferences}
        onClose={() => setReferenceDrawerOpen(false)}
        open={referenceDrawerOpen}
        selectedIds={selectedReferenceIds}
      />
      <StoryboardPreview
        onClose={() => setPreviewOpen(false)}
        open={previewOpen}
        scene={workspace.selectedScene}
      />
    </div>
  );
}
