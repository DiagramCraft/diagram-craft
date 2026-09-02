import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  parseEntityQueryText,
  printEntityQueryText,
  type EnumCatalog
} from './entityQueryTextCompiler';
import type { SchemaCatalog } from './entityQueryIRValidator';
import type { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';

const now = new Date('2026-06-29T12:00:00.000Z');

const makeSchema = (
  id: string,
  name: string,
  fields: SchemaDbResult['fields'] = []
): SchemaDbResult => ({
  id,
  workspace: 'ws-1',
  name,
  description: '',
  fields,
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: id.slice(0, 3).toUpperCase(),
  created_at: now,
  updated_at: now
});

const makeEnum = (
  id: string,
  name: string,
  options: { value: string; label: string }[]
): WorkspaceEnumDbResult => ({
  id,
  workspace: 'ws-1',
  name,
  options,
  sort_order: 0,
  created_at: now,
  updated_at: now
});

// Seeded shape mirrored from specs/QUERY_LANGUAGE.md §2 / QUERY_LANGUAGE_IR_EXAMPLES.md.
const DOMAIN = makeSchema('domain-id', 'Domain');
const SYSTEM = makeSchema('system-id', 'System', [
  {
    id: 'domain',
    name: 'Domain',
    type: 'containment',
    schemaId: DOMAIN.id,
    minCount: 0,
    maxCount: 1
  }
]);
const TECHNOLOGY_RADAR_STATUS_ENUM = 'radar-status-enum';
const TECHNOLOGY = makeSchema('technology-id', 'Technology', [
  { id: 'category', name: 'Category', type: 'text' },
  { id: 'radar_status', name: 'Radar Status', type: 'select', enumId: TECHNOLOGY_RADAR_STATUS_ENUM }
]);
const TECHNOLOGY_RELEASE = makeSchema('technology-release-id', 'Technology Release', [
  { id: 'eol_date', name: 'EOL Date', type: 'date' },
  { id: 'release_cycle', name: 'Release Cycle', type: 'text' },
  { id: 'latest_version', name: 'Latest Version', type: 'text' },
  {
    id: 'technology',
    name: 'Technology',
    type: 'containment',
    schemaId: TECHNOLOGY.id,
    minCount: 1,
    maxCount: 1
  }
]);
const COMPONENT = makeSchema('component-id', 'Component', [
  {
    id: 'system',
    name: 'System',
    type: 'containment',
    schemaId: SYSTEM.id,
    minCount: 0,
    maxCount: 1
  },
  {
    id: 'technology_releases',
    name: 'Technology Releases',
    type: 'reference',
    schemaId: TECHNOLOGY_RELEASE.id,
    minCount: 0,
    maxCount: -1
  }
]);
const RESOURCE = makeSchema('resource-id', 'Resource', [
  {
    id: 'technology_releases',
    name: 'Technology Releases',
    type: 'reference',
    schemaId: TECHNOLOGY_RELEASE.id,
    minCount: 0,
    maxCount: -1
  }
]);

const DATA_ENTITY = makeSchema('data-entity-id', 'Data Entity', [
  { id: 'alias_name', name: 'Alias', type: 'text' }
]);

const schemas: SchemaCatalog = new Map(
  [DOMAIN, SYSTEM, TECHNOLOGY, TECHNOLOGY_RELEASE, COMPONENT, RESOURCE, DATA_ENTITY].map(s => [
    s.id,
    s
  ])
);

const enums: EnumCatalog = new Map([
  [
    TECHNOLOGY_RADAR_STATUS_ENUM,
    makeEnum(TECHNOLOGY_RADAR_STATUS_ENUM, 'Technology Radar Status', [
      { value: 'hold', label: 'Hold' },
      { value: 'assess', label: 'Assess' }
    ])
  ]
]);

const DATA_FLOW: RelationSchemaDbResult = {
  id: 'data-flow-id',
  workspace: 'ws-1',
  name: 'Data Flow',
  description: '',
  in_schema_ids: [SYSTEM.id],
  out_schema_ids: [SYSTEM.id],
  fields: [
    { id: 'status', name: 'Status', type: 'text' },
    {
      id: 'data',
      name: 'Data',
      type: 'entityRelation',
      requirementLevel: 'optional',
      schemaId: DATA_ENTITY.id,
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

const TYPED_SYSTEM = makeSchema('typed-system-id', 'Typed System', [
  {
    id: 'data_flows_out',
    name: 'Data flows out',
    type: 'typedRelation',
    relationSchemaId: DATA_FLOW.id,
    direction: 'out',
    minCount: 0,
    maxCount: -1
  }
]);
const LOCKED_TYPED_SYSTEM = makeSchema('locked-typed-system-id', 'Locked Typed System', [
  {
    id: 'data_flows_out',
    name: 'Data flows out',
    type: 'typedRelation',
    relationSchemaId: DATA_FLOW.id,
    direction: 'out',
    minCount: 0,
    maxCount: -1,
    groupId: 'typed-restricted'
  }
]);
LOCKED_TYPED_SYSTEM.groups = [
  {
    id: 'typed-restricted',
    name: 'Typed restricted',
    accessControl: { teamIds: ['team-typed-restricted'] }
  }
];
const typedSchemas: SchemaCatalog = new Map([...schemas, [TYPED_SYSTEM.id, TYPED_SYSTEM]]);
const collidingTypedSchemas: SchemaCatalog = new Map([
  ...typedSchemas,
  [LOCKED_TYPED_SYSTEM.id, LOCKED_TYPED_SYSTEM]
]);
const relationSchemas = new Map([[DATA_FLOW.id, DATA_FLOW]]);

const parseOk = (text: string): EntityQuery => {
  const result = parseEntityQueryText(text, schemas, enums);
  if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
  return result.query;
};

const parseErr = (text: string) => {
  const result = parseEntityQueryText(text, schemas, enums);
  if (result.ok) throw new Error(`expected a parse error, got: ${JSON.stringify(result.query)}`);
  return result.errors;
};

describe('parseEntityQueryText — worked examples (specs/QUERY_LANGUAGE_IR_EXAMPLES.md)', () => {
  it('#2300 — Components at EOL risk via their linked Technology Release', () => {
    expect(parseOk('schema:Component technology_releases.eol_date < date("2026-06-30")')).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: COMPONENT.id },
          {
            kind: 'predicate',
            path: [{ kind: 'forward', fieldId: 'technology_releases' }],
            fieldId: 'eol_date',
            op: 'before',
            value: '2026-06-30'
          }
        ]
      }
    });
  });

  it('#2315 — Components using a Go release', () => {
    expect(parseOk('schema:Component technology_releases.technology._slug = "go"')).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: COMPONENT.id },
          {
            kind: 'predicate',
            path: [
              { kind: 'forward', fieldId: 'technology_releases' },
              { kind: 'forward', fieldId: 'technology' }
            ],
            fieldId: '_slug',
            op: 'equals',
            value: 'go'
          }
        ]
      }
    });
  });

  it('#2315 — Domains with a descendant Component using Go (backward chain)', () => {
    expect(
      parseOk(
        'schema:Domain <-domain.<-Component.system.technology_releases.technology._slug = "go"'
      )
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: DOMAIN.id },
          {
            kind: 'predicate',
            path: [
              { kind: 'backward', fieldId: 'domain', ownerSchemaId: SYSTEM.id },
              { kind: 'backward', fieldId: 'system', ownerSchemaId: COMPONENT.id },
              { kind: 'forward', fieldId: 'technology_releases' },
              { kind: 'forward', fieldId: 'technology' }
            ],
            fieldId: '_slug',
            op: 'equals',
            value: 'go'
          }
        ]
      }
    });
  });

  it('#2315 — identity-anchored query, no schema: root restriction', () => {
    expect(
      parseOk('technology_releases.technology._id = "00000000-0000-0000-0007-000000000003"')
    ).toEqual({
      root: {
        kind: 'predicate',
        path: [
          { kind: 'forward', fieldId: 'technology_releases' },
          { kind: 'forward', fieldId: 'technology' }
        ],
        fieldId: '_id',
        op: 'equals',
        value: '00000000-0000-0000-0007-000000000003'
      }
    });
  });

  it('backward-traversal ambiguity is rejected at compile time', () => {
    const errors = parseErr(
      'schema:Technology _id = "00000000-0000-0000-0007-000000000003" AND <-technology.<-technology_releases'
    );
    expect(errors.some(e => e.message.includes('ambiguous'))).toBe(true);
  });

  it('disambiguated backward step compiles to a relationExists node', () => {
    expect(
      parseOk(
        'schema:Technology _id = "00000000-0000-0000-0007-000000000003" AND <-technology.<-Component.technology_releases'
      )
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: TECHNOLOGY.id },
          {
            kind: 'predicate',
            path: [],
            fieldId: '_id',
            op: 'equals',
            value: '00000000-0000-0000-0007-000000000003'
          },
          {
            kind: 'relationExists',
            path: [
              { kind: 'backward', fieldId: 'technology', ownerSchemaId: TECHNOLOGY_RELEASE.id },
              { kind: 'backward', fieldId: 'technology_releases', ownerSchemaId: COMPONENT.id }
            ]
          }
        ]
      }
    });
  });

  it('same-instance scoping: bracketed condition binds to one witness', () => {
    expect(
      parseOk(
        'schema:Component technology_releases[release_cycle < 2.0 AND technology._slug = "go"]'
      )
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: COMPONENT.id },
          {
            kind: 'relationExists',
            path: [
              {
                kind: 'forward',
                fieldId: 'technology_releases',
                filter: {
                  kind: 'and',
                  children: [
                    { kind: 'predicate', path: [], fieldId: 'release_cycle', op: 'lt', value: 2 },
                    {
                      kind: 'predicate',
                      path: [{ kind: 'forward', fieldId: 'technology' }],
                      fieldId: '_slug',
                      op: 'equals',
                      value: 'go'
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    });
  });

  it('unscoped form has two independent existential witnesses (no filter nesting)', () => {
    expect(
      parseOk(
        'schema:Component technology_releases.release_cycle < 2.0 AND technology_releases.technology._slug = "go"'
      )
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: COMPONENT.id },
          {
            kind: 'predicate',
            path: [{ kind: 'forward', fieldId: 'technology_releases' }],
            fieldId: 'release_cycle',
            op: 'lt',
            value: 2
          },
          {
            kind: 'predicate',
            path: [
              { kind: 'forward', fieldId: 'technology_releases' },
              { kind: 'forward', fieldId: 'technology' }
            ],
            fieldId: '_slug',
            op: 'equals',
            value: 'go'
          }
        ]
      }
    });
  });

  it('saved-view OR/NOT grouping, with enumLabel resolved to the stored value', () => {
    expect(
      parseOk(
        'schema:Technology (radar_status = "hold" OR radar_status = enumLabel("Assess")) AND NOT category = "library"'
      )
    ).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: TECHNOLOGY.id },
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
    });
  });
});

