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
  label: string;
  type: ParameterType;
  ui: ParameterUi;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  // For swatch/preset UIs.
  options?: Array<{value: string; label: string; preview?: string}>;
  // Optional hint shown under the control (e.g. "Можно тянуть зону на модели").
  hint?: string;
}

export type ZoneGroup = 'body' | 'face' | 'hair' | 'skin' | 'pose' | 'clothing';

export interface EditableZone {
  id: string;
  label: string;
  group: ZoneGroup;
  level: 1 | 2 | 3;
  parentId?: string;
  isSymmetric?: boolean;
  children?: EditableZone[];
  parameters?: EditableParameter[];
}

// ─────────── Swatch palettes ───────────
const HAIR_COLORS = [
  {value: '#0c0a09', label: 'Угольный'},
  {value: '#1E1A18', label: 'Тёмный шоколад'},
  {value: '#3a2a1f', label: 'Каштан'},
  {value: '#7a4a2a', label: 'Светло-каштановый'},
  {value: '#c98257', label: 'Клубничный блонд'},
  {value: '#c4a06a', label: 'Блонд'},
];

const EYE_COLORS = [
  {value: '#3a6ca8', label: 'Стальной'},
  {value: '#244a2a', label: 'Изумруд'},
  {value: '#7a4a1a', label: 'Карий'},
  {value: '#a45a8a', label: 'Аметист'},
  {value: '#6ac7d9', label: 'Ледяной'},
];

const SKIN_TONES = [
  {value: '#f0d8c0', label: 'Светлая'},
  {value: '#dac0a3', label: 'Тёплая'},
  {value: '#b58a6a', label: 'Загар'},
  {value: '#8a6a55', label: 'Смуглая'},
  {value: '#5a3a2a', label: 'Тёмная'},
];

// Garment fabric colors for the A5 clothing layer (top / bottom). A fixed
// palette — like every other swatch here, clothing is analytic/parametric, not
// AI-generated, so the "no generative nets in the core" invariant holds.
const CLOTHING_COLORS = [
  {value: '#3b5266', label: 'Синий'},
  {value: '#6b3b3b', label: 'Бордовый'},
  {value: '#2d2d33', label: 'Графит'},
  {value: '#3b5a3b', label: 'Зелёный'},
  {value: '#c9b99b', label: 'Бежевый'},
];

const CLOTHING_TOP_STYLES = [
  {value: 'tshirt', label: 'Футболка'},
  {value: 'sleeveless', label: 'Без рукавов'},
  {value: 'long_sleeve', label: 'Длинный рукав'},
];

const CLOTHING_BOTTOM_STYLES = [
  {value: 'shorts', label: 'Шорты'},
  {value: 'trousers', label: 'Брюки'},
];

// hairStyle picks the SILHOUETTE (built as distinct geometry in rig.ts);
// hairShape below is the strand TEXTURE (straight/wavy/curly) layered on top.
// 'none' is a bald head — rig.ts builds no hair meshes and length/volume are
// no-ops for it. Unknown saved values degrade to 'default' in the rig, so
// older characters (which had no hairStyle at all) keep rendering.
const HAIR_STYLES = [
  {value: 'default', label: 'Обычные'},
  {value: 'long', label: 'Длинные'},
  {value: 'bob', label: 'Каре'},
  {value: 'ponytail', label: 'Хвост'},
  {value: 'bun', label: 'Пучок'},
  {value: 'afro', label: 'Афро'},
  {value: 'none', label: 'Без волос'},
];

// «Короткие» (buzz) was removed on purpose: it ignored hairLength and made
// the length slider look broken — short hair is just a low hairLength value.
const HAIR_PRESETS = [
  {value: 'straight', label: 'Прямые'},
  {value: 'wavy', label: 'Волнистые'},
  {value: 'curly', label: 'Кудрявые'},
];

const POSTURE_PRESETS = [
  {value: 'neutral', label: 'Нейтральная'},
  {value: 'confident', label: 'Уверенная'},
  {value: 'relaxed', label: 'Расслабленная'},
  {value: 'dynamic', label: 'Динамичная'},
];

