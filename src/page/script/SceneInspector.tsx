import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import React from 'react';

import type {Scene} from './types';
import {SCENE_TYPE_LABELS} from './types';

interface SceneInspectorProps {
  scene: Scene | null;
  canEdit: boolean;
  saving: boolean;
  dirty: boolean;
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onSave: () => void;
  onDelete: (sceneId: number) => void;
  onOpenScreenplay?: () => void;
  onClose?: () => void;
  showSaveAction?: boolean;
  showTitleField?: boolean;
}

export default function SceneInspector({
  scene,
  canEdit,
  saving,
  dirty,
  onChange,
  onSave,
  onDelete,
  onOpenScreenplay,
  onClose,
  showSaveAction = true,
  showTitleField = true,
}: SceneInspectorProps) {
  if (!scene) {
    return <aside className="script-inspector script-inspector--empty">
      <span className="script-empty-icon">✦</span>
      <h2>Выберите сцену</h2>
      <p>Здесь появятся структура сцены и заметки.</p>
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
          aria-label="Закрыть параметры сцены"
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
    <section className="script-inspector__section">
      <h3>Карточка сцены</h3>
    <label className="script-field">
      <span>Описание</span>
      <textarea
        disabled={!canEdit}
        rows={4}
        value={scene.description}
        onChange={(event) => update({description: event.target.value})}
      />
    </label>
    <div className="script-field-grid">
      <label className="script-field">
        <span>Акт</span>
        <select
          disabled={!canEdit}
          value={scene.act}
          onChange={(event) => update({act: Number(event.target.value)})}
        >
          <option value={1}>Акт 1</option>
          <option value={2}>Акт 2</option>
          <option value={3}>Акт 3</option>
        </select>
      </label>
      <label className="script-field">
        <span>Хронометраж</span>
        <div className="script-number-input">
          <input
            disabled={!canEdit}
            min={0}
            type="number"
            value={Math.round(scene.durationSeconds / 60)}
            onChange={(event) => update({durationSeconds: Math.max(0, Number(event.target.value) * 60)})}
          />
          <span>мин</span>
        </div>
      </label>
    </div>
    <label className="script-field">
      <span>Драматическая функция</span>
      <select
        disabled={!canEdit}
        value={scene.sceneType}
        onChange={(event) => update({sceneType: event.target.value})}
      >
        {Object.entries(SCENE_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
    </section>

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
