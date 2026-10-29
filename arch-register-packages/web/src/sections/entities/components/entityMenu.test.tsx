import { describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { buildEntityMenuItems, type EntityCommonActions } from './entityMenu';

const entity = { _uid: 'u1' } as EntityRecord;

const makeActions = (pinned: boolean): EntityCommonActions => ({
  open: vi.fn(),
  openInNewTab: vi.fn(),
  copyLink: vi.fn(),
  isPinned: () => pinned,
  togglePin: vi.fn()
});

const item = (id: string) => ({ id, label: id, onClick: vi.fn() });

describe('buildEntityMenuItems', () => {
  it('orders groups navigate, edit, extra, danger and separates them', () => {
    const items = buildEntityMenuItems(entity, {
      actions: makeActions(false),
      edit: [item('clone')],
      extra: [item('exclude')],
      danger: [item('delete')]
    });

    expect(items.map(i => i.id)).toEqual([
      'open',
      'open-new-tab',
      'copy-link',
      'pin',
      'clone',
      'exclude',
      'delete'
    ]);
    expect(items.filter(i => i.separatorBefore).map(i => i.id)).toEqual([
      'clone',
      'exclude',
      'delete'
    ]);
  });

  it('shows Unpin when the entity is pinned', () => {
    const ids = buildEntityMenuItems(entity, { actions: makeActions(true) }).map(i => i.id);
    expect(ids).toContain('unpin');
    expect(ids).not.toContain('pin');
  });

  it('drops empty groups and omits navigate entries without actions', () => {
    const items = buildEntityMenuItems(entity, { danger: [item('delete')] });
    expect(items.map(i => i.id)).toEqual(['delete']);
    expect(items[0]?.separatorBefore).toBeUndefined();
  });
});
