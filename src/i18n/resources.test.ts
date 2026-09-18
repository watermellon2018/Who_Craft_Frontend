import i18n, {translationResources} from './index';

function flatten(value: unknown, prefix = '', result: Record<string, string> = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === 'string') result[path] = nested;
    else flatten(nested, path, result);
  }
  return result;
}

describe('translation resources', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('does not hide Russian copy behind the English fallback chain', async () => {
    await i18n.changeLanguage('en');

    expect(i18n.t('common.clear')).toBe('Clear');
    expect(i18n.t('missing.translation.key')).toBe('missing.translation.key');
  });

  it('keeps English interface copy free of Cyrillic except language names', () => {
    const allowedCyrillicKeys = new Set(['profile.language.ru']);
    const accidentalRussianCopy = Object.entries(flatten(translationResources.en))
      .filter(([key, value]) => !allowedCyrillicKeys.has(key) && /[А-Яа-яЁё]/.test(value));

    expect(accidentalRussianCopy).toEqual([]);
  });

  it('keeps Russian and English translation keys in sync', () => {
    const pluralBase = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');
    const russianKeys = new Set(Object.keys(flatten(translationResources.ru)).map(pluralBase));
    const englishKeys = new Set(Object.keys(flatten(translationResources.en)).map(pluralBase));

    expect(Array.from(russianKeys).filter((key) => !englishKeys.has(key))).toEqual([]);
    expect(Array.from(englishKeys).filter((key) => !russianKeys.has(key))).toEqual([]);
  });
});
