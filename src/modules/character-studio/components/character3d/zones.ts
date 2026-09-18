// Editable zone hierarchy for the 3D character editor.
//
// This file is the single source of truth for what the user can edit:
// what zones exist, how they nest, which are symmetric (mirror-applied),
// and what parameters each zone exposes.
//
// The tree is consumed by:
//   • the viewport (clickable overlays for level-1/2 zones)
//   • the contextual panel (breadcrumbs, subzone list, parameter controls)
//   • the category rail (top-level group → active rail item)
//
// When the real 3D pipeline lands, parameter values map to morph targets
// (`type: 'morph'`), bone transforms (`type: 'bone'`), material slots
// (`type: 'material'`), or asset swaps (`type: 'asset'`). Frontend stores
// the value; backend applies it.

export type ParameterType = 'morph' | 'bone' | 'material' | 'asset' | 'pose' | 'texture' | 'blendshape';

export type ParameterUi = 'slider' | 'drag' | 'swatch' | 'preset' | 'toggle';

export interface EditableParameter {
  id: string;
  translationKey: string;
  type: ParameterType;
  ui: ParameterUi;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  // For swatch/preset UIs.
  options?: Array<{value: string; translationKey: string; preview?: string}>;
  // Optional hint shown under the control (e.g. "Можно тянуть зону на модели").
  hintTranslationKey?: string;
}

export type ZoneGroup = 'body' | 'face' | 'hair' | 'skin' | 'pose' | 'clothing';

export interface EditableZone {
  id: string;
  translationKey: string;
  group: ZoneGroup;
  level: 1 | 2 | 3;
  parentId?: string;
  isSymmetric?: boolean;
  children?: EditableZone[];
  parameters?: EditableParameter[];
}

// ─────────── Swatch palettes ───────────
const HAIR_COLORS = [
  {value: '#0c0a09', translationKey: 'characterStudio3d.options.hairColor.charcoal'},
  {value: '#1E1A18', translationKey: 'characterStudio3d.options.hairColor.darkChocolate'},
  {value: '#3a2a1f', translationKey: 'characterStudio3d.options.hairColor.chestnut'},
  {value: '#7a4a2a', translationKey: 'characterStudio3d.options.hairColor.lightChestnut'},
  {value: '#c98257', translationKey: 'characterStudio3d.options.hairColor.strawberryBlonde'},
  {value: '#c4a06a', translationKey: 'characterStudio3d.options.hairColor.blonde'},
];

const EYE_COLORS = [
  {value: '#3a6ca8', translationKey: 'characterStudio3d.options.eyeColor.steel'},
  {value: '#244a2a', translationKey: 'characterStudio3d.options.eyeColor.emerald'},
  {value: '#7a4a1a', translationKey: 'characterStudio3d.options.eyeColor.brown'},
  {value: '#a45a8a', translationKey: 'characterStudio3d.options.eyeColor.amethyst'},
  {value: '#6ac7d9', translationKey: 'characterStudio3d.options.eyeColor.ice'},
];

const SKIN_TONES = [
  {value: '#f0d8c0', translationKey: 'characterStudio3d.options.skinTone.light'},
  {value: '#dac0a3', translationKey: 'characterStudio3d.options.skinTone.warm'},
  {value: '#b58a6a', translationKey: 'characterStudio3d.options.skinTone.tan'},
  {value: '#8a6a55', translationKey: 'characterStudio3d.options.skinTone.medium'},
  {value: '#5a3a2a', translationKey: 'characterStudio3d.options.skinTone.dark'},
];

// Garment fabric colors for the A5 clothing layer (top / bottom). A fixed
// palette — like every other swatch here, clothing is analytic/parametric, not
// AI-generated, so the "no generative nets in the core" invariant holds.
const CLOTHING_COLORS = [
  {value: '#3b5266', translationKey: 'characterStudio3d.options.clothingColor.blue'},
  {value: '#6b3b3b', translationKey: 'characterStudio3d.options.clothingColor.burgundy'},
  {value: '#2d2d33', translationKey: 'characterStudio3d.options.clothingColor.graphite'},
  {value: '#3b5a3b', translationKey: 'characterStudio3d.options.clothingColor.green'},
  {value: '#c9b99b', translationKey: 'characterStudio3d.options.clothingColor.beige'},
];