describe('parseEntityQueryText — typed scalar relation fields', () => {
  it('parses a typed relation hop with a scalar relation-instance filter', () => {
    const result = parseEntityQueryText(
      'schema:"Typed System" data_flows_out[status = "active"]._name = "B"',
      typedSchemas,
      enums,
      null,
      relationSchemas
    );
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [],
              fieldId: '_schemaId',
              op: 'equals',
              value: TYPED_SYSTEM.id
            },
            {
              kind: 'predicate',
              path: [
                {
                  kind: 'typedRelation',
                  fieldId: 'data_flows_out',
                  relationSchemaId: DATA_FLOW.id,
                  direction: 'out',
                  ownerSchemaIds: [TYPED_SYSTEM.id],
                  filter: {
                    kind: 'predicate',
                    path: [],
                    fieldId: 'status',
                    op: 'equals',
                    value: 'active'
                  }
                }
              ],
              fieldId: '_name',
              op: 'equals',
              value: 'B'
            }
          ]
        }
      }
    });
    if (result.ok) {
      expect(printEntityQueryText(result.query, typedSchemas, relationSchemas)).toBe(
        'schema:"Typed System" AND data_flows_out[status = "active"]._name = "B"'
      );
    }
  });

  it('uses a bare typed relation hop as relationExists', () => {
    const result = parseEntityQueryText(
      'data_flows_out',
      typedSchemas,
      enums,
      null,
      relationSchemas
    );
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'relationExists',
          path: [
            {
              kind: 'typedRelation',
              fieldId: 'data_flows_out',
              relationSchemaId: DATA_FLOW.id,
              direction: 'out',
              ownerSchemaIds: [TYPED_SYSTEM.id]
            }
          ]
        }
      }
    });
  });

  it('parses and prints an unbound outgoing typed relation hop', () => {
    const result = parseEntityQueryText(
      'schema:System ->"Data Flow"[status = "active"]._name = "Target"',
      schemas,
      enums,
      null,
      relationSchemas
    );

    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [],
              fieldId: '_schemaId',
              op: 'equals',
              value: SYSTEM.id
            },
            {
              kind: 'predicate',
              path: [
                {
                  kind: 'unboundTypedRelation',
                  relationSchemaId: DATA_FLOW.id,
                  direction: 'in',
                  filter: {
                    kind: 'predicate',
                    path: [],
                    fieldId: 'status',
                    op: 'equals',
                    value: 'active'
                  }
                }
              ],
              fieldId: '_name',
              op: 'equals',
              value: 'Target'
            }
          ]
        }
      }
    });
    if (result.ok) {
      expect(printEntityQueryText(result.query, schemas, relationSchemas)).toBe(
        'schema:System AND ->"Data Flow"[status = "active"]._name = "Target"'
      );
    }
  });

  it('parses a quoted unbound incoming typed relation as relationExists', () => {
    expect(parseEntityQueryText('<-"Data Flow"', schemas, enums, null, relationSchemas)).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'relationExists',
          path: [
            {
              kind: 'unboundTypedRelation',
              relationSchemaId: DATA_FLOW.id,
              direction: 'out'
            }
          ]
        }
      }
    });
  });
});

