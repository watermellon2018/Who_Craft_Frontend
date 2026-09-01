import {CheckCircleOutlined, ClockCircleOutlined, MinusCircleOutlined} from '@ant-design/icons';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {isShotReady} from '../model';
import type {StoryboardScene} from '../model';

interface SceneSidebarProps {
  scenes: StoryboardScene[];
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
}

const STATUS_ICONS = {
  completed: <CheckCircleOutlined aria-hidden="true" />,
  draft: <ClockCircleOutlined aria-hidden="true" />,
  empty: <MinusCircleOutlined aria-hidden="true" />,
};

export default function SceneSidebar({scenes, selectedSceneId, onSelect}: SceneSidebarProps) {
  const {t} = useTranslation();

  return (
    <aside className="storyboard-scenes" aria-label={t('storyboard.scenes')}>
      <div className="storyboard-section-heading">
        <div>
          <h2>{t('storyboard.scenes')}</h2>
          <p>{t('storyboard.fromScript')}</p>
        </div>
      </div>

      <div className="storyboard-scene-list">
        {scenes.map((scene, index) => {
          const active = scene.id === selectedSceneId;
          const shotCount = scene.shotsCount ?? scene.shots.length;
          const readyShotCount = scene.readyShotsCount ?? scene.shots.filter(isShotReady).length;
          return (
            <button
              aria-current={active ? 'true' : undefined}
              className={`storyboard-scene-button${active ? ' storyboard-scene-button--active' : ''}`}
              key={scene.id}
              onClick={() => onSelect(scene.id)}
              type="button"
            >
              <span className="storyboard-scene-button__number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="storyboard-scene-button__body">
                <span className="storyboard-scene-button__title">
                  {scene.heading || scene.title}
                </span>
                <span className="storyboard-scene-button__meta">
                  <span className={`storyboard-status storyboard-status--${scene.status}`}>
                    {STATUS_ICONS[scene.status]}
                    {t(`storyboard.status.${scene.status}`)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {shotCount > 0
                      ? t('storyboard.shotsReady', {ready: readyShotCount, total: shotCount})
                      : t('storyboard.notStoryboarded')}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