const CLOTHING_TOP_STYLES = [
  {value: 'tshirt', translationKey: 'characterStudio3d.options.clothingTop.tshirt'},
  {value: 'sleeveless', translationKey: 'characterStudio3d.options.clothingTop.sleeveless'},
  {value: 'long_sleeve', translationKey: 'characterStudio3d.options.clothingTop.longSleeve'},
];

const CLOTHING_BOTTOM_STYLES = [
  {value: 'shorts', translationKey: 'characterStudio3d.options.clothingBottom.shorts'},
  {value: 'trousers', translationKey: 'characterStudio3d.options.clothingBottom.trousers'},
];

// hairStyle picks the SILHOUETTE (built as distinct geometry in rig.ts);
// hairShape below is the strand TEXTURE (straight/wavy/curly) layered on top.
// 'none' is a bald head — rig.ts builds no hair meshes and length/volume are
// no-ops for it. Unknown saved values degrade to 'default' in the rig, so
// older characters (which had no hairStyle at all) keep rendering.
const HAIR_STYLES = [
  {value: 'default', translationKey: 'characterStudio3d.options.hairStyle.default'},
  {value: 'long', translationKey: 'characterStudio3d.options.hairStyle.long'},
  {value: 'bob', translationKey: 'characterStudio3d.options.hairStyle.bob'},
  {value: 'ponytail', translationKey: 'characterStudio3d.options.hairStyle.ponytail'},
  {value: 'bun', translationKey: 'characterStudio3d.options.hairStyle.bun'},
  {value: 'afro', translationKey: 'characterStudio3d.options.hairStyle.afro'},
  {value: 'none', translationKey: 'characterStudio3d.options.hairStyle.none'},
];

// «Короткие» (buzz) was removed on purpose: it ignored hairLength and made
// the length slider look broken — short hair is just a low hairLength value.
const HAIR_PRESETS = [
  {value: 'straight', translationKey: 'characterStudio3d.options.hairShape.straight'},
  {value: 'wavy', translationKey: 'characterStudio3d.options.hairShape.wavy'},
  {value: 'curly', translationKey: 'characterStudio3d.options.hairShape.curly'},
];

const POSTURE_PRESETS = [
  {value: 'neutral', translationKey: 'characterStudio3d.options.posture.neutral'},
  {value: 'confident', translationKey: 'characterStudio3d.options.posture.confident'},
  {value: 'relaxed', translationKey: 'characterStudio3d.options.posture.relaxed'},
  {value: 'dynamic', translationKey: 'characterStudio3d.options.posture.dynamic'},
];

// Compact slider builder so the tree stays readable.
const morphSlider = (id: string, translationKey: string, hintTranslationKey?: string): EditableParameter => ({
  id,
  translationKey,
  type: 'morph',
  ui: 'slider',
  defaultValue: 0,
  min: -1,
  max: 1,
  step: 0.05,
  hintTranslationKey,
});

const boneSlider = (id: string, translationKey: string, hintTranslationKey?: string): EditableParameter => ({
  id,
  translationKey,
  type: 'bone',
  ui: 'slider',
  defaultValue: 0,
  min: -1,
  max: 1,
  step: 0.05,
  hintTranslationKey,
});

const dragSlider = (id: string, translationKey: string, type: ParameterType = 'morph'): EditableParameter => ({
  id,
  translationKey,
  type,
  ui: 'drag',
  defaultValue: 0,
  min: -1,
  max: 1,
  step: 0.05,
  hintTranslationKey: 'characterStudio3d.parameters.dragHint',
});

const swatch = (
  id: string,
  translationKey: string,
  options: Array<{value: string; translationKey: string}>,
  defaultValue: string,
): EditableParameter => ({
  id,
  translationKey,
  type: 'material',
  ui: 'swatch',
  defaultValue,
  options,
});

