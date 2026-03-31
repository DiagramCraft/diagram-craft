import { beforeEach, describe, expect, test } from 'vitest';
import { UserState } from './UserState';

describe('UserState', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value)
      },
      configurable: true
    });
  });

  test('persists the selected theme mode', () => {
    const userState = new UserState();

    userState.themeMode = 'light';

    expect(JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}')).toMatchObject({
      themeMode: 'light'
    });
    expect(new UserState().themeMode).toBe('light');
  });

  test('defaults to dark mode when no theme mode is stored', () => {
    expect(new UserState().themeMode).toBe('dark');
  });
});
