import {CheckOutlined, LinkOutlined, PictureOutlined} from '@ant-design/icons';
import {Alert, Button, Checkbox, Drawer, Empty} from 'antd';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import {
  listContinuityReferences,
  suggestContinuityReferences,
} from '../model';
import type {
  GenerationReference,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardShot,
} from '../model';

interface GenerationDrawerProps {
  error: string | null;
  keyframe: StoryboardKeyframe | null;
  loading: boolean;
  open: boolean;
  previousShot?: StoryboardShot;
  scene: StoryboardScene | null;
  shot: StoryboardShot | null;
  onClose: () => void;
  onGenerate: (references: GenerationReference[]) => void;
}

export default function GenerationDrawer({
  error,
  keyframe,
  loading,
  open,
  previousShot,
  scene,
  shot,
  onClose,
  onGenerate,
}: GenerationDrawerProps) {
  const {t} = useTranslation();
  const contentReferences = useMemo<GenerationReference[]>(() => {
    if (!scene || !shot) return [];
    const selectedIds = new Set([
      ...shot.characterIds,
      ...shot.referenceIds,
      ...(shot.locationId ? [shot.locationId] : []),
    ]);
    return scene.entities
      .filter(({id}) => selectedIds.has(id))
      .map((entity) => ({
        id: `asset-${entity.id}`,
        imageUrl: entity.imageUrl || `mock://storyboard/${entity.id}`,
        title: entity.title,
        type: entity.type,
      }));
  }, [scene, shot]);
  const continuityReferences = useMemo(() => {
    if (!keyframe || !scene || !shot) return [];
    const suggested = suggestContinuityReferences(keyframe, shot, previousShot);
    const available = listContinuityReferences(keyframe, shot, scene.shots);
    const existing = keyframe.generationReferences?.filter((reference) => (
      reference.type === 'previous-keyframe' || reference.type === 'previous-shot'
    )) ?? [];
    const byId = new Map(
      [...available, ...existing, ...suggested].map((reference) => [reference.id, reference]),
    );
    return Array.from(byId.values());
  }, [keyframe, previousShot, scene, shot]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const persistedIds = keyframe?.generationReferences?.map(({id}) => id);
    setSelectedIds([
      ...contentReferences
        .filter(({id}) => !persistedIds || persistedIds.includes(id))
        .map(({id}) => id),
      ...continuityReferences
        .filter(({id, primary}) => persistedIds ? persistedIds.includes(id) : primary)
        .map(({id}) => id),
    ]);
  }, [contentReferences, continuityReferences, keyframe, open]);

  const allReferences = [...contentReferences, ...continuityReferences];

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      size="large"
      title={t('storyboard.generation.title')}
      extra={(
        <Button
          disabled={!keyframe || !shot}
          loading={loading}
          onClick={() => onGenerate(allReferences.filter(({id}) => selectedIds.includes(id)))}
          type="primary"
        >
          {t('storyboard.generation.generate')}
        </Button>
      )}
    >
      <div className="storyboard-stack">
        {error && <Alert message={error} showIcon type="error" />}
        <section>
          <div className="storyboard-section-heading">
            <div>
              <h3>{t('storyboard.generation.content')}</h3>
              <p>{t('storyboard.generation.contentHelp')}</p>
            </div>
          </div>
          {contentReferences.length === 0 ? (
            <Empty description={t('storyboard.generation.noAssets')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="storyboard-reference-grid">
              {contentReferences.map((reference) => {
                const selected = selectedIds.includes(reference.id);
                const referenceImageUrl = safeImageUrl(reference.imageUrl);
                return (
                  <button
                    aria-pressed={selected}
                    className={`storyboard-asset-card${selected ? ' storyboard-asset-card--selected' : ''}`}
                    key={reference.id}
                    onClick={() => setSelectedIds((current) => (
                      selected
                        ? current.filter((id) => id !== reference.id)
                        : [...current, reference.id]
                    ))}
                    type="button"
                  >
                    <span className="storyboard-asset-card__visual">
                      {referenceImageUrl
                        ? <img alt="" src={referenceImageUrl} />
                        : selected
                          ? <CheckOutlined aria-hidden="true" />
                          : <PictureOutlined aria-hidden="true" />}
                    </span>
                    <span className="storyboard-asset-card__title">{reference.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="storyboard-section-heading">
            <div>
              <h3>{t('storyboard.generation.continuity')}</h3>
              <p>{t('storyboard.generation.continuityHelp')}</p>
            </div>
          </div>
          {continuityReferences.length === 0 ? (
            <Empty description={t('storyboard.generation.noContinuity')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="storyboard-continuity-list">
              {continuityReferences.map((reference) => {
                const referenceImageUrl = safeImageUrl(reference.imageUrl);
                return (
                  <label className="storyboard-continuity-card" key={reference.id}>
                  <span className="storyboard-continuity-card__thumb" aria-hidden="true">
                    {referenceImageUrl && (
                      <img alt="" src={referenceImageUrl} />
                    )}
                  </span>
                  <span>
                    <strong>{reference.title}</strong>
                    <span className="storyboard-muted" style={{display: 'block', fontSize: 11}}>
                      <LinkOutlined aria-hidden="true" /> {t(`storyboard.referenceType.${reference.type}`)}
                    </span>
                  </span>
                  <Checkbox
                    aria-label={reference.title}
                    checked={selectedIds.includes(reference.id)}
                    onChange={(event) => setSelectedIds((current) => (
                      event.target.checked
                        ? [...current, reference.id]
                        : current.filter((id) => id !== reference.id)
                    ))}
                  />
                  </label>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
