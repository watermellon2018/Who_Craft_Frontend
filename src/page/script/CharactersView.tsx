import React, {useEffect, useMemo, useState} from 'react';
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

type AnalysisSelection =
  | {id: string; type: 'character'}
  | {id: string; type: 'relationship'};

const DEFAULT_VISIBLE_CHARACTER_COUNT = 10;
const GRAPH_MIN_HEIGHT = 640;
const GRAPH_ROW_HEIGHT = 210;
const GRAPH_TOP_PADDING = 125;
const GRAPH_WIDTH = 1200;

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

  const relationshipName = (relationship: CharacterRelationshipMetric) => {
    const source = characterById.get(relationship.sourceId)?.name ?? 'Персонаж';
    const target = characterById.get(relationship.targetId)?.name ?? 'Персонаж';
    return `${source} — ${target}`;
  };

  const nodeRadius = (metric: CharacterMetric) => (
    42 + Math.round(Math.sqrt(metric.dialogueCount / maxDialogueCount) * 15)
  );

  return <main className="character-analysis">
    <header className="character-analysis__header">
      <div className="character-analysis__intro">
        <span className="script-eyebrow">АНАЛИТИКА СЦЕНАРИЯ</span>
        <h2>Связи персонажей</h2>
        <p>Факты из привязанных реплик — без оценки характера отношений.</p>
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

    <div className="character-analysis__body">
      <section className="character-analysis__graph-panel" aria-labelledby="character-graph-title">
        <header>
          <div>
            <h3 id="character-graph-title">Карта связей</h3>
            <p>Размер узла — число реплик, толщина линии — диалоговые обмены.</p>
          </div>
          <span>{visibleCharacters.length} из {analysis.characters.length}</span>
        </header>
        <div className="character-graph__viewport">
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
              className="character-graph__map"
              role="group"
              aria-label={`Граф связей: ${visibleCharacters.length} персонажей, ${visibleRelationships.length} связей`}
              viewBox={`0 0 ${GRAPH_WIDTH} ${layout.height}`}
              style={{minHeight: Math.min(layout.height, 920)}}
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

      <aside className="character-analysis__details" aria-label="Детали анализа" aria-live="polite">
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
          <span className="script-eyebrow">КАК ЧИТАТЬ ГРАФ</span>
          <h3>Только факты из текста</h3>
          <ul className="character-analysis__legend">
            <li><i className="is-node" />Крупнее узел — больше реплик.</li>
            <li><i className="is-edge" />Толще линия — больше смен говорящих.</li>
            <li><i className="is-filter" />Фильтры пересчитывают данные по актам и сценам.</li>
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
