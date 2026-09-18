import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from './locales/ru.json';
import en from './locales/en.json';
import {characterStudioResources} from './resources/characterStudio';
import {characterStudio3dResources} from './resources/characterStudio3d';
import {posterResources} from './resources/poster';
import {profileShellResources} from './resources/profileShell';
import {projectResources} from './resources/project';
import {scriptResources} from './resources/script';

export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ru';

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string'
    && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

type TranslationTree = Record<string, unknown>;

function isTranslationTree(value: unknown): value is TranslationTree {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeTranslations(...sources: TranslationTree[]): TranslationTree {
  const result: TranslationTree = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const current = result[key];
      result[key] = isTranslationTree(current) && isTranslationTree(value)
        ? mergeTranslations(current, value)
        : value;
    }
  }

  return result;
}

export const translationResources = {
  ru: mergeTranslations(
    ru,
    projectResources.ru,
    scriptResources.ru,
    characterStudioResources.ru,
    characterStudio3dResources.ru,
    profileShellResources.ru,
    posterResources.ru,
  ),
  en: mergeTranslations(
    en,
    projectResources.en,
    scriptResources.en,
    characterStudioResources.en,
    characterStudio3dResources.en,
    profileShellResources.en,
    posterResources.en,
  ),
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: {translation: translationResources.ru},
      en: {translation: translationResources.en},
    },
    // Never leak Russian fallback copy into an explicitly English interface.
    // Unsupported browser locales still start in the product default language.
    fallbackLng: (languageCode) => (
      languageCode?.toLowerCase().startsWith('en') ? ['en'] : [DEFAULT_LANGUAGE]
    ),
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    interpolation: {
      // React already escapes — disable i18next's escaping to avoid double encoding.
      escapeValue: false,
    },
    detection: {
      // Persist explicit choice across reloads; profile API call still happens
      // on save so the server stays the source of truth across devices.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'craft.lang',
    },
    returnNull: false,
  });

function updateDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

updateDocumentLanguage(i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE);
i18n.on('languageChanged', updateDocumentLanguage);

export default i18n;
