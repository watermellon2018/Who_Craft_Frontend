import React, {useMemo} from 'react';
import {findZone, ZONE_INDEX} from './zones';
import {VIEWPORT_ZONE_RECTS, visibleOverlayIds} from './zoneOverlays';

interface Props {
  hoveredZoneId: string | null;
  selectedZoneId: string | null;
  zoomZoneId: string | null;
  ancestorIds: string[];
  onHoverZone: (zoneId: string | null) => void;
  onSelectZone: (zoneId: string | null) => void;
  zoneParams: Record<string, Record<string, number | string | boolean>>;
}

// Mock character viewport.
//
// Renders the SVG silhouette as the visual backdrop and overlays clickable
// rectangular regions on top of it, one per editable zone. Hit-test is
// per-overlay (not on the SVG paths) — accuracy is not the goal; legible
// UX is. Real anatomical hit-testing comes once Three.js raycasting lands.
//
// TODO: replace SVG body + rectangle overlays with React Three Fiber
// mesh + raycaster. Zone outline becomes a postprocessing pass.
const CharacterViewport: React.FC<Props> = ({
  hoveredZoneId,
  selectedZoneId,
  zoomZoneId,
  ancestorIds,
  onHoverZone,
  onSelectZone,
  zoneParams,
}) => {
  const selectedZone = useMemo(() => findZone(selectedZoneId), [selectedZoneId]);
  const overlayIds = useMemo(
    () => visibleOverlayIds(selectedZoneId, ancestorIds),
    [selectedZoneId, ancestorIds],
  );

  // Resolve user-set colors so the avatar reflects choices in real time.
  const hairColor = (zoneParams.hair?.hairColor as string) || '#1E1A18';
  const eyeColor = (zoneParams.eyes?.eyeColor as string) || '#3a6ca8';
  const skinTone = (zoneParams.skin_color?.skinTone as string) || '#dac0a3';

  const isZoomed = !!zoomZoneId;

  const handleBackgroundClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) onSelectZone(null);
  };

  return (
    <div
      className={`c3d-viewport ${isZoomed ? 'c3d-viewport--zoomed' : ''}`}
      onClick={handleBackgroundClick}
    >
      <div className="c3d-viewport__bg" />
      <div className="c3d-viewport__floor" />
      <div className="c3d-viewport__grid" />
      <div className="c3d-viewport__atmos" />

      <div
        className={`c3d-viewport__avatar ${isZoomed ? 'c3d-viewport__avatar--zoomed' : ''}`}
        // CSS reads --zoom-x/--zoom-y to translate the avatar toward the
        // selected zone when zoomed. Coordinates are computed from the
        // selected zone's rect center.
        style={zoomTransformStyle(zoomZoneId)}
      >
        <AvatarSvg hairColor={hairColor} eyeColor={eyeColor} skinTone={skinTone} />
      </div>

      {/* Clickable overlays for zones reachable at this drill level. */}
      <div className="c3d-overlays" onClick={handleBackgroundClick}>
        {overlayIds.map((id) => {
          const rect = VIEWPORT_ZONE_RECTS[id];
          const zone = ZONE_INDEX[id];
          if (!rect || !zone) return null;
          const isSelected = selectedZoneId === id;
          const isAncestor = !isSelected && ancestorIds.includes(id);
          const isHovered = hoveredZoneId === id && !isSelected;
          const isZoomedHere = zoomZoneId === id;
          return (
            <button
              key={id}
              type="button"
              className={[
                'c3d-zone',
                isHovered ? 'c3d-zone--hover' : '',
                isSelected ? 'c3d-zone--selected' : '',
                isAncestor ? 'c3d-zone--ancestor' : '',
                isZoomedHere ? 'c3d-zone--zoomed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: `${rect.left}%`,
                top: `${rect.top}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
              }}
              onMouseEnter={() => onHoverZone(id)}
              onMouseLeave={() => onHoverZone(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectZone(id);
              }}
              aria-label={zone.label}
              aria-pressed={isSelected}
            />
          );
        })}
      </div>

      {/* Selection label pinned near the selected zone. */}
      {selectedZone && VIEWPORT_ZONE_RECTS[selectedZone.id] ? (
        <SelectionLabel
          label={selectedZone.label}
          rect={VIEWPORT_ZONE_RECTS[selectedZone.id]}
          onClose={() => onSelectZone(null)}
        />
      ) : null}

      {/* Zoom mode badge — pinned at top center of the stage. */}
      {isZoomed && selectedZone ? (
        <div className="c3d-zoom-badge" role="status">
          <span className="c3d-zoom-badge__dot" />
          <span>Режим детализации: {selectedZone.label}</span>
        </div>
      ) : null}

      {/* Empty-state hints (only when nothing is selected). */}
      {!selectedZoneId ? (
        <div className="c3d-empty-hint">
          <span>Кликните на часть персонажа, чтобы редактировать её</span>
        </div>
      ) : null}
    </div>
  );
};

// Compute a translate/scale transform that nudges the avatar toward the
// selected zone when in zoom mode. This is the CSS mock the spec calls
// for — replace with a real Three.js camera focus later.
function zoomTransformStyle(zoneId: string | null): React.CSSProperties {
  if (!zoneId) return {};
  const rect = VIEWPORT_ZONE_RECTS[zoneId];
  if (!rect) return {};
  // Center of the zone in viewport-fraction coordinates.
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // Translate the avatar so the zone moves toward the viewport center.
  // Magnitudes are dampened — the spec wants a focus hint, not a teleport.
  const tx = 50 - cx;
  const ty = 50 - cy;
  return {
    '--c3d-zoom-tx': `${tx * 0.6}%`,
    '--c3d-zoom-ty': `${ty * 0.6}%`,
  } as React.CSSProperties;
}

const SelectionLabel: React.FC<{
  label: string;
  rect: {left: number; top: number; width: number; height: number};
  onClose: () => void;
}> = ({label, rect, onClose}) => {
  const left = rect.left + rect.width / 2;
  const top = rect.top;
  return (
    <div
      className="c3d-selection-label"
      style={{left: `${left}%`, top: `${top}%`}}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="c3d-selection-label__pulse" />
      <span className="c3d-selection-label__text">{label}</span>
      <button type="button" className="c3d-selection-label__close" onClick={onClose} aria-label="Снять выделение">
        ×
      </button>
    </div>
  );
};

// SVG humanoid silhouette. Read-only — purely a visual placeholder.
// Skin tone, hair color, and eye color come from zone params so the
// avatar reflects user edits even in the mock.
const AvatarSvg: React.FC<{hairColor: string; eyeColor: string; skinTone: string}> = ({
  hairColor,
  eyeColor,
  skinTone,
}) => {
  return (
    <svg
      viewBox="0 0 400 720"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="c3d-skin-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skinTone} />
          <stop offset="100%" stopColor={shade(skinTone, -0.35)} />
        </linearGradient>
        <radialGradient id="c3d-rim" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(245, 180, 0, 0.25)" />
          <stop offset="100%" stopColor="rgba(245, 180, 0, 0)" />
        </radialGradient>
      </defs>

      <ellipse cx={200} cy={680} rx={150} ry={28} fill="rgba(0,0,0,0.55)" />

      {/* Torso / body silhouette */}
      <path
        d="
          M155 240 Q200 224 245 240
          L262 288 Q272 340 268 396
          L260 470 Q256 524 252 568
          L240 632 L160 632
          L148 568 Q144 524 140 470
          L132 396 Q128 340 138 288 Z
        "
        fill="url(#c3d-skin-grad)"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={0.5}
      />

      {/* Arms */}
      <path d="M138 290 Q120 360 110 470 L116 540 L132 540 L130 470 Q138 380 148 300 Z" fill="url(#c3d-skin-grad)" />
      <path d="M262 290 Q280 360 290 470 L284 540 L268 540 L270 470 Q262 380 252 300 Z" fill="url(#c3d-skin-grad)" />

      {/* Legs */}
      <path d="M160 632 L168 720 L196 720 L198 632 Z" fill="url(#c3d-skin-grad)" />
      <path d="M240 632 L232 720 L204 720 L202 632 Z" fill="url(#c3d-skin-grad)" />

      {/* Head + face */}
      <path
        d="M165 110 Q200 96 235 110 Q252 130 248 168 Q244 200 230 218 Q200 246 170 218 Q156 200 152 168 Q148 130 165 110 Z"
        fill="url(#c3d-skin-grad)"
      />

      {/* Hair */}
      <path
        d="M155 28 Q200 -8 245 28 Q278 60 268 118 Q258 148 248 142 Q252 100 230 80 Q200 70 170 80 Q148 100 152 142 Q142 148 132 118 Q122 60 155 28 Z"
        fill={hairColor}
      />
      <path
        d="M158 32 Q200 -4 242 32 Q258 50 252 70 Q236 56 200 56 Q164 56 148 70 Q142 50 158 32 Z"
        fill="rgba(255,255,255,0.08)"
      />

      {/* Eyes */}
      <ellipse cx={185} cy={170} rx={9} ry={4.5} fill="#fff" />
      <ellipse cx={215} cy={170} rx={9} ry={4.5} fill="#fff" />
      <circle cx={185} cy={170} r={3.5} fill={eyeColor} />
      <circle cx={215} cy={170} r={3.5} fill={eyeColor} />
      <circle cx={185.6} cy={168.6} r={1} fill="#fff" />
      <circle cx={215.6} cy={168.6} r={1} fill="#fff" />

      {/* Brows + mouth */}
      <path d="M170 152 Q186 146 200 152" stroke="#3a2a20" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M230 152 Q214 146 200 152" stroke="#3a2a20" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M188 208 Q200 214 212 208" stroke="#5a2a30" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </svg>
  );
};

// Lighten / darken a hex color by `amount` in [-1, 1]. Cheap shader-less
// way to derive a shadow tone from the chosen skin color.
function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(parseInt(m[1], 16) * (1 + amount));
  const g = clamp(parseInt(m[2], 16) * (1 + amount));
  const b = clamp(parseInt(m[3], 16) * (1 + amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export default CharacterViewport;
