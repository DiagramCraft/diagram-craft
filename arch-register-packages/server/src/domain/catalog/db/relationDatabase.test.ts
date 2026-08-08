import { describe, expect, it } from 'vitest';
import { relationMappers } from './relationDatabase';

const relationSchemaRow = (inSchemaIds: unknown, outSchemaIds: unknown) => ({
  id: 'relation-schema-1',
  workspace: 'workspace-1',
  name: 'Relation schema',
  description: '',
  in_schema_ids: inSchemaIds,
  out_schema_ids: outSchemaIds,
  fields: [],
  groups: [],
  shared_field_group_links: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  version: 1,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
});

describe('relationMappers', () => {
  it('maps a PostgreSQL-decoded wildcard endpoint', () => {
    const result = relationMappers.relationSchema(relationSchemaRow('any', 'any'));

    expect(result.in_schema_ids).toBe('any');
    expect(result.out_schema_ids).toBe('any');
  });

  it('maps SQLite-serialized wildcard endpoints', () => {
    const result = relationMappers.relationSchema(relationSchemaRow('"any"', '"any"'));

    expect(result.in_schema_ids).toBe('any');
    expect(result.out_schema_ids).toBe('any');
  });
});
