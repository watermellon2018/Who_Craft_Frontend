import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {Select} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {Scene} from './types';

interface SceneInspectorProps {
  scene: Scene | null;
  canEdit: boolean;
  saving: boolean;
  dirty: boolean;
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onActChange?: (sceneId: number, act: number) => void;
  onSave: () => void;
  onDelete: (sceneId: number) => void;
  onOpenScreenplay?: () => void;
  onClose?: () => void;
  showSaveAction?: boolean;
  showStructureFields?: boolean;
  showTitleField?: boolean;
}

export default function SceneInspector({
  scene,
  canEdit,
  saving,
  dirty,
  onChange,
  onActChange,
  onSave,
  onDelete,
  onOpenScreenplay,
  onClose,
  showSaveAction = true,
  showStructureFields = true,
  showTitleField = true,
}: SceneInspectorProps) {
  const {t} = useTranslation();

  if (!scene) {
    return <aside className="script-inspector script-inspector--empty">
      <span className="script-empty-icon">✦</span>
      <h2>{t('script.inspector.selectScene')}</h2>
      <p>{t('script.inspector.selectSceneDescription')}</p>
    </aside>;
  }

  const update = (value: Partial<Scene>) => onChange(scene.id, value);
  return <aside className="script-inspector">
    <div className="script-inspector__title">
      <div>
        <span className="script-eyebrow">{t('script.common.sceneNumber', {number: scene.order})}</span>
        <h2>{scene.title || t('script.common.untitled')}</h2>
      </div>
      <div className="script-inspector__title-actions">
        <span className="script-save-state" aria-live="polite">
          {saving ? t('script.status.savingEllipsis') : dirty ? t('script.status.changed') : t('script.status.saved')}
        </span>
        {onClose && <button
          aria-label={t('script.inspector.closeNotes')}
          autoFocus
          onClick={onClose}
        >
          <CloseOutlined />
        </button>}
      </div>
    </div>

    {showTitleField && <label className="script-field">
      <span>{t('script.inspector.title')}</span>
      <input
        disabled={!canEdit}
        value={scene.title}
        onChange={(event) => update({title: event.target.value})}
      />
    </label>}
    {showStructureFields && <section className="script-inspector__section">
      <h3>{t('script.inspector.structure')}</h3>
      <div className="script-field">
        <label htmlFor={`scene-act-${scene.id}`}>{t('script.common.act')}</label>
        <Select<number>
          aria-label={t('script.common.act')}
          disabled={!canEdit}
          id={`scene-act-${scene.id}`}
          options={[
            {label: t('script.common.actNumber', {number: 1}), value: 1},
            {label: t('script.common.actNumber', {number: 2}), value: 2},
            {label: t('script.common.actNumber', {number: 3}), value: 3},
          ]}
          value={scene.act}
          onChange={(act) => {
            if (onActChange) onActChange(scene.id, act);
            else update({act});
          }}
        />
      </div>
    </section>}

    <section className="script-inspector__section">
      <h3>{t('script.common.notes')}</h3>
    <label className="script-field">
      <span>{t('script.inspector.notesDescription')}</span>
      <textarea
        disabled={!canEdit}
        rows={4}
        value={scene.notes}
        onChange={(event) => update({notes: event.target.value})}
      />
    </label>
    </section>

    <div className="script-inspector__actions">
      {showSaveAction && <button className="script-button script-button--primary" disabled={!canEdit || saving || !dirty} onClick={onSave}>
        <SaveOutlined /> {saving ? t('script.status.savingEllipsis') : t('script.actions.save')}
      </button>}
      {onOpenScreenplay && <button className="script-button" onClick={onOpenScreenplay}>
        <PlusOutlined /> {t('script.actions.openInScreenplay')}
      </button>}
      {canEdit && <button className="script-button script-button--danger" onClick={() => onDelete(scene.id)}>
        <DeleteOutlined /> {t('script.actions.deleteScene')}
      </button>}
    </div>
  </aside>;
}
