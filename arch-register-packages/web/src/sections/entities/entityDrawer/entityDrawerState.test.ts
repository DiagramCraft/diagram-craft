import { describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  buildDefaultEntityDrawerProfile,
  type EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderContext
} from './EntityDrawerProviderRegistry';
import { resolveEntityDrawerRenderModel } from './entityDrawerState';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'status', name: 'Status', type: 'text' },
    { id: 'depends_on', name: 'Depends on', type: 'reference', schemaId: 'service' },
    {
      id: 'retention_policy',
      name: 'Retention Policy',
      type: 'typedRelation',
      relationSchemaId: 'retention-assignment',
      direction: 'in'
    },
    { id: 'restricted', name: 'Restricted', type: 'text', groupId: 'private' },
    {
      id: 'restricted_relation',
      name: 'Restricted relation',
      type: 'typedRelation',
      relationSchemaId: 'restricted-assignment',
      direction: 'in',
      groupId: 'private'
    },
    { id: 'archived', name: 'Archived', type: 'text', archived: true }
  ],
  groups: [{ id: 'private', name: 'Private', accessControl: { teamIds: ['team-private'] } }],
  shared_field_group_links: []
} as unknown as EntitySchema;

const entity = {
  _uid: 'entity-1',
  _publicId: 'SRV-001',
  _schema: { id: 'service', name: 'Service' },
  _name: 'Payments',
  _slug: 'payments',
  _description: '',
  _owner: null,
  _lifecycle: null,
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _namespace: '',
  _tags: [],
  _links: [],
  name: 'Payments',
  status: 'Active',
  depends_on: []
} as unknown as EntityRecord;

const providerContext = {
  workspaceId: 'workspace-1',
  entity,
  schema,
  schemas: [schema],
  relationSchemas: [],
  relations: { outgoing: [], incoming: [] },
  typedRelations: { outgoing: [], incoming: [] },
  openEntity: vi.fn()
} as unknown as EntityDrawerProviderContext;

const resolve = (profile: EntityDrawerProfile, options?: { access?: 'view' | 'edit' | 'none' }) =>
  resolveEntityDrawerRenderModel({
    entity,
    schema,
    profile,
    providerRegistry: createEntityDrawerProviderRegistry([]),
    providerContext,
    getFieldGroupAccess: () => options?.access ?? 'edit'
  });

