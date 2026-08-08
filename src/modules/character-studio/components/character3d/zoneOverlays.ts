// Bounding rectangles for clickable zone overlays on the viewport.
//
// Coordinates are percentages of the viewport container. Values are
// intentionally approximate — the spec says: don't fight pixel-perfect
// anatomy without a real 3D raycaster; what matters is the UX is legible.
// TODO: replace with raycasted bounding boxes once the Three.js scene
// renders the character mesh.

export interface ZoneRect {
  // All units are percent of the stage. Origin is top-left.
  left: number;
  top: number;
  width: number;
  height: number;
}

// Which zones get a visible clickable overlay. Level-3 zones (upper_arm,
// forearm, hand, thigh, etc.) are reachable via the right-panel subzone
// list — the avatar is too small for those hit areas to be readable, and
// the spec says "не пытаться идеально попадать overlay-зонами в анатомию"
// for the first version.
export const VIEWPORT_ZONE_RECTS: Record<string, ZoneRect> = {
  // Level 1 silhouettes (large catch-all regions)
  body: {left: 32, top: 26, width: 36, height: 68},
  face: {left: 38, top: 9, width: 24, height: 20},
  hair: {left: 35, top: 2, width: 30, height: 14},

  // Face level-2 zones
  eyes: {left: 41, top: 16, width: 18, height: 5},
  nose: {left: 46, top: 18, width: 8, height: 7},
  mouth: {left: 44, top: 24, width: 12, height: 4},
  brows: {left: 42, top: 14, width: 16, height: 3},
  jaw_chin: {left: 42, top: 25, width: 16, height: 6},
  ears: {left: 36, top: 16, width: 28, height: 6},
  face_shape: {left: 38, top: 9, width: 24, height: 20},

  // Body level-2 zones (mapped onto the silhouette below the head)
  head_neck: {left: 41, top: 28, width: 18, height: 6},
  shoulders: {left: 30, top: 32, width: 40, height: 7},
  torso: {left: 34, top: 37, width: 32, height: 13},
  waist: {left: 36, top: 48, width: 28, height: 8},
  hips: {left: 34, top: 54, width: 32, height: 8},
  arms: {left: 22, top: 34, width: 56, height: 28},
  legs: {left: 34, top: 62, width: 32, height: 32},

  // Hair, skin, pose top-level zones use the same rough silhouette as
  // their group; the user typically picks them through the left rail.
  skin: {left: 34, top: 11, width: 32, height: 70},
  pose: {left: 25, top: 5, width: 50, height: 90},
};

// Helper: which zones should render an overlay right now, given the
// selected zone. We avoid rendering EVERYTHING — the avatar would be
// covered. The rule: show overlays for level-1 zones (always), plus
// level-2 children of the selected zone's parent if the user has drilled
// in. Level-3 zones don't get a viewport overlay; they're reachable via
// the right panel.
export function visibleOverlayIds(selectedZoneId: string | null, selectedAncestorIds: string[]): string[] {
  // Always show top-level "silhouette" catch-alls when nothing is selected.
  if (!selectedZoneId) {
    return ['hair', 'face', 'body'];
  }

  // If the user is in face or body, surface that group's level-2 children
  // as overlays so they can click between sibling features.
  if (selectedAncestorIds.includes('face')) {
    return ['eyes', 'nose', 'mouth', 'brows', 'jaw_chin', 'ears', 'face_shape', 'hair'];
  }
  if (selectedAncestorIds.includes('body')) {
    return ['head_neck', 'shoulders', 'torso', 'waist', 'hips', 'arms', 'legs', 'hair', 'face'];
  }

  // Hair/skin/pose: keep the silhouette overlays so the user can switch
  // categories by clicking on the avatar.
  return ['hair', 'face', 'body'];
}
