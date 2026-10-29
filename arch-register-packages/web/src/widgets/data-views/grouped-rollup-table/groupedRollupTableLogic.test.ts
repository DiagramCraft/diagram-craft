import { describe, expect, it } from 'vitest';
import { buildRollupRows } from './groupedRollupTableLogic';

const rec = (
  uid: string,
  name: string,
  cc: string | undefined,
  amount: number,
  currency = 'USD'
) => ({
  _uid: uid,
  _name: name,
  _publicId: uid.toUpperCase(),
  cost_centre: cc,
  spend: { amount, currency }
});

const records = [
  rec('a', 'Acme', 'eng', 3000),
  rec('b', 'Beta', 'sales', 1000),
  rec('c', 'Cargo', 'eng', 500),
  rec('d', 'Delta', undefined, 200)
];

describe('buildRollupRows', () => {
  it('lists one row per record sorted by amount when not grouped', () => {
    const result = buildRollupRows(records, { valueFieldId: 'spend' });
    expect(result.rows.map(row => row.label)).toEqual(['Acme', 'Beta', 'Cargo', 'Delta']);
    expect(result.rows[0]?.entityPublicId).toBe('A');
    expect(result.totalAmount).toBe(4700);
    expect(result.totalCurrency).toBe('USD');
  });

  it('groups by a field with labels, counts and an empty-group bucket', () => {
    const result = buildRollupRows(records, {
      groupFieldId: 'cost_centre',
      valueFieldId: 'spend',
      groupLabel: value => value.toUpperCase()
    });
    expect(result.rows.map(row => [row.label, row.amount, row.count])).toEqual([
      ['ENG', 3500, 2],
      ['SALES', 1000, 1],
      ['—', 200, 1]
    ]);
    expect(result.rows[0]?.entityPublicId).toBeUndefined();
    expect(result.totalCount).toBe(4);
  });

  it('drops the currency when values mix currencies', () => {
    const result = buildRollupRows([rec('a', 'A', 'x', 1), rec('b', 'B', 'x', 1, 'EUR')], {
      groupFieldId: 'cost_centre',
      valueFieldId: 'spend'
    });
    expect(result.rows[0]?.currency).toBeUndefined();
    expect(result.totalCurrency).toBeUndefined();
  });
});
