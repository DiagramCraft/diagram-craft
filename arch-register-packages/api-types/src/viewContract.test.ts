import { describe, expect, it } from 'vitest';
import {
  bubbleViewConfigSchema,
  graphViewConfigSchema,
  savedViewQuerySchema
} from './viewContract';

describe('graph view configuration', () => {
  it('accepts entity graph traversal settings and relation graph settings together', () => {
    expect(
      graphViewConfigSchema.safeParse({
        maxDepth: 3,
        direction: 'upstream',
        relationSchemaIds: ['relation-schema'],
        edgeLabelFieldId: null,
        edgeColorFieldId: 'status'
      }).success
    ).toBe(true);
  });

  it('rejects traversal depths outside the supported range', () => {
    expect(graphViewConfigSchema.safeParse({ maxDepth: 6 }).success).toBe(false);
  });
});

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
