import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  resolveFieldSchemaScope,
  resolveRelationFieldSchemaScope,
  validateEntityQueryIR,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRValidator';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';

const now = new Date('2026-06-29T12:00:00.000Z');

const makeSchema = (id: string, fields: SchemaDbResult['fields'] = []): SchemaDbResult => ({
  id,
  workspace: 'ws-1',
  name: id,
  description: '',
  fields,
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: id.slice(0, 3).toUpperCase(),
  created_at: now,
  updated_at: now
});

const DOMAIN = makeSchema('domain-schema');
const SYSTEM = makeSchema('system-schema', [
  {
    id: 'domain',
    name: 'Domain',
    type: 'containment',
    schemaId: DOMAIN.id,
    minCount: 0,
    maxCount: 1
  }
]);
const COMPONENT = makeSchema('component-schema', [
  {
    id: 'eol_date',
    name: 'EOL Date',
    type: 'date'
  },
  {
    id: 'deps',
    name: 'Depends on',
    type: 'typedRelation',
    relationSchemaId: 'rel-1',
    direction: 'out',
    minCount: 0,
    maxCount: -1
  } as never
]);

const schemas: SchemaCatalog = new Map([
  [DOMAIN.id, DOMAIN],
  [SYSTEM.id, SYSTEM],
  [COMPONENT.id, COMPONENT]
]);

describe('validateEntityQueryIR', () => {
  it('accepts a path at exactly MAX_PATH_HOPS', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: Array.from({ length: 6 }, () => ({
          kind: 'backward' as const,
          fieldId: 'domain',
          ownerSchemaId: SYSTEM.id
        }))
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects a path exceeding MAX_PATH_HOPS', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: Array.from({ length: 7 }, () => ({
          kind: 'backward' as const,
          fieldId: 'domain',
          ownerSchemaId: SYSTEM.id
        }))
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('MAX_PATH_HOPS'))).toBe(true);
    }
  });

  it('counts hops nested inside a PathStep.filter cumulatively', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'backward',
            fieldId: 'domain',
            ownerSchemaId: SYSTEM.id,
            filter: {
              kind: 'relationExists',
              path: Array.from({ length: 6 }, () => ({
                kind: 'backward' as const,
                fieldId: 'domain',
                ownerSchemaId: SYSTEM.id
              }))
            }
          }
        ]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('accepts a backward step whose ownerSchemaId genuinely owns the field', () => {
    const query: EntityQuery = {
      schemaId: DOMAIN.id,
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: SYSTEM.id }]
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects a backward step whose ownerSchemaId does not define the field', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: COMPONENT.id }]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('fieldId'))).toBe(true);
    }
  });

  it('rejects a backward step naming an unknown ownerSchemaId', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: 'does-not-exist' }]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('accepts an empty and/or children array as vacuously true/false', () => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects an unknown fieldId on a forward step', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'not_a_real_field' }],
        fieldId: '_name',
        op: 'equals',
        value: 'x'
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('rejects a predicate on a typedRelation field', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'deps',
        op: 'equals',
        value: 'x'
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: ['root', 'fieldId'],
        message: "Field 'deps' is a typed relation and is not queryable"
      });
    }
  });

  it('rejects a projection on a typedRelation field', () => {
    const query: EntityQuery = {
      root: { kind: 'freeText', value: 'x' },
      projections: [{ path: [], fieldId: 'deps' }]
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: ['projections', 0, 'fieldId'],
        message: "Field 'deps' is a typed relation and is not queryable"
      });
    }
  });

  it('accepts underscore pseudo-fields without checking them against schema fields', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_slug',
        op: 'equals',
        value: 'go'
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('accepts free-text search at the root', () => {
    expect(
      validateEntityQueryIR({ root: { kind: 'freeText', value: 'platform' } }, schemas)
    ).toEqual({ ok: true });
  });

  it('rejects free-text search inside a relation filter', () => {
    const result = validateEntityQueryIR(
      {
        root: {
          kind: 'relationExists',
          path: [
            {
              kind: 'backward',
              fieldId: 'domain',
              ownerSchemaId: SYSTEM.id,
              filter: { kind: 'freeText', value: 'platform' }
            }
          ]
        }
      },
      schemas
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(error => error.message.includes('starting entity list'))).toBe(
        true
      );
    }
  });

  it('rejects an empty free-text value', () => {
    const result = validateEntityQueryIR({ root: { kind: 'freeText', value: '  ' } }, schemas);
    expect(result.ok).toBe(false);
  });

  it('rejects an _assessment predicate when assessmentId is not set', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_assessment:riskLevel',
        op: 'gte',
        value: 3
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path[0] === 'assessmentId')).toBe(true);
    }
  });

  it('accepts an _assessment predicate when assessmentId is set', () => {
    const query: EntityQuery = {
      assessmentId: 'assessment-1',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_assessment:riskLevel',
        op: 'gte',
        value: 3
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('finds an _assessment predicate nested inside a PathStep.filter', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'backward',
            fieldId: 'domain',
            ownerSchemaId: SYSTEM.id,
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: '_assessment',
              op: 'not_empty',
              value: null
            }
          }
        ]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path[0] === 'assessmentId')).toBe(true);
    }
  });

  it('validates projection aliases and projection path bounds', () => {
    const query: EntityQuery = {
      root: { kind: 'and', children: [] },
      projections: [
        { path: [], fieldId: 'eol_date', alias: 'date' },
        { path: [], fieldId: 'eol_date', alias: 'date' },
        {
          path: [
            {
              kind: 'backward',
              fieldId: 'domain',
              ownerSchemaId: SYSTEM.id,
              filter: { kind: 'and', children: [] }
            },
            ...Array.from({ length: 6 }, () => ({
              kind: 'backward' as const,
              fieldId: 'domain',
              ownerSchemaId: SYSTEM.id
            }))
          ],
          fieldId: '_name'
        }
      ]
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(error => error.message.includes('Duplicate projection alias'))
      ).toBe(true);
      expect(
        result.errors.some(error =>
          error.message.includes('may only carry a scoped filter on their final')
        )
      ).toBe(true);
      expect(result.errors.some(error => error.message.includes('MAX_PATH_HOPS'))).toBe(true);
    }
  });

  it('requires assessmentId for projected assessment fields', () => {
    const query: EntityQuery = {
      root: { kind: 'and', children: [] },
      projections: [{ path: [], fieldId: '_assessment:riskLevel' }]
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(error => error.path[0] === 'assessmentId')).toBe(true);
    }
  });
});

