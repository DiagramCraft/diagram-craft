import { describe, expect, it } from 'vitest';
import { applyPayload, overlayDraftItems } from './schemaDraftOverlay';

const categories = [{ id: 'c1', name: 'Core' }] as unknown as Parameters<typeof applyPayload>[2];

describe('applyPayload', () => {
  it('overlays body fields and resolves category_id', () => {
    const result = applyPayload(
      { id: 'a', name: 'Old', category: null },
      { name: 'New', category_id: 'c1', fieldMigrations: {} },
      categories
    );
    expect(result).toEqual({ id: 'a', name: 'New', category: { id: 'c1', name: 'Core' } });
  });

  it('leaves the category untouched when category_id is absent', () => {
    const result = applyPayload(
      { id: 'a', name: 'Old', category: { id: 'c1', name: 'Core' } },
      { name: 'New' },
      categories
    );
    expect(result.category).toEqual({ id: 'c1', name: 'Core' });
  });
});

describe('overlayDraftItems', () => {
  const item = (item_id: string, op: 'create' | 'update' | 'delete', payload: unknown = null) =>
    ({ kind: 'enum', item_id, op, payload }) as never;
  const toLive = (payload: unknown, existing: { id: string } | undefined, id: string) => ({
    ...existing,
    id,
    ...(payload as object)
  });

  it('flags updated, deleted and new items', () => {
    const result = overlayDraftItems(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [item('a', 'update', { x: 1 }), item('b', 'delete'), item('n', 'create', { x: 2 })],
      toLive
    );
    expect(result.map(r => [r.item.id, r.badge])).toEqual([
      ['a', 'changed'],
      ['b', 'deleted'],
      ['c', null],
      ['n', 'new']
    ]);
  });
});
