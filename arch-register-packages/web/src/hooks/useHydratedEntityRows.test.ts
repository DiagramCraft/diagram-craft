import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { filterEntityRowsBySchema, mergeHydratedEntityRows } from './useHydratedEntityRows';

const entity = (id: string, name: string, schemaId = 's') =>
  ({ _uid: id, _name: name, _schema: { id: schemaId, name: schemaId } }) as EntityRecord;

describe('mergeHydratedEntityRows', () => {
  it('preserves order, assessment data, and rows without full records', () => {
    const first = { ...entity('1', 'summary'), _assessment: { score: 3 } };
    const second = entity('2', 'only summary');

    const result = mergeHydratedEntityRows([first, second], [entity('1', 'full')]);

    expect(result.map(row => row._uid)).toEqual(['1', '2']);
    expect(result[0]).toMatchObject({ _name: 'full', _assessment: { score: 3 } });
    expect(result[1]).toBe(second);
  });
});

describe('filterEntityRowsBySchema', () => {
  it('keeps only rows belonging to the configured schema', () => {
    const rows = [
      entity('1', 'first', 'service'),
      entity('2', 'second', 'component'),
      entity('3', 'third', 'service')
    ];

    expect(filterEntityRowsBySchema(rows, 'service').map(row => row._uid)).toEqual(['1', '3']);
  });

  it('preserves all rows when no schema is configured', () => {
    const rows = [entity('1', 'first'), entity('2', 'second')];

    expect(filterEntityRowsBySchema(rows)).toBe(rows);
    expect(filterEntityRowsBySchema(rows, null)).toBe(rows);
  });
});
