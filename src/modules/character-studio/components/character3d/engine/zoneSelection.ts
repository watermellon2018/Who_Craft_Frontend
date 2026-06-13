import {getAncestors} from '../zones';
import {visibleOverlayIds} from '../zoneOverlays';

// Limbs that should be selectable in a single click rather than first
// selecting the whole body. Clicking an arm highlights the arm — anything
// else feels like the click "did nothing" because the whole-body glow on a
// light figure reads as no change.
const DIRECT_BODY_ZONES = new Set(['arms', 'legs']);

// Maps a raycast hit (most specific zone tagged on the mesh) to the zone the
// click should select, honoring the same drill-down rules the 2D overlay
// version used: level-1 silhouettes first, then level-2 siblings once the
// user is inside a group; level-3 zones are reached via the side panel.
//
// Example: nothing selected + click on a torso → 'body'; click on an arm →
// 'arms' directly. With 'body' (or any body child) selected, a click on a
// leg resolves to 'legs'.
export function resolveSelectableZone(
  hitZoneId: string | null,
  selectedZoneId: string | null,
  selectedAncestorIds: string[],
): string | null {
  if (!hitZoneId) return null;
  const chain = getAncestors(hitZoneId);

  // First click on a limb selects the limb group directly (skip the
  // whole-body step), so the click visibly highlights what was hit.
  if (!selectedZoneId) {
    const limb = chain.find((z) => DIRECT_BODY_ZONES.has(z.id));
    if (limb) return limb.id;
  }

  const allowed = new Set(visibleOverlayIds(selectedZoneId, selectedAncestorIds));

  // Deepest zone in the hit chain the drill level currently allows.
  let candidateIdx = -1;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (allowed.has(chain[i].id)) {
      candidateIdx = i;
      break;
    }
  }
  // If the current selection sits even deeper inside the hit subtree (a
  // level-3 zone picked from the side panel), hits keep targeting it — that
  // is what hover feedback and drag editing must attach to.
  const selectedIdx = selectedZoneId ? chain.findIndex((z) => z.id === selectedZoneId) : -1;
  if (selectedIdx > candidateIdx) return selectedZoneId;
  return candidateIdx >= 0 ? chain[candidateIdx].id : null;
}
