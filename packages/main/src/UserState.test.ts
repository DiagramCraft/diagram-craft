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