describe('parseEntityQueryText — entity-valued relation fields (#2670)', () => {
  it('parses a compound typedRelation + relationForward path', () => {
    const result = parseEntityQueryText(
      'schema:"Typed System" data_flows_out[data.alias_name = "Address"]._id = "A"',
      typedSchemas,
      enums,
      null,
      relationSchemas
    );
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [],
              fieldId: '_schemaId',
              op: 'equals',
              value: TYPED_SYSTEM.id
            },
            {
              kind: 'predicate',
              path: [
                {
                  kind: 'typedRelation',
                  fieldId: 'data_flows_out',
                  relationSchemaId: DATA_FLOW.id,
                  direction: 'out',
                  ownerSchemaIds: [TYPED_SYSTEM.id],
                  filter: {
                    kind: 'predicate',
                    path: [{ kind: 'relationForward', fieldId: 'data' }],
                    fieldId: 'alias_name',
                    op: 'equals',
                    value: 'Address'
                  }
                }
              ],
              fieldId: '_id',
              op: 'equals',
              value: 'A'
            }
          ]
        }
      }
    });
    if (result.ok) {
      expect(printEntityQueryText(result.query, typedSchemas, relationSchemas)).toBe(
        'schema:"Typed System" AND data_flows_out[data.alias_name = "Address"]._id = "A"'
      );
    }
  });

  it('parses the reverse <-RelationSchema.field form with an endpoint-scoped bracket filter', () => {
    const result = parseEntityQueryText(
      'schema:"Data Entity" <-"Data Flow".data[_out._id = "A"]',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [],
              fieldId: '_schemaId',
              op: 'equals',
              value: DATA_ENTITY.id
            },
            {
              kind: 'relationExists',
              path: [
                {
                  kind: 'relationBackward',
                  fieldId: 'data',
                  relationSchemaId: DATA_FLOW.id,
                  filter: {
                    kind: 'predicate',
                    path: [{ kind: 'endpoint', direction: 'out' }],
                    fieldId: '_id',
                    op: 'equals',
                    value: 'A'
                  }
                }
              ]
            }
          ]
        }
      }
    });
    if (result.ok) {
      expect(printEntityQueryText(result.query, schemas, relationSchemas)).toBe(
        'schema:"Data Entity" AND <-"Data Flow".data[_out._id = "A"]'
      );
    }
  });

  it('parses the reverse form without brackets as a flat path', () => {
    const result = parseEntityQueryText(
      'schema:"Data Entity" <-"Data Flow".data._out._id = "A"',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'and',
          children: [
            {
              kind: 'predicate',
              path: [],
              fieldId: '_schemaId',
              op: 'equals',
              value: DATA_ENTITY.id
            },
            {
              kind: 'predicate',
              path: [
                { kind: 'relationBackward', fieldId: 'data', relationSchemaId: DATA_FLOW.id },
                { kind: 'endpoint', direction: 'out' }
              ],
              fieldId: '_id',
              op: 'equals',
              value: 'A'
            }
          ]
        }
      }
    });
  });

  it('uses a bare relationBackward hop as relationExists', () => {
    const result = parseEntityQueryText(
      'schema:"Data Entity" <-"Data Flow".data',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query.root).toMatchObject({
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId' },
          {
            kind: 'relationExists',
            path: [{ kind: 'relationBackward', fieldId: 'data', relationSchemaId: DATA_FLOW.id }]
          }
        ]
      });
    }
  });

  it('rejects an unknown entityRelation field inside a typedRelation bracket', () => {
    const errors = parseErr('schema:"Typed System" data_flows_out[missing.alias_name = "x"]');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown relation schema in the <-Schema.field form', () => {
    const result = parseEntityQueryText(
      'schema:"Data Entity" <-"No Such Schema".data',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result.ok).toBe(false);
  });

  it('requires further traversal after a bare _out inside a relation bracket', () => {
    const result = parseEntityQueryText(
      'schema:"Data Entity" <-"Data Flow".data[_out]',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result.ok).toBe(false);
  });
});

