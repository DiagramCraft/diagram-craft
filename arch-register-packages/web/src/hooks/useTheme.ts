import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY_AR = 'ar-theme';
const STORAGE_KEY_DC = 'diagram-craft.user-state';

// Read theme from diagram-craft's UserState format
const readDiagramCraftTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DC);
    if (!stored) return null;
    const state = JSON.parse(stored);
    if (state.themeMode === 'light' || state.themeMode === 'dark') return state.themeMode;
    return null;
  } catch {
    return null;
  }
};

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
export const migrateTheme = (): Theme => {
  const dcTheme = readDiagramCraftTheme();
  if (dcTheme) return dcTheme;

  const arTheme = localStorage.getItem(STORAGE_KEY_AR);
  if (arTheme === 'light' || arTheme === 'dark') {
    writeDiagramCraftTheme(arTheme);
    return arTheme;
  }

  return 'dark';
};

const getInitialTheme = (): Theme => {
  return migrateTheme();
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

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    writeDiagramCraftTheme(theme);
    // Keep backward compatibility
    try {
      localStorage.setItem(STORAGE_KEY_AR, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_DC && e.newValue) {
        try {
          const state = JSON.parse(e.newValue);
          const newTheme = state.themeMode === 'light' ? 'light' : 'dark';
          if (newTheme !== theme) {
            setThemeState(newTheme);
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme]);

  // Listen for custom events (same-window sync with embedded diagram-craft)
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ themeMode: Theme }>;
      const newTheme = customEvent.detail.themeMode;
      if (newTheme !== theme) {
        setThemeState(newTheme);
      }
    };

    window.addEventListener('diagram-craft:theme-change', handleCustomEvent);
    return () => window.removeEventListener('diagram-craft:theme-change', handleCustomEvent);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return { theme, setTheme } as const;
};
