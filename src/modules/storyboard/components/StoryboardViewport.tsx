import {
  ExpandOutlined,
  PictureOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {Alert, Button, Dropdown, Slider, Spin, Tooltip} from 'antd';
import type {MenuProps} from 'antd';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import type {StoryboardKeyframe, StoryboardShot} from '../model';

interface StoryboardViewportProps {
  error: string | null;
  keyframe: StoryboardKeyframe | null;
  loading: boolean;
  shot: StoryboardShot | null;
  onEditReferences: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
}

export default function StoryboardViewport({
  error,
  keyframe,
  loading,
  shot,
  onEditReferences,
  onGenerate,
  onRegenerate,
}: StoryboardViewportProps) {
  const {t} = useTranslation();
  const [zoom, setZoom] = useState(100);
  const keyframeLabel = keyframe
    ? t(`storyboard.keyframeType.${keyframe.type}`)
    : t('storyboard.keyframeType.none');
  const renderedImageUrl = safeImageUrl(keyframe?.imageUrl);
  const regenerateItems: MenuProps['items'] = [
    {
      icon: <ReloadOutlined aria-hidden="true" />,
      key: 'same',
      label: t('storyboard.regenerate.sameSettings'),
      onClick: onRegenerate,
    },
    {
      icon: <PictureOutlined aria-hidden="true" />,
      key: 'references',
      label: t('storyboard.regenerate.editReferences'),
      onClick: onEditReferences,
    },
  ];

  return (
    <section
      aria-busy={loading}
      aria-label={t('storyboard.viewport.title')}
      className="storyboard-viewport"
    >
      <div className="storyboard-viewport__topbar">
        <div className="storyboard-viewport__label">
          {shot ? `Shot ${String(shot.order).padStart(2, '0')} · ${keyframeLabel}` : keyframeLabel}
        </div>
        <div className="storyboard-viewport__tools">
          <Tooltip title={t('storyboard.viewport.fit')}>
            <Button
              aria-label={t('storyboard.viewport.fit')}
              icon={<ExpandOutlined aria-hidden="true" />}
              onClick={() => setZoom(100)}
              size="small"
              type="text"
            />
          </Tooltip>
          <ZoomOutOutlined aria-hidden="true" />
          <Slider
            aria-label={t('storyboard.viewport.zoom')}
            max={160}
            min={70}
            onChange={setZoom}
            style={{width: 86}}
            value={zoom}
          />
          <ZoomInOutlined aria-hidden="true" />
          {keyframe?.imageUrl && (
            <Dropdown menu={{items: regenerateItems}} trigger={['click']}>
              <Button icon={<ReloadOutlined aria-hidden="true" />} size="small" type="text">
                {t('common.regenerate')}
              </Button>
            </Dropdown>
          )}
        </div>
      </div>

      {error && (
        <Alert
          action={<Button onClick={onGenerate} size="small">{t('common.retry')}</Button>}
          message={t('storyboard.errors.frameGeneration')}
          showIcon
          type="error"
        />
      )}

      {keyframe?.imageUrl ? (
        <div
          className={`storyboard-frame${renderedImageUrl ? ' storyboard-frame--image' : ''}`}
          style={{transform: `scale(${zoom / 100})`}}
        >
          {renderedImageUrl && (
            <img
              alt={t('storyboard.viewport.imageAlt', {
                keyframe: keyframeLabel,
                shot: shot?.order ?? '',
              })}
              className="storyboard-frame__image"
              src={renderedImageUrl}
            />
          )}
          <span className="storyboard-frame__caption">
            {shot?.description || t('storyboard.viewport.generatedCaption')}
          </span>
        </div>
      ) : (
        <div className="storyboard-viewport__empty">
          <PictureOutlined aria-hidden="true" style={{color: 'var(--craft-accent)', fontSize: 28}} />
          <h3>{t('storyboard.viewport.emptyTitle')}</h3>
          <p>{t('storyboard.viewport.emptyDescription')}</p>
          <Button loading={loading} onClick={onGenerate} type="primary">
            {t('storyboard.viewport.createFrame')}
          </Button>
        </div>
      )}
      {loading && (
        <div className="storyboard-viewport__loading">
          <Spin size="large" />
          <span>{t('storyboard.viewport.generating')}</span>
        </div>
      )}
      <span aria-live="polite" className="sr-only">
        {loading ? t('storyboard.viewport.generating') : ''}
      </span>
    </section>
  );
}
