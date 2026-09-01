import {Button, Checkbox, Input, InputNumber, Select} from 'antd';
import React, {useEffect, useId, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import {CANVAS_MARKER_LIMIT, CANVAS_OBJECT_LIMIT, canvasId, entityLink} from '../canvasModel';
import type {CanvasObject, StoryboardCanvasDocument} from '../canvasModel';
import type {CameraIntent, StoryboardSceneEntity} from '../model';
import './blockingInspector.css';

interface BlockingInspectorProps {
  document: StoryboardCanvasDocument;
  selectedObjectId: string | null;
  intent: CameraIntent;
  entities: StoryboardSceneEntity[];
  duration: number;
  disabled: boolean;
  onChange: (document: StoryboardCanvasDocument) => void;
  onIntentChange: (intent: CameraIntent) => void;
  onDurationChange: (duration: number) => void;
  onDrawPath: () => void;
  onDrawCameraPath: () => void;
  onAddComment: () => void;
  notesOpenRequest?: number;
}

const AZIMUTHS = ['front', 'front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right'] as const;
const FRAMINGS = ['extreme-wide', 'wide', 'full', 'medium', 'medium-close', 'close', 'extreme-close', 'ots', 'pov'] as const;
const CAMERA_MOVEMENTS = ['Static', 'Dolly In', 'Dolly Out', 'Zoom In', 'Zoom Out', 'Pan', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down', 'Orbit Left', 'Orbit Right', 'Truck Left', 'Truck Right', 'Crane Up', 'Crane Down', 'Follow', 'Custom'] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positionPatch(object: CanvasObject, x: number, y: number): Pick<CanvasObject, 'x' | 'y' | 'motion'> {
  const nextX = clamp(x, 0, Math.max(0, 100 - object.width));
  const nextY = clamp(y, 0, Math.max(0, 100 - object.height));
  return {x: nextX, y: nextY, motion: {...object.motion, points: object.motion.points.map((point) => ({
    x: clamp(point.x + nextX - object.x, 0, 100),
    y: clamp(point.y + nextY - object.y, 0, 100),
  }))}};
}

export default function BlockingInspector({document, selectedObjectId, intent, entities, duration,
  disabled, onChange, onIntentChange, onDurationChange, onDrawPath, onDrawCameraPath, onAddComment,
  notesOpenRequest = 0}: BlockingInspectorProps) {
  const {t} = useTranslation();
  const id = useId();
  const object = document.objects.find((candidate) => candidate.id === selectedObjectId);
  const hasSelection = Boolean(object);
  const [mode, setMode] = useState<'frame' | 'object'>(hasSelection ? 'object' : 'frame');
  const [notesOpen, setNotesOpen] = useState(false);
  const markerCount = document.markers.length;
  const previousMarkerCount = useRef(markerCount);
  useEffect(() => setMode(hasSelection ? 'object' : 'frame'), [hasSelection, selectedObjectId]);
  useEffect(() => {
    if (markerCount > previousMarkerCount.current) {
      setMode('frame');
      setNotesOpen(true);
    }
    previousMarkerCount.current = markerCount;
  }, [markerCount]);
  useEffect(() => {
    if (!notesOpenRequest) return;
    setMode('frame');
    setNotesOpen(true);
  }, [notesOpenRequest]);
  const objectDisabled = disabled || Boolean(object?.locked);
  const text = (key: string, fallback: string) => t(`storyboard.canvas.${key}`, {defaultValue: fallback});
  const currentLinkedEntity = object?.entity ? entities.find((entity) => (
    entity.id === object.entity?.id && entity.type === object.entity?.type
  )) : undefined;
  const entityWarning = !object?.entity ? null : !currentLinkedEntity
    ? text('entityLinkUnavailable', 'Элемент библиотеки недоступен. Сохранённая привязка не изменена.')
    : object.entity.versionId !== currentLinkedEntity.versionId || object.entity.assetId !== currentLinkedEntity.assetId
      ? text('entityLinkChanged', 'Версия или ресурс библиотеки изменились. Кадр сохраняет прежнюю привязку.')
      : null;
  const field = (key: string, label: string, control: React.ReactElement) => (
    <label className="blocking-inspector__field" htmlFor={`${id}-${key}`} key={key}>
      <span>{label}</span>
      {React.cloneElement(control, {id: `${id}-${key}`, 'aria-label': label})}
    </label>
  );
  const options = (items: readonly string[], prefix: string, labels: string[]) => items.map((value, index) => ({
    value, label: text(`${prefix}.${value}`, labels[index] ?? value),
  }));
  const patchDocument = (patch: Partial<StoryboardCanvasDocument>) => {
    if (!disabled) onChange({...document, ...patch});
  };
  const patchObject = (patch: Partial<CanvasObject>, unlock = false) => {
    if (!object || disabled || (object.locked && !unlock)) return;
    onChange({...document, objects: document.objects.map((candidate) => candidate.id === object.id
      ? {...candidate, ...patch} : candidate)});
  };
  const patchIntent = (patch: Partial<CameraIntent>) => {
    if (!disabled) onIntentChange({...intent, ...patch});
  };
  const patchMotion = (patch: Partial<StoryboardCanvasDocument['cameraMotion']>) => {
    patchDocument({cameraMotion: {...document.cameraMotion, ...patch}});
  };
  const patchLighting = (patch: Partial<StoryboardCanvasDocument['lighting']>) => {
    patchDocument({lighting: {...document.lighting, ...patch}});
  };
  const patchObjectMotion = (patch: Partial<CanvasObject['motion']>) => {
    if (object) patchObject({motion: {...object.motion, ...patch}});
  };
  const intensityOptions = options(['low', 'medium', 'high'], 'intensity', ['Низкая', 'Средняя', 'Высокая']);
  const tempoOptions = options(['low', 'medium', 'high'], 'tempo', ['Медленный', 'Средний', 'Быстрый']);
  const entityOptions = entities.map((entity) => {
    const image = safeImageUrl(entity.imageUrl);
    return {value: entity.id, searchText: entity.title, label: (
      <span className="blocking-inspector__entity-option">
        {image && <img alt="" src={image} onError={(event) => { event.currentTarget.hidden = true; }} />}
        <span>{entity.title}</span>
      </span>
    )};
  });
  const targetOptions = entities.map((entity) => ({value: entity.id, label: entity.title}));
  if (intent.targetId && !targetOptions.some((option) => option.value === intent.targetId)) {
    targetOptions.push({value: intent.targetId, label: text('unavailableTarget', 'Объект недоступен')});
  }
  const motionTargets = document.objects.map((candidate, index) => ({value: candidate.id,
    label: candidate.title || candidate.entity?.title || text('untitledObject', 'Объект') + ` ${index + 1}`}));
  if (document.cameraMotion.targetId && !motionTargets.some((option) => option.value === document.cameraMotion.targetId)) {
    motionTargets.push({value: document.cameraMotion.targetId, label: text('unavailableTarget', 'Объект недоступен')});
  }
  if (object?.entity && !entityOptions.some((option) => option.value === object.entity?.id)) {
    entityOptions.push({value: object.entity.id, searchText: object.entity.title,
      label: <span>{object.entity.title || text('unavailableEntity', 'Элемент библиотеки недоступен')}</span>});
  }
  const reorder = (front: boolean) => {
    if (!object || objectDisabled) return;
    const remaining = document.objects.filter((candidate) => candidate.id !== object.id);
    patchDocument({objects: front ? [...remaining, object] : [object, ...remaining]});
  };
  const duplicate = () => {
    if (!object || objectDisabled || document.objects.length >= CANVAS_OBJECT_LIMIT) return;
    const duplicateObject: CanvasObject = {...object, ...positionPatch(object, object.x + 3, object.y + 3), id: canvasId(),
      title: `${object.title} ${text('copySuffix', '(копия)')}`.slice(0, 255),
      entity: object.entity ? {...object.entity} : undefined};
    const objects = [...document.objects];
    objects.splice(objects.findIndex((candidate) => candidate.id === object.id) + 1, 0, duplicateObject);
    patchDocument({objects});
  };
  const changeDuration = (value: number | null) => {
    if (disabled || value === null) return;
    const next = clamp(value, 0.1, 600);
    const timing = (motion: {start: number; end: number}) => ({
      start: Math.min(motion.start, next), end: Math.min(motion.end, next),
    });
    onChange({...document, cameraMotion: {...document.cameraMotion, ...timing(document.cameraMotion)},
      objects: document.objects.map((candidate) => ({...candidate,
        motion: {...candidate.motion, ...timing(candidate.motion)}}))});
    onDurationChange(next);
  };
  const section = (key: string, title: string, children: React.ReactNode, open = false) => (
    <details className="blocking-inspector__section" key={key} open={key === 'notes' ? notesOpen : open}
      onToggle={key === 'notes' ? (event) => setNotesOpen(event.currentTarget.open) : undefined}>
      <summary>{title}</summary><div className="blocking-inspector__section-content">{children}</div>
    </details>
  );

  return (
    <aside aria-label={text('inspector', 'Параметры постановки')} className="blocking-inspector">
      <div aria-label={text('inspectorMode', 'Режим параметров')} className="blocking-inspector__modes">
        <Button aria-pressed={mode === 'frame'} onClick={() => setMode('frame')} type={mode === 'frame' ? 'primary' : 'text'}>
          {text('frame', 'Кадр')}
        </Button>
        <Button aria-pressed={mode === 'object'} disabled={!object} onClick={() => setMode('object')} type={mode === 'object' ? 'primary' : 'text'}>
          {text('object', 'Объект')}
        </Button>
      </div>
      {mode === 'frame' ? <>
        {section('timing', text('timing', 'Тайминг'), <>
          {field('duration', text('duration', 'Длительность, с'), <InputNumber disabled={disabled} min={0.1} max={600} step={0.1} value={duration} onChange={changeDuration} />)}
        </>, true)}
        {section('camera', text('cameraForGeneration', 'Параметры камеры для генерации'), <>
          <p className="blocking-inspector__hint">{text('cameraForGenerationHint', 'Расположение и размер объектов задаются на схеме. Эти параметры уточняют ракурс, оптику и смысл крупности для модели.')}</p>
          {field('framing', text('framing', 'Крупность'), <Select disabled={disabled} value={intent.framing}
            options={options(FRAMINGS, 'framingOptions', ['Дальний', 'Общий', 'В полный рост', 'Средний', 'Средний крупный', 'Крупный', 'Деталь', 'Через плечо', 'От первого лица'])}
            onChange={(framing) => patchIntent({framing})} />)}
          {field('azimuth', text('azimuth', 'Ракурс'), <Select disabled={disabled} value={intent.azimuth}
            options={options(AZIMUTHS, 'azimuthOptions', ['Спереди', 'Спереди слева', 'Слева', 'Сзади слева', 'Сзади', 'Сзади справа', 'Справа', 'Спереди справа'])}
            onChange={(azimuth) => patchIntent({azimuth})} />)}
          <div className="blocking-inspector__grid">
            {field('elevation', text('elevation', 'Высота'), <Select disabled={disabled} value={intent.elevation}
              options={options(['low', 'eye-level', 'high', 'top'], 'elevationOptions', ['Снизу', 'Уровень глаз', 'Сверху', 'Вертикально сверху'])}
              onChange={(elevation) => patchIntent({elevation})} />)}
            {field('distance', text('distance', 'Дистанция'), <Select disabled={disabled} value={intent.distance}
              options={options(['wide', 'medium', 'near'], 'distanceOptions', ['Далеко', 'Средне', 'Близко'])}
              onChange={(distance) => patchIntent({distance})} />)}
          </div>
          {field('lens', text('lens', 'Объектив, мм'), <InputNumber disabled={disabled} min={8} max={300} value={intent.lens ?? 50}
            onChange={(lens) => lens !== null && patchIntent({lens})} />)}
          {field('target', text('cameraTarget', 'Объект внимания'), <Select allowClear showSearch optionFilterProp="label"
            disabled={disabled} value={intent.targetId} options={targetOptions}
            placeholder={text('noTarget', 'Не выбран')} onChange={(targetId) => patchIntent({targetId})} />)}
        </>)}
        {section('camera-motion', text('cameraMotion', 'Движение камеры'), <>
          <p className="blocking-inspector__hint">{text('cameraMotionHint', 'Выбранное движение автоматически показывается режиссёрским обозначением на схеме и передаётся модели как инструкция.')}</p>
          {field('camera-motion-type', text('motionType', 'Тип движения'), <Select disabled={disabled} value={document.cameraMotion.type}
            options={options(CAMERA_MOVEMENTS, 'cameraMotionOptions', ['Статично', 'Наезд', 'Отъезд', 'Приближение зумом', 'Отдаление зумом', 'Панорама', 'Панорама влево', 'Панорама вправо', 'Наклон вверх', 'Наклон вниз', 'Обход слева', 'Обход справа', 'Проезд влево', 'Проезд вправо', 'Подъём', 'Спуск', 'Следование', 'Другое'])}
            onChange={(type) => patchMotion({type})} />)}
          {document.cameraMotion.type !== 'Static' && <>
            {field('camera-intensity', text('motionTempo', 'Темп'), <Select disabled={disabled} value={document.cameraMotion.intensity} options={tempoOptions} onChange={(intensity) => patchMotion({intensity})} />)}
            {field('camera-motion-target', text('motionTarget', 'Объект слежения'), <Select allowClear showSearch optionFilterProp="label" disabled={disabled}
              aria-describedby={`${id}-motion-target-hint`} value={document.cameraMotion.targetId} options={motionTargets}
              placeholder={text('noTarget', 'Не выбран')} onChange={(targetId) => patchMotion({targetId})} />)}
            <p className="blocking-inspector__hint" id={`${id}-motion-target-hint`}>{text('motionTargetHint', 'Объект, относительно которого работает камера.')}</p>
            {document.cameraMotion.type === 'Custom' && <>
              <Button disabled={disabled} onClick={() => {if (!disabled) onDrawCameraPath();}}>
                {text('drawCameraPath', 'Нарисовать траекторию камеры')}
              </Button>
              <p className="blocking-inspector__hint">{document.cameraMotion.points.length < 2
                ? text('cameraPathDrawHint', 'Проведите линию от начальной до конечной точки. После этого можно переместить начало, середину и конец.')
                : t('storyboard.canvas.cameraPathPoints', {defaultValue: 'Точек траектории камеры: {{count}}', count: document.cameraMotion.points.length})}</p>
            </>}
            <div className="blocking-inspector__grid">
              {field('camera-start', text('startTime', 'Начало, с'), <InputNumber disabled={disabled} min={0} max={document.cameraMotion.end} step={0.1} value={document.cameraMotion.start}
                onChange={(start) => start !== null && patchMotion({start: clamp(start, 0, document.cameraMotion.end)})} />)}
              {field('camera-end', text('endTime', 'Конец, с'), <InputNumber disabled={disabled} min={document.cameraMotion.start} max={duration} step={0.1} value={document.cameraMotion.end}
                onChange={(end) => end !== null && patchMotion({end: clamp(end, document.cameraMotion.start, duration)})} />)}
            </div>
          </>}
        </>, true)}
        {section('lighting', text('lighting', 'Свет'), <>
          {field('light-preset', text('lightPreset', 'Схема света'), <Select disabled={disabled} value={document.lighting.preset}
            options={options(['daylight', 'studio', 'night', 'custom'], 'lightPresets', ['Дневной', 'Студийный', 'Ночной', 'Своя схема'])} onChange={(preset) => patchLighting({preset})} />)}
          {field('light-direction', text('lightDirection', 'Направление'), <Select disabled={disabled} value={document.lighting.direction}
            options={options(['front', 'left', 'right', 'top-left', 'top-right', 'back', 'top'], 'lightDirections', ['Спереди', 'Слева', 'Справа', 'Сверху слева', 'Сверху справа', 'Контровой', 'Сверху'])} onChange={(direction) => patchLighting({direction})} />)}
          <div className="blocking-inspector__grid">
            {field('light-softness', text('lightSoftness', 'Характер'), <Select disabled={disabled} value={document.lighting.softness}
              options={options(['soft', 'hard'], 'lightSoftnessOptions', ['Мягкий', 'Жёсткий'])} onChange={(softness) => patchLighting({softness})} />)}
            {field('light-temperature', text('lightTemperature', 'Температура'), <Select disabled={disabled} value={document.lighting.temperature}
              options={options(['warm', 'neutral', 'cool'], 'lightTemperatures', ['Тёплая', 'Нейтральная', 'Холодная'])} onChange={(temperature) => patchLighting({temperature})} />)}
          </div>
          {field('light-contrast', text('lightContrast', 'Контраст'), <Select disabled={disabled} value={document.lighting.contrast} options={intensityOptions} onChange={(contrast) => patchLighting({contrast})} />)}
          {field('light-notes', text('lightNotes', 'Уточнения к свету'), <Input.TextArea disabled={disabled} maxLength={2000} autoSize={{minRows: 2, maxRows: 6}} value={document.lighting.notes} onChange={(event) => patchLighting({notes: event.target.value})} />)}
        </>)}
        {section('notes', text('notes', 'Заметки к кадру'), <>
          {field('frame-notes', text('frameNotes', 'Общее описание постановки'), <Input.TextArea disabled={disabled} maxLength={2000} autoSize={{minRows: 3, maxRows: 8}} value={document.notes} onChange={(event) => patchDocument({notes: event.target.value})} />)}
          <Button disabled={disabled || document.markers.length >= CANVAS_MARKER_LIMIT} onClick={() => { if (!disabled && document.markers.length < CANVAS_MARKER_LIMIT) onAddComment(); }}>
            {text('addComment', 'Добавить пометку на кадр')}
          </Button>
          {document.markers.map((marker, index) => <div className="blocking-inspector__marker" key={marker.id}>
            {field(`marker-${marker.id}`, `${text('marker', 'Пометка')} ${index + 1}`, <Input.TextArea disabled={disabled} maxLength={2000} autoSize={{minRows: 2, maxRows: 5}} value={marker.text}
              onChange={(event) => patchDocument({markers: document.markers.map((candidate) => candidate.id === marker.id ? {...candidate, text: event.target.value} : candidate)})} />)}
            <Button danger disabled={disabled} onClick={() => patchDocument({markers: document.markers.filter((candidate) => candidate.id !== marker.id)})}>
              {text('deleteMarker', 'Удалить пометку')}
            </Button>
          </div>)}
        </>)}
      </> : object && <>
        <div className="blocking-inspector__object-heading"><h3>{object.title || text('untitledObject', 'Объект')}</h3>
          <Checkbox checked={object.locked} disabled={disabled} onChange={(event) => patchObject({locked: event.target.checked}, true)}>{text('locked', 'Заблокирован')}</Checkbox>
        </div>
        {object.locked && <p className="blocking-inspector__hint">{text('lockedHint', 'Снимите блокировку, чтобы изменить объект.')}</p>}
        {section('object-content', text('objectContent', 'Содержание'), <>
          {field('entity-link', text('libraryLink', 'Связь с библиотекой'), <Select allowClear showSearch virtual={false} disabled={objectDisabled} value={object.entity?.id}
            aria-describedby={entityWarning ? `${id}-entity-warning` : undefined}
            optionFilterProp="searchText" options={entityOptions} placeholder={text('unbound', 'Не привязан')}
            onChange={(entityId) => { const entity = entities.find((candidate) => candidate.id === entityId); patchObject({entity: entity ? entityLink(entity) : undefined}); }} />)}
          <p className="blocking-inspector__warning" hidden={!entityWarning} id={`${id}-entity-warning`} role="status">{entityWarning}</p>
          {field('object-title', text('objectTitle', 'Название объекта'), <Input disabled={objectDisabled} maxLength={255} value={object.title} onChange={(event) => patchObject({title: event.target.value})} />)}
          {field('object-description', text('objectDescription', 'Описание объекта'), <Input.TextArea disabled={objectDisabled} maxLength={2000} autoSize={{minRows: 2, maxRows: 6}} value={object.description} onChange={(event) => patchObject({description: event.target.value})} />)}
          <Checkbox checked={object.hidden} disabled={objectDisabled} onChange={(event) => patchObject({hidden: event.target.checked})}>{text('hidden', 'Скрыть объект')}</Checkbox>
          {(object.kind === 'person' || object.kind === 'animal') && field('object-pose', text('pose', 'Поза'), <Select disabled={objectDisabled} value={object.pose}
            options={options(['front', 'profile', 'back', 'sitting'], 'poses', ['Анфас', 'Профиль', 'Спиной', 'Сидя'])} onChange={(pose) => patchObject({pose})} />)}
        </>, true)}
        {section('geometry', text('geometry', 'Точные значения'), <>
          <p className="blocking-inspector__hint">{text('geometryHint', 'Обычно объект удобнее перемещать, масштабировать и поворачивать мышью. Здесь можно ввести точные значения или управлять слоями.')}</p>
          <div className="blocking-inspector__grid">
            {field('object-x', 'X, %', <InputNumber disabled={objectDisabled} min={0} max={Math.round(100 - object.width)} precision={0} step={1}
              value={Math.round(object.x)} onChange={(x) => x !== null && patchObject(positionPatch(object, Math.round(x), object.y))} />)}
            {field('object-y', 'Y, %', <InputNumber disabled={objectDisabled} min={0} max={Math.round(100 - object.height)} precision={0} step={1}
              value={Math.round(object.y)} onChange={(y) => y !== null && patchObject(positionPatch(object, object.x, Math.round(y)))} />)}
            {field('object-width', text('width', 'Ширина, %'), <InputNumber disabled={objectDisabled} min={1} max={Math.max(1, Math.round(100 - object.x))} precision={0} step={1}
              value={Math.round(object.width)} onChange={(width) => width !== null && patchObject({width: clamp(Math.round(width), 1, 100 - object.x)})} />)}
            {field('object-height', text('height', 'Высота, %'), <InputNumber disabled={objectDisabled} min={1} max={Math.max(1, Math.round(100 - object.y))} precision={0} step={1}
              value={Math.round(object.height)} onChange={(height) => height !== null && patchObject({height: clamp(Math.round(height), 1, 100 - object.y)})} />)}
          </div>
          {field('object-rotation', text('rotation', 'Поворот, °'), <InputNumber disabled={objectDisabled} min={-360} max={360} precision={0} step={1}
            value={Math.round(object.rotation)} onChange={(rotation) => rotation !== null && patchObject({rotation: clamp(Math.round(rotation), -360, 360)})} />)}
          <Checkbox checked={object.flipX} disabled={objectDisabled} onChange={(event) => patchObject({flipX: event.target.checked})}>{text('flip', 'Отразить по горизонтали')}</Checkbox>
          <div className="blocking-inspector__actions">
            <Button disabled={objectDisabled || document.objects.at(-1)?.id === object.id} onClick={() => reorder(true)}>{text('bringFront', 'На передний план')}</Button>
            <Button disabled={objectDisabled || document.objects[0]?.id === object.id} onClick={() => reorder(false)}>{text('sendBack', 'На задний план')}</Button>
          </div>
        </>)}
        {section('object-motion', text('objectMotion', 'Движение объекта'), <>
          <p className="blocking-inspector__hint">{text('objectMotionHint', 'Траектория описывает изменение во времени, которого не видно по размеру объекта в одном статичном кадре.')}</p>
          {field('object-motion-type', text('motionType', 'Тип движения'), <Select disabled={objectDisabled} value={object.motion.type}
            options={options(['static', 'path'], 'objectMotionOptions', ['Статично', 'По траектории'])} onChange={(type) => patchObjectMotion({type})} />)}
          {object.motion.type === 'path' && <>
            <Button disabled={objectDisabled} onClick={() => { if (!objectDisabled) onDrawPath(); }}>{text('drawPath', 'Нарисовать траекторию')}</Button>
            <p className="blocking-inspector__hint blocking-inspector__hint--path">{object.motion.points.length < 2
              ? text('pathHint', 'Нажмите на конечную точку в кадре. Начало привязано к объекту; промежуточную точку можно переместить.')
              : t('storyboard.canvas.pathPoints', {defaultValue: 'Точек траектории: {{count}}', count: object.motion.points.length})}</p>
            <div className="blocking-inspector__grid">
              {field('object-start', text('startTime', 'Начало, с'), <InputNumber disabled={objectDisabled} min={0} max={object.motion.end} step={0.1} value={object.motion.start}
                onChange={(start) => start !== null && patchObjectMotion({start: clamp(start, 0, object.motion.end)})} />)}
              {field('object-end', text('endTime', 'Конец, с'), <InputNumber disabled={objectDisabled} min={object.motion.start} max={duration} step={0.1} value={object.motion.end}
                onChange={(end) => end !== null && patchObjectMotion({end: clamp(end, object.motion.start, duration)})} />)}
            </div>
            {field('object-facing', text('facing', 'Куда смотрит объект'), <Input disabled={objectDisabled} maxLength={2000} value={object.motion.facing}
              placeholder={text('facingPlaceholder', 'Например, на собеседника')} onChange={(event) => patchObjectMotion({facing: event.target.value})} />)}
          </>}
        </>)}
        <div className="blocking-inspector__footer">
          <Button disabled={objectDisabled || document.objects.length >= CANVAS_OBJECT_LIMIT} onClick={duplicate}>{text('duplicate', 'Дублировать')}</Button>
          <Button danger disabled={objectDisabled} onClick={() => { if (!objectDisabled) patchDocument({
            objects: document.objects.filter((candidate) => candidate.id !== object.id),
            cameraMotion: document.cameraMotion.targetId === object.id ? {...document.cameraMotion, targetId: undefined} : document.cameraMotion,
          }); }}>{text('deleteObject', 'Удалить объект')}</Button>
        </div>
      </>}
    </aside>
  );
}
