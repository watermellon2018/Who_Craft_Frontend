import React, {useMemo} from 'react';

import {backendAssetUrl} from '../../api/http';
import type {CompactCharacter} from './types';

interface CharactersViewProps {
  characters: CompactCharacter[];
}

interface GraphPosition {
  x: number;
  y: number;
}

const GRAPH_WIDTH = 1200;
const GRAPH_MIN_HEIGHT = 620;
const GRAPH_ROW_HEIGHT = 190;
const GRAPH_TOP_PADDING = 138;

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const buildGraphLayout = (count: number) => {
  if (count === 0) return {height: GRAPH_MIN_HEIGHT, positions: [] as GraphPosition[]};
  if (count === 1) {
    return {
      height: GRAPH_MIN_HEIGHT,
      positions: [{x: GRAPH_WIDTH / 2, y: GRAPH_MIN_HEIGHT / 2 - 18}],
    };
  }

  const columns = Math.min(5, Math.ceil(Math.sqrt(count * 1.55)));
  const rows = Math.ceil(count / columns);
  const height = Math.max(GRAPH_MIN_HEIGHT, rows * GRAPH_ROW_HEIGHT + GRAPH_TOP_PADDING + 70);
  const cellWidth = GRAPH_WIDTH / columns;
  const positions = Array.from({length: count}, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, count - row * columns);
    const rowWidth = itemsInRow * cellWidth;
    const rowOffset = (GRAPH_WIDTH - rowWidth) / 2;
    const horizontalDrift = Math.sin((index + 1) * 2.17) * Math.min(22, cellWidth * 0.08);
    const verticalDrift = Math.cos((index + 1) * 1.73) * 18;
    return {
      x: rowOffset + cellWidth * (column + 0.5) + horizontalDrift,
      y: GRAPH_TOP_PADDING + row * GRAPH_ROW_HEIGHT + verticalDrift,
    };
  });

  return {height, positions};
};

export default function CharactersView({characters}: CharactersViewProps) {
  const layout = useMemo(() => buildGraphLayout(characters.length), [characters.length]);

  return <main className="character-graph">
    <header className="character-graph__header">
      <div>
        <span className="script-eyebrow">ГРАФ ПЕРСОНАЖЕЙ</span>
        <h1>Персонажи истории</h1>
        <p>Каждая вершина — отдельный герой проекта.</p>
      </div>
      <div className="character-graph__count" aria-label={`Количество персонажей: ${characters.length}`}>
        <strong>{characters.length}</strong>
        <span>вершин</span>
      </div>
    </header>

    {characters.length === 0 ? <section className="character-graph__empty">
      <span aria-hidden="true">◌</span>
      <h2>Граф пока пуст</h2>
      <p>Добавленные в проект персонажи появятся здесь отдельными вершинами.</p>
    </section> : <div className="character-graph__viewport">
      <svg
        className="character-graph__map"
        role="img"
        aria-label={`Несвязный граф: ${characters.length} персонажей`}
        viewBox={`0 0 ${GRAPH_WIDTH} ${layout.height}`}
        style={{minHeight: Math.min(layout.height, 900)}}
      >
        <defs>
          <filter id="character-node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {characters.map((character, index) => (
            <clipPath key={character.id} id={`character-avatar-${index}`}>
              <circle cx="0" cy="0" r="48" />
            </clipPath>
          ))}
        </defs>

        {characters.map((character, index) => {
          const position = layout.positions[index];
          const portrait = character.imageUrl ? backendAssetUrl(character.imageUrl) : '';
          return <g
            key={character.id}
            data-testid="character-graph-node"
            className="character-graph__node"
            transform={`translate(${position.x} ${position.y})`}
            aria-label={character.name}
          >
            <title>{character.name}</title>
            <circle className="character-graph__node-glow" cx="0" cy="0" r="68" />
            <circle className="character-graph__node-ring" cx="0" cy="0" r="58" />
            <circle className="character-graph__node-core" cx="0" cy="0" r="49" />
            {portrait ? <image
              href={portrait}
              x="-48"
              y="-48"
              width="96"
              height="96"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#character-avatar-${index})`}
            /> : <text className="character-graph__initials" x="0" y="8" textAnchor="middle">
              {initials(character.name)}
            </text>}
            <text className="character-graph__name" x="0" y="88" textAnchor="middle">
              {character.name}
            </text>
            <text className="character-graph__role" x="0" y="108" textAnchor="middle">
              {character.roleLabel || character.role || 'Персонаж'}
            </text>
          </g>;
        })}
      </svg>
    </div>}
  </main>;
}
