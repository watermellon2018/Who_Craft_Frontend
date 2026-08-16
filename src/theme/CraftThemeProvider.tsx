import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

import {
  applyCraftTheme,
  CRAFT_THEME_CHANGED_EVENT,
  CRAFT_THEME_STORAGE_KEY,
  DEFAULT_CRAFT_THEME,
  isCraftTheme,
  readStoredCraftTheme,
} from './craftTheme';
import type {CraftTheme} from './craftTheme';

interface CraftThemeContextValue {
  setTheme: (theme: CraftTheme) => void;
  theme: CraftTheme;
}

const defaultContext: CraftThemeContextValue = {
  setTheme: applyCraftTheme,
  theme: DEFAULT_CRAFT_THEME,
};

const CraftThemeContext = createContext<CraftThemeContextValue>(defaultContext);

export function CraftThemeProvider({children}: {children: React.ReactNode}) {
  const [theme, setThemeState] = useState<CraftTheme>(readStoredCraftTheme);

  const setTheme = useCallback((nextTheme: CraftTheme) => {
    applyCraftTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{theme?: string}>).detail;
      const nextTheme = detail?.theme ?? null;
      if (isCraftTheme(nextTheme)) {
        setThemeState(nextTheme);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CRAFT_THEME_STORAGE_KEY || !isCraftTheme(event.newValue)) return;
      document.documentElement.dataset.craftTheme = event.newValue;
      document.documentElement.style.colorScheme = event.newValue === 'light' ? 'light' : 'dark';
      setThemeState(event.newValue);
    };

    window.addEventListener(CRAFT_THEME_CHANGED_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CRAFT_THEME_CHANGED_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const value = useMemo(() => ({setTheme, theme}), [setTheme, theme]);
  return <CraftThemeContext.Provider value={value}>{children}</CraftThemeContext.Provider>;
}

export function useCraftTheme() {
  return useContext(CraftThemeContext);
}