const preset = (
  id: string,
  translationKey: string,
  options: Array<{value: string; translationKey: string}>,
  defaultValue: string,
  type: ParameterType = 'asset',
): EditableParameter => ({
  id,
  translationKey,
  type,
  ui: 'preset',
  defaultValue,
  options,
});

const toggle = (
  id: string,
  translationKey: string,
  type: ParameterType = 'material',
  defaultValue = false,
): EditableParameter => ({
  id,
  translationKey,
  type,
  ui: 'toggle',
  defaultValue,
});

// ─────────── The tree ───────────
export const ZONE_TREE: EditableZone[] = [
  // ───── Body ─────
  {
    id: 'body',
    translationKey: 'characterStudio3d.zones.body',
    group: 'body',
    level: 1,
    children: [
      {
        id: 'head_neck',
        translationKey: 'characterStudio3d.zones.headNeck',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          morphSlider('headSize', 'characterStudio3d.parameters.headSize'),
          morphSlider('neckLength', 'characterStudio3d.parameters.neckLength'),
          morphSlider('neckThickness', 'characterStudio3d.parameters.neckThickness'),
        ],
      },
      {
        id: 'shoulders',
        translationKey: 'characterStudio3d.zones.shoulders',
        group: 'body',
        level: 2,
        parentId: 'body',
        isSymmetric: true,
        parameters: [
          dragSlider('shouldersWidth', 'characterStudio3d.parameters.shouldersWidth'),
          boneSlider('shouldersSlope', 'characterStudio3d.parameters.shouldersSlope'),
          boneSlider('shouldersHeight', 'characterStudio3d.parameters.shouldersHeight'),
        ],
      },
      {
        id: 'torso',
        translationKey: 'characterStudio3d.zones.torso',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          morphSlider('chestWidth', 'characterStudio3d.parameters.chestWidth'),
          morphSlider('chestDepth', 'characterStudio3d.parameters.chestDepth'),
          morphSlider('backWidth', 'characterStudio3d.parameters.backWidth'),
        ],
      },
      {
        id: 'waist',
        translationKey: 'characterStudio3d.zones.waist',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          dragSlider('waistWidth', 'characterStudio3d.parameters.waistWidth'),
          morphSlider('torsoCurve', 'characterStudio3d.parameters.torsoCurve'),
        ],
      },
      {
        id: 'hips',
        translationKey: 'characterStudio3d.zones.hips',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          dragSlider('hipsWidth', 'characterStudio3d.parameters.hipsWidth'),
          morphSlider('hipsShape', 'characterStudio3d.parameters.hipsShape'),
        ],
      },
      {
        id: 'arms',
        translationKey: 'characterStudio3d.zones.arms',
        group: 'body',
        level: 2,
        parentId: 'body',
        isSymmetric: true,
        children: [
          {
            id: 'upper_arm',
            translationKey: 'characterStudio3d.zones.upperArm',
            group: 'body',
            level: 3,
            parentId: 'arms',
            isSymmetric: true,
            parameters: [
              dragSlider('volume', 'characterStudio3d.parameters.volume'),
              morphSlider('definition', 'characterStudio3d.parameters.definition'),
              boneSlider('length', 'characterStudio3d.parameters.length'),
            ],
          },
          {
            id: 'forearm',
            translationKey: 'characterStudio3d.zones.forearm',
            group: 'body',
            level: 3,
            parentId: 'arms',
            isSymmetric: true,
            parameters: [
              morphSlider('thickness', 'characterStudio3d.parameters.thickness'),
              boneSlider('length', 'characterStudio3d.parameters.length'),
            ],
          },
          {
            id: 'hand',
            translationKey: 'characterStudio3d.zones.hand',
            group: 'body',
            level: 3,
            parentId: 'arms',
            isSymmetric: true,
            parameters: [
              morphSlider('size', 'characterStudio3d.parameters.handSize'),
              morphSlider('fingerLength', 'characterStudio3d.parameters.fingerLength'),
            ],
          },
        ],
      },
      {
        id: 'legs',
        translationKey: 'characterStudio3d.zones.legs',
        group: 'body',
        level: 2,
        parentId: 'body',
        isSymmetric: true,
        children: [
          {
            id: 'thigh',
            translationKey: 'characterStudio3d.zones.thigh',
            group: 'body',
            level: 3,
            parentId: 'legs',
            isSymmetric: true,
            parameters: [
              dragSlider('thighVolume', 'characterStudio3d.parameters.volume'),
              boneSlider('thighLength', 'characterStudio3d.parameters.length'),
            ],
          },
          {
            id: 'calf',
            translationKey: 'characterStudio3d.zones.calf',
            group: 'body',
            level: 3,
            parentId: 'legs',
            isSymmetric: true,
            parameters: [
              morphSlider('calfVolume', 'characterStudio3d.parameters.volume'),
              boneSlider('calfLength', 'characterStudio3d.parameters.length'),
            ],
          },
          {
            id: 'foot',
            translationKey: 'characterStudio3d.zones.foot',
            group: 'body',
            level: 3,
            parentId: 'legs',
            isSymmetric: true,
            parameters: [
              morphSlider('footSize', 'characterStudio3d.parameters.footSize'),
            ],
          },
        ],
      },
    ],
  },

  // ───── Face ─────
  {
    id: 'face',
    translationKey: 'characterStudio3d.zones.face',
    group: 'face',
    level: 1,
    children: [
      {
        id: 'face_shape',
        translationKey: 'characterStudio3d.zones.faceShape',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          preset(
            'shape',
            'characterStudio3d.parameters.shape',
            [
              {value: 'oval', translationKey: 'characterStudio3d.options.faceShape.oval'},
              {value: 'round', translationKey: 'characterStudio3d.options.faceShape.round'},
              {value: 'square', translationKey: 'characterStudio3d.options.faceShape.square'},
              {value: 'heart', translationKey: 'characterStudio3d.options.faceShape.heart'},
            ],
            'oval',
            'morph',
          ),
          morphSlider('cheekbones', 'characterStudio3d.parameters.cheekbones'),
          morphSlider('faceDepth', 'characterStudio3d.parameters.faceDepth'),
        ],
      },
      {
        id: 'eyes',
        translationKey: 'characterStudio3d.zones.eyes',
        group: 'face',
        level: 2,
        parentId: 'face',
        isSymmetric: true,
        parameters: [
          morphSlider('eyeSize', 'characterStudio3d.parameters.eyeSize'),
          morphSlider('eyeDistance', 'characterStudio3d.parameters.distance'),
          morphSlider('eyeTilt', 'characterStudio3d.parameters.tilt'),
          swatch('eyeColor', 'characterStudio3d.parameters.color', EYE_COLORS, '#3a6ca8'),
        ],
      },
      {
        id: 'brows',
        translationKey: 'characterStudio3d.zones.brows',
        group: 'face',
        level: 2,
        parentId: 'face',
        isSymmetric: true,
        parameters: [
          morphSlider('browHeight', 'characterStudio3d.parameters.height'),
          morphSlider('browAngle', 'characterStudio3d.parameters.tilt'),
          morphSlider('browThickness', 'characterStudio3d.parameters.thickness'),
        ],
      },
      {
        id: 'nose',
        translationKey: 'characterStudio3d.zones.nose',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          morphSlider('noseLength', 'characterStudio3d.parameters.length'),
          morphSlider('noseWidth', 'characterStudio3d.parameters.width'),
          morphSlider('noseTip', 'characterStudio3d.parameters.noseTip'),
          morphSlider('bridgeHeight', 'characterStudio3d.parameters.bridgeHeight'),
        ],
      },
      {
        id: 'mouth',
        translationKey: 'characterStudio3d.zones.mouth',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          morphSlider('mouthWidth', 'characterStudio3d.parameters.mouthWidth'),
          morphSlider('upperLip', 'characterStudio3d.parameters.upperLip'),
          morphSlider('lowerLip', 'characterStudio3d.parameters.lowerLip'),
          morphSlider('cornerLift', 'characterStudio3d.parameters.cornerLift'),
        ],
      },
      {
        id: 'jaw_chin',
        translationKey: 'characterStudio3d.zones.jawChin',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          morphSlider('jawWidth', 'characterStudio3d.parameters.jawWidth'),
          morphSlider('chinLength', 'characterStudio3d.parameters.chinLength'),
          morphSlider('chinShape', 'characterStudio3d.parameters.chinShape'),
        ],
      },
      {
        id: 'ears',
        translationKey: 'characterStudio3d.zones.ears',
        group: 'face',
        level: 2,
        parentId: 'face',
        isSymmetric: true,
        parameters: [
          morphSlider('earSize', 'characterStudio3d.parameters.size'),
          morphSlider('earAngle', 'characterStudio3d.parameters.tilt'),
        ],
      },
    ],
  },

  // ───── Hair ─────
  {
    id: 'hair',
    translationKey: 'characterStudio3d.zones.hair',
    group: 'hair',
    level: 1,
    parameters: [
      preset('hairStyle', 'characterStudio3d.parameters.hairStyle', HAIR_STYLES, 'default'),
      swatch('hairColor', 'characterStudio3d.parameters.hairColor', HAIR_COLORS, '#1E1A18'),
      {
        id: 'hairLength',
        translationKey: 'characterStudio3d.parameters.length',
        type: 'asset',
        ui: 'slider',
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
      },
      morphSlider('hairVolume', 'characterStudio3d.parameters.volume'),
      preset('hairShape', 'characterStudio3d.parameters.shape', HAIR_PRESETS, 'wavy'),
    ],
  },

  // ───── Skin ─────
  {
    id: 'skin',
    translationKey: 'characterStudio3d.zones.skin',
    group: 'skin',
    level: 1,
    children: [
      {
        id: 'skin_color',
        translationKey: 'characterStudio3d.zones.skinColor',
        group: 'skin',
        level: 2,
        parentId: 'skin',
        parameters: [
          swatch('skinTone', 'characterStudio3d.parameters.skinTone', SKIN_TONES, '#dac0a3'),
          morphSlider('skinSaturation', 'characterStudio3d.parameters.saturation'),
        ],
      },
      {
        id: 'skin_details',
        translationKey: 'characterStudio3d.zones.skinDetails',
        group: 'skin',
        level: 2,
        parentId: 'skin',
        parameters: [
          toggle('freckles', 'characterStudio3d.parameters.freckles', 'texture'),
          toggle('moles', 'characterStudio3d.parameters.moles', 'texture'),
          toggle('scars', 'characterStudio3d.parameters.scars', 'texture'),
          toggle('blush', 'characterStudio3d.parameters.blush', 'texture'),
        ],
      },
    ],
  },

  // ───── Clothing (A5) ─────
  // A basic top + bottom garment layered on the body. In morph mode (MorphRig)
  // each garment is a thickened, band-masked copy of the SMPL-X body surface
  // that tracks the shape morphs; in the procedural engine these zones are
  // inert (no garment meshes) — both read the same {zone:{param}} doc, so
  // autofit/save/undo need no special casing. 'enabled' defaults ON so a fresh
  // character is dressed; 'color' is a fixed fabric palette.
  {
    id: 'clothing',
    translationKey: 'characterStudio3d.zones.clothing',
    group: 'clothing',
    level: 1,
    children: [
      {
        id: 'clothing_top',
        translationKey: 'characterStudio3d.zones.clothingTop',
        group: 'clothing',
        level: 2,
        parentId: 'clothing',
        parameters: [
          toggle('enabled', 'characterStudio3d.parameters.wearTop', 'asset', true),
          preset('style', 'characterStudio3d.parameters.shape', CLOTHING_TOP_STYLES, 'tshirt'),
          swatch('color', 'characterStudio3d.parameters.color', CLOTHING_COLORS, '#3b5266'),
        ],
      },
      {
        id: 'clothing_bottom',
        translationKey: 'characterStudio3d.zones.clothingBottom',
        group: 'clothing',
        level: 2,
        parentId: 'clothing',
        parameters: [
          toggle('enabled', 'characterStudio3d.parameters.wearBottom', 'asset', true),
          preset('style', 'characterStudio3d.parameters.shape', CLOTHING_BOTTOM_STYLES, 'shorts'),
          swatch('color', 'characterStudio3d.parameters.color', CLOTHING_COLORS, '#2d2d33'),
        ],
      },
    ],
  },

  // ───── Pose ─────
  {
    id: 'pose',
    translationKey: 'characterStudio3d.zones.pose',
    group: 'pose',
    level: 1,
    children: [
      {
        id: 'posture',
        translationKey: 'characterStudio3d.zones.posture',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        parameters: [
          preset('posturePreset', 'characterStudio3d.parameters.type', POSTURE_PRESETS, 'neutral', 'pose'),
          boneSlider('postureStraightness', 'characterStudio3d.parameters.postureStraightness'),
          boneSlider('shouldersForward', 'characterStudio3d.parameters.shouldersForward'),
          boneSlider('torsoTilt', 'characterStudio3d.parameters.torsoTilt'),
        ],
      },
      {
        id: 'head_pose',
        translationKey: 'characterStudio3d.zones.head',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        parameters: [
          boneSlider('headTilt', 'characterStudio3d.parameters.headTilt'),
          boneSlider('headTurn', 'characterStudio3d.parameters.headTurn'),
        ],
      },
      {
        id: 'arms_pose',
        translationKey: 'characterStudio3d.zones.arms',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        isSymmetric: true,
        parameters: [
          boneSlider('armsRaise', 'characterStudio3d.parameters.armsRaise'),
          boneSlider('armsForward', 'characterStudio3d.parameters.armsForward'),
        ],
      },
      {
        id: 'expression',
        translationKey: 'characterStudio3d.zones.expression',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        parameters: [
          {
            id: 'smile',
            translationKey: 'characterStudio3d.parameters.smile',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
          {
            id: 'squint',
            translationKey: 'characterStudio3d.parameters.squint',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
          {
            id: 'browRaise',
            translationKey: 'characterStudio3d.parameters.browRaise',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
          {
            id: 'mouthOpen',
            translationKey: 'characterStudio3d.parameters.mouthOpen',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
        ],
      },
    ],
  },
];

// ─────────── Lookups ───────────
// Flat index keyed by zone id. Built once at module load.
export const ZONE_INDEX: Record<string, EditableZone> = (() => {
  const out: Record<string, EditableZone> = {};
  const visit = (zone: EditableZone) => {
    out[zone.id] = zone;
    zone.children?.forEach(visit);
  };
  ZONE_TREE.forEach(visit);
  return out;
})();

export function findZone(zoneId: string | null): EditableZone | null {
  if (!zoneId) return null;
  return ZONE_INDEX[zoneId] ?? null;
}

// Returns the chain from the top-level group root → ... → target zone.
export function getAncestors(zoneId: string | null): EditableZone[] {
  const zone = findZone(zoneId);
  if (!zone) return [];
  const chain: EditableZone[] = [zone];
  let cursor = zone;
  while (cursor.parentId) {
    const parent = ZONE_INDEX[cursor.parentId];
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent;
  }
  return chain;
}

export function getTopLevelGroup(zoneId: string | null): ZoneGroup | null {
  const zone = findZone(zoneId);
  return zone?.group ?? null;
}

export function isZoneSymmetric(zoneId: string | null): boolean {
  return !!findZone(zoneId)?.isSymmetric;
}

// Build the initial parameter values map: { [zoneId]: { [paramId]: defaultValue } }
export function buildInitialZoneParams(): Record<string, Record<string, number | string | boolean>> {
  const out: Record<string, Record<string, number | string | boolean>> = {};
  const visit = (zone: EditableZone) => {
    if (zone.parameters?.length) {
      out[zone.id] = Object.fromEntries(zone.parameters.map((p) => [p.id, p.defaultValue]));
    }
    zone.children?.forEach(visit);
  };
  ZONE_TREE.forEach(visit);
  return out;
}

// True if the zone has any parameter that maps to a material/texture color (used to
// decide whether the bottom bar's color block is visible/enabled).
export function zoneHasColorParameter(zoneId: string | null): boolean {
  const zone = findZone(zoneId);
  if (!zone?.parameters) return false;
  return zone.parameters.some((p) => p.ui === 'swatch');
}
