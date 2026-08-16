export const CRAFT_THEMES = ['light', 'blue', 'dark'] as const;

export type CraftTheme = (typeof CRAFT_THEMES)[number];

export const DEFAULT_CRAFT_THEME: CraftTheme = 'blue';
export const CRAFT_THEME_STORAGE_KEY = 'craft.theme';
export const CRAFT_THEME_CHANGED_EVENT = 'craft-theme-changed';

interface CraftThemeChangedDetail {
  theme: CraftTheme;
}

export function isCraftTheme(value: string | null): value is CraftTheme {
  return CRAFT_THEMES.some((theme) => theme === value);
}

export function readStoredCraftTheme(): CraftTheme {
  try {
    const storedTheme = window.localStorage.getItem(CRAFT_THEME_STORAGE_KEY);
    return isCraftTheme(storedTheme) ? storedTheme : DEFAULT_CRAFT_THEME;
  } catch {
    return DEFAULT_CRAFT_THEME;
  }
}

function updateDocumentTheme(theme: CraftTheme) {
  const root = document.documentElement;
  root.dataset.craftTheme = theme;
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}

export function initializeCraftTheme(): CraftTheme {
  const theme = readStoredCraftTheme();
  updateDocumentTheme(theme);
  return theme;
}

export function applyCraftTheme(theme: CraftTheme) {
  const root = document.documentElement;
  root.classList.add('craft-theme-switching');
  updateDocumentTheme(theme);

  try {
    window.localStorage.setItem(CRAFT_THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private mode; the active tab still keeps the theme.
  }

  window.dispatchEvent(new CustomEvent<CraftThemeChangedDetail>(
    CRAFT_THEME_CHANGED_EVENT,
    {detail: {theme}},
  ));

  const restoreTransitions = () => root.classList.remove('craft-theme-switching');
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(restoreTransitions);
  } else {
    window.setTimeout(restoreTransitions, 0);
  }
}
