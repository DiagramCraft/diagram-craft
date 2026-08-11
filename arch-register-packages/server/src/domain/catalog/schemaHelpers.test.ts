import { describe, expect, it } from 'vitest';
import {
  buildCreateSchemaInput,
  buildUpdateSchemaInput,
  clearOrphanedGroupIds,
  normalizeEntityTemplates,
  normalizeSchemaGroups,
  toApiEnum,
  toApiSchema
} from './schemaHelpers';
import { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';
import { SchemaField } from '@arch-register/api-types/schemaContract';

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
    expect(result.options).toEqual([{ value: 'active', label: 'Active' }]);
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
              fields: { enabled: false, score: 4, parent: ['entity-1'], removed: 'ignored' }
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
          fields: { enabled: false, score: 4, parent: ['entity-1'] }
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
});
