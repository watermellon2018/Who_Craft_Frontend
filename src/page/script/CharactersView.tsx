import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {InputNumber, Select} from 'antd';

import {backendAssetUrl} from '../../api/http';
import {
  analyzeCharacterRelationships,
} from './characterAnalytics';
import type {
  CharacterMetric,
  CharacterRelationshipMetric,
} from './characterAnalytics';
import type {CompactCharacter, Scene} from './types';

interface CharactersViewProps {
  characters: CompactCharacter[];
  scenes: Scene[];
}

interface GraphPosition {
  x: number;
  y: number;
}

interface GraphView {
  center: GraphPosition;
  zoom: number;
}

interface GraphPanState {
  moved: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startView: GraphView;
}

type AnalysisSelection =
  | {id: string; type: 'character'}
  | {id: string; type: 'relationship'};

const DEFAULT_VISIBLE_CHARACTER_COUNT = 10;
const DEFAULT_GRAPH_ZOOM = 100;
const GRAPH_MIN_HEIGHT = 640;
const GRAPH_ROW_HEIGHT = 210;
const GRAPH_TOP_PADDING = 125;
const GRAPH_WIDTH = 1200;
const MAX_GRAPH_ZOOM = 200;
const MIN_GRAPH_ZOOM = 50;
const GRAPH_ZOOM_STEP = 10;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

const graphViewportSize = (zoom: number, graphHeight: number) => ({
  height: graphHeight * DEFAULT_GRAPH_ZOOM / zoom,
  width: GRAPH_WIDTH * DEFAULT_GRAPH_ZOOM / zoom,
});

const clampGraphCenter = (
  center: GraphPosition,
  zoom: number,
  graphHeight: number,
): GraphPosition => {
  const viewport = graphViewportSize(zoom, graphHeight);
  const clampAxis = (value: number, total: number, visible: number) => (
    visible >= total ? total / 2 : clamp(value, visible / 2, total - visible / 2)
  );
  return {
    x: clampAxis(center.x, GRAPH_WIDTH, viewport.width),
    y: clampAxis(center.y, graphHeight, viewport.height),
  };
};

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const pluralize = (value: number, one: string, few: string, many: string) => {
  const absoluteValue = Math.abs(value) % 100;
  const lastDigit = absoluteValue % 10;
  if (absoluteValue > 10 && absoluteValue < 20) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
};

const formatMetric = (value: number, one: string, few: string, many: string) => (
  `${value} ${pluralize(value, one, few, many)}`
);

const buildGraphLayout = (count: number) => {
  if (count === 0) return {height: GRAPH_MIN_HEIGHT, positions: [] as GraphPosition[]};
  if (count === 1) {
    return {
      height: GRAPH_MIN_HEIGHT,
      positions: [{x: GRAPH_WIDTH / 2, y: GRAPH_MIN_HEIGHT / 2 - 10}],
    };
  }

  const columns = Math.min(5, Math.ceil(Math.sqrt(count * 1.55)));
  const rows = Math.ceil(count / columns);
  const height = Math.max(GRAPH_MIN_HEIGHT, rows * GRAPH_ROW_HEIGHT + GRAPH_TOP_PADDING + 80);
  const cellWidth = GRAPH_WIDTH / columns;
  const positions = Array.from({length: count}, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, count - row * columns);
    const rowWidth = itemsInRow * cellWidth;
    const rowOffset = (GRAPH_WIDTH - rowWidth) / 2;
    const horizontalDrift = Math.sin((index + 1) * 2.17) * Math.min(20, cellWidth * 0.07);
    const verticalDrift = Math.cos((index + 1) * 1.73) * 16;
    return {
      x: rowOffset + cellWidth * (column + 0.5) + horizontalDrift,
      y: GRAPH_TOP_PADDING + row * GRAPH_ROW_HEIGHT + verticalDrift,
    };
  });

  return {height, positions};
};

const activateWithKeyboard = (
  event: React.KeyboardEvent<SVGGElement>,
  activate: () => void,
) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  activate();
};

const relationshipCharacterIds = (relationship: CharacterRelationshipMetric) => [
  relationship.sourceId,
  relationship.targetId,
];

