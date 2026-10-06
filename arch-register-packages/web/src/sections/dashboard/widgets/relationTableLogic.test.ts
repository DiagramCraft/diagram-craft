import { describe, expect, it } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  buildRelationQueryText,
  compareRelationValues,
  formatRelationFieldValue,
  resolveRelationTableColumns
} from './relationTableLogic';

const schema = {
  id: 's1',
  name: 'Data Flow',
  fields: [
    {
      id: 'data_classification',
      name: 'Data Classification',
      type: 'select',
      options: [{ value: 'highly-sensitive', label: 'Highly sensitive' }]
    },
    { id: 'protocol', name: 'Protocol', type: 'text' }
  ]
} as unknown as RelationSchema;

describe('buildRelationQueryText', () => {
  it('roots the query on the schema', () => {
    expect(buildRelationQueryText('Data Flow', undefined)).toBe('schema:"Data Flow"');
    expect(buildRelationQueryText('Data Flow', '  ')).toBe('schema:"Data Flow"');
  });

  it('AND-s a parenthesised filter', () => {
    expect(buildRelationQueryText('Data Flow', 'a = "x" OR b = "y"')).toBe(
      'schema:"Data Flow" AND (a = "x" OR b = "y")'
    );
  });
});

describe('resolveRelationTableColumns', () => {
  it('resolves fields by id or name, keeps meta columns and drops unknown ids', () => {
    const columns = resolveRelationTableColumns(
      ['Data Classification', 'protocol', '_owner', 'nope'],
      schema
    );
    expect(columns.map(column => [column.kind, column.id, column.label])).toEqual([
      ['field', 'data_classification', 'Data Classification'],
      ['field', 'protocol', 'Protocol'],
      ['meta', '_owner', 'Owner']
    ]);
  });
});

describe('formatRelationFieldValue', () => {
  const [select, text] = schema.fields;
  it('resolves select labels, joins multiple values and handles empties and booleans', () => {
    expect(formatRelationFieldValue(select!, 'highly-sensitive')).toBe('Highly sensitive');
    expect(formatRelationFieldValue(select!, ['highly-sensitive', 'other'])).toBe(
      'Highly sensitive, other'
    );
    expect(formatRelationFieldValue(text!, null)).toBe('');
    expect(formatRelationFieldValue(text!, true)).toBe('Yes');
  });
});

describe('compareRelationValues', () => {
  it('sorts empties last and numbers numerically', () => {
    expect(compareRelationValues(null, 'a')).toBeGreaterThan(0);
    expect(compareRelationValues(2, 10)).toBeLessThan(0);
    expect(compareRelationValues('a', 'b')).toBeLessThan(0);
  });
});
