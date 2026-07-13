import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { mergeHydratedEntityRows } from './useHydratedEntityRows';

const entity = (id: string, name: string) =>
  ({ _uid: id, _name: name, _schema: { id: 's' } }) as EntityRecord;

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
