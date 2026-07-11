import { describe, expect, it } from 'vitest';
import { entityListFiltersSchema } from './entityContract';

describe('entityListFiltersSchema', () => {
  it('accepts typed conditions and booleans', () => {
    expect(
      entityListFiltersSchema.parse({
        conditions: [{ fieldId: '_name', op: 'contains', value: 'Auth' }],
        includeProjectSnapshots: false
      })
    ).toEqual({
      conditions: [{ fieldId: '_name', op: 'contains', value: 'Auth' }],
      includeProjectSnapshots: false
    });
  });

  it('normalizes legacy serialized query values', () => {
    expect(
      entityListFiltersSchema.parse({
        conditions: JSON.stringify([{ fieldId: '_name', op: 'contains', value: 'Auth' }]),
        includeProjectSnapshots: 'true'
      })
    ).toEqual({
      conditions: [{ fieldId: '_name', op: 'contains', value: 'Auth' }],
      includeProjectSnapshots: true
    });
  });
});