describe('parseEntityQueryText — date/enum/empty resolution', () => {
  it('parses root free-text search as a dedicated node', () => {
    expect(parseOk('schema:Component text:"platform"')).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: COMPONENT.id },
          { kind: 'freeText', value: 'platform' }
        ]
      }
    });
  });

  it('rejects free-text search inside a relation scope', () => {
    const errors = parseErr('schema:Component technology_releases[text:"platform"]');
    expect(errors.some(e => e.message.includes('starting entity list'))).toBe(true);
  });

  it('rejects an empty free-text value', () => {
    const errors = parseErr('text:"  "');
    expect(errors.some(e => e.message.includes('must not be empty'))).toBe(true);
  });

  it('resolves date(...) and the </> to before/after mapping for date fields', () => {
    const query = parseOk('schema:Component technology_releases.eol_date > date("2026-01-01")');
    const predicate = (query.root as { children: unknown[] }).children[1];
    expect(predicate).toEqual({
      kind: 'predicate',
      path: [{ kind: 'forward', fieldId: 'technology_releases' }],
      fieldId: 'eol_date',
      op: 'after',
      value: '2026-01-01'
    });
  });

  it('resolves `=` on a date field to the `on` op', () => {
    const query = parseOk('schema:Component technology_releases.eol_date = date("2026-01-01")');
    const predicate = (query.root as { children: unknown[] }).children[1];
    expect(predicate).toEqual({
      kind: 'predicate',
      path: [{ kind: 'forward', fieldId: 'technology_releases' }],
      fieldId: 'eol_date',
      op: 'on',
      value: '2026-01-01'
    });
  });

  it('rejects an unrecognized enumLabel', () => {
    const errors = parseErr('schema:Technology radar_status = enumLabel("Nope")');
    expect(errors.some(e => e.message.includes('Unrecognized enum label'))).toBe(true);
  });

  it('rejects a comparator with no meaning against a select field', () => {
    const errors = parseErr('schema:Technology radar_status < "hold"');
    expect(errors.some(e => e.message.includes('select field'))).toBe(true);
  });

  it('parses the `empty` keyword value', () => {
    const query = parseOk('schema:Technology category = empty');
    expect((query.root as { children: unknown[] }).children[1]).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: 'category',
      op: 'empty',
      value: null
    });
  });

  it('rejects `!=` combined with the `empty` keyword', () => {
    const errors = parseErr('schema:Technology category != empty');
    expect(errors.some(e => e.message.includes('cannot be combined'))).toBe(true);
  });

  it('a bare path is shorthand for not_empty', () => {
    expect(parseOk('schema:Technology category')).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: TECHNOLOGY.id },
          { kind: 'predicate', path: [], fieldId: 'category', op: 'not_empty', value: null }
        ]
      }
    });
  });

  it('a bare relation path compiles to relationExists with no filter', () => {
    expect(parseOk('schema:Component technology_releases')).toEqual({
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: COMPONENT.id },
          { kind: 'relationExists', path: [{ kind: 'forward', fieldId: 'technology_releases' }] }
        ]
      }
    });
  });
});

