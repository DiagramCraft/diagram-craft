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
});
