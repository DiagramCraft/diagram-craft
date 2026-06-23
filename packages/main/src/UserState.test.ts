import { beforeEach, describe, expect, test, vi } from 'vitest';
import { UserState } from './UserState';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';

describe('UserState', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    CollaborationConfig.isNoOp = true;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value)
      },
      configurable: true
    });
  });

  test('persists the selected theme preference', () => {
    const userState = new UserState();

    userState.themePreference = 'light';

    expect(JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}')).toMatchObject({
      themePreference: 'light'
    });
    expect(new UserState().themePreference).toBe('light');
    expect(new UserState().effectiveTheme).toBe('light');
  });

  test('defaults to system mode when no theme preference is stored', () => {
    const userState = new UserState();
    expect(userState.themePreference).toBe('system');
    // effectiveTheme depends on system preference
    expect(['light', 'dark']).toContain(userState.effectiveTheme);
  });

  test('backward compatibility: reads old themeMode as themePreference', () => {
    storage.set('diagram-craft.user-state', JSON.stringify({ themeMode: 'light' }));
    const userState = new UserState();
    expect(userState.themePreference).toBe('light');
    expect(userState.effectiveTheme).toBe('light');
  });

  test('system mode resolves to effective theme based on prefers-color-scheme', () => {
    const userState = new UserState();
    userState.themePreference = 'system';
    
    // In test environment without window, defaults to 'dark'
    // In browser environment, would match system preference
    if (typeof window === 'undefined' || !window.matchMedia) {
      expect(userState.effectiveTheme).toBe('dark');
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      expect(userState.effectiveTheme).toBe(systemPrefersDark ? 'dark' : 'light');
    }
  });

  test('explicit light preference ignores system preference', () => {
    const userState = new UserState();
    userState.themePreference = 'light';
    expect(userState.effectiveTheme).toBe('light');
  });

  test('explicit dark preference ignores system preference', () => {
    const userState = new UserState();
    userState.themePreference = 'dark';
    expect(userState.effectiveTheme).toBe('dark');
  });

  test('persists the stencil picker view mode', () => {
    const userState = new UserState();

    expect(userState.stencilPickerViewMode).toBe('grid');

    userState.stencilPickerViewMode = 'list';

    expect(JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}')).toMatchObject({
      stencilPickerViewMode: 'list'
    });
    expect(new UserState().stencilPickerViewMode).toBe('list');
  });

  test('only emits change when persisted state actually changes', () => {
    const userState = new UserState();
    const changeListener = vi.fn();

    userState.on('change', changeListener);

    userState.showHelp = true;
    userState.setToolWindowTab('object-tool', 'style');
    userState.setToolWindowTab('object-tool', 'style');
    userState.showHelp = false;
    userState.showHelp = false;

    expect(changeListener).toHaveBeenCalledTimes(2);
  });

  test('persists the selected document tab', () => {
    CollaborationConfig.isNoOp = false;
    const userState = new UserState();

    userState.setDocumentTab('/tmp/a.diagram', 'diagram-1');

    expect(JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}')).toMatchObject({
      documentTabs: [{ documentKey: '/tmp/a.diagram', tabId: 'diagram-1' }]
    });
    expect(new UserState().getDocumentTab('/tmp/a.diagram')).toBe('diagram-1');
  });

  test('keeps only the 10 most recent document tabs', () => {
    CollaborationConfig.isNoOp = false;
    const userState = new UserState();

    for (let i = 0; i < 12; i++) {
      userState.setDocumentTab(`/tmp/${i}.diagram`, `diagram-${i}`);
    }

    const documentTabs = JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}')
      .documentTabs;

    expect(documentTabs).toHaveLength(10);
    expect(documentTabs[0]).toEqual({ documentKey: '/tmp/11.diagram', tabId: 'diagram-11' });
    expect(documentTabs[9]).toEqual({ documentKey: '/tmp/2.diagram', tabId: 'diagram-2' });
    expect(userState.getDocumentTab('/tmp/0.diagram')).toBeUndefined();
  });

  test('does not persist document tabs when collaboration is disabled', () => {
    const userState = new UserState();

    userState.setDocumentTab('/tmp/a.diagram', 'diagram-1');

    expect(userState.getDocumentTab('/tmp/a.diagram')).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}')).not.toMatchObject({
      documentTabs: [{ documentKey: '/tmp/a.diagram', tabId: 'diagram-1' }]
    });
  });
});