describe('resolveEntityDrawerRenderModel', () => {
  it('keeps configured item order and omits empty metadata', () => {
    const result = resolve({
      header: { badges: [{ kind: 'field', fieldId: 'status', label: 'State' }] },
      sections: [
        {
          id: 'custom',
          title: 'Custom',
          collapsible: false,
          items: [
            { kind: 'metadata', slot: 'description' },
            { kind: 'field', fieldId: 'status', label: 'Lifecycle state' },
            { kind: 'field', fieldId: 'name' }
          ]
        }
      ]
    });

    expect(result.badges[0]?.label).toBe('State');
    expect(result.sections[0]?.items.map(item => item.label)).toEqual(['Lifecycle state', 'Name']);
    expect(result.diagnostics).toEqual([]);
  });

  it('omits stale fields, invalid relations, and inaccessible field groups with diagnostics', () => {
    const result = resolve(
      {
        header: {
          badges: [
            { kind: 'field', fieldId: 'archived' },
            { kind: 'field', fieldId: 'restricted' }
          ]
        },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: true,
            items: [
              { kind: 'field', fieldId: 'missing' },
              { kind: 'relation', fieldId: 'status' },
              { kind: 'field', fieldId: 'restricted' }
            ]
          }
        ]
      },
      { access: 'none' }
    );

    expect(result.badges).toEqual([]);
    expect(result.sections).toEqual([]);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'missing_or_archived_field',
      'missing_or_archived_field',
      'missing_relation_field'
    ]);
  });

  it('omits unavailable providers and reports provider diagnostics', () => {
    const availableProvider = {
      slotId: 'test.available',
      supports: () => true,
      Component: () => null
    };
    const unavailableProvider = {
      slotId: 'test.unavailable',
      supports: () => false,
      Component: () => null
    };
    const profile: EntityDrawerProfile = {
      header: { badges: [] },
      sections: [
        {
          id: 'providers',
          title: 'Providers',
          collapsible: true,
          items: [
            { kind: 'slot', slotId: 'test.available' },
            { kind: 'slot', slotId: 'test.unavailable' },
            { kind: 'slot', slotId: 'test.missing' }
          ]
        }
      ]
    };
    const result = resolveEntityDrawerRenderModel({
      entity,
      schema,
      profile,
      providerRegistry: createEntityDrawerProviderRegistry([
        availableProvider,
        unavailableProvider
      ]),
      providerContext,
      getFieldGroupAccess: () => 'edit'
    });

    expect(
      result.sections[0]?.items.map(item => item.item.kind === 'slot' && item.item.slotId)
    ).toEqual(['test.available']);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'unsupported_slot_for_schema',
      'unsupported_slot'
    ]);
  });

  it('renders the schema-derived default profile through the same resolver', () => {
    const result = resolve(buildDefaultEntityDrawerProfile(schema));
    const itemIds = result.sections.flatMap(section =>
      section.items.map(item => {
        if (item.item.kind === 'metadata') return item.item.slot;
        if (item.item.kind === 'slot') return item.item.slotId;
        if (item.item.kind === 'rollup-leaf-count') return item.item.kind;
        return item.item.fieldId;
      })
    );

    expect(itemIds).toContain('name');
    expect(itemIds).toContain('depends_on');
    expect(itemIds).toContain('publicId');
    expect(itemIds).not.toContain('archived');
  });

  it('defaults typed relations without an explicit presentation to mini-panels', () => {
    const result = resolve({
      header: { badges: [] },
      sections: [
        {
          id: 'custom',
          title: 'Custom',
          collapsible: false,
          items: [{ kind: 'relation', fieldId: 'retention_policy' }]
        }
      ]
    });

    expect(result.sections[0]?.items[0]?.item).toEqual({
      kind: 'relation',
      fieldId: 'retention_policy',
      presentation: 'mini-panel'
    });
  });

  it('resolves cross-schema containment children with their configured label', () => {
    const parentSchema = { ...schema, id: 'vendor', name: 'Vendor' };
    const childSchema = {
      id: 'contract',
      name: 'Contract',
      fields: [
        {
          id: 'vendor',
          name: 'Vendor',
          type: 'containment',
          schemaId: 'vendor'
        }
      ]
    } as unknown as EntitySchema;
    const parentEntity = { ...entity, _schema: { id: 'vendor', name: 'Vendor' } };
    const result = resolveEntityDrawerRenderModel({
      entity: parentEntity,
      schema: parentSchema,
      profile: {
        header: { badges: [] },
        sections: [
          {
            id: 'children',
            title: 'Children',
            collapsible: true,
            items: [
              { kind: 'children', childSchemaId: 'contract', fieldId: 'vendor', label: 'Contracts' }
            ]
          }
        ]
      },
      providerRegistry: createEntityDrawerProviderRegistry([]),
      providerContext: {
        ...providerContext,
        entity: parentEntity,
        schema: parentSchema,
        schemas: [parentSchema, childSchema]
      },
      getFieldGroupAccess: () => 'edit'
    });

    expect(result.sections[0]?.items[0]).toMatchObject({
      label: 'Contracts',
      item: { kind: 'children', childSchemaId: 'contract', fieldId: 'vendor' }
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('omits children whose containment target no longer matches the current schema', () => {
    const result = resolve({
      header: { badges: [] },
      sections: [
        {
          id: 'children',
          title: 'Children',
          collapsible: true,
          items: [{ kind: 'children', childSchemaId: 'missing', fieldId: 'parent' }]
        }
      ]
    });

    expect(result.sections).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe('invalid_children_target');
  });

  describe('generic rollup items', () => {
    const schemaWithParent = {
      ...schema,
      fields: [
        ...schema.fields,
        { id: 'parent', name: 'Parent', type: 'containment', schemaId: 'service' },
        { id: 'maturity', name: 'Maturity', type: 'number' }
      ]
    } as unknown as EntitySchema;
    const rollupContext = {
      ...providerContext,
      schema: schemaWithParent
    } as EntityDrawerProviderContext;

    const resolveRollup = (profile: EntityDrawerProfile) =>
      resolveEntityDrawerRenderModel({
        entity,
        schema: schemaWithParent,
        profile,
        providerRegistry: createEntityDrawerProviderRegistry([]),
        providerContext: rollupContext,
        getFieldGroupAccess: () => 'edit'
      });

    it('resolves a rollup item over a numeric field', () => {
      const result = resolveRollup({
        header: { badges: [] },
        sections: [
          {
            id: 'rollup',
            title: 'Roll-up',
            collapsible: true,
            items: [{ kind: 'rollup', fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' }]
          }
        ]
      });

      expect(result.sections[0]?.items[0]).toMatchObject({
        label: 'Maturity',
        item: { kind: 'rollup', fieldId: 'maturity' }
      });
      expect(result.diagnostics).toEqual([]);
    });

    it('resolves a standalone leaf-count item', () => {
      const result = resolveRollup({
        header: { badges: [] },
        sections: [
          {
            id: 'rollup',
            title: 'Roll-up',
            collapsible: true,
            items: [{ kind: 'rollup-leaf-count' }]
          }
        ]
      });

      expect(result.sections[0]?.items[0]).toMatchObject({
        label: 'Leaf count',
        item: { kind: 'rollup-leaf-count' }
      });
      expect(result.diagnostics).toEqual([]);
    });

    it('omits a rollup item whose field is missing or non-numeric', () => {
      const result = resolveRollup({
        header: { badges: [] },
        sections: [
          {
            id: 'rollup',
            title: 'Roll-up',
            collapsible: true,
            items: [{ kind: 'rollup', fieldId: 'status', aggregation: 'avg', format: 'decimal1' }]
          }
        ]
      });

      expect(result.sections).toEqual([]);
      expect(result.diagnostics[0]?.code).toBe('missing_or_archived_field');
    });

    it('omits rollup items on a schema without a parent containment field', () => {
      const result = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'rollup',
            title: 'Roll-up',
            collapsible: true,
            items: [{ kind: 'rollup-leaf-count' }]
          }
        ]
      });

      expect(result.sections).toEqual([]);
      expect(result.diagnostics[0]?.code).toBe('unsupported_rollup_schema');
    });
  });

  describe('typed-relation-list items', () => {
    it('resolves with the referenced field populated', () => {
      const result = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: false,
            items: [{ kind: 'typed-relation-list', fieldId: 'retention_policy' }]
          }
        ]
      });

      expect(result.sections[0]?.items[0]).toMatchObject({
        label: 'Retention Policy',
        item: { kind: 'typed-relation-list', fieldId: 'retention_policy' },
        field: { id: 'retention_policy', type: 'typedRelation' }
      });
      expect(result.diagnostics).toEqual([]);
    });

    it('passes configured attributes through untouched', () => {
      const result = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: false,
            items: [
              {
                kind: 'typed-relation-list',
                fieldId: 'retention_policy',
                attributes: [{ fieldId: 'coverage' }, { fieldId: 'effectiveness', label: 'Eff.' }]
              }
            ]
          }
        ]
      });

      expect(result.sections[0]?.items[0]?.item).toMatchObject({
        attributes: [{ fieldId: 'coverage' }, { fieldId: 'effectiveness', label: 'Eff.' }]
      });
    });

    it('defaults the label to the field name', () => {
      const result = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: false,
            items: [
              { kind: 'typed-relation-list', fieldId: 'retention_policy', label: 'Retention' }
            ]
          }
        ]
      });

      expect(result.sections[0]?.items[0]?.label).toBe('Retention');
    });

    it('omits and reports a diagnostic when the field is missing, archived, or not a typed relation', () => {
      const missing = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: false,
            items: [{ kind: 'typed-relation-list', fieldId: 'nope' }]
          }
        ]
      });
      expect(missing.sections).toEqual([]);
      expect(missing.diagnostics[0]?.code).toBe('missing_relation_field');

      const wrongType = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: false,
            items: [{ kind: 'typed-relation-list', fieldId: 'status' }]
          }
        ]
      });
      expect(wrongType.sections).toEqual([]);
      expect(wrongType.diagnostics[0]?.code).toBe('missing_relation_field');

      const archived = resolve({
        header: { badges: [] },
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            collapsible: false,
            items: [{ kind: 'typed-relation-list', fieldId: 'archived' }]
          }
        ]
      });
      expect(archived.sections).toEqual([]);
      expect(archived.diagnostics[0]?.code).toBe('missing_relation_field');
    });

    it('omits the item when the field group access is none', () => {
      const result = resolve(
        {
          header: { badges: [] },
          sections: [
            {
              id: 'custom',
              title: 'Custom',
              collapsible: false,
              items: [{ kind: 'typed-relation-list', fieldId: 'restricted_relation' }]
            }
          ]
        },
        { access: 'none' }
      );

      expect(result.sections).toEqual([]);
    });
  });
});
