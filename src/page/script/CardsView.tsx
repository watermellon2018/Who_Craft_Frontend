import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  HolderOutlined,
  LoadingOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import SceneInspector from './SceneInspector';
import {
  formatEstimatedDuration,
  getSceneHeading,
  getSceneLocation,
  isSceneEmpty,
  moveScene,
  SCRIPT_ACTS,
  toScenePlacements,
} from './sceneStructure';
import type {ScenePlacement} from './sceneStructure';
import type {Scene} from './types';

interface CardsViewProps {
  scenes: Scene[];
  selectedScene: Scene | null;
  characterFilter: string | null;
  canEdit: boolean;
  dirtySceneIds: number[];
  savingSceneIds: number[];
  reordering: boolean;
  onSelect: (sceneId: number) => void;
  onChange: (sceneId: number, update: Partial<Scene>) => void;
  onSave: () => void;
  onAdd: () => void;
  onDelete: (sceneId: number) => void;
  onOpenScreenplay: (sceneId: number) => void;
  onReorder: (placements: ScenePlacement[]) => Promise<boolean>;
  onClearFilter: () => void;
}

interface DropTarget {
  act: number;
  sceneId: number | null;
  position: 'before' | 'after' | 'end';
}

const ACT_META = [
  {act: 1, titleKey: 'script.cards.actSetup', className: 'act-teal'},
  {act: 2, titleKey: 'script.cards.actConflict', className: 'act-violet'},
  {act: 3, titleKey: 'script.cards.actFinal', className: 'act-coral'},
];

const sceneTitle = (scene: Scene | undefined, fallback: string) => scene?.title.trim() || fallback;

