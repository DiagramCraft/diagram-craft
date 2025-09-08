import { describe, test, expect } from 'vitest';
import { convertSimpleSearchToDJQL, convertAdvancedSearchToDJQL } from './djqlConverter';

describe('convertSimpleSearchToDJQL', () => {
  test('handles empty query', () => {
    expect(convertSimpleSearchToDJQL('')).toBe('.elements[]');
    expect(convertSimpleSearchToDJQL('   ')).toBe('.elements[]');
  });

  test('converts basic text search', () => {
    const result = convertSimpleSearchToDJQL('button');
    expect(result).toBe(
      '.elements[]\n  | select(.type == "node")\n  | select(.name | test("button"; "i"))'
    );
  });

  test('escapes quotes in search text', () => {
    const result = convertSimpleSearchToDJQL('text with "quotes"');
    expect(result).toBe(
      '.elements[]\n  | select(.type == "node")\n  | select(.name | test("text with \\"quotes\\""; "i"))'
    );
  });

  test('handles special characters', () => {
    const result = convertSimpleSearchToDJQL('search$text*');
    expect(result).toBe(
      '.elements[]\n  | select(.type == "node")\n  | select(.name | test("search$text*"; "i"))'
    );
  });
});

describe('convertAdvancedSearchToDJQL', () => {
  test('handles empty query', () => {
    expect(convertAdvancedSearchToDJQL('')).toBe('.elements[]');
    expect(convertAdvancedSearchToDJQL('   ')).toBe('.elements[]');
  });

  test('handles invalid JSON', () => {
    expect(convertAdvancedSearchToDJQL('invalid json')).toBe('.elements[]');
  });

  test('handles empty clause array', () => {
    expect(convertAdvancedSearchToDJQL('[]')).toBe('.elements[]');
  });

  test('converts single props clause with string equality', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'props',
        path: 'props.fill.color',
        relation: 'eq',
        value: 'red'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe('.elements[]\n  | select(.props.fill.color == "red")');
  });

  test('converts single props clause with numeric equality', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'props',
        path: 'props.width',
        relation: 'eq',
        value: '100'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe('.elements[]\n  | select(.props.width == 100)');
  });

  test('converts props clause with contains relation', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'props',
        path: 'metadata.name',
        relation: 'contains',
        value: 'button'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe('.elements[]\n  | select(.metadata.name | test("button"; "i"))');
  });

  test('converts props clause with set relation', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'props',
        path: 'props.custom.field',
        relation: 'set'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe('.elements[]\n  | select(.props.custom.field != null)');
  });

  test('converts tags clause', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'tags',
        tags: ['important', 'ui']
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe('.elements[]\n  | select(.tags | contains(["important","ui"]))');
  });

  test('converts comment clause with state', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'comment',
        state: 'unresolved'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe(
      '.elements[]\n  | select(any(.comments[]; .state == "unresolved"))'
    );
  });

  test('converts comment clause without state', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'comment'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe('.elements[]\n  | select(.comments | length > 0)');
  });

  test('converts multiple clauses with proper formatting', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'props',
        path: 'props.fill.color',
        relation: 'eq',
        value: 'red'
      },
      {
        id: '2',
        type: 'tags',
        tags: ['important']
      },
      {
        id: '3',
        type: 'props',
        path: 'props.width',
        relation: 'gt',
        value: '50'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe(
      '.elements[]\n  | select(.props.fill.color == "red")\n  | select(.tags | contains(["important"]))\n  | select(.props.width > 50)'
    );
  });

  test('handles all prop relations correctly', () => {
    const relations = [
      { relation: 'neq', value: 'test', expected: 'select(.path != "test")' },
      { relation: 'gt', value: '10', expected: 'select(.path > 10)' },
      { relation: 'lt', value: '5', expected: 'select(.path < 5)' },
      { relation: 'matches', value: 'regex.*', expected: 'select(.path | test("regex.*"))' }
    ];

    relations.forEach(({ relation, value, expected }) => {
      const clauses = JSON.stringify([
        {
          id: '1',
          type: 'props',
          path: 'path',
          relation,
          value
        }
      ]);

      const result = convertAdvancedSearchToDJQL(clauses);
      expect(result).toBe(`.elements[]\n  | ${expected}`);
    });
  });

  test('escapes quotes in prop values', () => {
    const clauses = JSON.stringify([
      {
        id: '1',
        type: 'props',
        path: 'metadata.name',
        relation: 'contains',
        value: 'text with "quotes"'
      }
    ]);

    const result = convertAdvancedSearchToDJQL(clauses);
    expect(result).toBe(
      '.elements[]\n  | select(.metadata.name | test("text with \\"quotes\\""; "i"))'
    );
  });
});