describe('parseEntityQueryText — MAX_PATH_HOPS', () => {
  // A self-referential schema so a chain of 7 backward hops resolves unambiguously at every step
  // (the seeded catalog above is only 2-3 levels deep, per specs/QUERY_LANGUAGE.md §2).
  const LOOP = makeSchema('loop-id', 'Loop');
  LOOP.fields.push({
    id: 'parent',
    name: 'Parent',
    type: 'containment',
    schemaId: LOOP.id,
    minCount: 0,
    maxCount: 1
  });
  const loopSchemas: SchemaCatalog = new Map([[LOOP.id, LOOP]]);

  it('accepts a path at exactly MAX_PATH_HOPS', () => {
    const result = parseEntityQueryText(
      'schema:Loop <-parent.<-parent.<-parent.<-parent.<-parent.<-parent',
      loopSchemas,
      new Map()
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a path exceeding MAX_PATH_HOPS', () => {
    const result = parseEntityQueryText(
      'schema:Loop <-parent.<-parent.<-parent.<-parent.<-parent.<-parent.<-parent',
      loopSchemas,
      new Map()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('MAX_PATH_HOPS'))).toBe(true);
    }
  });
});

describe('parseEntityQueryText — escaping', () => {
  it('accepts \\" and \\\\ escapes inside a quoted string', () => {
    const query = parseOk('schema:Technology category = "back\\\\slash and \\"quote\\""');
    expect((query.root as { children: unknown[] }).children[1]).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: 'category',
      op: 'equals',
      value: 'back\\slash and "quote"'
    });
  });

  it('rejects any other backslash escape', () => {
    const errors = parseErr('schema:Technology category = "bad\\nescape"');
    expect(errors.some(e => e.message.includes('Invalid escape sequence'))).toBe(true);
  });
});

describe('printEntityQueryText', () => {
  it('round-trips the #2300 EOL-risk query, re-wrapping the date value in date(...)', () => {
    const text = 'schema:Component technology_releases.eol_date < date("2026-06-30")';
    const query = parseOk(text);
    const printed = printEntityQueryText(query, schemas);
    expect(printed).toContain('date("2026-06-30")');
    expect(parseOk(printed)).toEqual(query);
  });

  it('round-trips the same-instance scoped query', () => {
    const text =
      'schema:Component technology_releases[release_cycle < 2.0 AND technology._slug = "go"]';
    const query = parseOk(text);
    const printed = printEntityQueryText(query, schemas);
    expect(parseOk(printed)).toEqual(query);
  });

  it('round-trips the saved-view OR/NOT grouping query', () => {
    const text =
      'schema:Technology (radar_status = "hold" OR radar_status = "assess") AND NOT category = "library"';
    const query = parseOk(text);
    const printed = printEntityQueryText(query, schemas);
    expect(parseOk(printed)).toEqual(query);
  });

  it('round-trips a root free-text query', () => {
    const query = parseOk('schema:Component text:"platform \\"api\\""');
    expect(printEntityQueryText(query, schemas)).toBe(
      'schema:Component AND text:"platform \\"api\\""'
    );
    expect(parseOk(printEntityQueryText(query, schemas))).toEqual(query);
  });

  it('accepts conformance status pseudo-fields in saved-view query text', () => {
    const query = parseOk('schema:Component _conformanceStatus = "unresolved"');
    expect(query.root).toMatchObject({ kind: 'and' });
    expect(query.root.kind === 'and' ? query.root.children : []).toContainEqual({
      kind: 'predicate',
      path: [],
      fieldId: '_conformanceStatus',
      op: 'equals',
      value: 'unresolved'
    });
    expect(parseOk(printEntityQueryText(query, schemas))).toEqual(query);
  });

  it('always prints an explicit owner schema for backward steps', () => {
    const query = parseOk(
      'schema:Domain <-domain.<-Component.system.technology_releases.technology._slug = "go"'
    );
    const printed = printEntityQueryText(query, schemas);
    expect(printed).toContain('<-Component.system');
    expect(parseOk(printed)).toEqual(query);
  });

  it.each([
    {
      name: 'same-instance scoped filter',
      source:
        'schema:Component technology_releases[release_cycle < 2.0 AND technology._slug = "go"]',
      expected: `schema:Component AND
technology_releases[
  release_cycle < 2 AND
  technology._slug = "go"
]`
    },
    {
      name: 'saved-view OR/NOT grouping',
      source:
        'schema:Technology (radar_status = "hold" OR radar_status = enumLabel("Assess")) AND NOT category = "library"',
      expected: `schema:Technology AND
(
  radar_status = "hold" OR
  radar_status = "assess"
) AND
NOT category = "library"`
    }
  ])('$name has a readable golden format and round-trips', ({ source, expected }) => {
    const query = parseOk(source);
    const printed = printEntityQueryText(query, schemas, new Map(), { pretty: true });

    expect(printed).toBe(expected);
    expect(printed.endsWith('\n')).toBe(false);
    expect(parseOk(printed)).toEqual(query);
  });

  it('wraps long flat expressions at the configured width', () => {
    const query = parseOk(
      'schema:Component technology_releases.eol_date < date("2026-06-30") AND technology_releases.technology._slug = "go"'
    );

    const printed = printEntityQueryText(query, schemas, new Map(), {
      pretty: true,
      maxLineLength: 60
    });

    expect(printed).toBe(`schema:Component AND
technology_releases.eol_date < date("2026-06-30") AND
technology_releases.technology._slug = "go"`);
    expect(parseOk(printed)).toEqual(query);
  });
});

