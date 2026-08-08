import {DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import React from 'react';

import SceneInspector from './SceneInspector';
import type {CompactCharacter, Scene, ScriptBlock, ScriptBlockType} from './types';
import {BLOCK_LABELS} from './types';

interface ScreenplayViewProps {
  scenes: Scene[];
  characters: CompactCharacter[];
  selectedScene: Scene | null;
  canEdit: boolean;
  canRunGeneration: boolean;
  dirtySceneIds: number[];
  savingSceneIds: number[];
  onSelect: (sceneId: number) => void;
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onSave: () => void;
  onAddScene: () => void;
  onDeleteScene: (sceneId: number) => void;
  onCreateMusic: (sceneId: number) => void;
}

const newBlock = (type: ScriptBlockType): ScriptBlock => ({
  id: crypto.randomUUID(),
  type,
  text: '',
});

export default function ScreenplayView(props: ScreenplayViewProps) {
  const scene = props.selectedScene;
  const updateBlocks = (blocks: ScriptBlock[]) => {
    if (!scene) return;
    props.onChange(scene.id, {
      scriptBlocks: blocks,
      scriptText: blocks.map((block) => block.text).filter(Boolean).join('\n\n'),
    });
  };
  const changeBlock = (blockId: string, update: Partial<ScriptBlock>) => {
    if (!scene) return;
    updateBlocks(scene.scriptBlocks.map((block) => block.id === blockId ? {...block, ...update} : block));
  };
  const appendBlock = (type: ScriptBlockType) => {
    if (!scene) return;
    updateBlocks([...scene.scriptBlocks, newBlock(type)]);
  };

  return <div className="screenplay-layout">
    <nav className="scene-navigator" aria-label="Сцены сценария">
      <div className="scene-navigator__header">
        <div>
          <span className="script-eyebrow">СТРУКТУРА</span>
          <h2>Сцены</h2>
        </div>
        {props.canEdit && <button aria-label="Добавить сцену" onClick={props.onAddScene}><PlusOutlined /></button>}
      </div>
      <div className="scene-navigator__list">
        {props.scenes.map((item) => (
          <button
            key={item.id}
            className={scene?.id === item.id ? 'is-selected' : ''}
            onClick={() => props.onSelect(item.id)}
          >
            <span>{item.order}</span>
            <span><strong>{item.title || 'Без названия'}</strong><small>Акт {item.act} · {Math.round(item.durationSeconds / 60)} мин</small></span>
          </button>
        ))}
      </div>
    </nav>

    <main className="screenplay-canvas">
      {scene ? <>
        <div className="screenplay-paper">
          <header>
            <span>СЦЕНА {scene.order}</span>
            <span>Акт {scene.act}</span>
          </header>
          <input
            aria-label="Название сцены"
            className="screenplay-title-input"
            disabled={!props.canEdit}
            value={scene.title}
            onChange={(event) => props.onChange(scene.id, {title: event.target.value})}
          />
          <div className="screenplay-blocks">
            {scene.scriptBlocks.map((block) => (
              <div key={block.id} className={`screenplay-block screenplay-block--${block.type}`}>
                <div className="screenplay-block__tools">
                  <select
                    aria-label="Тип блока"
                    disabled={!props.canEdit}
                    value={block.type}
                    onChange={(event) => changeBlock(block.id, {type: event.target.value as ScriptBlockType})}
                  >
                    {Object.entries(BLOCK_LABELS).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                  {block.type === 'dialogue' && <select
                    aria-label="Персонаж реплики"
                    disabled={!props.canEdit}
                    value={block.characterId || ''}
                    onChange={(event) => changeBlock(block.id, {characterId: event.target.value || undefined})}
                  >
                    <option value="">Персонаж…</option>
                    {props.characters.map((character) => (
                      <option key={character.id} value={character.id}>{character.name}</option>
                    ))}
                  </select>}
                  {props.canEdit && <button
                    aria-label="Удалить блок"
                    onClick={() => updateBlocks(scene.scriptBlocks.filter((item) => item.id !== block.id))}
                  ><DeleteOutlined /></button>}
                </div>
                <textarea
                  aria-label={BLOCK_LABELS[block.type]}
                  disabled={!props.canEdit}
                  placeholder={BLOCK_LABELS[block.type]}
                  rows={block.type === 'dialogue' || block.type === 'action' ? 3 : 1}
                  value={block.text}
                  onChange={(event) => changeBlock(block.id, {text: event.target.value})}
                />
              </div>
            ))}
            {scene.scriptBlocks.length === 0 && <div className="screenplay-paper__empty">
              Начните со строки места и времени действия.
            </div>}
          </div>
        </div>
        {props.canEdit && <div className="block-toolbar" aria-label="Добавить блок сценария">
          {(['scene_heading', 'action', 'character', 'dialogue', 'remark', 'camera', 'transition', 'sound', 'note'] as ScriptBlockType[])
            .map((type) => <button key={type} onClick={() => appendBlock(type)}>
              <PlusOutlined /> {BLOCK_LABELS[type]}
            </button>)}
        </div>}
      </> : <div className="script-center-empty">
        <span>✦</span>
        <h2>Сценарий пока пуст</h2>
        <p>Добавьте первую сцену, чтобы начать писать.</p>
        {props.canEdit && <button className="script-button script-button--primary" onClick={props.onAddScene}>
          <PlusOutlined /> Добавить сцену
        </button>}
      </div>}
    </main>

    <SceneInspector
      scene={scene}
      characters={props.characters}
      canEdit={props.canEdit}
      canRunGeneration={props.canRunGeneration}
      dirty={Boolean(scene && props.dirtySceneIds.includes(scene.id))}
      saving={Boolean(scene && props.savingSceneIds.includes(scene.id))}
      onChange={props.onChange}
      onDelete={props.onDeleteScene}
      onCreateMusic={props.onCreateMusic}
      onSave={props.onSave}
    />
  </div>;
}
