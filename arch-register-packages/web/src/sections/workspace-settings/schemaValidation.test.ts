import { describe, expect, it } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { validateWorkspaceSchemas } from './schemaValidation';

const schema = (id: string, name = id, fields: SchemaField[] = []): EntitySchema =>
  ({ id, name, fields }) as EntitySchema;

const typedRelation = (
  id: string,
  relationSchemaId: string,
  direction: 'in' | 'out',
  archived = false
): SchemaField =>
  ({
    id,
    name: id,
    type: 'typedRelation',
    relationSchemaId,
    direction,
    ...(archived ? { archived: true } : {})
  }) as SchemaField;

const relation = (overrides: Partial<RelationSchema> = {}): RelationSchema =>
  ({
    id: 'relation-1',
    name: 'Uses',
    in: { schemaIds: ['service'] },
    out: { schemaIds: ['application'] },
    ...overrides
  }) as RelationSchema;

describe('validateWorkspaceSchemas', () => {
  it('accepts explicit endpoints with matching projections in both directions', () => {
    expect(
      validateWorkspaceSchemas(
        [
          schema('application', 'Application', [typedRelation('uses', 'relation-1', 'out')]),
          schema('service', 'Service', [typedRelation('used-by', 'relation-1', 'in')])
        ],
        [relation()]
      )
    ).toEqual([]);
  });

  it('requires both projections when one entity schema is allowed at both endpoints', () => {
    const issues = validateWorkspaceSchemas(
      [schema('system', 'System', [typedRelation('outgoing', 'relation-1', 'out')])],
      [relation({ in: { schemaIds: ['system'] }, out: { schemaIds: ['system'] } })]
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'TYPED_RELATION_PROJECTION_MISSING',
      entitySchemaId: 'system',
      direction: 'in',
      expected: { relationSchemaId: 'relation-1', direction: 'in' }
    });
  });

  it('expands wildcard endpoints to every current entity schema', () => {
    const issues = validateWorkspaceSchemas(
      [
        schema('application', 'Application', [typedRelation('uses', 'relation-1', 'out')]),
        schema('service', 'Service', [typedRelation('used-by', 'relation-1', 'in')]),
        schema('team', 'Team')
      ],
      [relation({ in: { schemaIds: 'any' }, out: { schemaIds: 'any' } })]
    );

    expect(issues.filter(issue => issue.code === 'TYPED_RELATION_PROJECTION_MISSING')).toHaveLength(
      4
    );
  });

  it('reports dangling and disallowed active projections', () => {
    const issues = validateWorkspaceSchemas(
      [
        schema('application', 'Application', [
          typedRelation('missing', 'unknown-relation', 'out'),
          typedRelation('wrong-endpoint', 'relation-1', 'in')
        ])
      ],
      [relation()]
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TYPED_RELATION_PROJECTION_DANGLING',
          fieldId: 'missing'
        }),
        expect.objectContaining({
          code: 'TYPED_RELATION_PROJECTION_NOT_ALLOWED',
          fieldId: 'wrong-endpoint'
        })
      ])
    );
  });

  it('does not let archived fields satisfy a projection check', () => {
    const issues = validateWorkspaceSchemas(
      [schema('application', 'Application', [typedRelation('uses', 'relation-1', 'out', true)])],
      [relation()]
    );

    expect(issues).toHaveLength(1);
    expect(issues.every(issue => issue.code === 'TYPED_RELATION_PROJECTION_MISSING')).toBe(true);
  });

  it('keeps output deterministic and ignores duplicate matching fields', () => {
    const issues = validateWorkspaceSchemas(
      [
        schema('z', 'Z', [
          typedRelation('one', 'relation-1', 'out'),
          typedRelation('two', 'relation-1', 'out')
        ]),
        schema('a', 'A')
      ],
      [relation({ in: { schemaIds: ['a'] }, out: { schemaIds: ['z'] } })]
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ entitySchemaId: 'a', direction: 'in' });
  });
});
