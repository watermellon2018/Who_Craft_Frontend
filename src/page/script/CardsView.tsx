import {EllipsisOutlined, PlusOutlined} from '@ant-design/icons';
import React from 'react';

import SceneInspector from './SceneInspector';
import type {CompactCharacter, Scene} from './types';
import {SCENE_TYPE_LABELS} from './types';

interface CardsViewProps {
  scenes: Scene[];
  characters: CompactCharacter[];
  selectedScene: Scene | null;
  characterFilter: string | null;
  canEdit: boolean;
  dirtySceneIds: number[];
  savingSceneIds: number[];
  onSelect: (sceneId: number) => void;
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onSave: () => void;
  onAdd: () => void;
  onDelete: (sceneId: number) => void;
  onOpenScreenplay: () => void;
  onClearFilter: () => void;
}

const ACT_META = [
  {act: 1, title: 'АКТ 1 — Завязка', className: 'act-teal'},
  {act: 2, title: 'АКТ 2 — Конфликт', className: 'act-violet'},
  {act: 3, title: 'АКТ 3 — Финал', className: 'act-coral'},
];

export default function CardsView(props: CardsViewProps) {
  const filteredScenes = props.characterFilter
    ? props.scenes.filter((scene) => scene.characters.some((item) => item.id === props.characterFilter))
    : props.scenes;

  return <div className="cards-layout">
    <main className="cards-board">
      {props.characterFilter && <div className="script-filter-note">
        Показаны сцены выбранного персонажа
        <button onClick={props.onClearFilter}>Показать все</button>
      </div>}
      <div className="cards-columns">
        {ACT_META.map(({act, title, className}) => {
          const actScenes = filteredScenes.filter((scene) => scene.act === act);
          return <section key={act} className={`cards-column ${className}`}>
            <header>
              <h2>{title}</h2>
              <span>{actScenes.length} сцен</span>
            </header>
            <div className="cards-column__body">
              {actScenes.map((scene) => (
                <button
                  key={scene.id}
                  className={`scene-card ${props.selectedScene?.id === scene.id ? 'is-selected' : ''}`}
                  onClick={() => props.onSelect(scene.id)}
                >
                  <div className="scene-card__meta">
                    <strong>{scene.order}</strong>
                    <span>{Math.round(scene.durationSeconds / 60)} мин</span>
                    <EllipsisOutlined />
                  </div>
                  <h3>{scene.title || 'Без названия'}</h3>
                  <p>{scene.description || 'Добавьте краткое описание сцены.'}</p>
                  <div className="scene-card__footer">
                    <span className="scene-card__people">
                      {scene.characters.slice(0, 2).map((character) => character.name).join(' · ') || 'Без персонажей'}
                    </span>
                    <span className="scene-card__type">{SCENE_TYPE_LABELS[scene.sceneType] || scene.sceneType}</span>
                  </div>
                </button>
              ))}
              {actScenes.length === 0 && <div className="cards-empty">В этом акте пока нет сцен</div>}
              {props.canEdit && <button className="cards-add" onClick={props.onAdd}>
                <PlusOutlined /> Добавить сцену
              </button>}
            </div>
          </section>;
        })}
      </div>
    </main>
    <SceneInspector
      scene={props.selectedScene}
      characters={props.characters}
      canEdit={props.canEdit}
      dirty={Boolean(props.selectedScene && props.dirtySceneIds.includes(props.selectedScene.id))}
      saving={Boolean(props.selectedScene && props.savingSceneIds.includes(props.selectedScene.id))}
      onChange={props.onChange}
      onDelete={props.onDelete}
      onOpenScreenplay={props.onOpenScreenplay}
      onSave={props.onSave}
    />
  </div>;
}
