import { describe, expect, it } from 'vitest';
import {
  buildCreateEnumInput,
  buildUpdateEnumInput,
  isEnumReferencedBySchemas
} from './enumHelpers';
import { SchemaDbResult, WorkspaceEnumDbResult } from './db/catalogDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const existingEnum: WorkspaceEnumDbResult = {
  id: 'enum-1',
  workspace: 'default',
  name: 'Status',
  options: [{ value: 'draft', label: 'Draft' }],
  sort_order: 7,
  created_at: now,
  updated_at: now
};

describe('enum route helpers', () => {
  it('builds create input with explicit optional fields', () => {
    const result = buildCreateEnumInput(
      'default',
      {
        name: 'Lifecycle',
        options: [{ value: 'prod', label: 'Production' }],
        sort_order: 3
      },
      now
    );

    expect(result).toMatchObject({
      workspace: 'default',
      name: 'Lifecycle',
      options: [{ value: 'prod', label: 'Production' }],
      sort_order: 3,
      created_at: now,
      updated_at: now
    });
    expect(result.id).toBeTypeOf('string');
  });

  it('builds create input with default options and sort order', () => {
    const result = buildCreateEnumInput(
      'default',
      {
        name: 'Lifecycle',
        options: 'invalid',
        sort_order: 'invalid'
      } as Record<string, unknown>,
      now
    );

    expect(result.options).toEqual([]);
    expect(result.sort_order).toBe(0);
  });

  it('merges update input with existing values when optional fields are omitted', () => {
    const result = buildUpdateEnumInput(
      {
        name: 'Status Updated'
      },
      existingEnum,
      now
    );

    expect(result).toEqual({
      name: 'Status Updated',
      options: [
        {
          value: 'draft',
          label: 'Draft',
          description: null,
          retired: false,
          restricted: false
        }
      ],
      sort_order: existingEnum.sort_order,
      updated_at: now
    });
  });

  it('replaces update input optional fields when provided', () => {
    const result = buildUpdateEnumInput(
      {
        name: 'Status Updated',
        options: [{ value: 'active', label: 'Active' }],
        sort_order: 2
      },
      existingEnum,
      now
    );

    expect(result).toEqual({
      name: 'Status Updated',
      options: [
        {
          value: 'active',
          label: 'Active',
          description: null,
          retired: false,
          restricted: false
        },
        {
          value: 'draft',
          label: 'Draft',
          description: null,
          retired: true,
          restricted: false
        }
      ],
      sort_order: 2,
      updated_at: now
    });
  });

  it('removes omitted unused options and retires omitted used options', () => {
    const existing: WorkspaceEnumDbResult = {
      ...existingEnum,
      options: [
        { value: 'used', label: 'Used' },
        { value: 'unused', label: 'Unused' }
      ]
    };

    expect(
      buildUpdateEnumInput({ name: 'Status', options: [] }, existing, now, new Set(['used']))
        .options
    ).toEqual([
      {
        value: 'used',
        label: 'Used',
        description: null,
        retired: true,
        restricted: false
      }
    ]);
  });

  it('preserves option metadata and allows reactivating retired values', () => {
    const retired = {
      value: 'draft',
      label: 'Draft',
      description: 'No longer used for new records',
      retired: true,
      restricted: true
    };
    const existing: WorkspaceEnumDbResult = { ...existingEnum, options: [retired] };

    expect(
      buildUpdateEnumInput({ name: 'Status', options: [retired] }, existing, now).options
    ).toEqual([retired]);
    expect(
      buildUpdateEnumInput(
        { name: 'Status', options: [{ value: 'draft', label: 'Draft', retired: false }] },
        existing,
        now
      ).options
    ).toEqual([
      {
        value: 'draft',
        label: 'Draft',
        description: null,
        retired: false,
        restricted: false
      }
    ]);
  });

  it('detects when an enum is referenced by a select field', () => {
    const schemas: SchemaDbResult[] = [
      {
        id: 'schema-1',
        workspace: 'default',
        name: 'API',
        description: '',
        fields: [{ id: 'api_type', name: 'Type', type: 'select', enumId: 'enum-1' }],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: 'API',
        created_at: now,
        updated_at: now
      }
    ];

    expect(isEnumReferencedBySchemas(schemas, 'enum-1')).toBe(true);
  });

  it('ignores non-select fields and different enum ids', () => {
    const schemas: SchemaDbResult[] = [
      {
        id: 'schema-1',
        workspace: 'default',
        name: 'API',
        description: '',
        fields: [
          { id: 'notes', name: 'Notes', type: 'text' },
          { id: 'tier', name: 'Tier', type: 'select', enumId: 'enum-2' }
        ],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: 'API',
        created_at: now,
        updated_at: now
      }
    ];

    expect(isEnumReferencedBySchemas(schemas, 'enum-1')).toBe(false);
  });

  it('detects references from relation schemas', () => {
    expect(
      isEnumReferencedBySchemas([], 'enum-1', [
        {
          fields: [{ id: 'purpose', name: 'Purpose', type: 'select', enumId: 'enum-1' }]
        } as never
      ])
    ).toBe(true);
  });
});
