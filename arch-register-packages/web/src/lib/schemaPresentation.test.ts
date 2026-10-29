import { describe, expect, it } from 'vitest';
import {
  groupSchemasByCategory,
  resolveSchemaColor,
  resolveSchemaPresentation,
  UNCATEGORIZED_SCHEMA_CATEGORY
} from './schemaPresentation';

describe('groupSchemasByCategory', () => {
  it('sorts categories and schemas while preserving original indexes', () => {
    const groups = groupSchemasByCategory([
      { name: 'Zulu', category: { id: 'arch', name: 'Architecture' } },
      { name: 'Alpha', category: { id: 'arch', name: 'Architecture' } },
      { name: 'Beta', category: null },
      { name: 'Blank', category: null }
    ]);

    expect(groups.map(group => group.category)).toEqual([
      'Architecture',
      UNCATEGORIZED_SCHEMA_CATEGORY
    ]);
    expect(groups[0]?.items.map(item => [item.schema.name, item.index])).toEqual([
      ['Alpha', 1],
      ['Zulu', 0]
    ]);
    expect(groups[1]?.items.map(item => [item.schema.name, item.index])).toEqual([
      ['Beta', 2],
      ['Blank', 3]
    ]);
  });
});

describe('resolveSchemaPresentation', () => {
  const schemas = [
    { id: 'a', color: '#ff0000' },
    { id: 'b', color: null }
  ];

  it('uses the schema colour, or a palette colour by position', () => {
    expect(resolveSchemaPresentation(schemas, 'a')).toEqual({
      schema: schemas[0],
      color: '#ff0000'
    });
    expect(resolveSchemaPresentation(schemas, 'b').color).toBe(resolveSchemaColor(schemas[1]!, 1));
  });

  it('falls back to the accent colour for an unknown or missing schema', () => {
    expect(resolveSchemaPresentation(schemas, 'missing')).toEqual({
      schema: null,
      color: 'var(--accent-fg)'
    });
    expect(resolveSchemaPresentation(schemas, undefined).schema).toBeNull();
  });
});
