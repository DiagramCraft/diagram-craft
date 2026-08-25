import { describe, expect, it } from 'vitest';
import {
  buildCreateSchemaInput,
  buildUpdateSchemaInput,
  clearOrphanedGroupIds,
  normalizeEntityTemplates,
  normalizeSchemaFields,
  normalizeSchemaGroups,
  remapLayoutFieldIds,
  toApiEnum,
  toApiSchema
} from './schemaHelpers';
import { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';
import { DetailLayoutConfig, SchemaField } from '@arch-register/api-types/schemaContract';

const now = new Date('2025-06-01T12:00:00.000Z');
const nowIso = '2025-06-01T12:00:00.000Z';

// ── toApiEnum ─────────────────────────────────────────────────

describe('toApiEnum', () => {
  it('maps fields and serializes dates to ISO strings', () => {
    const e: WorkspaceEnumDbResult = {
      id: 'enum-1',
      workspace: 'ws-1',
      name: 'Status',
      options: [{ value: 'active', label: 'Active' }],
      sort_order: 0,
      created_at: now,
      updated_at: now
    };
    const result = toApiEnum(e);
    expect(result.id).toBe('enum-1');
    expect(result.options).toEqual([
      { value: 'active', label: 'Active', description: null, retired: false, restricted: false }
    ]);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});

// ── toApiSchema ───────────────────────────────────────────────

describe('toApiSchema', () => {
  const baseEnum: WorkspaceEnumDbResult = {
    id: 'enum-env',
    workspace: 'ws-1',
    name: 'Env',
    options: [{ value: 'prod', label: 'Production' }],
    sort_order: 0,
    created_at: now,
    updated_at: now
  };

  const schema: SchemaDbResult = {
    id: 'schema-1',
    workspace: 'ws-1',
    name: 'Application',
    category: 'Architecture',
    description: 'desc',
    fields: [
      { id: 'env', name: 'Env', type: 'select', enumId: 'enum-env' },
      { id: 'notes', name: 'Notes', type: 'text' },
      { id: 'go_live', name: 'Go Live', type: 'date' },
      { id: 'headcount', name: 'Headcount', type: 'number', min: 0, max: 100 }
    ],
    templates: [],
    groups: [{ id: 'g1', name: 'Basics' }],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'APP',
    version: 1,
    created_at: now,
    updated_at: now
  };

  it('resolves options for select fields', () => {
    const result = toApiSchema(schema, 5, [baseEnum]);
    expect(result.category).toBe('Architecture');
    const envField = result.fields.find(f => f.id === 'env') as Record<string, unknown>;
    expect(envField?.options).toEqual([{ value: 'prod', label: 'Production' }]);
  });

  it('falls back to empty options when enum is missing', () => {
    const result = toApiSchema(schema, 5, []);
    const envField = result.fields.find(f => f.id === 'env') as Record<string, unknown>;
    expect(envField?.options).toEqual([]);
  });

  it('leaves non-select fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const notesField = result.fields.find(f => f.id === 'notes');
    expect(notesField).toEqual({ id: 'notes', name: 'Notes', type: 'text' });
  });

  it('passes through date fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const dateField = result.fields.find(f => f.id === 'go_live');
    expect(dateField).toEqual({ id: 'go_live', name: 'Go Live', type: 'date' });
  });

  it('passes through number fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const numberField = result.fields.find(f => f.id === 'headcount');
    expect(numberField).toEqual({
      id: 'headcount',
      name: 'Headcount',
      type: 'number',
      min: 0,
      max: 100
    });
  });

  it('includes entity count and serializes dates', () => {
    const result = toApiSchema(schema, 42, []);
    expect(result.entity_count).toBe(42);
    expect(result.created_at).toBe(nowIso);
  });

  it('passes through groups', () => {
    const result = toApiSchema(schema, 5, []);
    expect(result.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
  });

  it('defaults groups to an empty array when missing from the row', () => {
    const { groups: _groups, ...schemaWithoutGroups } = schema;
    const result = toApiSchema(schemaWithoutGroups as SchemaDbResult, 5, []);
    expect(result.groups).toEqual([]);
  });
});

// ── buildCreateSchemaInput (number field validation) ────────────

describe('buildCreateSchemaInput', () => {
  it('trims category values and normalizes blank or omitted values to null', () => {
    expect(
      buildCreateSchemaInput(
        'ws-1',
        { name: 'Application', category: '  Architecture  ' },
        new Set(),
        now
      ).category
    ).toBe('Architecture');
    expect(
      buildCreateSchemaInput('ws-1', { name: 'Application', category: '  ' }, new Set(), now)
        .category
    ).toBeNull();
    expect(
      buildCreateSchemaInput('ws-1', { name: 'Application' }, new Set(), now).category
    ).toBeNull();
  });

  it('accepts a number field with min <= max', () => {
    const result = buildCreateSchemaInput(
      'ws-1',
      {
        name: 'Application',
        fields: [{ id: 'headcount', name: 'Headcount', type: 'number', min: 0, max: 100 }]
      },
      new Set(),
      now
    );
    expect(result.fields).toEqual([
      { id: 'headcount', name: 'Headcount', type: 'number', min: 0, max: 100 }
    ]);
  });

  it('keeps scalar completeness and minimum cardinality synchronized', () => {
    const fields = normalizeSchemaFields([
      {
        id: 'required',
        name: 'Required',
        type: 'text',
        requirementLevel: 'required',
        minCardinality: 0
      },
      {
        id: 'multi',
        name: 'Multi',
        type: 'select',
        requirementLevel: 'optional',
        minCardinality: 2,
        maxCardinality: 3,
        enumId: 'status'
      },
      {
        id: 'expected',
        name: 'Expected',
        type: 'text',
        requirementLevel: 'expected',
        minCardinality: 0
      }
    ]);

    expect(fields).toEqual([
      expect.objectContaining({
        id: 'required',
        requirementLevel: 'required',
        minCardinality: 1
      }),
      expect.objectContaining({
        id: 'multi',
        requirementLevel: 'required',
        minCardinality: 2,
        maxCardinality: 3
      }),
      expect.objectContaining({
        id: 'expected',
        requirementLevel: 'expected',
        minCardinality: 0
      })
    ]);
  });

  it('rejects a number field with min > max', () => {
    expect(() =>
      buildCreateSchemaInput(
        'ws-1',
        {
          name: 'Application',
          fields: [{ id: 'headcount', name: 'Headcount', type: 'number', min: 100, max: 0 }]
        },
        new Set(),
        now
      )
    ).toThrow('Number field min must be less than or equal to max');
  });

  it('validates typed-relation cardinality without changing requirement level', () => {
    const fields = normalizeSchemaFields([
      {
        id: 'dependencies',
        name: 'Dependencies',
        type: 'typedRelation',
        relationSchemaId: 'relation-schema-1',
        direction: 'out',
        requirementLevel: 'optional',
        minCount: 2,
        maxCount: 3
      }
    ]);

    expect(fields[0]).toEqual(
      expect.objectContaining({
        requirementLevel: 'optional',
        minCount: 2,
        maxCount: 3
      })
    );
  });

  it('rejects an invalid typed-relation cardinality range', () => {
    expect(() =>
      normalizeSchemaFields([
        {
          id: 'dependencies',
          name: 'Dependencies',
          type: 'typedRelation',
          relationSchemaId: 'relation-schema-1',
          direction: 'out',
          minCount: 3,
          maxCount: 2
        }
      ])
    ).toThrow('minCount must be less than or equal to maxCount');
  });

  it('defaults groups to an empty array when omitted', () => {
    const result = buildCreateSchemaInput('ws-1', { name: 'Application' }, new Set(), now);
    expect(result.groups).toEqual([]);
  });

  it('passes through provided groups', () => {
    const result = buildCreateSchemaInput(
      'ws-1',
      { name: 'Application', groups: [{ id: 'g1', name: 'Basics' }] },
      new Set(),
      now
    );
    expect(result.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
  });

  it('rejects fields referencing a group not present in the submitted groups', () => {
    expect(() =>
      buildCreateSchemaInput(
        'ws-1',
        {
          name: 'Application',
          fields: [{ id: 'notes', name: 'Notes', type: 'text', groupId: 'missing' }],
          groups: [{ id: 'g1', name: 'Basics' }]
        },
        new Set(),
        now
      )
    ).toThrow("Field 'Notes' references missing field group 'missing'");
  });
});

describe('buildUpdateSchemaInput', () => {
  const current: SchemaDbResult = {
    id: 'schema-1',
    workspace: 'ws-1',
    name: 'Application',
    category: 'Architecture',
    description: '',
    fields: [{ id: 'notes', name: 'Notes', type: 'text', groupId: 'g1' }],
    templates: [],
    groups: [{ id: 'g1', name: 'Basics' }],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'APP',
    version: 1,
    created_at: now,
    updated_at: now
  };

  it('falls back to the current groups when omitted', () => {
    const result = buildUpdateSchemaInput({ name: 'Application' }, current, new Set(), now);
    expect(result.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
    expect(result.category).toBe('Architecture');
  });

  it('trims a changed category and clears whitespace-only values', () => {
    expect(
      buildUpdateSchemaInput(
        { name: 'Application', category: '  Portfolio  ' },
        current,
        new Set(),
        now
      ).category
    ).toBe('Portfolio');
    expect(
      buildUpdateSchemaInput({ name: 'Application', category: '   ' }, current, new Set(), now)
        .category
    ).toBeNull();
  });

  it('replaces groups when provided', () => {
    const result = buildUpdateSchemaInput(
      {
        name: 'Application',
        fields: [{ id: 'notes', name: 'Notes', type: 'text', groupId: 'g2' }],
        groups: [{ id: 'g2', name: 'Advanced' }]
      },
      current,
      new Set(),
      now
    );
    expect(result.groups).toEqual([{ id: 'g2', name: 'Advanced' }]);
  });

  it('rejects fields referencing a group removed from groups', () => {
    expect(() =>
      buildUpdateSchemaInput({ name: 'Application', groups: [] }, current, new Set(), now)
    ).toThrow("Field 'Notes' references missing field group 'g1'");
  });
});

describe('normalizeSchemaGroups', () => {
  it('returns an empty array when undefined', () => {
    expect(normalizeSchemaGroups(undefined)).toEqual([]);
  });

  it('trims names/ids and drops empty description', () => {
    expect(normalizeSchemaGroups([{ id: ' g1 ', name: ' Basics ', description: '  ' }])).toEqual([
      { id: 'g1', name: 'Basics' }
    ]);
  });

  it('retains a non-empty description', () => {
    expect(
      normalizeSchemaGroups([{ id: 'g1', name: 'Basics', description: 'Core fields' }])
    ).toEqual([{ id: 'g1', name: 'Basics', description: 'Core fields' }]);
  });

  it('rejects a missing name', () => {
    expect(() => normalizeSchemaGroups([{ id: 'g1', name: '' }])).toThrow(
      'Group name is required and must be a string'
    );
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      normalizeSchemaGroups([
        { id: 'g1', name: 'Basics' },
        { id: 'g1', name: 'Advanced' }
      ])
    ).toThrow("Duplicate group id 'g1'");
  });

  it('rejects duplicate names case-insensitively', () => {
    expect(() =>
      normalizeSchemaGroups([
        { id: 'g1', name: 'Basics' },
        { id: 'g2', name: 'basics' }
      ])
    ).toThrow("Duplicate group name 'basics'");
  });
});

describe('clearOrphanedGroupIds', () => {
  it('clears groupId when the group no longer exists', () => {
    const fields = [{ id: 'f1', groupId: 'missing' }];
    expect(clearOrphanedGroupIds(fields, [{ id: 'g1', name: 'Basics' }])).toEqual([
      { id: 'f1', groupId: undefined }
    ]);
  });

  it('leaves groupId untouched when the group exists', () => {
    const fields = [{ id: 'f1', groupId: 'g1' }];
    expect(clearOrphanedGroupIds(fields, [{ id: 'g1', name: 'Basics' }])).toEqual([
      { id: 'f1', groupId: 'g1' }
    ]);
  });
});

describe('normalizeEntityTemplates', () => {
  const fields: SchemaField[] = [
    { id: 'enabled', name: 'Enabled', type: 'boolean' },
    { id: 'score', name: 'Score', type: 'number', min: 0, max: 10 },
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: 'parent-schema',
      minCount: 0,
      maxCount: 1
    },
    {
      id: 'dependencies',
      name: 'Dependencies',
      type: 'typedRelation',
      relationSchemaId: 'relation-schema-1',
      direction: 'out',
      minCount: 0,
      maxCount: 1
    }
  ];

  it('normalizes partial values while retaining false and relation ids', () => {
    expect(
      normalizeEntityTemplates(
        [
          {
            id: 'default',
            name: ' Default ',
            values: {
              owner: 'team-1',
              tags: [' vendor ', 'vendor'],
              fields: {
                enabled: false,
                score: 4,
                parent: ['entity-1'],
                dependencies: [{ note: 'prefill' }],
                removed: 'ignored'
              }
            }
          }
        ],
        fields
      )
    ).toEqual([
      {
        id: 'default',
        name: 'Default',
        values: {
          owner: 'team-1',
          tags: ['vendor'],
          fields: {
            enabled: false,
            score: 4,
            parent: ['entity-1'],
            dependencies: [{ note: 'prefill' }]
          }
        }
      }
    ]);
  });

  it('rejects duplicate names case-insensitively', () => {
    expect(() =>
      normalizeEntityTemplates(
        [
          { id: 'one', name: 'Vendor', values: { fields: {} } },
          { id: 'two', name: 'vendor', values: { fields: {} } }
        ],
        fields
      )
    ).toThrow("Duplicate template name 'vendor'");
  });

  it('rejects too many typed-relation template drafts', () => {
    expect(() =>
      normalizeEntityTemplates(
        [
          {
            id: 'default',
            name: 'Default',
            values: { fields: { dependencies: [{}, {}] } }
          }
        ],
        fields
      )
    ).toThrow('allows at most 1 relation');
  });
});

// ── remapLayoutFieldIds ──────────────────────────────────────

describe('remapLayoutFieldIds', () => {
  const layout: DetailLayoutConfig = {
    version: 1,
    tabs: [
      {
        id: 'overview',
        title: 'Overview',
        columns: 1,
        panels: [
          {
            id: 'properties',
            title: 'Properties',
            collapsible: false,
            column: 1,
            blocks: [
              { id: 'field:f1', kind: 'field', refId: 'f1' },
              { id: 'field:f2', kind: 'field', refId: 'f2' }
            ]
          },
          {
            id: 'group:g1',
            title: 'Group One',
            collapsible: false,
            column: 1,
            blocks: [{ id: 'fieldGroup:g1', kind: 'fieldGroup', refId: 'g1' }]
          },
          {
            id: 'links',
            title: 'Links',
            collapsible: true,
            column: 1,
            blocks: [{ id: 'links', kind: 'links' }]
          }
        ]
      }
    ]
  };

  it('returns undefined unchanged', () => {
    expect(remapLayoutFieldIds(undefined, new Map(), new Set(), new Set())).toBeUndefined();
  });

  it('rewrites field blocks whose field was renamed', () => {
    const remapped = remapLayoutFieldIds(
      layout,
      new Map([['f1', 'f1-renamed']]),
      new Set(['f1-renamed', 'f2']),
      new Set(['g1'])
    );
    expect(remapped!.tabs[0]!.panels[0]!.blocks).toEqual([
      { id: 'field:f1', kind: 'field', refId: 'f1-renamed' },
      { id: 'field:f2', kind: 'field', refId: 'f2' }
    ]);
  });

  it('drops field blocks whose field was removed, leaving the panel otherwise intact', () => {
    const remapped = remapLayoutFieldIds(layout, new Map(), new Set(['f2']), new Set(['g1']));
    expect(remapped!.tabs[0]!.panels[0]!.blocks).toEqual([
      { id: 'field:f2', kind: 'field', refId: 'f2' }
    ]);
  });

  it('drops fieldGroup blocks whose group was removed', () => {
    const remapped = remapLayoutFieldIds(
      layout,
      new Map(),
      new Set(['f1', 'f2']),
      new Set() // g1 no longer exists
    );
    const groupPanel = remapped!.tabs[0]!.panels.find(panel => panel.id === 'group:g1');
    expect(groupPanel!.blocks).toEqual([]);
  });

  it('leaves non-field blocks (e.g. links) untouched', () => {
    const remapped = remapLayoutFieldIds(layout, new Map(), new Set(['f1', 'f2']), new Set(['g1']));
    const linksPanel = remapped!.tabs[0]!.panels.find(panel => panel.id === 'links');
    expect(linksPanel!.blocks).toEqual([{ id: 'links', kind: 'links' }]);
  });
});
