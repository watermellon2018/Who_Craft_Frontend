import {
  DeleteOutlined,
  FileTextOutlined,
  PlusOutlined,
  RedoOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {Select} from 'antd';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import SceneInspector from './SceneInspector';
import type {
  CompactCharacter,
  Scene,
  SceneCharacter,
  ScriptBlock,
  ScriptBlockType,
} from './types';
import {BLOCK_LABELS} from './types';

interface ScreenplayViewProps {
  characters: CompactCharacter[];
  selectedScene: Scene | null;
  sceneCount: number;
  scenePosition: number;
  canEdit: boolean;
  dirtySceneIds: number[];
  savingSceneIds: number[];
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onSave: () => void;
  onAddScene: () => void;
  onDeleteScene: (sceneId: number) => void;
}

interface ScreenplayHistoryEntry {
  blocks: ScriptBlock[];
  characters: SceneCharacter[];
}

interface ScreenplayPaperStyle extends React.CSSProperties {
  '--screenplay-body-font-size': string;
  '--screenplay-line-min-height': string;
  '--screenplay-meta-font-size': string;
  '--screenplay-page-min-height': string;
  '--screenplay-page-padding-end': string;
  '--screenplay-page-padding-start': string;
  '--screenplay-page-width': string;
  '--screenplay-title-font-size': string;
}

type ZoomMode = 'fit' | number;

const BLOCK_TYPES = Object.keys(BLOCK_LABELS) as ScriptBlockType[];
const BLOCK_TYPE_OPTIONS = BLOCK_TYPES.map((type) => ({
  label: BLOCK_LABELS[type],
  value: type,
}));
const CHARACTER_LINKED_BLOCK_TYPES = new Set<ScriptBlockType>(['character', 'dialogue', 'remark']);
const DEFAULT_ZOOM = 100;
const MAX_ZOOM = 200;
const MIN_ZOOM = 50;
const SCREENPLAY_PAGE_WIDTH = 820;
const ZOOM_LEVELS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];
const ZOOM_STORAGE_KEY = 'wcraft.screenplay.zoom';

const ENTER_BLOCK_TYPE: Record<ScriptBlockType, ScriptBlockType> = {
  scene_heading: 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'action',
  remark: 'dialogue',
  camera: 'action',
  transition: 'scene_heading',
  sound: 'action',
  note: 'action',
};

const TAB_BLOCK_TYPE: Record<ScriptBlockType, ScriptBlockType> = {
  scene_heading: 'action',
  action: 'character',
  character: 'dialogue',
  dialogue: 'remark',
  remark: 'transition',
  camera: 'sound',
  transition: 'scene_heading',
  sound: 'note',
  note: 'camera',
};

const newBlock = (type: ScriptBlockType, text = ''): ScriptBlock => ({
  id: typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  text,
});

const resizeTextarea = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const toSceneCharacter = (character: CompactCharacter): SceneCharacter => ({
  id: character.id,
  imageUrl: character.imageUrl,
  name: character.name,
  role: character.role,
  roleLabel: character.roleLabel,
});

const filterCharacters = (characters: CompactCharacter[], text: string) => {
  const query = text.trim().toLocaleLowerCase();
  if (!query) return characters;
  return characters.filter((character) => (
    character.name.toLocaleLowerCase().includes(query)
  ));
};

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const readStoredZoom = (): ZoomMode => {
  if (typeof window === 'undefined') return DEFAULT_ZOOM;
  try {
    const storedZoom = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (storedZoom === 'fit') return storedZoom;
    const numericZoom = Number(storedZoom);
    return ZOOM_LEVELS.some((zoom) => zoom === numericZoom) ? numericZoom : DEFAULT_ZOOM;
  } catch {
    return DEFAULT_ZOOM;
  }
};

