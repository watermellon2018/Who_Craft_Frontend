import {ArrowRightOutlined} from '@ant-design/icons';
import {Empty, Modal} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import {sortKeyframes} from '../model';
import type {StoryboardScene} from '../model';

interface StoryboardPreviewProps {
  open: boolean;
  scene: StoryboardScene | null;
  onClose: () => void;
}

export default function StoryboardPreview({open, scene, onClose}: StoryboardPreviewProps) {
  const {t} = useTranslation();

  return (
    <Modal
      centered
      footer={null}
      onCancel={onClose}
      open={open}
      title={t('storyboard.preview.title')}
      width="min(1100px, 94vw)"
    >
      {!scene || scene.shots.length === 0 ? (
        <Empty description={t('storyboard.preview.empty')} />
      ) : (
        <div className="storyboard-preview-grid">
          {scene.shots.map((shot) => (
            <article className="storyboard-preview-shot" key={shot.id}>
              <h3>
                Shot {String(shot.order).padStart(2, '0')} · {shot.title}
                <span className="storyboard-duration" style={{float: 'right'}}>
                  {shot.duration?.toFixed(1)} {t('storyboard.secondsShort')}
                </span>
              </h3>
              <div className="storyboard-preview-shot__frames">
                {sortKeyframes(shot.keyframes).map((keyframe, index, keyframes) => {
                  const previewImageUrl = safeImageUrl(keyframe.imageUrl);
                  return (
                    <React.Fragment key={keyframe.id}>
                    <div className="storyboard-preview-shot__frame">
                      {previewImageUrl && (
                        <img
                          alt={t('storyboard.preview.imageAlt', {
                            keyframe: t(`storyboard.keyframeType.${keyframe.type}`),
                            shot: shot.order,
                          })}
                          src={previewImageUrl}
                        />
                      )}
                      <span>
                        {keyframe.imageUrl
                          ? t(`storyboard.keyframeType.${keyframe.type}`)
                          : t('storyboard.preview.missingFrame')}
                      </span>
                    </div>
                    {index < keyframes.length - 1 && <ArrowRightOutlined aria-hidden="true" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
