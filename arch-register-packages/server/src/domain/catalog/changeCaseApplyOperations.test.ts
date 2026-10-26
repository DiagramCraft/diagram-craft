import { describe, expect, it } from 'vitest';
import { withoutDerivedFields } from './changeCaseApplyOperations';

describe('withoutDerivedFields', () => {
  const fields = [
    { id: 'budget', type: 'derived' },
    { id: 'note', type: 'text' }
  ];

  it('drops derived field values but keeps everything else', () => {
    expect(
      withoutDerivedFields(fields, { _name: 'Service', note: 'n', budget: 1200, other: 1 })
    ).toEqual({ _name: 'Service', note: 'n', other: 1 });
  });

  it('returns the payload untouched when the schema has no derived fields', () => {
    const payload = { note: 'n' };
    expect(withoutDerivedFields([{ id: 'note', type: 'text' }], payload)).toBe(payload);
  });
});
