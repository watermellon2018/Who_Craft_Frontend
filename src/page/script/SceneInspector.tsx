import {CustomerServiceOutlined, DeleteOutlined, PlusOutlined, SaveOutlined} from '@ant-design/icons';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {CompactCharacter, Scene, SceneCharacter} from './types';
import {MOOD_LABELS, SCENE_TYPE_LABELS} from './types';

interface SceneInspectorProps {
  scene: Scene | null;
  characters: CompactCharacter[];
  canEdit: boolean;
  canRunGeneration: boolean;
  saving: boolean;
  dirty: boolean;
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onSave: () => void;
  onDelete: (sceneId: number) => void;
  onOpenScreenplay?: () => void;
  onCreateMusic?: (sceneId: number) => void;
}

const toSceneCharacter = (character: CompactCharacter): SceneCharacter => ({
  id: character.id,
  name: character.name,
  role: character.role,
  roleLabel: character.roleLabel,
  imageUrl: character.imageUrl,
});

export default function SceneInspector({
  scene,
  characters,
  canEdit,
  canRunGeneration,
  saving,
  dirty,
  onChange,
  onSave,
  onDelete,
  onOpenScreenplay,
  onCreateMusic,
}: SceneInspectorProps) {
  const {t} = useTranslation();
  if (!scene) {
    return <aside className="script-inspector script-inspector--empty">
      <span className="script-empty-icon">✦</span>
      <h2>Выберите сцену</h2>
      <p>Здесь появятся детали, персонажи и заметки.</p>
    </aside>;
  }

  const update = (value: Partial<Scene>) => onChange(scene.id, value);
  const toggleCharacter = (character: CompactCharacter) => {
    const selected = scene.characters.some((item) => item.id === character.id);
    update({
      characters: selected
        ? scene.characters.filter((item) => item.id !== character.id)
        : [...scene.characters, toSceneCharacter(character)],
    });
  };

  return <aside className="script-inspector">
    <div className="script-inspector__title">
      <div>
        <span className="script-eyebrow">СЦЕНА {scene.order}</span>
        <h2>{scene.title || 'Без названия'}</h2>
      </div>
      {dirty && <span className="script-unsaved">Не сохранено</span>}
    </div>

    <label className="script-field">
      <span>Заголовок</span>
      <input
        disabled={!canEdit}
        value={scene.title}
        onChange={(event) => update({title: event.target.value})}
      />
    </label>
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
      <span>Тип сцены</span>
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
    <label className="script-field">
      <span>Настроение</span>
      <select
        disabled={!canEdit}
        value={scene.mood}
        onChange={(event) => update({mood: event.target.value})}
      >
        {Object.entries(MOOD_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>

    <fieldset className="script-character-picker" disabled={!canEdit}>
      <legend>Персонажи</legend>
      <div className="script-character-picker__list">
        {characters.map((character) => {
          const checked = scene.characters.some((item) => item.id === character.id);
          return <label key={character.id} className={checked ? 'is-selected' : ''}>
            <input
              checked={checked}
              type="checkbox"
              onChange={() => toggleCharacter(character)}
            />
            <span>{character.name}</span>
          </label>;
        })}
        {characters.length === 0 && <span className="script-muted">Персонажей пока нет</span>}
      </div>
    </fieldset>

    <label className="script-field">
      <span>Заметки</span>
      <textarea
        disabled={!canEdit}
        rows={4}
        value={scene.notes}
        onChange={(event) => update({notes: event.target.value})}
      />
    </label>

    <div className="script-inspector__actions">
      <button className="script-button script-button--primary" disabled={!canEdit || saving || !dirty} onClick={onSave}>
        <SaveOutlined /> {saving ? 'Сохраняем…' : 'Сохранить'}
      </button>
      {onOpenScreenplay && <button className="script-button" onClick={onOpenScreenplay}>
        <PlusOutlined /> Открыть в сценарии
      </button>}
      {canRunGeneration && onCreateMusic && <button className="script-button" onClick={() => onCreateMusic(scene.id)}>
        <CustomerServiceOutlined /> {t('musicStudio.create.title')}
      </button>}
      {canEdit && <button className="script-button script-button--danger" onClick={() => onDelete(scene.id)}>
        <DeleteOutlined /> Удалить сцену
      </button>}
    </div>
  </aside>;
}
