import {DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {Button, Empty, Tooltip} from 'antd';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import {detectCameraMovement, sortKeyframes} from '../model';
import type {StoryboardShot} from '../model';

interface KeyframeTimelineProps {
  selectedKeyframeId: string | null;
  shot: StoryboardShot | null;
  onAddIntermediate: () => void;
  onDelete: (keyframeId: string) => void;
  onReposition: (keyframeId: string, position: number) => void;
  onSelect: (keyframeId: string) => void;
}

export default function KeyframeTimeline({
  selectedKeyframeId,
  shot,
  onAddIntermediate,
  onDelete,
  onReposition,
  onSelect,
}: KeyframeTimelineProps) {
  const {t} = useTranslation();
  const [draggedKeyframeId, setDraggedKeyframeId] = useState<string | null>(null);
  const keyframes = shot ? sortKeyframes(shot.keyframes) : [];

  return (
    <section className="storyboard-timeline" aria-label={t('storyboard.keyframes')}>
      <div className="storyboard-section-heading">
        <div>
          <h3>{t('storyboard.keyframes')}</h3>
          <p>{t('storyboard.keyframesHelp')}</p>
        </div>
        <Button
          disabled={!shot}
          icon={<PlusOutlined aria-hidden="true" />}
          onClick={onAddIntermediate}
          size="small"
        >
          {t('storyboard.addIntermediate')}
        </Button>
      </div>

      {keyframes.length === 0 ? (
        <Empty description={t('storyboard.emptyKeyframes')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="storyboard-timeline__track">
          {keyframes.map((keyframe, index) => {
            const nextKeyframe = keyframes[index + 1];
            const transition = nextKeyframe
              ? shot?.transitions.find(({fromKeyframeId, toKeyframeId}) => (
                fromKeyframeId === keyframe.id && toKeyframeId === nextKeyframe.id
              ))
              : undefined;
            const movement = nextKeyframe
              ? transition?.movementOverride
                ?? detectCameraMovement(keyframe.cameraIntent, nextKeyframe.cameraIntent)
              : null;
            const active = keyframe.id === selectedKeyframeId;
            const previewImageUrl = safeImageUrl(keyframe.imageUrl);

            return (
              <React.Fragment key={keyframe.id}>
                <div
                  draggable={keyframe.type === 'intermediate'}
                  onDragEnd={() => setDraggedKeyframeId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggedKeyframeId(keyframe.id)}
                  onDrop={() => {
                    if (!draggedKeyframeId || draggedKeyframeId === keyframe.id) return;
                    const previous = keyframes[Math.max(0, index - 1)]?.position ?? 0;
                    const next = keyframes[Math.min(keyframes.length - 1, index + 1)]?.position ?? 1;
                    onReposition(draggedKeyframeId, (previous + next) / 2);
                    setDraggedKeyframeId(null);
                  }}
                  style={{position: 'relative'}}
                >
                  <button
                    aria-current={active ? 'true' : undefined}
                    aria-keyshortcuts={keyframe.type === 'intermediate' ? 'ArrowLeft ArrowRight' : undefined}
                    className={`storyboard-keyframe${active ? ' storyboard-keyframe--active' : ''}`}
                    onClick={() => onSelect(keyframe.id)}
                    onKeyDown={(event) => {
                      if (keyframe.type !== 'intermediate') return;
                      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                      event.preventDefault();
                      const direction = event.key === 'ArrowLeft' ? -1 : 1;
                      const step = event.shiftKey ? 0.1 : 0.02;
                      onReposition(keyframe.id, keyframe.position + direction * step);
                    }}
                    type="button"
                  >
                    <span className="storyboard-keyframe__header">
                      <span>{t(`storyboard.keyframeType.${keyframe.type}`)}</span>
                      <span className="storyboard-keyframe__position">
                        {Math.round(keyframe.position * 100)}%
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`storyboard-keyframe__preview${keyframe.imageUrl ? ' storyboard-keyframe__preview--ready' : ''}`}
                    >
                      {previewImageUrl && (
                        <img alt="" src={previewImageUrl} />
                      )}
                    </span>
                    <span className="storyboard-keyframe__meta">
                      {keyframe.imageUrl
                        ? t('storyboard.frameReady')
                        : t('storyboard.frameNotCreated')}
                    </span>
                  </button>
                  {keyframe.type === 'intermediate' && (
                    <Tooltip title={t('storyboard.deleteIntermediate')}>
                      <Button
                        aria-label={t('storyboard.deleteIntermediate')}
                        danger
                        icon={<DeleteOutlined aria-hidden="true" />}
                        onClick={() => onDelete(keyframe.id)}
                        shape="circle"
                        size="small"
                        style={{position: 'absolute', right: -8, top: -8, zIndex: 2}}
                      />
                    </Tooltip>
                  )}
                </div>
                {movement && (
                  <div className="storyboard-transition" aria-label={movement}>
                    <span className="storyboard-transition__line" aria-hidden="true" />
                    <span>{movement}</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
