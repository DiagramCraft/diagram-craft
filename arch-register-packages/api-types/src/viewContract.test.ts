import { describe, expect, it } from 'vitest';
import { savedViewQuerySchema } from './viewContract';

describe('saved view filters', () => {
  it('requires a canonical EntityQuery', () => {
    expect(savedViewQuerySchema.safeParse({ schemaId: 'component' }).success).toBe(false);
  });

  it('rejects legacy flat fields and supplemental conditions', () => {
    expect(
      savedViewQuerySchema.safeParse({
        status: 'production',
        root: { kind: 'and', children: [] }
      }).success
    ).toBe(false);
    expect(
      savedViewQuerySchema.safeParse({
        conditions: [],
        root: { kind: 'and', children: [] }
      }).success
    ).toBe(false);
  });
});