describe('parseEntityQueryText field-group restriction', () => {
  const RESTRICTED = makeSchema('restricted-id', 'Restricted', [
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

  it('reports a restricted field identically to a typo', () => {
    const noAccess = authCtxWithTeamRoles({});
    const restrictedResult = parseEntityQueryText(
      'schema:Restricted secret = "x"',
      restrictedSchemas,
      enums,
      noAccess
    );
    const typoResult = parseEntityQueryText(
      'schema:Restricted sekret = "x"',
      restrictedSchemas,
      enums,
      noAccess
    );
    expect(restrictedResult).toEqual({
      ok: false,
      errors: [
        {
          offset: expect.any(Number),
          message: "Schema 'Restricted' does not define field 'secret'"
        }
      ]
    });
    expect(typoResult).toEqual({
      ok: false,
      errors: [
        {
          offset: expect.any(Number),
          message: "Schema 'Restricted' does not define field 'sekret'"
        }
      ]
    });
  });

  it('resolves a restricted field once the caller has view or edit access', () => {
    const viewer = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    const result = parseEntityQueryText(
      'schema:Restricted secret = "x"',
      restrictedSchemas,
      enums,
      viewer
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a restricted backward relation field', () => {
    const noAccess = authCtxWithTeamRoles({});
    const result = parseEntityQueryText('<-link.name', restrictedSchemas, enums, noAccess);
    expect(result.ok).toBe(false);
  });

  it('defaults to unrestricted when authCtx is omitted (internal/system callers)', () => {
    const result = parseEntityQueryText('schema:Restricted secret = "x"', restrictedSchemas, enums);
    expect(result.ok).toBe(true);
  });

  it('retains only accessible owner schemas for an unqualified typed-relation field', () => {
    const noAccess = authCtxWithTeamRoles({});
    const result = parseEntityQueryText(
      'data_flows_out',
      collidingTypedSchemas,
      enums,
      noAccess,
      relationSchemas
    );
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'relationExists',
          path: [
            {
              kind: 'typedRelation',
              fieldId: 'data_flows_out',
              relationSchemaId: DATA_FLOW.id,
              direction: 'out',
              ownerSchemaIds: [TYPED_SYSTEM.id]
            }
          ]
        }
      }
    });
  });

  it('rejects an explicitly selected typed-relation owner schema that is restricted', () => {
    const noAccess = authCtxWithTeamRoles({});
    const result = parseEntityQueryText(
      'schema:"Locked Typed System" data_flows_out',
      collidingTypedSchemas,
      enums,
      noAccess,
      relationSchemas
    );
    expect(result.ok).toBe(false);
  });

  // #2592: a bare (no `schema:` prefix) field id resolves against every schema in the catalog, so
  // a field id restricted in one schema but also defined, unrestricted, by an unrelated schema
  // still resolves here — matching the collapsing behavior above. The per-schema leak this
  // collision would otherwise cause is closed downstream, at compile time, by scoping the
  // compiled SQL to only the schemas that actually grant the field (entityQueryIRCompiler.ts).
  it('still resolves a colliding field via an unrelated unrestricted schema', () => {
    const UNRESTRICTED_COLLIDER = makeSchema('collider-id', 'Collider', [
      { id: 'secret', name: 'Secret', type: 'text' }
    ]);
    const collidingSchemas: SchemaCatalog = new Map([
      ...restrictedSchemas,
      [UNRESTRICTED_COLLIDER.id, UNRESTRICTED_COLLIDER]
    ]);
    const noAccess = authCtxWithTeamRoles({});
    const result = parseEntityQueryText('secret = "x"', collidingSchemas, enums, noAccess);
    expect(result.ok).toBe(true);
  });
});

