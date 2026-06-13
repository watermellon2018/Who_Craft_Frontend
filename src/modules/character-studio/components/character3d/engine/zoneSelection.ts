import {getAncestors} from '../zones';
import {visibleOverlayIds} from '../zoneOverlays';

// The "directly selectable" body part for a raycast hit, used by BOTH hover
// and the first click so the two always agree (hover never promises a part
// the click won't select). For a hit on a body sub-mesh this is its level-2
// zone (torso, shoulders, waist, hips, head_neck, arms, legs); for the head
// it is the whole 'face' zone; for hair it is 'hair'. The whole-figure
// 'body' silhouette is intentionally NOT a hover/first-click target —
// glowing the entire light-skinned figure reads as "nothing happened".
//
// Returns null when the hit has no such part (e.g. decoration meshes that
// shouldn't be hover targets at all).
export function resolveDirectPart(hitZoneId: string | null): string | null {
  if (!hitZoneId) return null;
  const chain = getAncestors(hitZoneId); // root group → ... → hit
  const top = chain[0]?.id;
  if (top === 'hair') return 'hair';
  if (top === 'face') return 'face';
  if (top === 'body') {
    // chain[1] is the level-2 body part (torso, arms, legs, …). Fall back to
    // the hit itself if the hierarchy is shallower than expected.
    return chain[1]?.id ?? hitZoneId;
  }
  // skin/pose decorations and anything ungrouped: not a hover target.
  return null;
}

// Maps a raycast hit (most specific zone tagged on the mesh) to the zone the
// click should select. With nothing selected, a click selects the direct
// part under the cursor (so hover and click agree). Once a zone is selected,
// the legacy drill-down rules apply so the user can walk between sibling
// sub-zones via the viewport.
//
// Example: nothing selected + click on a torso → 'torso'; on an arm →
// 'arms'; on a cheek → 'face'. With 'eyes' selected, a click on the nose
// resolves to 'nose'.
export function resolveSelectableZone(
  hitZoneId: string | null,
  selectedZoneId: string | null,
  selectedAncestorIds: string[],
): string | null {
  if (!hitZoneId) return null;
  const chain = getAncestors(hitZoneId);

  // Fresh selection: pick the concrete part under the cursor directly.
  if (!selectedZoneId) {
    return resolveDirectPart(hitZoneId);
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
  if (candidateIdx >= 0) return chain[candidateIdx].id;
  // Nothing in the hit chain is reachable at this drill level (e.g. hovering
  // the legs while the face is selected) — fall back to the direct part so
  // the hover still highlights something concrete instead of nothing.
  return resolveDirectPart(hitZoneId);
}
