import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { SchemaDbResult } from './db/catalogDatabase';
import { printEntityQueryText } from './entityQueryTextPrinter';

const schema: SchemaDbResult = {
  id: 'technology-id',
  workspace: 'workspace-id',
  name: 'Technology',
  description: '',
  fields: [{ id: 'eol_date', name: 'EOL Date', type: 'date' }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'TEC',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const releaseSchema: SchemaDbResult = {
  ...schema,
  id: 'technology-release-id',
  name: 'Technology Release',
  fields: [
    { id: 'release_cycle', name: 'Release cycle', type: 'number' },
    { id: 'eol_date', name: 'EOL date', type: 'date' }
  ]
};

const componentSchema: SchemaDbResult = {
  ...schema,
  id: 'component-id',
  name: 'Component',
  fields: [
    {
      id: 'technology_releases',
      name: 'Technology releases',
      type: 'reference',
      schemaId: releaseSchema.id,
      minCount: 0,
      maxCount: -1
    }
  ]
};

describe('entity query text printer', () => {
  it('prints IR directly using schema context and canonical date syntax', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: schema.id },
          {
            kind: 'predicate',
            path: [],
            fieldId: 'eol_date',
            op: 'before',
            value: '2026-06-30'
          }
        ]
      }
    };

    expect(printEntityQueryText(query, new Map([[schema.id, schema]]))).toBe(
      'schema:Technology AND eol_date < date("2026-06-30")'
    );
  });

  it('keeps a short flat query compact in pretty mode', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: schema.id },
          { kind: 'predicate', path: [], fieldId: 'eol_date', op: 'before', value: '2026-06-30' }
        ]
      }
    };

    expect(
      printEntityQueryText(query, new Map([[schema.id, schema]]), new Map(), { pretty: true })
    ).toBe('schema:Technology AND eol_date < date("2026-06-30")');
  });

  it('prints nested boolean expressions with readable indentation', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: schema.id },
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: 'radar_status', op: 'equals', value: 'hold' },
              {
                kind: 'predicate',
                path: [],
                fieldId: 'radar_status',
                op: 'equals',
                value: 'assess'
              }
            ]
          },
          {
            kind: 'not',
            child: {
              kind: 'predicate',
              path: [],
              fieldId: 'category',
              op: 'equals',
              value: 'library'
            }
          }
        ]
      }
    };

    expect(
      printEntityQueryText(query, new Map([[schema.id, schema]]), new Map(), { pretty: true })
    ).toBe(`schema:Technology AND
(
  radar_status = "hold" OR
  radar_status = "assess"
) AND
NOT category = "library"`);
  });

  it('prints a scoped filter on indented lines and honors custom indentation', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [
          {
            kind: 'forward',
            fieldId: 'technology_releases',
            filter: {
              kind: 'and',
              children: [
                { kind: 'predicate', path: [], fieldId: 'release_cycle', op: 'lt', value: 2 },
                { kind: 'predicate', path: [], fieldId: 'eol_date', op: 'not_empty', value: null }
              ]
            }
          }
        ],
        fieldId: 'eol_date',
        op: 'before',
        value: '2026-06-30'
      }
    };

    expect(
      printEntityQueryText(
        {
          root: {
            kind: 'and',
            children: [
              {
                kind: 'predicate',
                path: [],
                fieldId: '_schemaId',
                op: 'equals',
                value: componentSchema.id
              },
              query.root
            ]
          }
        },
        new Map([
          [schema.id, schema],
          [componentSchema.id, componentSchema],
          [releaseSchema.id, releaseSchema]
        ]),
        new Map(),
        {
          pretty: true,
          indent: '\t'
        }
      )
    ).toBe(`schema:Component AND
technology_releases[
\trelease_cycle < 2 AND
\teol_date
].eol_date < date("2026-06-30")`);
  });
});
