import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeFallback = 'dark' | 'system';

export type ThemeOptions = {
  fallback?: ThemeFallback;
};

const STORAGE_KEY_AR = 'ar-theme';
const STORAGE_KEY_DC = 'diagram-craft.user-state';

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const getSystemTheme = (): Theme => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

// Read theme from diagram-craft's UserState format
const readDiagramCraftTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DC);
    if (!stored) return null;
    const state = JSON.parse(stored);
    return isTheme(state.themeMode) ? state.themeMode : null;
  } catch {
    return null;
  }
};

const readLegacyTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_AR);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

const readStoredTheme = (): Theme | null => readDiagramCraftTheme() ?? readLegacyTheme();

// Write theme to diagram-craft's UserState format
const writeDiagramCraftTheme = (theme: Theme) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DC);
    const state = stored ? JSON.parse(stored) : {};
    state.themeMode = theme;
    localStorage.setItem(STORAGE_KEY_DC, JSON.stringify(state));
  } catch {
    // ignore
  }
};

// Migrate from old storage if needed
export const migrateTheme = ({ fallback = 'dark' }: ThemeOptions = {}): Theme => {
  const dcTheme = readDiagramCraftTheme();
  if (dcTheme) return dcTheme;

  const arTheme = readLegacyTheme();
  if (arTheme) {
    writeDiagramCraftTheme(arTheme);
    return arTheme;
  }

  return fallback === 'system' ? getSystemTheme() : 'dark';
};

const getInitialTheme = (options: ThemeOptions): Theme => {
  return migrateTheme(options);
};

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const body = document.body;

  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
  } else {
    root.removeAttribute('data-theme');
    root.classList.add('dark');
  }

  const dcClass = theme === 'dark' ? 'dark-theme' : 'light-theme';
  const removeClass = theme === 'dark' ? 'light-theme' : 'dark-theme';

  root.classList.remove(removeClass);
  root.classList.add(dcClass);
  body.classList.remove(removeClass);
  body.classList.add(dcClass);
};

export const useTheme = ({ fallback = 'dark' }: ThemeOptions = {}) => {
  const useSystemFallback = fallback === 'system';
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme({ fallback }));
  const [hasExplicitTheme, setHasExplicitTheme] = useState(
    () => !useSystemFallback || readStoredTheme() !== null
  );

  useEffect(() => {
    applyTheme(theme);
    if (hasExplicitTheme) {
      writeDiagramCraftTheme(theme);
      // Keep backward compatibility
      try {
        localStorage.setItem(STORAGE_KEY_AR, theme);
      } catch {
        // ignore
      }
    }
  }, [hasExplicitTheme, theme]);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_DC && e.key !== STORAGE_KEY_AR) return;

      const storedTheme = readStoredTheme();
      if (storedTheme) {
        setHasExplicitTheme(true);
        if (storedTheme !== theme) setThemeState(storedTheme);
        return;
      }

      if (useSystemFallback) {
        setHasExplicitTheme(false);
        const systemTheme = getSystemTheme();
        if (systemTheme !== theme) setThemeState(systemTheme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme, useSystemFallback]);

  // Follow the operating system while the public catalog has no explicit choice.
  useEffect(() => {
    if (!useSystemFallback || hasExplicitTheme) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (readStoredTheme() !== null) return;
      const systemTheme = getSystemTheme();
      if (systemTheme !== theme) setThemeState(systemTheme);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      mediaQuery.addListener?.(handleSystemThemeChange);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } else {
        mediaQuery.removeListener?.(handleSystemThemeChange);
      }
    };
  }, [hasExplicitTheme, theme, useSystemFallback]);

  // Listen for custom events (same-window sync with embedded diagram-craft)
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ themeMode: Theme }>;
      const newTheme = customEvent.detail?.themeMode;
      if (!isTheme(newTheme)) return;
      setHasExplicitTheme(true);
      if (newTheme !== theme) {
        setThemeState(newTheme);
      }
    };

    window.addEventListener('diagram-craft:theme-change', handleCustomEvent);
    return () => window.removeEventListener('diagram-craft:theme-change', handleCustomEvent);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setHasExplicitTheme(true);
    setThemeState(t);
  }, []);

  return { theme, setTheme } as const;
};
