import {
  ApartmentOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {Button, Spin} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardEntityType, StoryboardScene} from '../model';
import GenerationTimer from './GenerationTimer';
import type {GenerationTiming} from './GenerationTimer';

export interface SceneEntity {
  available: boolean;
  id: string;
  kind: StoryboardEntityType;
  title: string;
}

interface SceneOverviewProps {
  aiGenerating: boolean;
  aiLoading: boolean;
  aiLoadingModels: boolean;
  generationTiming?: GenerationTiming;
  entities: SceneEntity[];
  scene: StoryboardScene;
  onAddMissingAsset: () => void;
  onStartManual?: () => void;
  onKeepScene: () => void;
  onSplitScene: () => void;
  onSuggest: () => void;
}

function ScreenplayExcerpt({scene, loadingLabel, generationTiming}: {
  scene: StoryboardScene;
  loadingLabel: string | null;
  generationTiming?: GenerationTiming;
}) {
  const loading = Boolean(loadingLabel);
  const blocks = scene.scriptBlocks?.filter(({text, type}) => (
    type !== 'scene_heading' && Boolean(text.trim())
  ));

  if (blocks?.length === 0 && !loading) return null;

  return (
    <div className={`storyboard-script${blocks ? '' : ' storyboard-script--plain'}${generationTiming ? ' storyboard-script--generating' : ''}`}>
      <div aria-busy={loading}>
        {blocks ? blocks.map((block) => (
          <p
            className={`storyboard-script__block storyboard-script__block--${block.type}`}
            key={block.id}
          >
            {block.text}
          </p>
        )) : scene.text}
      </div>
      <div
        aria-label={loadingLabel ?? undefined}
        className={`storyboard-script__loading${loading ? ' storyboard-script__loading--active' : ''}`}
        role="status"
      >
        {loading && (
          <>
            <Spin aria-hidden="true" indicator={<LoadingOutlined spin />} size="large" />
            <span className="storyboard-script__loading-label">{loadingLabel}</span>
            {generationTiming && <GenerationTimer {...generationTiming} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function SceneOverview({
  aiGenerating,
  aiLoading,
  aiLoadingModels,
  generationTiming,
  entities,
  scene,
  onAddMissingAsset,
  onStartManual,
  onKeepScene,
  onSplitScene,
  onSuggest,
}: SceneOverviewProps) {
  const {t} = useTranslation();
  const locations = entities.filter((entity) => entity.kind === 'location');

  return (
    <section className="storyboard-overview" aria-labelledby="storyboard-scene-title">
      <p className="storyboard-overview__eyebrow">
        {t('storyboard.scene')} {scene.id.replace(/\D/g, '').padStart(2, '0')}
      </p>
      <h2 id="storyboard-scene-title">{scene.heading || scene.title}</h2>
      <ScreenplayExcerpt
        generationTiming={aiGenerating ? generationTiming : undefined}
        loadingLabel={aiLoadingModels
          ? t('storyboard.ai.loadingModels')
          : aiGenerating ? t('storyboard.ai.loading') : null}
        scene={scene}
      />

      <div className="storyboard-detected" aria-label={t('storyboard.detected')}>
        <span className="storyboard-detected__label">{t('storyboard.detected')}</span>
        {entities.map((entity) => (
          <span
            className={`storyboard-chip${entity.available ? '' : ' storyboard-chip--missing'}`}
            key={entity.id}
            title={entity.available ? entity.title : t('storyboard.visualAssetMissing')}
          >
            {entity.kind === 'character' && '● '}
            {entity.kind === 'location' && '⌖ '}
            {entity.kind !== 'character' && entity.kind !== 'location' && '◇ '}
            {entity.title}
            {!entity.available && <span>· {t('storyboard.assetMissing')}</span>}
          </span>
        ))}
        {entities.some((entity) => !entity.available) && (
          <Button onClick={onAddMissingAsset} size="small" type="link">
            {t('storyboard.addFromLibrary')}
          </Button>
        )}
      </div>

      {locations.length > 1 && (
        <div className="storyboard-notice" role="status">
          <div>
            <strong>{t('storyboard.locationSwitch.title')}</strong>
            <div>{t('storyboard.locationSwitch.description')}</div>
          </div>
          <div className="storyboard-inline-actions">
            <Button icon={<ApartmentOutlined aria-hidden="true" />} onClick={onSplitScene} size="small">
              {t('storyboard.locationSwitch.split')}
            </Button>
            <Button onClick={onKeepScene} size="small" type="text">
              {t('storyboard.locationSwitch.keep')}
            </Button>
          </div>
        </div>
      )}

      <div className="storyboard-overview__actions">
        <Button
          className="craft-action-button"
          disabled={aiLoading || scene.canEdit === false}
          onClick={onSuggest}
          type="primary"
        >
          {aiGenerating ? t('storyboard.ai.loading') : t('storyboard.ai.suggest')}
        </Button>
        <Button
          disabled={aiLoading || scene.canEdit === false}
          onClick={onStartManual}
          className="craft-action-button craft-action-button--secondary"
        >
          {t('storyboard.manual.create')}
        </Button>
      </div>

    </section>
  );
}
