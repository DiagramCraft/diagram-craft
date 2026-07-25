import { describe, expect, it } from 'vitest';
import { bubbleViewConfigSchema, savedViewQuerySchema } from './viewContract';

describe('bubble view configuration', () => {
  it('accepts legacy configs without quadrant settings', () => {
    expect(
      bubbleViewConfigSchema.safeParse({
        xFieldId: 'cost',
        yFieldId: 'fit',
        sizeFieldId: null,
        colorFieldId: null
      }).success
    ).toBe(true);
  });

  it('accepts enabled quadrant settings with positional labels', () => {
    expect(
      bubbleViewConfigSchema.safeParse({
        xFieldId: 'cost',
        yFieldId: 'fit',
        sizeFieldId: null,
        colorFieldId: null,
        quadrants: {
          enabled: true,
          labels: {
            topLeft: 'Invest',
            topRight: 'Strategic',
            bottomLeft: 'Deprioritize',
            bottomRight: 'Maintain'
          }
        }
      }).success
    ).toBe(true);
  });
});

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
