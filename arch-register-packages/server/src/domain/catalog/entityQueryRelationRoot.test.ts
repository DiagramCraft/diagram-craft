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

const dataFlow: RelationSchemaDbResult = {
  id: 'data-flow',
  workspace: 'ws-1',
  name: 'Data Flow',
  description: '',
  in_schema_ids: ['system'],
  out_schema_ids: ['system'],
  fields: [{ id: 'status', name: 'Status', type: 'text' }],
  groups: [],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now
};

const schemas = new Map([[system.id, system]]);
const relationSchemas = new Map([[dataFlow.id, dataFlow]]);

describe('relation-rooted query IR', () => {
  it('derives root_kind from a relation schemaId without an explicit flag', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'and', children: [] }
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });
  });

  it('rejects a root_kind that disagrees with the schema-derived kind', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root_kind: 'entity',
      root: { kind: 'and', children: [] }
    };
    const result = validateEntityQueryIR(query, schemas, null, relationSchemas);
    expect(result.ok).toBe(false);
  });

  it('validates a scalar predicate against the relation row and rejects unknown fields', () => {
    const valid: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }
    };
    expect(validateEntityQueryIR(valid, schemas, null, relationSchemas)).toEqual({ ok: true });

    const invalid: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'predicate', path: [], fieldId: '_name', op: 'equals', value: 'x' }
    };
    expect(validateEntityQueryIR(invalid, schemas, null, relationSchemas).ok).toBe(false);
  });

  it('accepts relation pseudo-fields (_inEntityId/_outEntityId) at the root', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'predicate', path: [], fieldId: '_inEntityId', op: 'equals', value: 'e1' }
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });
  });

  it('allows an endpoint path step only as the first step of a relation-rooted path', () => {
    const valid: EntityQuery = {
      schemaId: dataFlow.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'endpoint', direction: 'out' }],
        fieldId: '_name',
        op: 'equals',
        value: 'System B'
      }
    };
    expect(validateEntityQueryIR(valid, schemas, null, relationSchemas)).toEqual({ ok: true });

    const invalid: EntityQuery = {
      schemaId: dataFlow.id,
      root: {
        kind: 'predicate',
        path: [
          { kind: 'forward', fieldId: 'whatever' },
          { kind: 'endpoint', direction: 'out' }
        ],
        fieldId: '_name',
        op: 'equals',
        value: 'x'
      }
    };
    expect(validateEntityQueryIR(invalid, schemas, null, relationSchemas).ok).toBe(false);
  });

  it('rejects freeText and assessment fields under a relation root', () => {
    const freeText: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'freeText', value: 'x' }
    };
    expect(validateEntityQueryIR(freeText, schemas, null, relationSchemas).ok).toBe(false);

    const assessment: EntityQuery = {
      schemaId: dataFlow.id,
      assessmentId: 'assessment-1',
      root: { kind: 'predicate', path: [], fieldId: '_assessment', op: 'not_empty', value: null }
    };
    expect(validateEntityQueryIR(assessment, schemas, null, relationSchemas).ok).toBe(false);
  });
});

describe('relation-rooted query compilation', () => {
  it('binds e0 to scoped_relation and compiles a root scalar predicate', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('FROM scoped_relation e0');
    expect(compiled.sql).toContain("json_extract(e0.data, '$.status')");
    expect(compiled.sql).toContain('JOIN relation_schema rs');
    expect(compiled.sql).toContain('LEFT JOIN catalog_record in_e');
    expect(compiled.sql).toContain('LEFT JOIN catalog_record out_e');
    expect(compiled.params).toContain('active');
  });

  it('compiles an endpoint path step as a join to scoped_entity keyed on in/out_record_id', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'endpoint', direction: 'out' }],
        fieldId: '_name',
        op: 'equals',
        value: 'System B'
      }
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    // A root-level path occurrence is compiled via a projection binding CTE (same machinery as
    // typedRelation hops), not an inline EXISTS — this asserts the endpoint hop's join shape there.
    expect(compiled.sql).toContain(
      'JOIN scoped_entity pb_query_path_0_1 ON pb_query_path_0_1.id = pb_root_query_path_0.out_record_id'
    );
    expect(compiled.sql).toContain('FROM scoped_relation pb_root_query_path_0');
    expect(compiled.params).toContain('System B');
  });

  it('applies visibleRelationIds as a WHERE filter on the relation scope CTE', () => {
    const query: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'and', children: [] }
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      { visibleRelationIds: ['rel-1', 'rel-2'] },
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('r.id IN (?, ?)');
    expect(compiled.params).toContain('rel-1');
    expect(compiled.params).toContain('rel-2');
  });

  it('leaves entity-rooted compilation untouched (no root_kind set)', () => {
    const query: EntityQuery = {
      schemaId: system.id,
      root: { kind: 'and', children: [] }
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('FROM scoped_entity e0');
    expect(compiled.sql).toContain('JOIN entity_schema es');
  });
});
