import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  parseEntityQueryText,
  printEntityQueryText,
  type EnumCatalog
} from './entityQueryTextCompiler';
import type { SchemaCatalog } from './entityQueryIRValidator';
import type { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';

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

const schemas: SchemaCatalog = new Map(
  [DOMAIN, SYSTEM, TECHNOLOGY, TECHNOLOGY_RELEASE, COMPONENT, RESOURCE].map(s => [s.id, s])
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

describe('parseEntityQueryText — date/enum/empty resolution', () => {
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

  it('always prints an explicit owner schema for backward steps', () => {
    const query = parseOk(
      'schema:Domain <-domain.<-Component.system.technology_releases.technology._slug = "go"'
    );
    const printed = printEntityQueryText(query, schemas);
    expect(printed).toContain('<-Component.system');
    expect(parseOk(printed)).toEqual(query);
  });
});
