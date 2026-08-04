import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import type { SchemaDbResult } from './db/catalogDatabase';
import { validateEntityQueryIR } from './entityQueryIRValidator';
import {
  compileEntityQueryIR,
  compileEntityQueryCountIR,
  UnsupportedEntityQueryIRError
} from './entityQueryIRCompiler';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';

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

// #2700: push LIMIT/OFFSET into the compiled SQL for relation-rooted queries instead of
// collect-all-then-slice in JS, plus a companion COUNT(*) query for an accurate total.
describe('relation-rooted query pagination (#2700)', () => {
  const query: EntityQuery = {
    schemaId: dataFlow.id,
    root: { kind: 'and', children: [] }
  };

  it('appends LIMIT/OFFSET after ORDER BY when both are set', () => {
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      { limit: 25, offset: 50 },
      null,
      relationSchemas
    );
    expect(compiled.sql).toMatch(/ORDER BY[\s\S]*LIMIT \?\s*OFFSET \?\s*$/);
    expect(compiled.params.slice(-2)).toEqual([25, 50]);
  });

  it('appends only LIMIT when offset is not set', () => {
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      { limit: 25 },
      null,
      relationSchemas
    );
    expect(compiled.sql).toMatch(/LIMIT \?\s*$/);
    expect(compiled.sql).not.toContain('OFFSET');
    expect(compiled.params.at(-1)).toBe(25);
  });

  it('omits LIMIT/OFFSET entirely when neither is set', () => {
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).not.toContain('LIMIT');
    expect(compiled.sql).not.toContain('OFFSET');
  });

  it('uses dialect-correct placeholders for LIMIT/OFFSET on postgres', () => {
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'postgres',
      'ws-1',
      { limit: 10, offset: 20 },
      null,
      relationSchemas
    );
    expect(compiled.sql).toMatch(/LIMIT \$\d+\s*OFFSET \$\d+\s*$/);
  });

  it('compiles a COUNT(*) query with the same WHERE clause and no ORDER BY/LIMIT/OFFSET', () => {
    const filtered: EntityQuery = {
      schemaId: dataFlow.id,
      root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }
    };
    const rowQuery = compileEntityQueryIR(
      filtered,
      schemas,
      'sqlite',
      'ws-1',
      { limit: 10, offset: 0 },
      null,
      relationSchemas
    );
    const countQuery = compileEntityQueryCountIR(
      filtered,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(countQuery.sql).toContain('SELECT COUNT(*) AS count');
    expect(countQuery.sql).toContain("json_extract(e0.data, '$.status')");
    expect(countQuery.sql).not.toContain('ORDER BY');
    expect(countQuery.sql).not.toContain('LIMIT');
    expect(countQuery.params).toEqual(rowQuery.params.slice(0, countQuery.params.length));
  });

  it('rejects compileEntityQueryCountIR for an entity-rooted query', () => {
    const entityQuery: EntityQuery = {
      schemaId: system.id,
      root: { kind: 'and', children: [] }
    };
    expect(() =>
      compileEntityQueryCountIR(entityQuery, schemas, 'sqlite', 'ws-1', {}, null, relationSchemas)
    ).toThrow(UnsupportedEntityQueryIRError);
  });
});

// #2701: a relation field id colliding across two relation schemas (one restricted, one not) must be
// scoped to only the granting schema(s) in the compiled SQL — mirrors the entity-rooted coverage in
// entityQueryIRCompiler.contract.test.ts's "scopes compiled SQL to the schemas that granted a field id
// colliding across schemas" test.
describe('relation-rooted query compilation — field id collision scoping', () => {
  const restrictedRelation: RelationSchemaDbResult = {
    id: 'restricted-relation',
    workspace: 'ws-1',
    name: 'Restricted Relation',
    description: '',
    in_schema_ids: ['system'],
    out_schema_ids: ['system'],
    fields: [{ id: 'note', name: 'Note', type: 'text', groupId: 'restricted' }],
    groups: [
      { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
    ],
    color: null,
    icon: null,
    created_at: now,
    updated_at: now
  };
  const unrestrictedCollider: RelationSchemaDbResult = {
    id: 'collider-relation',
    workspace: 'ws-1',
    name: 'Collider Relation',
    description: '',
    in_schema_ids: ['system'],
    out_schema_ids: ['system'],
    fields: [{ id: 'note', name: 'Note', type: 'text' }],
    groups: [],
    color: null,
    icon: null,
    created_at: now,
    updated_at: now
  };
  const collidingRelationSchemas = new Map([
    [restrictedRelation.id, restrictedRelation],
    [unrestrictedCollider.id, unrestrictedCollider]
  ]);

  const noAccess = buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: [],
    schemas: [],
    entities: [],
    grants: []
  });

  it('scopes a root predicate on a colliding relation field to the granting schema', () => {
    // No schemaId (schema-less "browse all relations"), so both colliding relation schemas are in play.
    const query: EntityQuery = {
      root_kind: 'relation',
      root: { kind: 'predicate', path: [], fieldId: 'note', op: 'equals', value: 'x' }
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      noAccess,
      collidingRelationSchemas
    );
    expect(compiled.sql).toContain('e0.schema_id IN (?)');
    expect(compiled.params).toContain(unrestrictedCollider.id);
    expect(compiled.params).not.toContain(restrictedRelation.id);
  });

  it('does not scope a root predicate on a colliding relation field once access is granted', () => {
    const viewer = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' as TeamRole }],
      schemas: [],
      entities: [],
      grants: []
    });
    const query: EntityQuery = {
      root_kind: 'relation',
      root: { kind: 'predicate', path: [], fieldId: 'note', op: 'equals', value: 'x' }
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      viewer,
      collidingRelationSchemas
    );
    expect(compiled.sql).not.toContain('schema_id IN');
  });

  it('nulls out a root projection of a colliding relation field for a non-granting row', () => {
    const query: EntityQuery = {
      root_kind: 'relation',
      root: { kind: 'and', children: [] },
      projections: [{ path: [], fieldId: 'note' }]
    };
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      noAccess,
      collidingRelationSchemas
    );
    expect(compiled.sql).toContain('CASE WHEN e0.schema_id IN (?) THEN');
    expect(compiled.sql).toContain("json_extract(e0.data, '$.note')");
    expect(compiled.params).toContain(unrestrictedCollider.id);
  });
});
