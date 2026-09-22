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
});
