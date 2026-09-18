import {ZONE_TREE} from '../../modules/character-studio/components/character3d/zones';
import {characterStudio3dResources} from './characterStudio3d';

function flatten(value: unknown, prefix = '', result = new Set<string>()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;

  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === 'string') result.add(path);
    else flatten(nested, path, result);
  }

  return result;
}

describe('Character Studio 3D translations', () => {
  it.each(['ru', 'en'] as const)('contains every zone, parameter and option key in %s', (language) => {
    const availableKeys = flatten(characterStudio3dResources[language]);
    const usedKeys = new Set<string>();

    const visit = (zone: (typeof ZONE_TREE)[number]) => {
      usedKeys.add(zone.translationKey);
      for (const parameter of zone.parameters ?? []) {
        usedKeys.add(parameter.translationKey);
        if (parameter.hintTranslationKey) usedKeys.add(parameter.hintTranslationKey);
        for (const option of parameter.options ?? []) usedKeys.add(option.translationKey);
      }
      for (const child of zone.children ?? []) visit(child);
    };

    for (const zone of ZONE_TREE) visit(zone);

    expect(Array.from(usedKeys).filter((key) => !availableKeys.has(key))).toEqual([]);
  });
});
