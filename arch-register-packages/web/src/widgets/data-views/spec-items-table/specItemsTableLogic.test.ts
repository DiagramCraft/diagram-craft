import { describe, expect, it } from 'vitest';
import type { SpecificationItemRow } from '../../../hooks/useSpecificationItemsFeed';
import { specItemSortValue, specItemsEmptyLabel, specItemTone } from './specItemsTableLogic';

const row = (item: Record<string, unknown>) =>
  ({
    key: 'k',
    api: { id: 'a', publicId: 'A', name: 'Api' },
    item
  }) as unknown as SpecificationItemRow;

describe('specItemTone', () => {
  it('is case-insensitive and undefined for unknown methods', () => {
    expect(specItemTone('get')).toBe(specItemTone('GET'));
    expect(specItemTone('DELETE')).toContain('danger');
    expect(specItemTone('RPC')).toBeUndefined();
  });
});

describe('specItemSortValue', () => {
  it('falls back from path to channel to empty', () => {
    expect(specItemSortValue(row({ action: 'get', path: '/a' }), 'path')).toBe('/a');
    expect(specItemSortValue(row({ action: 'get', channel: 'orders' }), 'path')).toBe('orders');
    expect(specItemSortValue(row({ action: 'get' }), 'path')).toBe('');
    expect(specItemSortValue(row({ action: 'get' }), 'method')).toBe('get');
  });
});

describe('specItemsEmptyLabel', () => {
  it('differs for deprecated-only', () => {
    expect(specItemsEmptyLabel(true)).toContain('deprecated');
    expect(specItemsEmptyLabel(false)).not.toContain('deprecated');
  });
});