// Compact slider builder so the tree stays readable.
const morphSlider = (id: string, label: string, hint?: string): EditableParameter => ({
  id,
  label,
  type: 'morph',
  ui: 'slider',
  defaultValue: 0,
  min: -1,
  max: 1,
  step: 0.05,
  hint,
});

const boneSlider = (id: string, label: string, hint?: string): EditableParameter => ({
  id,
  label,
  type: 'bone',
  ui: 'slider',
  defaultValue: 0,
  min: -1,
  max: 1,
  step: 0.05,
  hint,
});

const dragSlider = (id: string, label: string, type: ParameterType = 'morph'): EditableParameter => ({
  id,
  label,
  type,
  ui: 'drag',
  defaultValue: 0,
  min: -1,
  max: 1,
  step: 0.05,
  hint: 'Можно тянуть зону на модели',
});

const swatch = (
  id: string,
  label: string,
  options: Array<{value: string; label: string}>,
  defaultValue: string,
): EditableParameter => ({
  id,
  label,
  type: 'material',
  ui: 'swatch',
  defaultValue,
  options,
});

const preset = (
  id: string,
  label: string,
  options: Array<{value: string; label: string}>,
  defaultValue: string,
  type: ParameterType = 'asset',
): EditableParameter => ({
  id,
  label,
  type,
  ui: 'preset',
  defaultValue,
  options,
});

const toggle = (
  id: string,
  label: string,
  type: ParameterType = 'material',
  defaultValue = false,
): EditableParameter => ({
  id,
  label,
  type,
  ui: 'toggle',
  defaultValue,
});