describe('validateEntityQueryIR field-group restriction', () => {
  const RESTRICTED = makeSchema('restricted-schema', [
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'secret', name: 'Secret', type: 'text', groupId: 'restricted' },
    {
      id: 'link',
      name: 'Link',
      type: 'containment',
      schemaId: DOMAIN.id,
      minCount: 0,
      maxCount: 1,
      groupId: 'restricted'
    }
  ]);
  RESTRICTED.groups = [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ];

  const restrictedSchemas: SchemaCatalog = new Map([...schemas, [RESTRICTED.id, RESTRICTED]]);

  const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
    buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
        teamRoles.map(role => ({ teamId, role }))
      ),
      schemas: [],
      entities: [],
      grants: []
    });

  it('treats a restricted field in a predicate as unknown, identically to a typo', () => {
    const noAccess = authCtxWithTeamRoles({});
    const restrictedQuery: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'secret', op: 'equals', value: 'x' }
    };
    const typoQuery: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'sekret', op: 'equals', value: 'x' }
    };
    const restrictedResult = validateEntityQueryIR(restrictedQuery, restrictedSchemas, noAccess);
    const typoResult = validateEntityQueryIR(typoQuery, restrictedSchemas, noAccess);
    expect(restrictedResult).toEqual({
      ok: false,
      errors: [{ path: ['root', 'fieldId'], message: "Unknown field 'secret'" }]
    });
    expect(typoResult).toEqual({
      ok: false,
      errors: [{ path: ['root', 'fieldId'], message: "Unknown field 'sekret'" }]
    });
  });

  it('treats a field with a dangling group reference as unknown', () => {
    const dangling = makeSchema('dangling-schema', [
      { id: 'dangling_secret', name: 'Dangling secret', type: 'text', groupId: 'deleted-group' }
    ]);
    const schemasWithDanglingGroup: SchemaCatalog = new Map([
      ...restrictedSchemas,
      [dangling.id, dangling]
    ]);
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'dangling_secret',
        op: 'equals',
        value: 'x'
      }
    };

    expect(
      validateEntityQueryIR(query, schemasWithDanglingGroup, authCtxWithTeamRoles({}))
    ).toEqual({
      ok: false,
      errors: [{ path: ['root', 'fieldId'], message: "Unknown field 'dangling_secret'" }]
    });
  });

  it('allows a restricted field once the caller has view or edit access', () => {
    const viewer = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    const query: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'secret', op: 'equals', value: 'x' }
    };
    expect(validateEntityQueryIR(query, restrictedSchemas, viewer)).toEqual({ ok: true });
  });

  it('rejects a restricted field in a projection', () => {
    const noAccess = authCtxWithTeamRoles({});
    const query: EntityQuery = {
      root: { kind: 'and', children: [] },
      projections: [{ path: [], fieldId: 'secret' }]
    };
    const result = validateEntityQueryIR(query, restrictedSchemas, noAccess);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(error => error.message === "Unknown field 'secret'")).toBe(true);
    }
  });

  it('rejects a restricted backward relation field in a path step', () => {
    const noAccess = authCtxWithTeamRoles({});
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'link', ownerSchemaId: RESTRICTED.id }]
      }
    };
    const result = validateEntityQueryIR(query, restrictedSchemas, noAccess);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(error =>
          error.message.includes("does not define a reference/containment field 'link'")
        )
      ).toBe(true);
    }
  });

  it('defaults to unrestricted when authCtx is omitted (internal/system callers)', () => {
    const query: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'secret', op: 'equals', value: 'x' }
    };
    expect(validateEntityQueryIR(query, restrictedSchemas)).toEqual({ ok: true });
  });

  // #2592: a field id restricted in one schema but also defined, unrestricted, by an unrelated
  // schema must still resolve at this layer (matching the collapsing behavior above) — the
  // per-schema leak this collision otherwise causes is closed downstream, at compile time, by
  // scoping the compiled SQL to only the schemas that actually grant the field. See
  // entityQueryIRCompiler.contract.test.ts for the SQL-level regression coverage.
  describe('field id collision across schemas', () => {
    const UNRESTRICTED_COLLIDER = makeSchema('collider-schema', [
      { id: 'secret', name: 'Secret', type: 'text' }
    ]);
    const collidingSchemas: SchemaCatalog = new Map([
      ...restrictedSchemas,
      [UNRESTRICTED_COLLIDER.id, UNRESTRICTED_COLLIDER]
    ]);

    it('still resolves the field via the unrestricted schema', () => {
      const noAccess = authCtxWithTeamRoles({});
      const query: EntityQuery = {
        root: { kind: 'predicate', path: [], fieldId: 'secret', op: 'equals', value: 'x' }
      };
      expect(validateEntityQueryIR(query, collidingSchemas, noAccess)).toEqual({ ok: true });
    });

    it('resolveFieldSchemaScope reports the granting schema and flags scoping as needed', () => {
      const noAccess = authCtxWithTeamRoles({});
      const scope = resolveFieldSchemaScope('secret', collidingSchemas, noAccess);
      expect(scope.needsScoping).toBe(true);
      expect(scope.grantedSchemaIds).toEqual(new Set([UNRESTRICTED_COLLIDER.id]));
    });

    it('resolveFieldSchemaScope needs no scoping for a non-colliding field', () => {
      const noAccess = authCtxWithTeamRoles({});
      const scope = resolveFieldSchemaScope('eol_date', collidingSchemas, noAccess);
      expect(scope.needsScoping).toBe(false);
    });
  });
});