// #3066: found live in the Relations browser's Advanced mode — a relation-rooted saved view's
// top-level `_schemaId equals <relationSchemaId>` predicate (the same pattern the Relations
// browser's "Type" filter and the seeded governance views use) printed the raw UUID instead of
// the schema name, and re-parsing that text as `schema:"Data Flow"` threw "Unknown schema" since
// root-schema resolution only ever consulted the entity schema catalog.
describe('relation-rooted queries — root-level schema: qualifier (#3066)', () => {
  const relationRootedQuery: EntityQuery = {
    root_kind: 'relation',
    root: {
      kind: 'and',
      children: [
        { kind: 'predicate', path: [], fieldId: '_schemaId', op: 'equals', value: DATA_FLOW.id },
        { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }
      ]
    }
  };

  it('prints the relation schema name, not its raw id', () => {
    expect(printEntityQueryText(relationRootedQuery, schemas, relationSchemas)).toBe(
      'schema:"Data Flow" AND status = "active"'
    );
  });

  it('parses schema:"Data Flow" at the root into a root_kind: relation query', () => {
    const result = parseEntityQueryText(
      'schema:"Data Flow" AND status = "active"',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result).toEqual({ ok: true, query: relationRootedQuery });
  });

  it('round-trips print -> parse back to the same query', () => {
    const printed = printEntityQueryText(relationRootedQuery, schemas, relationSchemas);
    const result = parseEntityQueryText(printed, schemas, enums, null, relationSchemas);
    expect(result).toEqual({ ok: true, query: relationRootedQuery });
  });

  it('pretty-prints nested relation-rooted boolean expressions', () => {
    const query: EntityQuery = {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_schemaId',
            op: 'equals',
            value: DATA_FLOW.id
          },
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' },
              { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'paused' }
            ]
          }
        ]
      }
    };

    const printed = printEntityQueryText(query, schemas, relationSchemas, { pretty: true });
    expect(printed).toBe(`schema:"Data Flow" AND
(
  status = "active" OR
  status = "paused"
)`);
    expect(parseEntityQueryText(printed, schemas, enums, null, relationSchemas)).toEqual({
      ok: true,
      query
    });
  });

  it('still rejects schema: nested inside an already-scoped relation row', () => {
    // <-"Data Flow".data reaches Data Entity rows through the relation's own entityRelation
    // field; a further schema: inside that bracket would be redundant/invalid, unchanged from
    // before this fix.
    const result = parseEntityQueryText(
      '<-"Data Flow".data[schema:"Data Flow"]',
      schemas,
      enums,
      null,
      relationSchemas
    );
    expect(result.ok).toBe(false);
  });
});

// #3066: found live via the seeded "Review Overdue" view — printing a `{ $now: true }` relative-
// date literal (#3090) against a date field produced `date("[object Object]")` since the printer
// naively stringified the object. now()/now(N) closes the round trip through Advanced mode.
describe('relative-date literal — now()/now(N) (#3090, #3066)', () => {
  const reviewDateField = makeSchema('review-entity-id', 'Reviewable', [
    { id: 'review_date', name: 'Review Date', type: 'date' }
  ]);
  const reviewSchemas: SchemaCatalog = new Map([...schemas, [reviewDateField.id, reviewDateField]]);

  it('prints a bare $now literal as now()', () => {
    const query: EntityQuery = {
      schemaId: reviewDateField.id,
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_schemaId',
            op: 'equals',
            value: reviewDateField.id
          },
          {
            kind: 'predicate',
            path: [],
            fieldId: 'review_date',
            op: 'before',
            value: { $now: true }
          }
        ]
      }
    };
    expect(printEntityQueryText(query, reviewSchemas)).toBe(
      'schema:Reviewable AND review_date < now()'
    );
  });

  it('prints a $now literal with an offset as now(N)', () => {
    const printed = printValueForOffset(30);
    expect(printed).toBe('schema:Reviewable AND review_date < now(30)');
  });

  it('parses now() into a bare $now literal', () => {
    const result = parseEntityQueryText('review_date < now()', reviewSchemas, enums);
    expect(result).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'predicate',
          path: [],
          fieldId: 'review_date',
          op: 'before',
          value: { $now: true }
        }
      }
    });
  });

  it('parses now(N), including a negative offset', () => {
    expect(parseEntityQueryText('review_date > now(-7)', reviewSchemas, enums)).toEqual({
      ok: true,
      query: {
        root: {
          kind: 'predicate',
          path: [],
          fieldId: 'review_date',
          op: 'after',
          value: { $now: true, offsetDays: -7 }
        }
      }
    });
  });

  it('rejects now() against a non-date field', () => {
    const result = parseEntityQueryText('status = now()', schemas, enums, null, relationSchemas);
    expect(result.ok).toBe(false);
  });

  function printValueForOffset(offsetDays: number): string {
    const query: EntityQuery = {
      schemaId: reviewDateField.id,
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_schemaId',
            op: 'equals',
            value: reviewDateField.id
          },
          {
            kind: 'predicate',
            path: [],
            fieldId: 'review_date',
            op: 'before',
            value: { $now: true, offsetDays }
          }
        ]
      }
    };
    return printEntityQueryText(query, reviewSchemas);
  }
});

