import React, {useEffect, useMemo, useRef, useState} from 'react';

import {backendAssetUrl} from '../../api/http';
import type {CompactCharacter} from './types';

interface CharactersViewProps {
  characters: CompactCharacter[];
}

interface GraphPosition {
  x: number;
  y: number;
}

interface DragState {
  characterId: string;
  offsetX: number;
  offsetY: number;
}

const GRAPH_WIDTH = 1200;
const GRAPH_MIN_HEIGHT = 620;
const GRAPH_ROW_HEIGHT = 190;
const GRAPH_TOP_PADDING = 120;
const GRAPH_HORIZONTAL_BOUNDARY = 74;
const GRAPH_TOP_BOUNDARY = 66;
const GRAPH_BOTTOM_BOUNDARY = 124;

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

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(Math.max(value, minimum), maximum)
);

const pointerPosition = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  graphHeight: number,
): GraphPosition => {
  const matrix = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
  if (matrix && typeof svg.createSVGPoint === 'function') {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const graphPoint = point.matrixTransform(matrix.inverse());
    return {x: graphPoint.x, y: graphPoint.y};
  }

  const bounds = svg.getBoundingClientRect();
  if (bounds.width > 0 && bounds.height > 0) {
    return {
      x: (clientX - bounds.left) / bounds.width * GRAPH_WIDTH,
      y: (clientY - bounds.top) / bounds.height * graphHeight,
    };
  }

  return {x: clientX, y: clientY};
};

export default function CharactersView({characters}: CharactersViewProps) {
  const layout = useMemo(() => buildGraphLayout(characters.length), [characters.length]);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggedCharacterId, setDraggedCharacterId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, GraphPosition>>({});

  useEffect(() => {
    setPositions((current) => Object.fromEntries(characters.map((character, index) => [
      character.id,
      current[character.id] ?? layout.positions[index],
    ])));
  }, [characters, layout.positions]);

  const startDrag = (
    event: React.PointerEvent<SVGGElement>,
    characterId: string,
    position: GraphPosition,
  ) => {
    if (event.button !== 0 || !svgRef.current) return;
    const pointer = pointerPosition(svgRef.current, event.clientX, event.clientY, layout.height);
    dragRef.current = {
      characterId,
      offsetX: pointer.x - position.x,
      offsetY: pointer.y - position.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggedCharacterId(characterId);
    event.preventDefault();
  };

  const moveDraggedNode = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const pointer = pointerPosition(svgRef.current, event.clientX, event.clientY, layout.height);
    setPositions((current) => ({
      ...current,
      [drag.characterId]: {
        x: clamp(
          pointer.x - drag.offsetX,
          GRAPH_HORIZONTAL_BOUNDARY,
          GRAPH_WIDTH - GRAPH_HORIZONTAL_BOUNDARY,
        ),
        y: clamp(
          pointer.y - drag.offsetY,
          GRAPH_TOP_BOUNDARY,
          layout.height - GRAPH_BOTTOM_BOUNDARY,
        ),
      },
    }));
  };

  const stopDragging = () => {
    dragRef.current = null;
    setDraggedCharacterId(null);
  };


  return <main className="character-graph">
    {characters.length === 0 ? <section className="character-graph__empty">
      <span aria-hidden="true">◌</span>
      <h2>Граф пока пуст</h2>
      <p>Добавленные в проект персонажи появятся здесь отдельными вершинами.</p>
    </section> : <div className="character-graph__viewport">
      <svg
        ref={svgRef}
        className="character-graph__map"
        role="img"
        aria-label={`Несвязный граф: ${characters.length} персонажей`}
        viewBox={`0 0 ${GRAPH_WIDTH} ${layout.height}`}
        style={{minHeight: Math.min(layout.height, 900)}}
        onPointerMove={moveDraggedNode}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
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
          const position = positions[character.id] ?? layout.positions[index];
          const portrait = character.imageUrl ? backendAssetUrl(character.imageUrl) : '';
          return <g
            key={character.id}
            data-testid="character-graph-node"
            className={`character-graph__node${draggedCharacterId === character.id ? ' is-dragging' : ''}`}
            transform={`translate(${position.x} ${position.y})`}
            aria-label={character.name}
            onPointerDown={(event) => startDrag(event, character.id, position)}
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
