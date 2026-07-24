import { beforeEach, describe, expect, it } from 'vitest';
import { migrateTheme } from './useTheme';

describe('migrateTheme', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value)
      }
    });
  });

  it('prefers the diagram-craft user state', () => {
    storage.set('diagram-craft.user-state', JSON.stringify({ themeMode: 'light' }));
    storage.set('ar-theme', 'dark');

    expect(migrateTheme()).toBe('light');
  });

  it('migrates the legacy theme when no diagram-craft theme exists', () => {
    storage.set('diagram-craft.user-state', JSON.stringify({ otherSetting: true }));
    storage.set('ar-theme', 'light');

    expect(migrateTheme()).toBe('light');
    expect(JSON.parse(storage.get('diagram-craft.user-state') ?? '{}')).toMatchObject({
      otherSetting: true,
      themeMode: 'light'
    });
  });

  it('defaults to dark when neither storage value is valid', () => {
    storage.set('ar-theme', 'blue');

    expect(migrateTheme()).toBe('dark');
  });
});