export default function CharactersView({characters, scenes}: CharactersViewProps) {
  const [scope, setScope] = useState('all');
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(DEFAULT_VISIBLE_CHARACTER_COUNT);
  const [showAll, setShowAll] = useState(false);
  const [selection, setSelection] = useState<AnalysisSelection | null>(null);
  const [graphView, setGraphView] = useState<GraphView>({
    center: {x: GRAPH_WIDTH / 2, y: GRAPH_MIN_HEIGHT / 2},
    zoom: DEFAULT_GRAPH_ZOOM,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const graphRef = useRef<SVGSVGElement>(null);
  const graphViewportRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<GraphPanState | null>(null);
  const suppressClickRef = useRef(false);

  const filteredScenes = useMemo(() => {
    if (scope === 'all') return scenes;
    if (scope.startsWith('act:')) {
      const act = Number(scope.slice(4));
      return scenes.filter((scene) => scene.act === act);
    }
    if (scope.startsWith('scene:')) {
      const sceneId = Number(scope.slice(6));
      return scenes.filter((scene) => scene.id === sceneId);
    }
    return scenes;
  }, [scenes, scope]);

  const analysis = useMemo(
    () => analyzeCharacterRelationships(characters, filteredScenes),
    [characters, filteredScenes],
  );
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );
  const sceneById = useMemo(
    () => new Map(scenes.map((scene) => [scene.id, scene])),
    [scenes],
  );
  const visibleCharacters = useMemo(() => (
    showAll
      ? analysis.characters
      : analysis.characters.slice(0, Math.max(1, visibleCharacterCount))
  ), [analysis.characters, showAll, visibleCharacterCount]);
  const visibleCharacterIds = useMemo(
    () => new Set(visibleCharacters.map((metric) => metric.character.id)),
    [visibleCharacters],
  );
  const visibleRelationships = useMemo(
    () => analysis.relationships.filter((relationship) => (
      visibleCharacterIds.has(relationship.sourceId)
      && visibleCharacterIds.has(relationship.targetId)
    )),
    [analysis.relationships, visibleCharacterIds],
  );
  const layout = useMemo(() => buildGraphLayout(visibleCharacters.length), [visibleCharacters.length]);
  const positions = useMemo(() => new Map(visibleCharacters.map((metric, index) => [
    metric.character.id,
    layout.positions[index],
  ])), [layout.positions, visibleCharacters]);
  const maxDialogueCount = Math.max(1, ...visibleCharacters.map((metric) => metric.dialogueCount));
  const maxExchangeCount = Math.max(1, ...visibleRelationships.map((metric) => metric.exchangeCount));

  const selectedCharacter = selection?.type === 'character'
    ? analysis.characters.find((metric) => metric.character.id === selection.id) ?? null
    : null;
  const selectedRelationship = selection?.type === 'relationship'
    ? analysis.relationships.find((relationship) => relationship.id === selection.id) ?? null
    : null;
  const strongestRelationship = analysis.relationships[0] ?? null;

  const scopeOptions = useMemo(() => {
    const acts = Array.from(new Set(scenes.map((scene) => scene.act))).sort((first, second) => first - second);
    return [
      {label: 'Весь сценарий', value: 'all'},
      ...acts.map((act) => ({label: `Акт ${act}`, value: `act:${act}`})),
      ...scenes.map((scene) => ({
        label: `Сцена ${scene.order} · ${scene.title || 'Без названия'}`,
        value: `scene:${scene.id}`,
      })),
    ];
  }, [scenes]);

  useEffect(() => {
    if (!selection) return;
    const selectionVisible = selection.type === 'character'
      ? visibleCharacterIds.has(selection.id)
      : visibleRelationships.some((relationship) => relationship.id === selection.id);
    if (!selectionVisible) setSelection(null);
  }, [selection, visibleCharacterIds, visibleRelationships]);

  useEffect(() => {
    setGraphView((current) => ({
      ...current,
      center: clampGraphCenter(current.center, current.zoom, layout.height),
    }));
  }, [layout.height]);

  const relationshipName = (relationship: CharacterRelationshipMetric) => {
    const source = characterById.get(relationship.sourceId)?.name ?? 'Персонаж';
    const target = characterById.get(relationship.targetId)?.name ?? 'Персонаж';
    return `${source} — ${target}`;
  };

  const nodeRadius = (metric: CharacterMetric) => (
    42 + Math.round(Math.sqrt(metric.dialogueCount / maxDialogueCount) * 15)
  );

  const zoomGraph = useCallback((direction: -1 | 1, anchor?: GraphPosition) => {
    setGraphView((current) => {
      const nextZoom = clamp(
        current.zoom + direction * GRAPH_ZOOM_STEP,
        MIN_GRAPH_ZOOM,
        MAX_GRAPH_ZOOM,
      );
      if (nextZoom === current.zoom) return current;

      let nextCenter = current.center;
      const graphBounds = graphRef.current?.getBoundingClientRect();
      if (anchor && graphBounds && graphBounds.width > 0 && graphBounds.height > 0) {
        const normalizedX = clamp((anchor.x - graphBounds.left) / graphBounds.width, 0, 1);
        const normalizedY = clamp((anchor.y - graphBounds.top) / graphBounds.height, 0, 1);
        const currentViewport = graphViewportSize(current.zoom, layout.height);
        const nextViewport = graphViewportSize(nextZoom, layout.height);
        const worldX = current.center.x + (normalizedX - 0.5) * currentViewport.width;
        const worldY = current.center.y + (normalizedY - 0.5) * currentViewport.height;
        nextCenter = {
          x: worldX - (normalizedX - 0.5) * nextViewport.width,
          y: worldY - (normalizedY - 0.5) * nextViewport.height,
        };
      }

      return {
        center: clampGraphCenter(nextCenter, nextZoom, layout.height),
        zoom: nextZoom,
      };
    });
  }, [layout.height]);

  useEffect(() => {
    const viewport = graphViewportRef.current;
    if (!viewport) return undefined;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY === 0) return;
      zoomGraph(event.deltaY < 0 ? 1 : -1, {x: event.clientX, y: event.clientY});
    };
    viewport.addEventListener('wheel', handleWheel, {passive: false});
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [zoomGraph]);

  const panGraph = (horizontal: number, vertical: number) => {
    setGraphView((current) => {
      const viewport = graphViewportSize(current.zoom, layout.height);
      return {
        ...current,
        center: clampGraphCenter({
          x: current.center.x + horizontal * viewport.width * 0.12,
          y: current.center.y + vertical * viewport.height * 0.12,
        }, current.zoom, layout.height),
      };
    });
  };

  const handleGraphKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') zoomGraph(1);
    else if (event.key === '-' || event.key === '_') zoomGraph(-1);
    else if (event.key === 'ArrowLeft') panGraph(-1, 0);
    else if (event.key === 'ArrowRight') panGraph(1, 0);
    else if (event.key === 'ArrowUp') panGraph(0, -1);
    else if (event.key === 'ArrowDown') panGraph(0, 1);
    else if (event.key === '0') {
      setGraphView({
        center: {x: GRAPH_WIDTH / 2, y: layout.height / 2},
        zoom: DEFAULT_GRAPH_ZOOM,
      });
    } else return;
    event.preventDefault();
  };

  const beginGraphPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (graphView.zoom <= DEFAULT_GRAPH_ZOOM || event.button !== 0 || event.isPrimary === false) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panStateRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startView: graphView,
    };
  };

  const moveGraph = (event: React.PointerEvent<SVGSVGElement>) => {
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - panState.startClientX;
    const deltaY = event.clientY - panState.startClientY;
    if (!panState.moved && Math.hypot(deltaX, deltaY) < 3) return;

    const graphBounds = event.currentTarget.getBoundingClientRect();
    if (graphBounds.width <= 0 || graphBounds.height <= 0) return;
    panState.moved = true;
    suppressClickRef.current = true;
    setIsPanning(true);
    const viewport = graphViewportSize(panState.startView.zoom, layout.height);
    setGraphView({
      center: clampGraphCenter({
        x: panState.startView.center.x - deltaX / graphBounds.width * viewport.width,
        y: panState.startView.center.y - deltaY / graphBounds.height * viewport.height,
      }, panState.startView.zoom, layout.height),
      zoom: panState.startView.zoom,
    });
  };

  const endGraphPan = (event: React.PointerEvent<SVGSVGElement>) => {
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    panStateRef.current = null;
    setIsPanning(false);
    if (panState.moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const graphViewport = graphViewportSize(graphView.zoom, layout.height);
  const graphViewBox = [
    graphView.center.x - graphViewport.width / 2,
    graphView.center.y - graphViewport.height / 2,
    graphViewport.width,
    graphViewport.height,
  ].join(' ');

  return <main className="character-analysis">
    <header className="character-analysis__header">
      <div className="character-analysis__intro">
        <span className="script-eyebrow">АНАЛИТИКА СЦЕНАРИЯ</span>
        <h2>Связи персонажей</h2>
      </div>
      <div className="character-analysis__filters">
        <label>
          <span>Анализировать</span>
          <Select
            aria-label="Период анализа"
            className="character-analysis__scope"
            options={scopeOptions}
            showSearch
            optionFilterProp="label"
            value={scope}
            onChange={(value) => {
              setScope(value);
              setSelection(null);
            }}
          />
        </label>
        <div className="character-analysis__limit">
          <label htmlFor="character-graph-limit">Персонажей на графе</label>
          <div>
            <InputNumber
              id="character-graph-limit"
              aria-label="Персонажей на графе"
              disabled={showAll || analysis.characters.length === 0}
              max={Math.max(1, analysis.characters.length)}
              min={1}
              precision={0}
              value={analysis.characters.length === 0
                ? null
                : Math.min(visibleCharacterCount, analysis.characters.length)}
              onChange={(value) => {
                if (typeof value !== 'number') return;
                setShowAll(false);
                setVisibleCharacterCount(value);
              }}
            />
            <button
              aria-label="Показать всех персонажей"
              aria-pressed={showAll}
              className={showAll ? 'is-active' : ''}
              disabled={analysis.characters.length === 0}
              type="button"
              onClick={() => setShowAll((current) => !current)}
            >Все</button>
          </div>
        </div>
      </div>
    </header>

    <section className="character-analysis__summary" aria-label="Сводка по персонажам">
      <article><strong>{analysis.characters.length}</strong><span>в тексте</span></article>
      <article><strong>{analysis.dialogueCount}</strong><span>реплик</span></article>
      <article><strong>{analysis.relationships.length}</strong><span>связей</span></article>
      <article className={analysis.unlinkedDialogueCount > 0 ? 'has-warning' : ''}>
        <strong>{analysis.unlinkedDialogueCount}</strong><span>без привязки</span>
      </article>
    </section>

    <div className={`character-analysis__body${detailsOpen ? '' : ' is-details-collapsed'}`}>
      <section className="character-analysis__graph-panel" aria-label="Граф связей персонажей">
        <p className="screen-reader-only" id="character-graph-navigation-instructions">
          Колесо мыши меняет масштаб. Зажмите левую кнопку и тяните увеличенный граф.
          С клавиатуры используйте плюс и минус для масштаба, стрелки для перемещения и ноль для сброса.
        </p>
        <div className="character-graph__navigation-hint" aria-hidden="true">
          <strong>{graphView.zoom}%</strong>
        </div>
        <div
          ref={graphViewportRef}
          className="character-graph__viewport"
          role="region"
          tabIndex={0}
          aria-label="Навигация по графу"
          aria-describedby="character-graph-navigation-instructions"
          onKeyDown={handleGraphKeyDown}
        >
          {analysis.characters.length === 0 ? <section className="character-graph__empty">
            <span aria-hidden="true">◌</span>
            <h3>{characters.length === 0 ? 'Персонажи пока не добавлены' : 'Нет привязанных персонажей'}</h3>
            <p>{characters.length === 0
              ? 'Добавленные в проект персонажи появятся здесь после привязки к репликам.'
              : 'Выберите персонажей в блоках сценария — тогда здесь появятся объективные данные.'}</p>
          </section> : <>
            {visibleRelationships.length === 0 && <p className="character-graph__no-links">
              Между показанными персонажами пока нет последовательных обменов репликами.
            </p>}
            <svg
              ref={graphRef}
              className={[
                'character-graph__map',
                graphView.zoom > DEFAULT_GRAPH_ZOOM ? 'is-pannable' : '',
                isPanning ? 'is-panning' : '',
              ].filter(Boolean).join(' ')}
              role="group"
              aria-label={`Граф связей: ${visibleCharacters.length} персонажей, ${visibleRelationships.length} связей`}
              viewBox={graphViewBox}
              style={{minHeight: Math.min(layout.height, 920)}}
              onClickCapture={(event) => {
                if (!suppressClickRef.current) return;
                event.preventDefault();
                event.stopPropagation();
                suppressClickRef.current = false;
              }}
              onPointerCancel={endGraphPan}
              onPointerDown={beginGraphPan}
              onPointerMove={moveGraph}
              onPointerUp={endGraphPan}
            >
              <defs>
                <filter id="character-node-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="9" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {visibleCharacters.map((metric, index) => {
                  const radius = nodeRadius(metric);
                  return <clipPath key={metric.character.id} id={`character-avatar-${index}`}>
                    <circle cx="0" cy="0" r={radius - 2} />
                  </clipPath>;
                })}
              </defs>

              {visibleRelationships.map((relationship) => {
                const source = positions.get(relationship.sourceId);
                const target = positions.get(relationship.targetId);
                if (!source || !target) return null;
                const selected = selection?.type === 'relationship' && selection.id === relationship.id;
                const strokeWidth = 2 + Math.sqrt(relationship.exchangeCount / maxExchangeCount) * 8;
                const selectRelationship = () => setSelection({id: relationship.id, type: 'relationship'});
                return <g
                  key={relationship.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Связь ${relationshipName(relationship)}: ${formatMetric(relationship.exchangeCount, 'обмен', 'обмена', 'обменов')}`}
                  className={`character-graph__edge${selected ? ' is-selected' : ''}`}
                  onClick={selectRelationship}
                  onKeyDown={(event) => activateWithKeyboard(event, selectRelationship)}
                >
                  <title>{relationshipName(relationship)}</title>
                  <line className="character-graph__edge-hit" x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
                  <line
                    className="character-graph__edge-line"
                    style={{strokeWidth}}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                </g>;
              })}

              {visibleCharacters.map((metric, index) => {
                const position = positions.get(metric.character.id) ?? layout.positions[index];
                const portrait = metric.character.imageUrl ? backendAssetUrl(metric.character.imageUrl) : '';
                const radius = nodeRadius(metric);
                const selected = selection?.type === 'character' && selection.id === metric.character.id;
                const selectCharacter = () => setSelection({id: metric.character.id, type: 'character'});
                return <g
                  key={metric.character.id}
                  role="button"
                  tabIndex={0}
                  data-testid="character-graph-node"
                  aria-label={`${metric.character.name}: ${formatMetric(metric.dialogueCount, 'реплика', 'реплики', 'реплик')}`}
                  className={`character-graph__node${selected ? ' is-selected' : ''}`}
                  transform={`translate(${position.x} ${position.y})`}
                  onClick={selectCharacter}
                  onKeyDown={(event) => activateWithKeyboard(event, selectCharacter)}
                >
                  <title>{metric.character.name}</title>
                  <circle className="character-graph__node-glow" cx="0" cy="0" r={radius + 14} />
                  <circle className="character-graph__node-ring" cx="0" cy="0" r={radius + 7} />
                  <circle className="character-graph__node-core" cx="0" cy="0" r={radius} />
                  {portrait ? <image
                    aria-hidden="true"
                    href={portrait}
                    x={-radius + 2}
                    y={-radius + 2}
                    width={(radius - 2) * 2}
                    height={(radius - 2) * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#character-avatar-${index})`}
                  /> : <text className="character-graph__initials" x="0" y="8" textAnchor="middle">
                    {initials(metric.character.name)}
                  </text>}
                  <text className="character-graph__name" x="0" y={radius + 31} textAnchor="middle">
                    {metric.character.name}
                  </text>
                  <text className="character-graph__role" x="0" y={radius + 51} textAnchor="middle">
                    {metric.character.roleLabel || metric.character.role || 'Персонаж'}
                  </text>
                  <text className="character-graph__metric" x="0" y={radius + 69} textAnchor="middle">
                    {formatMetric(metric.dialogueCount, 'реплика', 'реплики', 'реплик')}
                  </text>
                </g>;
              })}
            </svg>
          </>}
        </div>
      </section>

      <button
        aria-controls="character-analysis-details"
        aria-expanded={detailsOpen}
        aria-label={detailsOpen ? 'Скрыть панель деталей' : 'Показать панель деталей'}
        className={`character-analysis__details-handle ${detailsOpen ? 'is-open' : 'is-collapsed'}`}
        type="button"
        onClick={() => setDetailsOpen((current) => !current)}
      >
        {detailsOpen
          ? <MenuUnfoldOutlined aria-hidden="true" />
          : <MenuFoldOutlined aria-hidden="true" />}
      </button>

      <aside
        className="character-analysis__details"
        id="character-analysis-details"
        aria-label="Детали анализа"
        aria-live="polite"
        hidden={!detailsOpen}
      >
        {selectedCharacter && <>
          <span className="script-eyebrow">ПЕРСОНАЖ</span>
          <h3>{selectedCharacter.character.name}</h3>
          <dl className="character-analysis__metrics">
            <div><dt>Реплики</dt><dd>{selectedCharacter.dialogueCount}</dd></div>
            <div><dt>Слова</dt><dd>{selectedCharacter.wordCount}</dd></div>
            <div><dt>Сцены</dt><dd>{selectedCharacter.sceneIds.length}</dd></div>
            <div><dt>Собеседники</dt><dd>{selectedCharacter.relationshipCount}</dd></div>
          </dl>
          <h4>Основные собеседники</h4>
          <div className="character-analysis__relation-list">
            {analysis.relationships
              .filter((relationship) => relationshipCharacterIds(relationship)
                .includes(selectedCharacter.character.id))
              .map((relationship) => {
                const otherId = relationship.sourceId === selectedCharacter.character.id
                  ? relationship.targetId
                  : relationship.sourceId;
                return <button
                  key={relationship.id}
                  type="button"
                  onClick={() => setSelection({id: relationship.id, type: 'relationship'})}
                >
                  <span>{characterById.get(otherId)?.name ?? 'Персонаж'}</span>
                  <strong>{formatMetric(relationship.exchangeCount, 'обмен', 'обмена', 'обменов')}</strong>
                </button>;
              })}
            {selectedCharacter.relationshipCount === 0 && <p>Последовательных обменов репликами пока нет.</p>}
          </div>
        </>}

        {selectedRelationship && <>
          <span className="script-eyebrow">СВЯЗЬ</span>
          <h3>{relationshipName(selectedRelationship)}</h3>
          <dl className="character-analysis__metrics">
            <div><dt>Обмены</dt><dd>{selectedRelationship.exchangeCount}</dd></div>
            <div><dt>Общие сцены</dt><dd>{selectedRelationship.commonSceneIds.length}</dd></div>
            <div><dt>Сцены с диалогом</dt><dd>{selectedRelationship.dialogueSceneIds.length}</dd></div>
          </dl>
          <h4>По актам</h4>
          <div className="character-analysis__act-list">
            {selectedRelationship.actBreakdown.map((act) => <span key={act.act}>
              Акт {act.act} · {formatMetric(act.exchangeCount, 'обмен', 'обмена', 'обменов')}
            </span>)}
          </div>
          <h4>Общие сцены</h4>
          <ol className="character-analysis__scene-list">
            {selectedRelationship.commonSceneIds.map((sceneId) => {
              const scene = sceneById.get(sceneId);
              return <li key={sceneId}>
                <span>Сцена {scene?.order ?? sceneId}</span>
                <strong>{scene?.title || 'Без названия'}</strong>
              </li>;
            })}
          </ol>
        </>}

        {!selectedCharacter && !selectedRelationship && <>
          <h3>КАК ЧИТАТЬ ГРАФ</h3>
          <ul className="character-analysis__legend">
            <li><i className="is-node" />Крупнее узел — больше реплик.</li>
            <li><i className="is-edge" />Толще линия — больше смен говорящих.</li>
          </ul>
          {strongestRelationship && <>
            <h4>Самая активная связь</h4>
            <button
              className="character-analysis__strongest"
              type="button"
              onClick={() => setSelection({id: strongestRelationship.id, type: 'relationship'})}
            >
              <span>{relationshipName(strongestRelationship)}</span>
              <strong>{formatMetric(strongestRelationship.exchangeCount, 'обмен', 'обмена', 'обменов')}</strong>
            </button>
          </>}
          {analysis.unlinkedDialogueCount > 0 && <p className="character-analysis__warning">
            {formatMetric(analysis.unlinkedDialogueCount, 'реплика не привязана', 'реплики не привязаны', 'реплик не привязаны')} к персонажам и не входит в статистику.
          </p>}
        </>}
      </aside>
    </div>
    <div className="screen-reader-only" role="status">
      Показано {visibleCharacters.length} из {analysis.characters.length} персонажей.
    </div>
  </main>;
}