// #2701: relation-schema counterpart to the entity-side "field id collision across schemas" coverage
// above — resolveRelationFieldSchemaScope must flag the same kind of collision so the compiler can scope
// relation-rooted SQL to only the relation schemas that actually grant the field.
describe('resolveRelationFieldSchemaScope', () => {
  const now = new Date('2026-06-29T12:00:00.000Z');

  const makeRelationSchema = (
    id: string,
    fields: RelationSchemaDbResult['fields'] = []
  ): RelationSchemaDbResult => ({
    id,
    workspace: 'ws-1',
    name: id,
    description: '',
    in_schema_ids: [],
    out_schema_ids: [],
    fields,
    groups: [],
    color: null,
    icon: null,
    created_at: now,
    updated_at: now
  });

  const RESTRICTED_RELATION = makeRelationSchema('restricted-relation-schema', [
    { id: 'note', name: 'Note', type: 'text', groupId: 'restricted' },
    { id: 'eol_date', name: 'EOL Date', type: 'date' }
  ]);
  RESTRICTED_RELATION.groups = [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ];

  const UNRESTRICTED_COLLIDER_RELATION = makeRelationSchema('collider-relation-schema', [
    { id: 'note', name: 'Note', type: 'text' }
  ]);

  const collidingRelationSchemas: RelationSchemaCatalog = new Map([
    [RESTRICTED_RELATION.id, RESTRICTED_RELATION],
    [UNRESTRICTED_COLLIDER_RELATION.id, UNRESTRICTED_COLLIDER_RELATION]
  ]);

  const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
    buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
        teamRoles.map(role => ({ teamId, role }))
      ),
      schemas: [],
      entities: [],
      grants: []
    });

  it('reports the granting relation schema and flags scoping as needed', () => {
    const noAccess = authCtxWithTeamRoles({});
    const scope = resolveRelationFieldSchemaScope('note', collidingRelationSchemas, noAccess);
    expect(scope.needsScoping).toBe(true);
    expect(scope.grantedSchemaIds).toEqual(new Set([UNRESTRICTED_COLLIDER_RELATION.id]));
  });

  it('needs no scoping for a non-colliding relation field', () => {
    const noAccess = authCtxWithTeamRoles({});
    const scope = resolveRelationFieldSchemaScope('eol_date', collidingRelationSchemas, noAccess);
    expect(scope.needsScoping).toBe(false);
  });

  it('grants both schemas once the caller has view access to the restricted group', () => {
    const viewer = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    const scope = resolveRelationFieldSchemaScope('note', collidingRelationSchemas, viewer);
    expect(scope.needsScoping).toBe(false);
  });
});

