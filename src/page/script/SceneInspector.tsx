import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {Select} from 'antd';
import React from 'react';

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
  if (!scene) {
    return <aside className="script-inspector script-inspector--empty">
      <span className="script-empty-icon">✦</span>
      <h2>Выберите сцену</h2>
      <p>Здесь можно выбрать акт и оставить заметки.</p>
    </aside>;
  }

  const update = (value: Partial<Scene>) => onChange(scene.id, value);
  return <aside className="script-inspector">
    <div className="script-inspector__title">
      <div>
        <span className="script-eyebrow">СЦЕНА {scene.order}</span>
        <h2>{scene.title || 'Без названия'}</h2>
      </div>
      <div className="script-inspector__title-actions">
        <span className="script-save-state" aria-live="polite">
          {saving ? 'Сохраняем…' : dirty ? 'Есть изменения' : 'Сохранено'}
        </span>
        {onClose && <button
          aria-label="Закрыть заметки сцены"
          autoFocus
          onClick={onClose}
        >
          <CloseOutlined />
        </button>}
      </div>
    </div>

    {showTitleField && <label className="script-field">
      <span>Заголовок</span>
      <input
        disabled={!canEdit}
        value={scene.title}
        onChange={(event) => update({title: event.target.value})}
      />
    </label>}
    {showStructureFields && <section className="script-inspector__section">
      <h3>Структура</h3>
      <div className="script-field">
        <label htmlFor={`scene-act-${scene.id}`}>Акт</label>
        <Select<number>
          aria-label="Акт"
          disabled={!canEdit}
          id={`scene-act-${scene.id}`}
          options={[
            {label: 'Акт 1', value: 1},
            {label: 'Акт 2', value: 2},
            {label: 'Акт 3', value: 3},
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
      <h3>Заметки</h3>
    <label className="script-field">
      <span>Служебные заметки, которые не попадут в текст сценария</span>
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
        <SaveOutlined /> {saving ? 'Сохраняем…' : 'Сохранить'}
      </button>}
      {onOpenScreenplay && <button className="script-button" onClick={onOpenScreenplay}>
        <PlusOutlined /> Открыть в сценарии
      </button>}
      {canEdit && <button className="script-button script-button--danger" onClick={() => onDelete(scene.id)}>
        <DeleteOutlined /> Удалить сцену
      </button>}
    </div>
  </aside>;
}
