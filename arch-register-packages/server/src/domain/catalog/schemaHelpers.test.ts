import { describe, expect, it } from 'vitest';
import {
  buildCreateSchemaInput,
  findIncompatibleFieldChanges,
  normalizeEntityTemplates,
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
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'APP',
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

// ── findIncompatibleFieldChanges ────────────────────────────────

describe('findIncompatibleFieldChanges', () => {
  const text = (
    id: string,
    name: string,
    requirementLevel?: SchemaField['requirementLevel']
  ): SchemaField => ({
    id,
    name,
    type: 'text',
    requirementLevel
  });

  it('allows adding a new optional field', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('notes', 'Notes'), text('owner', 'Owner', 'optional')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('blocks adding a new required field', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('notes', 'Notes'), text('owner', 'Owner', 'required')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([
      'New field "Owner" cannot be required while entities exist'
    ]);
  });

  it('allows removing a field', () => {
    const oldFields = [text('notes', 'Notes'), text('owner', 'Owner')];
    const newFields = [text('notes', 'Notes')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('blocks changing a field id (matched by name)', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('note', 'Notes')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([
      'Field "Notes" cannot have its id changed (notes → note)'
    ]);
  });

  it('blocks making an optional field required', () => {
    const oldFields = [text('notes', 'Notes', 'optional')];
    const newFields = [text('notes', 'Notes', 'required')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([
      'Field "Notes" cannot be made required while entities exist'
    ]);
  });

  it('blocks making an expected field required', () => {
    const oldFields = [text('notes', 'Notes', 'expected')];
    const newFields = [text('notes', 'Notes', 'required')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([
      'Field "Notes" cannot be made required while entities exist'
    ]);
  });

  it('allows a required field staying required', () => {
    const oldFields = [text('notes', 'Notes', 'required')];
    const newFields = [text('notes', 'Notes', 'required')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('blocks changing a field type', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields: SchemaField[] = [{ id: 'notes', name: 'Notes', type: 'boolean' }];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([
      'Field "Notes" cannot change type (text → boolean)'
    ]);
  });

  it('allows renaming a field name while keeping its id', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('notes', 'Comments')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('allows reordering fields with no other changes', () => {
    const oldFields = [text('a', 'A'), text('b', 'B')];
    const newFields = [text('b', 'B'), text('a', 'A')];
    expect(findIncompatibleFieldChanges(oldFields, newFields)).toEqual([]);
  });
});