export default function ScreenplayView(props: ScreenplayViewProps) {
  const scene = props.selectedScene;
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{blockId: string; index: number} | null>(null);
  const [characterMenu, setCharacterMenu] = useState<{blockId: string; index: number} | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>(readStoredZoom);
  const [fitZoom, setFitZoom] = useState(DEFAULT_ZOOM);
  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocusRef = useRef<{blockId: string; position?: number} | null>(null);
  const inspectorButtonRef = useRef<HTMLButtonElement>(null);
  const characterOptionRefs = useRef(new Map<string, HTMLButtonElement>());
  const undoRef = useRef(new Map<number, ScreenplayHistoryEntry[]>());
  const redoRef = useRef(new Map<number, ScreenplayHistoryEntry[]>());
  const firstBlockId = scene?.scriptBlocks[0]?.id;
  const zoomPercent = zoomMode === 'fit' ? fitZoom : zoomMode;

  const paperStyle = useMemo<ScreenplayPaperStyle>(() => {
    const scale = zoomPercent / DEFAULT_ZOOM;
    return {
      '--screenplay-body-font-size': `${(14 * scale).toFixed(1)}px`,
      '--screenplay-line-min-height': `${Math.round(30 * scale)}px`,
      '--screenplay-meta-font-size': `${(10 * scale).toFixed(1)}px`,
      '--screenplay-page-min-height': `${Math.round(620 * scale)}px`,
      '--screenplay-page-padding-end': `${Math.round(90 * scale)}px`,
      '--screenplay-page-padding-start': `${Math.round(42 * scale)}px`,
      '--screenplay-page-width': `${Math.round(SCREENPLAY_PAGE_WIDTH * scale)}px`,
      '--screenplay-title-font-size': `${(22 * scale).toFixed(1)}px`,
    };
  }, [zoomPercent]);

  const zoomOptions = useMemo(() => [
    {label: zoomMode === 'fit' ? `По ширине · ${fitZoom}%` : 'По ширине', value: 'fit' as const},
    ...ZOOM_LEVELS.map((zoom) => ({label: `${zoom}%`, value: zoom})),
  ], [fitZoom, zoomMode]);

  const activeBlock = useMemo(
    () => scene?.scriptBlocks.find((block) => block.id === activeBlockId) ?? null,
    [activeBlockId, scene?.scriptBlocks],
  );

  useEffect(() => {
    setActiveBlockId(firstBlockId ?? null);
    setInspectorOpen(false);
    setSlashMenu(null);
    setCharacterMenu(null);
  }, [firstBlockId, scene?.id]);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const textarea = textareaRefs.current.get(pending.blockId);
    if (!textarea) return;
    textarea.focus();
    const position = pending.position ?? textarea.value.length;
    textarea.setSelectionRange(position, position);
    pendingFocusRef.current = null;
  }, [scene?.scriptBlocks]);

  useEffect(() => {
    if (!characterMenu || !scene) return;
    const block = scene.scriptBlocks.find((item) => item.id === characterMenu.blockId);
    if (!block) return;
    const options = filterCharacters(props.characters, block.text);
    const activeCharacter = options[Math.min(characterMenu.index, options.length - 1)];
    if (!activeCharacter) return;
    characterOptionRefs.current
      .get(`${block.id}:${activeCharacter.id}`)
      ?.scrollIntoView?.({block: 'nearest'});
  }, [characterMenu, props.characters, scene]);

  useEffect(() => {
    if (!inspectorOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setInspectorOpen(false);
      inspectorButtonRef.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [inspectorOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomMode));
    } catch {
      // The active session still keeps the selected zoom when storage is unavailable.
    }
  }, [zoomMode]);

  useEffect(() => {
    if (zoomMode !== 'fit') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const updateFitZoom = () => {
      const style = window.getComputedStyle(canvas);
      const paddingStart = Number.parseFloat(style.paddingInlineStart) || 0;
      const paddingEnd = Number.parseFloat(style.paddingInlineEnd) || 0;
      const availableWidth = Math.max(0, canvas.clientWidth - paddingStart - paddingEnd);
      setFitZoom(clampZoom(Math.floor(availableWidth / SCREENPLAY_PAGE_WIDTH * 100)));
    };

    updateFitZoom();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFitZoom);
      return () => window.removeEventListener('resize', updateFitZoom);
    }

    const observer = new ResizeObserver(updateFitZoom);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [inspectorOpen, zoomMode]);

  const characterIdsForBlocks = useCallback((blocks: ScriptBlock[]) => {
    const characterIds = new Set<string>();
    for (const block of blocks) {
      if (block.characterId) characterIds.add(block.characterId);
      if (block.type !== 'character') continue;
      const matchingCharacter = props.characters.find((character) => (
        character.name.toLocaleLowerCase() === block.text.trim().toLocaleLowerCase()
      ));
      if (matchingCharacter) characterIds.add(matchingCharacter.id);
    }
    return characterIds;
  }, [props.characters]);

  const sceneCharactersForBlocks = useCallback((blocks: ScriptBlock[]) => {
    if (!scene) return [];
    const previousBlockCharacterIds = characterIdsForBlocks(scene.scriptBlocks);
    const nextCharacterIds = characterIdsForBlocks(blocks);
    const characterById = new Map<string, SceneCharacter>([
      ...scene.characters.map((character) => [character.id, character] as const),
      ...props.characters.map((character) => [character.id, toSceneCharacter(character)] as const),
    ]);
    const retainedLegacyIds = scene.characters
      .map((character) => character.id)
      .filter((characterId) => !previousBlockCharacterIds.has(characterId));
    const desiredCharacterIds = new Set(retainedLegacyIds);
    nextCharacterIds.forEach((characterId) => desiredCharacterIds.add(characterId));

    return Array.from(desiredCharacterIds)
      .map((characterId) => characterById.get(characterId))
      .filter((character): character is SceneCharacter => Boolean(character));
  }, [characterIdsForBlocks, props.characters, scene]);

  const updateBlocks = useCallback((
    blocks: ScriptBlock[],
    recordHistory = true,
    charactersOverride?: SceneCharacter[],
  ) => {
    if (!scene) return;
    if (recordHistory) {
      const history = undoRef.current.get(scene.id) ?? [];
      undoRef.current.set(scene.id, [...history.slice(-99), {
        blocks: scene.scriptBlocks,
        characters: scene.characters,
      }]);
      redoRef.current.set(scene.id, []);
    }
    props.onChange(scene.id, {
      characters: charactersOverride ?? sceneCharactersForBlocks(blocks),
      scriptBlocks: blocks,
      scriptText: blocks.map((block) => block.text).filter(Boolean).join('\n\n'),
    });
  }, [props, scene, sceneCharactersForBlocks]);

  const changeBlock = (blockId: string, update: Partial<ScriptBlock>) => {
    if (!scene) return;
    updateBlocks(scene.scriptBlocks.map((block) => block.id === blockId ? {...block, ...update} : block));
  };

  const changeBlockType = (blockId: string, type: ScriptBlockType) => {
    if (!scene) return;
    updateBlocks(scene.scriptBlocks.map((block) => {
      if (block.id !== blockId) return block;
      const {characterId, ...blockWithoutCharacter} = block;
      return CHARACTER_LINKED_BLOCK_TYPES.has(block.type)
        && CHARACTER_LINKED_BLOCK_TYPES.has(type)
        && characterId
        ? {...blockWithoutCharacter, characterId, type}
        : {...blockWithoutCharacter, type};
    }));
  };

  const focusBlock = (blockId: string, position?: number) => {
    pendingFocusRef.current = {blockId, position};
    setActiveBlockId(blockId);
  };

  const stepZoom = (direction: -1 | 1) => {
    const nextZoom = direction === 1
      ? ZOOM_LEVELS.find((zoom) => zoom > zoomPercent)
      : ZOOM_LEVELS.slice().reverse().find((zoom) => zoom < zoomPercent);
    if (nextZoom) setZoomMode(nextZoom);
  };

  const undo = () => {
    if (!scene) return;
    const history = undoRef.current.get(scene.id) ?? [];
    const previous = history.at(-1);
    if (!previous) return;
    redoRef.current.set(scene.id, [...(redoRef.current.get(scene.id) ?? []), {
      blocks: scene.scriptBlocks,
      characters: scene.characters,
    }]);
    undoRef.current.set(scene.id, history.slice(0, -1));
    updateBlocks(previous.blocks, false, previous.characters);
  };

  const redo = () => {
    if (!scene) return;
    const history = redoRef.current.get(scene.id) ?? [];
    const next = history.at(-1);
    if (!next) return;
    undoRef.current.set(scene.id, [...(undoRef.current.get(scene.id) ?? []), {
      blocks: scene.scriptBlocks,
      characters: scene.characters,
    }]);
    redoRef.current.set(scene.id, history.slice(0, -1));
    updateBlocks(next.blocks, false, next.characters);
  };

  const deleteBlock = (blockId: string) => {
    if (!scene) return;
    const blockIndex = scene.scriptBlocks.findIndex((block) => block.id === blockId);
    const remaining = scene.scriptBlocks.filter((block) => block.id !== blockId);
    const nextActive = remaining[Math.max(0, blockIndex - 1)] ?? remaining[0];
    updateBlocks(remaining);
    setSlashMenu(null);
    setCharacterMenu(null);
    if (nextActive) {
      focusBlock(nextActive.id);
    } else {
      pendingFocusRef.current = null;
      setActiveBlockId(null);
    }
  };

  const selectBlockType = (blockId: string, type: ScriptBlockType) => {
    changeBlockType(blockId, type);
    setSlashMenu(null);
    setCharacterMenu(type === 'character' && props.characters.length > 0
      ? {blockId, index: 0}
      : null);
    focusBlock(blockId, 0);
  };

  const selectCharacter = (blockId: string, character: CompactCharacter) => {
    if (!scene) return;
    const blocks = scene.scriptBlocks.map((block) => block.id === blockId
      ? {...block, characterId: character.id, text: character.name.toLocaleUpperCase()}
      : block);
    updateBlocks(blocks);
    setCharacterMenu(null);
    focusBlock(blockId);
  };

  const handleBlockKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, block: ScriptBlock) => {
    if (!scene || !props.canEdit) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (characterMenu?.blockId === block.id) {
      const options = filterCharacters(props.characters, block.text);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (options.length === 0) return;
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setCharacterMenu({
          blockId: block.id,
          index: (characterMenu.index + direction + options.length) % options.length,
        });
        return;
      }
      if (event.key === 'Enter' && options.length > 0) {
        event.preventDefault();
        selectCharacter(block.id, options[Math.min(characterMenu.index, options.length - 1)]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setCharacterMenu(null);
        return;
      }
    }

    if (slashMenu?.blockId === block.id) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setSlashMenu({
          blockId: block.id,
          index: (slashMenu.index + direction + BLOCK_TYPES.length) % BLOCK_TYPES.length,
        });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        selectBlockType(block.id, BLOCK_TYPES[slashMenu.index]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setSlashMenu(null);
        return;
      }
    }

    if (event.key === '/' && block.text.length === 0) {
      event.preventDefault();
      if (block.type === 'character') {
        setCharacterMenu({blockId: block.id, index: 0});
      } else {
        setSlashMenu({blockId: block.id, index: 0});
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const type = TAB_BLOCK_TYPE[block.type];
      changeBlockType(block.id, type);
      setSlashMenu(null);
      setCharacterMenu(type === 'character' && props.characters.length > 0
        ? {blockId: block.id, index: 0}
        : null);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const caretStart = event.currentTarget.selectionStart;
      const caretEnd = event.currentTarget.selectionEnd;
      const nextBlock = {
        ...newBlock(ENTER_BLOCK_TYPE[block.type], block.text.slice(caretEnd)),
        ...(block.characterId
          && CHARACTER_LINKED_BLOCK_TYPES.has(ENTER_BLOCK_TYPE[block.type])
          ? {characterId: block.characterId}
          : {}),
      };
      const blockIndex = scene.scriptBlocks.findIndex((item) => item.id === block.id);
      const nextBlocks = [...scene.scriptBlocks];
      nextBlocks.splice(blockIndex, 1, {...block, text: block.text.slice(0, caretStart)}, nextBlock);
      updateBlocks(nextBlocks);
      focusBlock(nextBlock.id, 0);
      return;
    }

    if (
      event.key === 'Backspace'
      && event.currentTarget.selectionStart === 0
      && event.currentTarget.selectionEnd === 0
    ) {
      const blockIndex = scene.scriptBlocks.findIndex((item) => item.id === block.id);
      const previousBlock = scene.scriptBlocks[blockIndex - 1];
      if (!previousBlock) return;
      event.preventDefault();
      const previousLength = previousBlock.text.length;
      const blocks = scene.scriptBlocks
        .filter((item) => item.id !== block.id)
        .map((item) => item.id === previousBlock.id
          ? {...item, text: `${item.text}${block.text}`}
          : item);
      updateBlocks(blocks);
      setSlashMenu(null);
      setCharacterMenu(null);
      focusBlock(previousBlock.id, previousLength);
    }
  };

  if (!scene) {
    return <div className="script-center-empty">
      <span>✦</span>
      <h2>Сценарий пока пуст</h2>
      <p>Добавьте первую сцену, чтобы начать писать.</p>
      {props.canEdit && <button className="script-button script-button--primary" onClick={props.onAddScene}>
        <PlusOutlined /> Добавить сцену
      </button>}
    </div>;
  }

  const dirty = props.dirtySceneIds.includes(scene.id);
  const saving = props.savingSceneIds.includes(scene.id);

  return <div className={`screenplay-layout${inspectorOpen ? ' is-inspector-open' : ''}`}>
    <main className="screenplay-editor">
      <div className="screenplay-editor-toolbar" aria-label="Инструменты редактора">
        {props.canEdit && <>
          <button aria-label="Отменить" title="Отменить (Ctrl+Z)" onClick={undo}><UndoOutlined /></button>
          <button aria-label="Повторить" title="Повторить (Ctrl+Shift+Z)" onClick={redo}><RedoOutlined /></button>
          <span className="screenplay-toolbar-divider" />
          <Select<ScriptBlockType>
            aria-label="Тип абзаца"
            className="screenplay-toolbar-select screenplay-toolbar-select--format"
            disabled={!activeBlock}
            options={BLOCK_TYPE_OPTIONS}
            value={activeBlock?.type ?? 'action'}
            onChange={(value) => activeBlock && selectBlockType(activeBlock.id, value)}
          />
          {activeBlock?.type === 'dialogue' && <Select<string>
            allowClear
            aria-label="Персонаж реплики"
            className="screenplay-toolbar-select screenplay-toolbar-select--character"
            options={props.characters.map((character) => ({
              label: character.name,
              value: character.id,
            }))}
            placeholder="Персонаж…"
            value={activeBlock.characterId || undefined}
            onChange={(value) => changeBlock(activeBlock.id, {
              characterId: value,
            })}
          />}
          <button
            aria-label="Удалить абзац"
            disabled={!activeBlock}
            title="Удалить абзац"
            onClick={() => activeBlock && deleteBlock(activeBlock.id)}
          ><DeleteOutlined /></button>
        </>}
        <span className="screenplay-editor-toolbar__hint">Enter — новый абзац · Tab — формат · / — команды</span>
        <button
          ref={inspectorButtonRef}
          aria-label="Заметки сцены"
          aria-controls="scene-notes"
          aria-expanded={inspectorOpen}
          className={inspectorOpen ? 'is-active' : ''}
          onClick={() => setInspectorOpen((current) => !current)}
        ><FileTextOutlined /> <span>Заметки</span></button>
      </div>

      <div ref={canvasRef} className="screenplay-canvas">
        <div className="screenplay-scene-meta">
          <span>Сцена {props.scenePosition} из {props.sceneCount}</span>
          <small aria-live="polite">{saving ? 'Сохраняем…' : dirty ? 'Есть изменения' : 'Сохранено'}</small>
        </div>
        <div className="screenplay-paper" style={paperStyle}>
          <header>
            <span>СЦЕНА {scene.order}</span>
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
              <div
                key={block.id}
                className={`screenplay-block screenplay-block--${block.type}${activeBlockId === block.id ? ' is-active' : ''}`}
              >
                {props.canEdit && activeBlockId === block.id && <button
                  aria-label={`Удалить абзац «${BLOCK_LABELS[block.type]}»`}
                  className="screenplay-block__delete"
                  title="Удалить абзац"
                  onClick={() => deleteBlock(block.id)}
                ><DeleteOutlined /></button>}
                <textarea
                  ref={(textarea) => {
                    if (textarea) {
                      textareaRefs.current.set(block.id, textarea);
                      resizeTextarea(textarea);
                    } else {
                      textareaRefs.current.delete(block.id);
                    }
                  }}
                  aria-label={BLOCK_LABELS[block.type]}
                  aria-activedescendant={
                    slashMenu?.blockId === block.id
                      ? `format-option-${block.id}-${BLOCK_TYPES[slashMenu.index]}`
                      : characterMenu?.blockId === block.id
                        && filterCharacters(props.characters, block.text).length > 0
                        ? `character-option-${block.id}-${filterCharacters(
                          props.characters,
                          block.text,
                        )[Math.min(
                          characterMenu.index,
                          filterCharacters(props.characters, block.text).length - 1,
                        )].id}`
                        : undefined
                  }
                  aria-autocomplete={block.type === 'character' ? 'list' : undefined}
                  aria-controls={slashMenu?.blockId === block.id
                    ? `format-list-${block.id}`
                    : block.type === 'character'
                      ? `character-list-${block.id}`
                      : undefined}
                  aria-expanded={
                    block.type === 'character' || slashMenu?.blockId === block.id
                      ? slashMenu?.blockId === block.id || characterMenu?.blockId === block.id
                      : undefined
                  }
                  aria-haspopup={
                    block.type === 'character' || slashMenu?.blockId === block.id
                      ? 'listbox'
                      : undefined
                  }
                  disabled={!props.canEdit}
                  placeholder={BLOCK_LABELS[block.type]}
                  rows={1}
                  value={block.text}
                  onChange={(event) => {
                    resizeTextarea(event.currentTarget);
                    const update: Partial<ScriptBlock> = {text: event.target.value};
                    if (block.type === 'character') {
                      const matchingCharacter = props.characters.find((character) => (
                        character.name.toLocaleLowerCase()
                          === event.target.value.trim().toLocaleLowerCase()
                      ));
                      update.characterId = matchingCharacter?.id;
                      setCharacterMenu({blockId: block.id, index: 0});
                    }
                    changeBlock(block.id, update);
                  }}
                  onBlur={(event) => {
                    if (event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) return;
                    setSlashMenu(null);
                    setCharacterMenu(null);
                  }}
                  onFocus={() => {
                    setActiveBlockId(block.id);
                    setCharacterMenu(
                      block.type === 'character' && props.characters.length > 0
                        ? {blockId: block.id, index: 0}
                        : null,
                    );
                  }}
                  onKeyDown={(event) => handleBlockKeyDown(event, block)}
                />
                {characterMenu?.blockId === block.id && <div
                  className="screenplay-character-menu"
                  id={`character-list-${block.id}`}
                  role="listbox"
                  aria-label="Персонажи проекта"
                >
                  <strong>Персонажи проекта</strong>
                  <small>Начните вводить имя для поиска</small>
                  {filterCharacters(props.characters, block.text).map((character, index) => <button
                    key={character.id}
                    ref={(option) => {
                      const key = `${block.id}:${character.id}`;
                      if (option) characterOptionRefs.current.set(key, option);
                      else characterOptionRefs.current.delete(key);
                    }}
                    id={`character-option-${block.id}-${character.id}`}
                    role="option"
                    aria-selected={characterMenu.index === index}
                    className={characterMenu.index === index ? 'is-selected' : ''}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCharacter(block.id, character)}
                  >
                    <span>{character.name}</span>
                    <small>{character.roleLabel || character.role}</small>
                  </button>)}
                  {filterCharacters(props.characters, block.text).length === 0 && <span>Персонаж не найден</span>}
                </div>}
                {slashMenu?.blockId === block.id && <div
                  className="screenplay-command-menu"
                  id={`format-list-${block.id}`}
                  role="listbox"
                  aria-label="Формат абзаца"
                >
                  <strong>Формат абзаца</strong>
                  {BLOCK_TYPES.map((type, index) => <button
                    key={type}
                    id={`format-option-${block.id}-${type}`}
                    role="option"
                    aria-selected={slashMenu.index === index}
                    className={slashMenu.index === index ? 'is-selected' : ''}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectBlockType(block.id, type)}
                  >{BLOCK_LABELS[type]}</button>)}
                </div>}
              </div>
            ))}
            {scene.scriptBlocks.length === 0 && <button
              className="screenplay-paper__empty"
              disabled={!props.canEdit}
              onClick={() => {
                const block = newBlock('scene_heading');
                updateBlocks([block]);
                focusBlock(block.id);
              }}
            >Начните со строки места и времени действия</button>}
          </div>
        </div>
      </div>
      <div className="screenplay-zoom" role="group" aria-label="Масштаб листа">
        <button
          aria-label="Уменьшить масштаб листа"
          disabled={zoomPercent <= MIN_ZOOM}
          title="Уменьшить масштаб"
          onClick={() => stepZoom(-1)}
        ><ZoomOutOutlined /></button>
        <Select<ZoomMode>
          aria-label="Масштаб листа"
          options={zoomOptions}
          value={zoomMode}
          onChange={setZoomMode}
        />
        <button
          aria-label="Увеличить масштаб листа"
          disabled={zoomPercent >= MAX_ZOOM}
          title="Увеличить масштаб"
          onClick={() => stepZoom(1)}
        ><ZoomInOutlined /></button>
        <span className="screen-reader-only" aria-live="polite">
          Масштаб листа {zoomPercent}%
        </span>
      </div>
    </main>

    {inspectorOpen && <div
      aria-label="Заметки сцены"
      className="screenplay-inspector-drawer"
      id="scene-notes"
      role="complementary"
    >
      <SceneInspector
        scene={scene}
        canEdit={props.canEdit}
        dirty={dirty}
        saving={saving}
        showSaveAction={false}
        showStructureFields={false}
        showTitleField={false}
        onChange={props.onChange}
        onClose={() => {
          setInspectorOpen(false);
          inspectorButtonRef.current?.focus();
        }}
        onDelete={props.onDeleteScene}
        onSave={props.onSave}
      />
    </div>}
  </div>;
}