describe('columns projection sub-clause (specs/QUERY_LANGUAGE.md §4.6)', () => {
  const parseRelOk = (text: string): EntityQuery => {
    const result = parseEntityQueryText(text, schemas, enums, null, relationSchemas);
    if (!result.ok) throw new Error(`expected ok, got: ${JSON.stringify(result.errors)}`);
    return result.query;
  };

  it('binds a scoped columns capture to the segment witness and round-trips', () => {
    const text =
      'schema:Component technology_releases[eol_date < date("2026-06-30") columns eol_date as "TR EOL", latest_version]';
    const query = parseOk(text);
    expect(query.projections).toEqual([
      {
        path: [
          {
            kind: 'forward',
            fieldId: 'technology_releases',
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: 'eol_date',
              op: 'before',
              value: '2026-06-30'
            }
          }
        ],
        fieldId: 'eol_date',
        alias: 'TR EOL'
      },
      {
        path: [
          {
            kind: 'forward',
            fieldId: 'technology_releases',
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: 'eol_date',
              op: 'before',
              value: '2026-06-30'
            }
          }
        ],
        fieldId: 'latest_version'
      }
    ]);
    const printed = printEntityQueryText(query, schemas);
    expect(printed).toContain('columns eol_date as "TR EOL", latest_version');
    expect(parseOk(printed)).toEqual(query);
  });

  it('supports a capture-only bracket on an unfiltered traversal', () => {
    const text = 'schema:Component technology_releases.technology[columns radar_status]';
    const query = parseOk(text);
    expect(query.projections).toEqual([
      {
        path: [
          { kind: 'forward', fieldId: 'technology_releases' },
          { kind: 'forward', fieldId: 'technology' }
        ],
        fieldId: 'radar_status'
      }
    ]);
    expect(query.root.kind).toBe('and');
    expect(parseOk(printEntityQueryText(query, schemas))).toEqual(query);
  });

  it('round-trips a relation-rooted relationForward columns capture', () => {
    const text = 'schema:"Data Flow" AND data[columns alias_name as "Carried alias"]';
    const query = parseRelOk(text);
    expect(query.projections).toEqual([
      {
        path: [{ kind: 'relationForward', fieldId: 'data' }],
        fieldId: 'alias_name',
        alias: 'Carried alias'
      }
    ]);
    const printed = printEntityQueryText(query, schemas, relationSchemas);
    expect(printed).toContain('columns alias_name as "Carried alias"');
    const reparsed = parseEntityQueryText(printed, schemas, enums, null, relationSchemas);
    expect(reparsed).toEqual({ ok: true, query });
  });

  it('rejects columns combined with a trailing comparator on the same segment', () => {
    const errors = parseErr(
      'schema:Component technology_releases[columns eol_date] < date("2026-06-30")'
    );
    expect(errors[0]!.message).toContain('cannot be combined with a trailing comparator');
  });

  it('rejects a capture that does not end on a scalar field', () => {
    const errors = parseErr('schema:Component technology_releases[columns technology]');
    expect(errors[0]!.message).toContain('must end on a scalar field');
  });

  it('treats `columns` before a comparator as an ordinary field name', () => {
    const withField = makeSchema('with-columns-id', 'WithColumns', [
      { id: 'columns', name: 'Columns', type: 'text' }
    ]);
    const s: SchemaCatalog = new Map([[withField.id, withField]]);
    const result = parseEntityQueryText('schema:WithColumns columns = "x"', s, enums);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query.projections).toBeUndefined();
    }
  });

  it('round-trips a chain columns capture', () => {
    const text = 'schema:Component technology_releases[columns chain technology as "Tech chain"]';
    const query = parseOk(text);
    expect(query.projections).toEqual([
      {
        path: [
          { kind: 'forward', fieldId: 'technology_releases' },
          { kind: 'forward', fieldId: 'technology' }
        ],
        fieldId: 'technology',
        chain: true,
        alias: 'Tech chain'
      }
    ]);
    expect(parseOk(printEntityQueryText(query, schemas))).toEqual(query);
  });

  it('round-trips a capture that traverses past a scoped segment', () => {
    const text =
      'schema:Component technology_releases[eol_date < date("2026-06-30") columns technology.category as "Tech category"]';
    const query = parseOk(text);
    expect(query.projections).toEqual([
      {
        path: [
          {
            kind: 'forward',
            fieldId: 'technology_releases',
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: 'eol_date',
              op: 'before',
              value: '2026-06-30'
            }
          },
          { kind: 'forward', fieldId: 'technology' }
        ],
        fieldId: 'category',
        alias: 'Tech category'
      }
    ]);
    expect(parseOk(printEntityQueryText(query, schemas))).toEqual(query);
  });

  it('round-trips a source:relation capture off a typed relation link', () => {
    const parseTypedOk = (text: string): EntityQuery => {
      const result = parseEntityQueryText(text, typedSchemas, enums, null, relationSchemas);
      if (!result.ok) throw new Error(`expected ok, got: ${JSON.stringify(result.errors)}`);
      return result.query;
    };
    const text =
      'schema:"Typed System" data_flows_out[status = "active" columns status as "Flow status"]';
    const query = parseTypedOk(text);
    expect(query.projections).toEqual([
      {
        path: [
          {
            kind: 'typedRelation',
            fieldId: 'data_flows_out',
            relationSchemaId: DATA_FLOW.id,
            direction: 'out',
            ownerSchemaIds: [TYPED_SYSTEM.id],
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: 'status',
              op: 'equals',
              value: 'active'
            }
          }
        ],
        fieldId: 'status',
        source: 'relation',
        alias: 'Flow status'
      }
    ]);
    const printed = printEntityQueryText(query, typedSchemas, relationSchemas);
    expect(printed).toContain('columns status as "Flow status"');
    const reparsed = parseEntityQueryText(printed, typedSchemas, enums, null, relationSchemas);
    expect(reparsed).toEqual({ ok: true, query });
  });
});
