import { useCallback, useSyncExternalStore } from 'react';

export type EntityBrowserSidebarTab = 'home' | 'views' | 'bookmarks' | 'baselines';

const STORAGE_KEY = 'arch-register.entities.sidebarTab';
const TABS: readonly EntityBrowserSidebarTab[] = ['home', 'views', 'bookmarks', 'baselines'];

const listeners = new Set<() => void>();
let current: EntityBrowserSidebarTab | undefined;

const read = (): EntityBrowserSidebarTab => {
  if (current) return current;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    current = TABS.find(t => t === stored);
  } catch {
    // ignore unavailable storage
  }
  return current ?? 'home';
};

const write = (tab: EntityBrowserSidebarTab) => {
  if (tab === read()) return;
  current = tab;
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // ignore unavailable storage
  }
  listeners.forEach(l => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSidebarTab = () => {
  const tab = useSyncExternalStore(subscribe, read, () => 'home' as const);
  const setTab = useCallback((next: EntityBrowserSidebarTab) => write(next), []);
  return [tab, setTab] as const;
};
