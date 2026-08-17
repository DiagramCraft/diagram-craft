import { describe, expect, it } from 'vitest';
import { groupSchemasByCategory, UNCATEGORIZED_SCHEMA_CATEGORY } from './schemaPresentation';

describe('groupSchemasByCategory', () => {
  it('sorts categories and schemas while preserving original indexes', () => {
    const groups = groupSchemasByCategory([
      { name: 'Zulu', category: ' Architecture ' },
      { name: 'Alpha', category: 'Architecture' },
      { name: 'Beta', category: null },
      { name: 'Blank', category: '  ' }
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
