import {
  applyCraftTheme,
  CRAFT_THEME_STORAGE_KEY,
  initializeCraftTheme,
  readStoredCraftTheme,
} from './craftTheme';

describe('craft theme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.craftTheme;
    document.documentElement.style.colorScheme = '';
  });

  it('uses blue by default and restores a saved theme before render', () => {
    expect(readStoredCraftTheme()).toBe('blue');

    window.localStorage.setItem(CRAFT_THEME_STORAGE_KEY, 'dark');
    expect(initializeCraftTheme()).toBe('dark');
    expect(document.documentElement.dataset.craftTheme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('applies and persists an explicit theme', () => {
    applyCraftTheme('light');

    expect(window.localStorage.getItem(CRAFT_THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.craftTheme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
