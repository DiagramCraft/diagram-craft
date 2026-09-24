import { describe, expect, it } from 'vitest';
import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { createEntityDrawerQueryValidator } from './entityDrawerQueryValidation';

const makeSchema = (id: string, name: string, fields: SchemaDbResult['fields']): SchemaDbResult =>
  ({
    id,
    workspace: 'ws-1',
    name,
    description: '',
    fields,
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 3).toUpperCase(),
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z')
  }) as SchemaDbResult;

const vendorSchema = makeSchema('vendor', 'Vendor', [
  { id: 'name', name: 'Name', type: 'text' },
  {
    id: 'parent',
    name: 'Parent',
    type: 'containment',
    schemaId: 'vendor',
    minCount: 0,
    maxCount: 1
  }
]);
const contractSchema = makeSchema('contract', 'Contract', [
  {
    id: 'vendor',
    name: 'Vendor',
    type: 'reference',
    schemaId: 'vendor',
    minCount: 0,
    maxCount: 1
  },
  { id: 'annual_cost', name: 'Annual cost', type: 'currency' }
]);

const validator = createEntityDrawerQueryValidator(
  { schemas: [vendorSchema, contractSchema], enums: [], relationSchemas: [] },
  null
);

const validate = (
  item: Extract<EntityDrawerItem, { kind: 'query' }>,
  schema: SchemaDbResult = contractSchema
) => validator({ item, schema, schemaId: schema.id, sectionId: 'content' });

describe('entity drawer query validation', () => {
  it('reports parser errors for invalid query syntax', () => {
    expect(validate({ kind: 'query', queryText: 'missing(', fields: [] })).toContain(
      'Query text at offset 7: Unexpected trailing input'
    );
  });

  it('accepts valid paths and validates fields against their target schema', () => {
    expect(
      validate({
        kind: 'query',
        queryText: 'vendor',
        fields: [{ fieldId: 'name' }]
      })
    ).toBeNull();
  });

  it('accepts supported lifecycle metadata for query results', () => {
    expect(
      validate({
        kind: 'query',
        queryText: 'vendor',
        fields: [{ fieldId: '_lifecycle' }]
      })
    ).toBeNull();
  });

  it('rejects stale result field ids', () => {
    expect(
      validate({
        kind: 'query',
        queryText: 'vendor',
        fields: [{ fieldId: 'removed_field' }]
      })
    ).toContain("Result field 'removed_field'");
  });

  it('accepts recursive containment paths rooted at the configured schema', () => {
    expect(
      validate(
        { kind: 'query', queryText: 'subtree(parent)', fields: [{ fieldId: 'name' }] },
        vendorSchema
      )
    ).toBeNull();
  });
});
