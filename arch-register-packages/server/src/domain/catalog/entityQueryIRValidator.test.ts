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
    direction: 'out'
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
        result.errors.some(error => error.message.includes('Projection paths cannot contain'))
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