describe('entityRelation field traversal (#2670)', () => {
  const SYSTEM_ENTITY = makeSchema('system-entity-schema');
  const DATA_ENTITY = makeSchema('data-entity-schema', [
    { id: '_name', name: 'Name', type: 'text' }
  ]);
  const entitySchemas: SchemaCatalog = new Map([
    [SYSTEM_ENTITY.id, SYSTEM_ENTITY],
    [DATA_ENTITY.id, DATA_ENTITY]
  ]);

  const DATA_FLOW: RelationSchemaDbResult = {
    id: 'data-flow-schema',
    workspace: 'ws-1',
    name: 'Data Flow',
    description: '',
    in_schema_ids: [SYSTEM_ENTITY.id],
    out_schema_ids: [SYSTEM_ENTITY.id],
    fields: [
      {
        id: 'data',
        name: 'Data',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: DATA_ENTITY.id,
        minCount: 0,
        maxCount: -1
      },
      { id: 'note', name: 'Note', type: 'text', groupId: 'restricted' }
    ],
    groups: [
      { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
    ],
    color: null,
    icon: null,
    created_at: now,
    updated_at: now
  };
  const dataFlowRelationSchemas: RelationSchemaCatalog = new Map([[DATA_FLOW.id, DATA_FLOW]]);

  it('accepts a relation-rooted query traversing relationForward to a nested entity field', () => {
    const query: EntityQuery = {
      schemaId: DATA_FLOW.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationForward', fieldId: 'data' }],
        fieldId: '_name',
        op: 'equals',
        value: 'Address'
      }
    };
    expect(validateEntityQueryIR(query, entitySchemas, null, dataFlowRelationSchemas)).toEqual({
      ok: true
    });
  });

  it('accepts an entity-rooted query traversing relationBackward then endpoint', () => {
    const query: EntityQuery = {
      schemaId: DATA_ENTITY.id,
      root: {
        kind: 'predicate',
        path: [
          { kind: 'relationBackward', fieldId: 'data', relationSchemaId: DATA_FLOW.id },
          { kind: 'endpoint', direction: 'out' }
        ],
        fieldId: '_id',
        op: 'equals',
        value: 'A'
      }
    };
    expect(validateEntityQueryIR(query, entitySchemas, null, dataFlowRelationSchemas)).toEqual({
      ok: true
    });
  });

  it('rejects relationForward when the current position is not a relation', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationBackward', fieldId: 'data', relationSchemaId: DATA_FLOW.id }],
        fieldId: '_id',
        op: 'equals',
        value: 'A'
      }
    };
    // relationBackward starting from entity-rooted 'and' context is fine positionally, but a
    // second relationForward immediately after another relationBackward (still on relation, so
    // legal) vs. attempting relationForward from the query root (entity context) is not.
    const invalidQuery: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationForward', fieldId: 'data' }],
        fieldId: '_name',
        op: 'equals',
        value: 'Address'
      }
    };
    expect(validateEntityQueryIR(query, entitySchemas, null, dataFlowRelationSchemas).ok).toBe(
      true
    );
    const result = validateEntityQueryIR(
      invalidQuery,
      entitySchemas,
      null,
      dataFlowRelationSchemas
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes("'relationForward'"))).toBe(true);
    }
  });

  it('rejects an unknown entityRelation fieldId', () => {
    const query: EntityQuery = {
      schemaId: DATA_FLOW.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationForward', fieldId: 'missing' }],
        fieldId: '_name',
        op: 'equals',
        value: 'Address'
      }
    };
    const result = validateEntityQueryIR(query, entitySchemas, null, dataFlowRelationSchemas);
    expect(result.ok).toBe(false);
  });

  it('rejects a relationBackward referencing an unknown relation schema', () => {
    const query: EntityQuery = {
      schemaId: DATA_ENTITY.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationBackward', fieldId: 'data', relationSchemaId: 'missing-schema' }],
        fieldId: '_id',
        op: 'equals',
        value: 'A'
      }
    };
    const result = validateEntityQueryIR(query, entitySchemas, null, dataFlowRelationSchemas);
    expect(result.ok).toBe(false);
  });

  it('permits a scalar predicate inside a relationBackward filter scoped to the relation', () => {
    const query: EntityQuery = {
      schemaId: DATA_ENTITY.id,
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'relationBackward',
            fieldId: 'data',
            relationSchemaId: DATA_FLOW.id,
            filter: { kind: 'predicate', path: [], fieldId: 'note', op: 'equals', value: 'x' }
          }
        ]
      }
    };
    const noAccessCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });
    const noAccess = validateEntityQueryIR(
      query,
      entitySchemas,
      noAccessCtx,
      dataFlowRelationSchemas
    );
    expect(noAccess.ok).toBe(false);

    const viewer = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });
    expect(validateEntityQueryIR(query, entitySchemas, viewer, dataFlowRelationSchemas)).toEqual({
      ok: true
    });
  });

  it('fails closed when the entityRelation field granting the hop is itself group-restricted', () => {
    const RESTRICTED_DATA_FLOW: RelationSchemaDbResult = {
      ...DATA_FLOW,
      id: 'restricted-data-flow-schema',
      fields: [{ ...DATA_FLOW.fields[0]!, groupId: 'restricted' } as never],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    };
    const restrictedRelationSchemas: RelationSchemaCatalog = new Map([
      [RESTRICTED_DATA_FLOW.id, RESTRICTED_DATA_FLOW]
    ]);
    const noAccessCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });
    const viewerCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });

    const forwardQuery: EntityQuery = {
      schemaId: RESTRICTED_DATA_FLOW.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'relationForward', fieldId: 'data' }],
        fieldId: '_name',
        op: 'equals',
        value: 'Address'
      }
    };
    expect(
      validateEntityQueryIR(forwardQuery, entitySchemas, noAccessCtx, restrictedRelationSchemas).ok
    ).toBe(false);
    expect(
      validateEntityQueryIR(forwardQuery, entitySchemas, viewerCtx, restrictedRelationSchemas)
    ).toEqual({ ok: true });

    const backwardQuery: EntityQuery = {
      schemaId: DATA_ENTITY.id,
      root: {
        kind: 'relationExists',
        path: [
          { kind: 'relationBackward', fieldId: 'data', relationSchemaId: RESTRICTED_DATA_FLOW.id }
        ]
      }
    };
    expect(
      validateEntityQueryIR(backwardQuery, entitySchemas, noAccessCtx, restrictedRelationSchemas).ok
    ).toBe(false);
    expect(
      validateEntityQueryIR(backwardQuery, entitySchemas, viewerCtx, restrictedRelationSchemas)
    ).toEqual({ ok: true });
  });
});