export default function CardsView(props: CardsViewProps) {
  const {t} = useTranslation();
  const [draggedSceneId, setDraggedSceneId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const boardRef = useRef<HTMLElement | null>(null);
  const previousReorderingRef = useRef(props.reordering);
  const pendingFocusRef = useRef<{sceneId: number; action: string} | null>(null);
  const showReorderControls = props.canEdit && !props.characterFilter;
  const canReorder = props.canEdit && !props.reordering && !props.characterFilter;
  const filteredScenes = [...(props.characterFilter
    ? props.scenes.filter((scene) => (
      scene.characters.some((item) => item.id === props.characterFilter)
    ))
    : props.scenes
  )].sort((left, right) => left.order - right.order);

  const commitMove = (sceneId: number, targetAct: number, targetIndex: number) => {
    const nextScenes = moveScene(props.scenes, sceneId, targetAct, targetIndex);
    const previous = toScenePlacements(props.scenes);
    const next = toScenePlacements(nextScenes);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const title = sceneTitle(
      props.scenes.find((scene) => scene.id === sceneId),
      t('script.common.untitled'),
    );
    setAnnouncement(t('script.cards.reorderSaving', {title}));
    void props.onReorder(next).then((reordered) => {
      setAnnouncement(reordered
        ? t('script.cards.reorderSuccess', {act: targetAct, title})
        : t('script.cards.reorderError', {title}));
    }, () => {
      setAnnouncement(t('script.cards.reorderError', {title}));
    });
  };

  const moveWithinAct = (scene: Scene, direction: -1 | 1) => {
    const actScenes = props.scenes
      .filter((item) => item.act === scene.act)
      .sort((left, right) => left.order - right.order);
    const currentIndex = actScenes.findIndex((item) => item.id === scene.id);
    commitMove(scene.id, scene.act, currentIndex + direction);
  };

  const moveToAdjacentAct = (scene: Scene, direction: -1 | 1) => {
    const nextAct = scene.act + direction;
    const destinationLength = props.scenes.filter((item) => item.act === nextAct).length;
    commitMove(scene.id, nextAct, destinationLength);
  };

  const moveToAct = (sceneId: number, targetAct: number) => {
    const scene = props.scenes.find((item) => item.id === sceneId);
    if (!scene || scene.act === targetAct) return;
    const destinationLength = props.scenes.filter((item) => item.act === targetAct).length;
    commitMove(sceneId, targetAct, destinationLength);
  };

  const rememberKeyboardAction = (sceneId: number, action: string) => {
    pendingFocusRef.current = {sceneId, action};
  };

  useEffect(() => {
    if (previousReorderingRef.current && !props.reordering) {
      const pendingFocus = pendingFocusRef.current;
      if (pendingFocus) {
        const actionButton = boardRef.current?.querySelector<HTMLButtonElement>(
          `[data-reorder-scene="${pendingFocus.sceneId}"][data-reorder-action="${pendingFocus.action}"]`,
        );
        if (actionButton && !actionButton.disabled) actionButton.focus();
        else boardRef.current?.querySelector<HTMLButtonElement>(
          `[data-scene-content="${pendingFocus.sceneId}"]`,
        )?.focus();
        pendingFocusRef.current = null;
      }
    }
    previousReorderingRef.current = props.reordering;
  }, [props.reordering]);

  const dropOnCard = (scene: Scene, position: 'before' | 'after') => {
    if (!canReorder || draggedSceneId === null || draggedSceneId === scene.id) return;
    const destination = props.scenes
      .filter((item) => item.act === scene.act && item.id !== draggedSceneId)
      .sort((left, right) => left.order - right.order);
    const targetIndex = destination.findIndex((item) => item.id === scene.id);
    commitMove(
      draggedSceneId,
      scene.act,
      targetIndex < 0 ? destination.length : targetIndex + (position === 'after' ? 1 : 0),
    );
    setDraggedSceneId(null);
    setDropTarget(null);
  };

  const dropAtActEnd = (act: number) => {
    if (!canReorder || draggedSceneId === null) return;
    const destinationLength = props.scenes.filter((scene) => (
      scene.act === act && scene.id !== draggedSceneId
    )).length;
    commitMove(draggedSceneId, act, destinationLength);
    setDraggedSceneId(null);
    setDropTarget(null);
  };

  return <div className="cards-layout">
    <main ref={boardRef} className="cards-board" aria-label={t('script.cards.boardLabel')}>
      <p className="script-sr-only" id="scene-reorder-instructions">
        {t('script.cards.reorderInstructions')}
      </p>
      <div className="script-sr-only" aria-live="polite">{announcement}</div>
      {props.characterFilter && <div className="script-filter-note">
        <span>{t('script.cards.characterFilterNote')}</span>
        <button onClick={props.onClearFilter}>{t('script.cards.showAll')}</button>
      </div>}
      <div className="cards-columns">
        {ACT_META.map(({act, titleKey, className}) => {
          const actScenes = filteredScenes.filter((scene) => scene.act === act);
          return <section key={act} className={`cards-column ${className}`}>
            <header>
              <h2>{t(titleKey)}</h2>
              <span>{t('script.common.sceneCount', {count: actScenes.length})}</span>
            </header>
            <div className="cards-column__body">
              {actScenes.map((scene) => {
                const empty = isSceneEmpty(scene);
                const dirty = props.dirtySceneIds.includes(scene.id);
                const saving = props.savingSceneIds.includes(scene.id);
                const allActScenes = props.scenes
                  .filter((item) => item.act === scene.act)
                  .sort((left, right) => left.order - right.order);
                const actIndex = allActScenes.findIndex((item) => item.id === scene.id);
                const dropClass = dropTarget?.sceneId === scene.id
                  ? `is-drop-${dropTarget.position}`
                  : '';
                const people = scene.characters.slice(0, 3).map((character) => character.name);
                const hiddenPeople = Math.max(0, scene.characters.length - people.length);
                const titleId = `scene-card-title-${scene.id}`;
                const headingId = `scene-card-heading-${scene.id}`;
                const detailsId = `scene-card-details-${scene.id}`;
                const statusesId = `scene-card-statuses-${scene.id}`;
                return <article
                  key={scene.id}
                  data-testid={`scene-card-${scene.id}`}
                  className={[
                    'scene-card',
                    props.selectedScene?.id === scene.id ? 'is-selected' : '',
                    dirty ? 'is-dirty' : '',
                    empty ? 'is-empty' : '',
                    draggedSceneId === scene.id ? 'is-dragging' : '',
                    dropClass,
                  ].filter(Boolean).join(' ')}
                  draggable={canReorder}
                  onDragStart={(event) => {
                    if (!canReorder) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(scene.id));
                    setDraggedSceneId(scene.id);
                  }}
                  onDragEnd={() => {
                    setDraggedSceneId(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(event) => {
                    if (!canReorder || draggedSceneId === null || draggedSceneId === scene.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                    setDropTarget({act: scene.act, sceneId: scene.id, position});
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    dropOnCard(
                      scene,
                      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
                    );
                  }}
                >
                  <div className="scene-card__meta">
                    <strong>{t('script.common.sceneNumber', {number: scene.order})}</strong>
                    <span id={statusesId} className="scene-card__statuses">
                      {saving && <span className="scene-card__status is-saving"><LoadingOutlined /> {t('script.status.saving')}</span>}
                      {!saving && dirty && <span className="scene-card__status is-dirty"><i /> {t('script.status.unsaved')}</span>}
                      {empty && <span className="scene-card__status is-empty"><ExclamationCircleOutlined /> {t('script.status.empty')}</span>}
                    </span>
                    {showReorderControls && <HolderOutlined className="scene-card__drag-handle" aria-hidden="true" />}
                  </div>
                  <button
                    type="button"
                    className="scene-card__content"
                    data-scene-content={scene.id}
                    aria-labelledby={titleId}
                    aria-describedby={`${headingId} ${detailsId} ${statusesId} scene-reorder-instructions`}
                    onClick={() => props.onSelect(scene.id)}
                    onDoubleClick={() => props.onOpenScreenplay(scene.id)}
                  >
                    <span id={titleId} className="scene-card__title">{sceneTitle(scene, t('script.common.untitled'))}</span>
                    <span id={headingId} className="scene-card__heading">{getSceneHeading(scene, t('script.cards.headingMissing'))}</span>
                    <span id={detailsId} className="scene-card__details">
                      <span><EnvironmentOutlined aria-hidden="true" /><span className="scene-card__detail-value"><span className="script-sr-only">{t('script.cards.locationLabel')} </span>{getSceneLocation(scene, t('script.cards.locationMissing'))}</span></span>
                      <span><TeamOutlined aria-hidden="true" /><span className="scene-card__detail-value"><span className="script-sr-only">{t('script.cards.charactersLabel')} </span>
                        {people.join(' · ') || t('script.cards.charactersMissing')}{hiddenPeople > 0 ? ` · +${hiddenPeople}` : ''}
                      </span></span>
                      <span><ClockCircleOutlined aria-hidden="true" /><span className="scene-card__detail-value"><span className="script-sr-only">{t('script.cards.durationLabel')} </span>{formatEstimatedDuration(scene, {
                        lessThanMinute: t('script.duration.lessThanMinute'),
                        minute: t('script.duration.minuteShort'),
                        second: t('script.duration.secondShort'),
                      })}</span></span>
                    </span>
                  </button>
                  {showReorderControls && <div className="scene-card__actions" role="group" aria-label={t('script.cards.moveGroup', {number: scene.order})}>
                    <button
                      type="button"
                      data-reorder-scene={scene.id}
                      data-reorder-action="previous-act"
                      aria-label={t('script.cards.movePreviousAct', {number: scene.order})}
                      disabled={props.reordering || scene.act <= SCRIPT_ACTS[0]}
                      onClick={() => {
                        rememberKeyboardAction(scene.id, 'previous-act');
                        moveToAdjacentAct(scene, -1);
                      }}
                    ><ArrowLeftOutlined /></button>
                    <button
                      type="button"
                      data-reorder-scene={scene.id}
                      data-reorder-action="up"
                      aria-label={t('script.cards.moveUp', {number: scene.order})}
                      disabled={props.reordering || actIndex <= 0}
                      onClick={() => {
                        rememberKeyboardAction(scene.id, 'up');
                        moveWithinAct(scene, -1);
                      }}
                    ><ArrowUpOutlined /></button>
                    <button
                      type="button"
                      data-reorder-scene={scene.id}
                      data-reorder-action="down"
                      aria-label={t('script.cards.moveDown', {number: scene.order})}
                      disabled={props.reordering || actIndex === allActScenes.length - 1}
                      onClick={() => {
                        rememberKeyboardAction(scene.id, 'down');
                        moveWithinAct(scene, 1);
                      }}
                    ><ArrowDownOutlined /></button>
                    <button
                      type="button"
                      data-reorder-scene={scene.id}
                      data-reorder-action="next-act"
                      aria-label={t('script.cards.moveNextAct', {number: scene.order})}
                      disabled={props.reordering || scene.act >= SCRIPT_ACTS[SCRIPT_ACTS.length - 1]}
                      onClick={() => {
                        rememberKeyboardAction(scene.id, 'next-act');
                        moveToAdjacentAct(scene, 1);
                      }}
                    ><ArrowRightOutlined /></button>
                    <button
                      type="button"
                      className="scene-card__open"
                      aria-label={t('script.cards.openScene', {number: scene.order})}
                      onClick={() => props.onOpenScreenplay(scene.id)}
                    ><EditOutlined /></button>
                  </div>}
                </article>;
              })}
              {actScenes.length === 0 && <div className="cards-empty">{t('script.cards.emptyAct')}</div>}
              <div
                data-testid={`act-drop-${act}`}
                className={`cards-drop-zone ${dropTarget?.act === act && dropTarget.position === 'end' ? 'is-active' : ''}`}
                onDragOver={(event) => {
                  if (!canReorder || draggedSceneId === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTarget({act, sceneId: null, position: 'end'});
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropAtActEnd(act);
                }}
              >{draggedSceneId !== null ? t('script.cards.moveToActEnd') : ''}</div>
              {props.canEdit && <button className="cards-add" disabled={props.reordering} onClick={props.onAdd}>
                <PlusOutlined /> {t('script.actions.addScene')}
              </button>}
            </div>
          </section>;
        })}
      </div>
    </main>
    <SceneInspector
      scene={props.selectedScene}
      canEdit={props.canEdit && !props.reordering}
      dirty={Boolean(props.selectedScene && props.dirtySceneIds.includes(props.selectedScene.id))}
      saving={Boolean(props.selectedScene && props.savingSceneIds.includes(props.selectedScene.id))}
      onChange={props.onChange}
      onActChange={moveToAct}
      onDelete={props.onDelete}
      onOpenScreenplay={() => {
        if (props.selectedScene) props.onOpenScreenplay(props.selectedScene.id);
      }}
      onSave={props.onSave}
    />
  </div>;
}
