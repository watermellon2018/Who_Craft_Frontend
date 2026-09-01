import {EyeInvisibleOutlined, EyeOutlined, LockOutlined, UnlockOutlined} from '@ant-design/icons';
import {Button, Input, Tabs} from 'antd';
import React, {useId, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import {CANVAS_OBJECT_LIMIT, CANVAS_PRIMITIVES} from '../canvasModel';
import type {CanvasPrimitive, StoryboardCanvasDocument} from '../canvasModel';
import type {StoryboardSceneEntity} from '../model';
import './blockingInspector.css';

interface BlockingPaletteProps {
  document: StoryboardCanvasDocument;
  entities: StoryboardSceneEntity[];
  selectedObjectId: string | null;
  disabled: boolean;
  onAdd: (kind: CanvasPrimitive, entity?: StoryboardSceneEntity) => void;
  onSelect: (id: string | null) => void;
  onChange: (document: StoryboardCanvasDocument) => void;
}

export const BLOCKING_OBJECT_MIME = 'application/x-craft-storyboard-object';

function PrimitiveIcon({kind}: {kind: CanvasPrimitive}) {
  return <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'person' && <><circle cx="24" cy="9" r="5" /><path d="M24 15v16m-11-9 11-7 11 7M24 31l-8 12m8-12 8 12" /></>}
    {kind === 'animal' && <><path d="m8 25 6-10h17l7 8v12H10zM14 15l-4-7m21 7 5-7M15 35v7m17-7v7M8 25 3 18" /><circle cx="31" cy="23" r="1" /></>}
    {kind === 'prop' && <><path d="m8 15 16-7 16 7v22l-16 7L8 37zM8 15l16 8 16-8M24 23v21" /></>}
    {kind === 'rectangle' && <rect x="6" y="11" width="36" height="27" rx="2" />}
    {kind === 'ellipse' && <ellipse cx="24" cy="24" rx="18" ry="14" />}
    {kind === 'line' && <><path d="M7 37 41 11" /><circle cx="7" cy="37" r="2" /><circle cx="41" cy="11" r="2" /></>}
  </svg>;
}

