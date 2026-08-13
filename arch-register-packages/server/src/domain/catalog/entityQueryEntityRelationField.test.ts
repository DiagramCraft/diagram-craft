import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import type { SchemaDbResult } from './db/catalogDatabase';
import { validateEntityQueryIR } from './entityQueryIRValidator';
import { compileEntityQueryIR } from './entityQueryIRCompiler';

const now = new Date('2026-06-29T12:00:00.000Z');

const system: SchemaDbResult = {
  id: 'system',
  workspace: 'ws-1',
  name: 'System',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SYS',
  created_at: now,
  updated_at: now
};

const dataEntity: SchemaDbResult = {
  id: 'data-entity',
  workspace: 'ws-1',
  name: 'Data Entity',
  description: '',
  fields: [{ id: '_name_alias', name: 'Name Alias', type: 'text' }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'DAT',
  created_at: now,
  updated_at: now
};

const dataFlow: RelationSchemaDbResult = {
  id: 'data-flow',
  workspace: 'ws-1',
  name: 'Data Flow',
  description: '',
  in_schema_ids: [system.id],
  out_schema_ids: [system.id],
  fields: [
    {
      id: 'data',
      name: 'Data',
      type: 'entityRelation',
      requirementLevel: 'optional',
      schemaId: dataEntity.id,
      minCount: 0,
      maxCount: -1
    }
  ],
  groups: [],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now
};

const schemas = new Map([
  [system.id, system],
  [dataEntity.id, dataEntity]
]);
const relationSchemas = new Map([[dataFlow.id, dataFlow]]);

describe('entity-valued relation field traversal (#2670)', () => {
  it('compiles a forward hop from a relation-rooted query to a referenced entity', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationForward', fieldId: 'data' }],
        fieldId: '_name_alias',
        op: 'equals',
        value: 'Address'
      }
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });

    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('json_each');
    expect(compiled.params).toContain('Address');
  });

  it('compiles a backward hop from an entity-rooted query through endpoint to the opposite entity', () => {
    const query: EntityQuery = {
      schemaId: dataEntity.id,
      root: {
        kind: 'predicate',
        path: [
          { kind: 'relationBackward', fieldId: 'data', relationSchemaId: dataFlow.id },
          { kind: 'endpoint', direction: 'out' }
        ],
        fieldId: '_id',
        op: 'equals',
        value: 'system-a'
      }
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });

    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'postgres',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('scoped_relation');
    expect(compiled.sql).toContain('jsonb_array_elements_text');
    expect(compiled.params).toContain(dataFlow.id);
    expect(compiled.params).toContain('system-a');
  });

  it('compiles a relationExists check for "does any relation reference me via this field"', () => {
    const query: EntityQuery = {
      schemaId: dataEntity.id,
      root: {
        kind: 'relationExists',
        path: [{ kind: 'relationBackward', fieldId: 'data', relationSchemaId: dataFlow.id }]
      }
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });

    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('scoped_relation');
  });

  it('compiles the compound example: typedRelation hop scoped to a relationForward filter', () => {
    const systemWithTypedRelation: SchemaDbResult = {
      ...system,
      fields: [
        {
          id: 'flows_in',
          name: 'Flows in',
          type: 'typedRelation',
          relationSchemaId: dataFlow.id,
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    };
    const compoundSchemas = new Map([
      [system.id, systemWithTypedRelation],
      [dataEntity.id, dataEntity]
    ]);
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [
          {
            kind: 'typedRelation',
            fieldId: 'flows_in',
            relationSchemaId: dataFlow.id,
            direction: 'in',
            ownerSchemaIds: [system.id],
            filter: {
              kind: 'predicate',
              path: [{ kind: 'relationForward', fieldId: 'data' }],
              fieldId: '_name_alias',
              op: 'equals',
              value: 'Address'
            }
          }
        ],
        fieldId: '_id',
        op: 'equals',
        value: 'A'
      }
    };
    expect(validateEntityQueryIR(query, compoundSchemas, null, relationSchemas)).toEqual({
      ok: true
    });

    const compiled = compileEntityQueryIR(
      query,
      compoundSchemas,
      'postgres',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('jsonb_array_elements_text');
    expect(compiled.params).toContain('Address');
  });

  it('rejects a hop-bound-exceeding chain of relationBackward steps', () => {
    const query: EntityQuery = {
      schemaId: dataEntity.id,
      root: {
        kind: 'relationExists',
        path: Array.from({ length: 7 }, () => ({
          kind: 'relationBackward' as const,
          fieldId: 'data',
          relationSchemaId: dataFlow.id
        }))
      }
    };
    const result = validateEntityQueryIR(query, schemas, null, relationSchemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('MAX_PATH_HOPS'))).toBe(true);
    }
  });
});
