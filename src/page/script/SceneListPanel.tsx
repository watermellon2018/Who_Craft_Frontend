import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {Scene} from './types';

interface SceneListPanelProps {
  canEdit: boolean;
  collapsed: boolean;
  scenes: Scene[];
  selectedSceneId: number | null;
  onAdd: () => void;
  onSelect: (sceneId: number) => void;
  onToggle: () => void;
}

export default function SceneListPanel(props: SceneListPanelProps) {
  const {t} = useTranslation();
  const toggleLabel = props.collapsed
    ? t('script.sceneList.openPanel')
    : t('script.sceneList.hidePanel');

  return <aside
    aria-label={t('script.sceneList.label')}
    className={`script-scenes-panel${props.collapsed ? ' is-collapsed' : ''}`}
  >
    <div className="script-scenes-panel__header">
      {!props.collapsed && <div>
        <span className="script-eyebrow">{t('script.sceneList.structure')}</span>
        <h2>{t('script.common.scenes')}</h2>
      </div>}
      <div className="script-scenes-panel__actions">
        {!props.collapsed && props.canEdit && <button
          aria-label={t('script.actions.addScene')}
          type="button"
          onClick={props.onAdd}
        >
          <PlusOutlined />
        </button>}
        <button
          aria-controls="script-scene-list"
          aria-expanded={!props.collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          type="button"
          onClick={props.onToggle}
        >
          {props.collapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
        </button>
      </div>
    </div>

    {!props.collapsed && <div className="script-scenes-panel__items" id="script-scene-list">
      {props.scenes.map((scene) => <button
        key={scene.id}
        aria-current={props.selectedSceneId === scene.id ? 'true' : undefined}
        className={props.selectedSceneId === scene.id ? 'is-selected' : ''}
        type="button"
        onClick={() => props.onSelect(scene.id)}
      >
        <span>{scene.order}</span>
        <span>
          <strong>{scene.title || t('script.common.untitled')}</strong>
          <small>{t('script.common.actNumber', {number: scene.act})}</small>
        </span>
      </button>)}
    </div>}
  </aside>;
}