export default function BlockingPalette({document, entities, selectedObjectId, disabled, onAdd, onSelect, onChange}: BlockingPaletteProps) {
  const {t} = useTranslation();
  const searchId = useId();
  const [search, setSearch] = useState('');
  const text = (key: string, fallback: string) => t(`storyboard.canvas.${key}`, {defaultValue: fallback});
  const primitiveNames: Record<CanvasPrimitive, string> = {
    person: text('primitive.person', 'Человек'), animal: text('primitive.animal', 'Животное'),
    prop: text('primitive.prop', 'Предмет'), rectangle: text('primitive.rectangle', 'Прямоугольник'),
    ellipse: text('primitive.ellipse', 'Эллипс'), line: text('primitive.line', 'Линия'),
  };
  const entityTypeNames = {
    character: text('entityType.character', 'Персонаж'), location: text('entityType.location', 'Локация'),
    object: text('entityType.object', 'Предмет'), clothing: text('entityType.clothing', 'Одежда'), other: text('entityType.other', 'Референс'),
  };
  const addDisabled = disabled || document.objects.length >= CANVAS_OBJECT_LIMIT;
  const query = search.trim().toLocaleLowerCase();
  const matches = (title: string) => title.toLocaleLowerCase().includes(query);
  const filteredPrimitives = CANVAS_PRIMITIVES.filter((kind) => matches(primitiveNames[kind]));
  const filteredEntities = entities.filter((entity) => matches(entity.title) || matches(entityTypeNames[entity.type]));
  const add = (kind: CanvasPrimitive, entity?: StoryboardSceneEntity) => {
    if (!addDisabled) onAdd(kind, entity);
  };
  const drag = (event: React.DragEvent<HTMLButtonElement>, kind: CanvasPrimitive, entity?: StoryboardSceneEntity) => {
    if (addDisabled) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(BLOCKING_OBJECT_MIME, JSON.stringify({kind, ...(entity ? {entityId: entity.id} : {})}));
  };
  const layers = [...document.objects].reverse();

  return (
    <aside aria-label={text('palette', 'Элементы постановки')} className="blocking-palette">
      <div className="blocking-palette__search">
        <label htmlFor={searchId}>{text('search', 'Найти элемент')}</label>
        <Input id={searchId} allowClear value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('searchPlaceholder', 'Название или тип')} />
      </div>
      <Tabs defaultActiveKey="elements" items={[
        {key: 'elements', label: text('elements', 'Элементы'), children: <>
          <div className="blocking-palette__primitives">{filteredPrimitives.map((kind) => <button type="button" className="blocking-palette__primitive" key={kind}
            disabled={addDisabled} draggable={!addDisabled} onDragStart={(event) => drag(event, kind)} onClick={() => add(kind)}>
            <PrimitiveIcon kind={kind} /><span>{primitiveNames[kind]}</span>
          </button>)}</div>
          {!filteredPrimitives.length && <p className="blocking-palette__hint">{text('noMatches', 'Ничего не найдено')}</p>}
          <p className="blocking-palette__hint">{text('addHint', 'Нажмите на элемент или перетащите его в кадр.')}</p>
        </>},
        {key: 'library', label: text('library', 'Библиотека'), children: <div className="blocking-palette__library">
          {filteredEntities.map((entity) => {
            const imageUrl = safeImageUrl(entity.imageUrl);
            const kind = entity.type === 'character' ? 'person' : entity.type === 'location' ? 'rectangle' : 'prop';
            return <button type="button" className="blocking-palette__asset" key={`${entity.type}-${entity.id}`} disabled={addDisabled}
              draggable={!addDisabled} onDragStart={(event) => drag(event, kind, entity)} onClick={() => add(kind, entity)}>
              <span className="blocking-palette__asset-preview">{imageUrl ? <img alt="" src={imageUrl} /> : <PrimitiveIcon kind={kind} />}</span>
              <span className="blocking-palette__asset-text"><strong>{entity.title}</strong><small>{entityTypeNames[entity.type]}</small></span>
            </button>;
          })}
          {!filteredEntities.length && <p className="blocking-palette__hint">{entities.length
            ? text('noMatches', 'Ничего не найдено') : text('emptyLibrary', 'В этой сцене пока нет элементов библиотеки.')}</p>}
        </div>},
      ]} />
      {document.objects.length >= CANVAS_OBJECT_LIMIT && <p role="status" className="blocking-palette__hint">
        {t('storyboard.canvas.objectLimit', {defaultValue: 'В кадре может быть не больше {{count}} объектов.', count: CANVAS_OBJECT_LIMIT})}
      </p>}
      <section className="blocking-palette__layers" aria-label={text('layers', 'Слои')}>
        <div className="blocking-palette__layers-heading"><h3>{text('layers', 'Слои')}</h3>
          <Button onClick={() => onSelect(null)} size="small" type="text">{text('selectFrame', 'Выбрать кадр')}</Button>
        </div>
        {!layers.length && <p className="blocking-palette__hint">{text('emptyLayers', 'Добавьте первый элемент на кадр.')}</p>}
        {layers.map((object, index) => {
          const title = object.title || object.entity?.title || `${primitiveNames[object.kind]} ${layers.length - index}`;
          return <div className={`blocking-palette__layer${selectedObjectId === object.id ? ' blocking-palette__layer--selected' : ''}`} key={object.id}>
            <button type="button" className="blocking-palette__layer-select" aria-pressed={selectedObjectId === object.id} onClick={() => onSelect(object.id)}>
              <PrimitiveIcon kind={object.kind} /><span>{title}</span>
            </button>
            <Button type="text" size="small" disabled={disabled || object.locked} aria-label={`${object.hidden ? text('showLayer', 'Показать') : text('hideLayer', 'Скрыть')}: ${title}`}
              aria-pressed={object.hidden} icon={object.hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => { if (!disabled && !object.locked) onChange({...document, objects: document.objects.map((candidate) => candidate.id === object.id ? {...candidate, hidden: !candidate.hidden} : candidate)}); }} />
            <Button type="text" size="small" disabled={disabled} aria-label={`${object.locked ? text('unlockLayer', 'Разблокировать') : text('lockLayer', 'Заблокировать')}: ${title}`}
              aria-pressed={object.locked} icon={object.locked ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => { if (!disabled) onChange({...document, objects: document.objects.map((candidate) => candidate.id === object.id ? {...candidate, locked: !candidate.locked} : candidate)}); }} />
          </div>;
        })}
      </section>
    </aside>
  );
}