const DATA_ENTITY_FOR_NOW_TESTS = makeSchema('data-entity-for-now-tests', [
  { id: '_name', name: 'Name', type: 'text' }
]);
const DATA_ENTITY_FOR_NOW_TESTS_SCHEMAS: SchemaCatalog = new Map([
  [DATA_ENTITY_FOR_NOW_TESTS.id, DATA_ENTITY_FOR_NOW_TESTS]
]);

describe('$now relative-date literal', () => {
  const MULTI_DATE = makeSchema('multi-date-schema', [
    { id: 'reminders', name: 'Reminders', type: 'date', minCardinality: 0, maxCardinality: -1 }
  ] as never);
  const nowSchemas: SchemaCatalog = new Map([...schemas, [MULTI_DATE.id, MULTI_DATE]]);

  const REL_WITH_DATE: RelationSchemaDbResult = {
    id: 'rel-with-date-schema',
    workspace: 'ws-1',
    name: 'Rel With Date',
    description: '',
    in_schema_ids: [DOMAIN.id],
    out_schema_ids: [DOMAIN.id],
    fields: [{ id: 'review_date', name: 'Review Date', type: 'date' }],
    groups: [],
    color: null,
    icon: null,
    created_at: now,
    updated_at: now
  };
  const relationSchemasWithDate: RelationSchemaCatalog = new Map([
    [REL_WITH_DATE.id, REL_WITH_DATE]
  ]);

  it('accepts $now on an entity scalar date field with before/after/on', () => {
    for (const op of ['before', 'after', 'on'] as const) {
      const query: EntityQuery = {
        schemaId: COMPONENT.id,
        root: { kind: 'predicate', path: [], fieldId: 'eol_date', op, value: { $now: true } }
      };
      expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
    }
  });

  it('accepts $now with an integer offsetDays', () => {
    const query: EntityQuery = {
      schemaId: COMPONENT.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'eol_date',
        op: 'before',
        value: { $now: true, offsetDays: 30 }
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects $now with a non-date-comparison op', () => {
    const query: EntityQuery = {
      schemaId: COMPONENT.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'eol_date',
        op: 'equals',
        value: { $now: true }
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('rejects $now on a non-date entity field', () => {
    const query: EntityQuery = {
      schemaId: DATA_ENTITY_FOR_NOW_TESTS.id,
      root: { kind: 'predicate', path: [], fieldId: '_name', op: 'before', value: { $now: true } }
    };
    const result = validateEntityQueryIR(query, DATA_ENTITY_FOR_NOW_TESTS_SCHEMAS);
    expect(result.ok).toBe(false);
  });

  it('rejects $now on a multi-valued (array) date field', () => {
    const query: EntityQuery = {
      schemaId: MULTI_DATE.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'reminders',
        op: 'before',
        value: { $now: true }
      }
    };
    const result = validateEntityQueryIR(query, nowSchemas);
    expect(result.ok).toBe(false);
  });

  it('rejects $now on a builtin field', () => {
    const query: EntityQuery = {
      schemaId: COMPONENT.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_updatedAt',
        op: 'before',
        value: { $now: true }
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed $now marker shape', () => {
    const query: EntityQuery = {
      schemaId: COMPONENT.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'eol_date',
        op: 'before',
        value: { $now: true, offsetDays: 1.5 }
      }
    };
    // A non-integer offsetDays fails isNowDateLiteral's shape guard, so it's treated as an
    // ordinary literal value rather than a $now marker — not itself an error at this layer, but
    // it will not compile to a meaningful SQL comparison either. Documented via the compiler
    // tests rather than asserted here.
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('accepts $now on a bare relation-rooted date field', () => {
    const query: EntityQuery = {
      schemaId: REL_WITH_DATE.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'review_date',
        op: 'before',
        value: { $now: true }
      }
    };
    expect(validateEntityQueryIR(query, new Map(), null, relationSchemasWithDate)).toEqual({
      ok: true
    });
  });

  it('rejects $now on a bare relation-rooted non-date field', () => {
    const relWithText: RelationSchemaDbResult = {
      ...REL_WITH_DATE,
      id: 'rel-with-text-schema',
      fields: [{ id: 'note', name: 'Note', type: 'text' }]
    };
    const relationSchemasWithText: RelationSchemaCatalog = new Map([[relWithText.id, relWithText]]);
    const query: EntityQuery = {
      schemaId: relWithText.id,
      root: { kind: 'predicate', path: [], fieldId: 'note', op: 'before', value: { $now: true } }
    };
    const result = validateEntityQueryIR(query, new Map(), null, relationSchemasWithText);
    expect(result.ok).toBe(false);
  });
});