// ─────────── The tree ───────────
export const ZONE_TREE: EditableZone[] = [
  // ───── Body ─────
  {
    id: 'body',
    label: 'Тело',
    group: 'body',
    level: 1,
    children: [
      {
        id: 'head_neck',
        label: 'Голова и шея',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          morphSlider('headSize', 'Размер головы'),
          morphSlider('neckLength', 'Длина шеи'),
          morphSlider('neckThickness', 'Толщина шеи'),
        ],
      },
      {
        id: 'shoulders',
        label: 'Плечи',
        group: 'body',
        level: 2,
        parentId: 'body',
        isSymmetric: true,
        parameters: [
          dragSlider('shouldersWidth', 'Ширина плеч'),
          boneSlider('shouldersSlope', 'Наклон плеч'),
          boneSlider('shouldersHeight', 'Высота плеч'),
        ],
      },
      {
        id: 'torso',
        label: 'Торс',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          morphSlider('chestWidth', 'Ширина груди'),
          morphSlider('chestDepth', 'Глубина груди'),
          morphSlider('backWidth', 'Ширина спины'),
        ],
      },
      {
        id: 'waist',
        label: 'Талия',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          dragSlider('waistWidth', 'Ширина талии'),
          morphSlider('torsoCurve', 'Силуэт'),
        ],
      },
      {
        id: 'hips',
        label: 'Бёдра',
        group: 'body',
        level: 2,
        parentId: 'body',
        parameters: [
          dragSlider('hipsWidth', 'Ширина бёдер'),
          morphSlider('hipsShape', 'Форма бёдер'),
        ],
      },
      {
        id: 'arms',
        label: 'Руки',
        group: 'body',
        level: 2,
        parentId: 'body',
        isSymmetric: true,
        children: [
          {
            id: 'upper_arm',
            label: 'Верх руки',
            group: 'body',
            level: 3,
            parentId: 'arms',
            isSymmetric: true,
            parameters: [
              dragSlider('volume', 'Объём'),
              morphSlider('definition', 'Рельеф'),
              boneSlider('length', 'Длина'),
            ],
          },
          {
            id: 'forearm',
            label: 'Предплечье',
            group: 'body',
            level: 3,
            parentId: 'arms',
            isSymmetric: true,
            parameters: [
              morphSlider('thickness', 'Толщина'),
              boneSlider('length', 'Длина'),
            ],
          },
          {
            id: 'hand',
            label: 'Кисть',
            group: 'body',
            level: 3,
            parentId: 'arms',
            isSymmetric: true,
            parameters: [
              morphSlider('size', 'Размер кисти'),
              morphSlider('fingerLength', 'Длина пальцев'),
            ],
          },
        ],
      },
      {
        id: 'legs',
        label: 'Ноги',
        group: 'body',
        level: 2,
        parentId: 'body',
        isSymmetric: true,
        children: [
          {
            id: 'thigh',
            label: 'Бедро',
            group: 'body',
            level: 3,
            parentId: 'legs',
            isSymmetric: true,
            parameters: [
              dragSlider('thighVolume', 'Объём'),
              boneSlider('thighLength', 'Длина'),
            ],
          },
          {
            id: 'calf',
            label: 'Икра',
            group: 'body',
            level: 3,
            parentId: 'legs',
            isSymmetric: true,
            parameters: [
              morphSlider('calfVolume', 'Объём'),
              boneSlider('calfLength', 'Длина'),
            ],
          },
          {
            id: 'foot',
            label: 'Стопа',
            group: 'body',
            level: 3,
            parentId: 'legs',
            isSymmetric: true,
            parameters: [
              morphSlider('footSize', 'Размер стопы'),
            ],
          },
        ],
      },
    ],
  },

  // ───── Face ─────
  {
    id: 'face',
    label: 'Лицо',
    group: 'face',
    level: 1,
    children: [
      {
        id: 'face_shape',
        label: 'Форма лица',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          preset(
            'shape',
            'Форма',
            [
              {value: 'oval', label: 'Овал'},
              {value: 'round', label: 'Круг'},
              {value: 'square', label: 'Квадрат'},
              {value: 'heart', label: 'Сердце'},
            ],
            'oval',
            'morph',
          ),
          morphSlider('cheekbones', 'Скулы'),
          morphSlider('faceDepth', 'Глубина лица'),
        ],
      },
      {
        id: 'eyes',
        label: 'Глаза',
        group: 'face',
        level: 2,
        parentId: 'face',
        isSymmetric: true,
        parameters: [
          morphSlider('eyeSize', 'Размер глаз'),
          morphSlider('eyeDistance', 'Расстояние'),
          morphSlider('eyeTilt', 'Наклон'),
          swatch('eyeColor', 'Цвет', EYE_COLORS, '#3a6ca8'),
        ],
      },
      {
        id: 'brows',
        label: 'Брови',
        group: 'face',
        level: 2,
        parentId: 'face',
        isSymmetric: true,
        parameters: [
          morphSlider('browHeight', 'Высота'),
          morphSlider('browAngle', 'Наклон'),
          morphSlider('browThickness', 'Толщина'),
        ],
      },
      {
        id: 'nose',
        label: 'Нос',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          morphSlider('noseLength', 'Длина'),
          morphSlider('noseWidth', 'Ширина'),
          morphSlider('noseTip', 'Кончик носа'),
          morphSlider('bridgeHeight', 'Переносица'),
        ],
      },
      {
        id: 'mouth',
        label: 'Рот и губы',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          morphSlider('mouthWidth', 'Ширина рта'),
          morphSlider('upperLip', 'Верхняя губа'),
          morphSlider('lowerLip', 'Нижняя губа'),
          morphSlider('cornerLift', 'Уголки губ'),
        ],
      },
      {
        id: 'jaw_chin',
        label: 'Челюсть и подбородок',
        group: 'face',
        level: 2,
        parentId: 'face',
        parameters: [
          morphSlider('jawWidth', 'Ширина челюсти'),
          morphSlider('chinLength', 'Длина подбородка'),
          morphSlider('chinShape', 'Форма подбородка'),
        ],
      },
      {
        id: 'ears',
        label: 'Уши',
        group: 'face',
        level: 2,
        parentId: 'face',
        isSymmetric: true,
        parameters: [
          morphSlider('earSize', 'Размер'),
          morphSlider('earAngle', 'Наклон'),
        ],
      },
    ],
  },

  // ───── Hair ─────
  {
    id: 'hair',
    label: 'Волосы',
    group: 'hair',
    level: 1,
    parameters: [
      preset('hairStyle', 'Причёска', HAIR_STYLES, 'default'),
      swatch('hairColor', 'Цвет волос', HAIR_COLORS, '#1E1A18'),
      {
        id: 'hairLength',
        label: 'Длина',
        type: 'asset',
        ui: 'slider',
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
      },
      morphSlider('hairVolume', 'Объём'),
      preset('hairShape', 'Форма', HAIR_PRESETS, 'wavy'),
    ],
  },

  // ───── Skin ─────
  {
    id: 'skin',
    label: 'Кожа',
    group: 'skin',
    level: 1,
    children: [
      {
        id: 'skin_color',
        label: 'Цвет кожи',
        group: 'skin',
        level: 2,
        parentId: 'skin',
        parameters: [
          swatch('skinTone', 'Тон кожи', SKIN_TONES, '#dac0a3'),
          morphSlider('skinSaturation', 'Насыщенность'),
        ],
      },
      {
        id: 'skin_details',
        label: 'Детали кожи',
        group: 'skin',
        level: 2,
        parentId: 'skin',
        parameters: [
          toggle('freckles', 'Веснушки', 'texture'),
          toggle('moles', 'Родинки', 'texture'),
          toggle('scars', 'Шрамы', 'texture'),
          toggle('blush', 'Румянец', 'texture'),
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
    label: 'Одежда',
    group: 'clothing',
    level: 1,
    children: [
      {
        id: 'clothing_top',
        label: 'Верх',
        group: 'clothing',
        level: 2,
        parentId: 'clothing',
        parameters: [
          toggle('enabled', 'Надеть верх', 'asset', true),
          preset('style', 'Форма', CLOTHING_TOP_STYLES, 'tshirt'),
          swatch('color', 'Цвет', CLOTHING_COLORS, '#3b5266'),
        ],
      },
      {
        id: 'clothing_bottom',
        label: 'Низ',
        group: 'clothing',
        level: 2,
        parentId: 'clothing',
        parameters: [
          toggle('enabled', 'Надеть низ', 'asset', true),
          preset('style', 'Форма', CLOTHING_BOTTOM_STYLES, 'shorts'),
          swatch('color', 'Цвет', CLOTHING_COLORS, '#2d2d33'),
        ],
      },
    ],
  },

  // ───── Pose ─────
  {
    id: 'pose',
    label: 'Поза',
    group: 'pose',
    level: 1,
    children: [
      {
        id: 'posture',
        label: 'Осанка',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        parameters: [
          preset('posturePreset', 'Тип', POSTURE_PRESETS, 'neutral', 'pose'),
          boneSlider('postureStraightness', 'Прямая / сутулая'),
          boneSlider('shouldersForward', 'Плечи вперёд/назад'),
          boneSlider('torsoTilt', 'Наклон корпуса'),
        ],
      },
      {
        id: 'head_pose',
        label: 'Голова',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        parameters: [
          boneSlider('headTilt', 'Наклон головы'),
          boneSlider('headTurn', 'Поворот головы'),
        ],
      },
      {
        id: 'arms_pose',
        label: 'Руки',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        isSymmetric: true,
        parameters: [
          boneSlider('armsRaise', 'Подъём рук'),
          boneSlider('armsForward', 'Руки вперёд/назад'),
        ],
      },
      {
        id: 'expression',
        label: 'Мимика',
        group: 'pose',
        level: 2,
        parentId: 'pose',
        parameters: [
          {
            id: 'smile',
            label: 'Улыбка',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
          {
            id: 'squint',
            label: 'Прищур',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
          {
            id: 'browRaise',
            label: 'Поднятие бровей',
            type: 'blendshape',
            ui: 'slider',
            defaultValue: 0,
            min: 0,
            max: 1,
            step: 0.05,
          },
          {
            id: 'mouthOpen',
            label: 'Открытость рта',
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
