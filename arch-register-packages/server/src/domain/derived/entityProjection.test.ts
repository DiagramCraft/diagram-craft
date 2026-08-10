import { describe, expect, it } from 'vitest';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import { buildEntityProjection } from './entityProjection';

const entity = (id: string, schemaId: string, data: Record<string, unknown>) =>
  ({
    id,
    workspace: 'workspace-1',
    public_id: id,
    slug: id,
    namespace: '',
    name: id,
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: schemaId,
    data,
    project_id: null,
    completeness: 0,
    created_at: new Date(0),
    updated_at: new Date(0),
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: schemaId
  }) as EntityDbResult;

const schema = (id: string, fields: SchemaDbResult['fields']) =>
  ({
    id,
    workspace: 'workspace-1',
    name: id,
    description: '',
    fields,
    groups: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 3).toUpperCase(),
    created_at: new Date(0),
    updated_at: new Date(0)
  }) as SchemaDbResult;

describe('entity JSON projection', () => {
  it('expands generic references and typed relations for one hop', () => {
    const entities = [
      entity('domain-1', 'domain', {}),
      entity('system-1', 'system', { domain: ['domain-1'] }),
      entity('contract-1', 'contract', { annual_cost: { amount: 1200, currency: 'USD' } })
    ];
    const schemas = [
      schema('domain', [{ id: 'description', name: 'Description', type: 'text' }]),
      schema('contract', [{ id: 'annual_cost', name: 'Annual cost', type: 'currency' }]),
      schema('system', [
        {
          id: 'domain',
          name: 'Domain',
          type: 'reference',
          schemaId: 'domain',
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in'
        }
      ])
    ];
    const relations = [
      {
        id: 'relation-1',
        workspace: 'workspace-1',
        schema_id: 'system-contract',
        schema_name: 'System contract',
        in_entity_id: 'system-1',
        in_entity_name: 'system-1',
        out_entity_id: 'contract-1',
        out_entity_name: 'contract-1',
        data: { protocol: 'Kafka' },
        owner: null
      }
    ] as unknown as RelationDbResult[];
    const relationSchemas = [
      {
        id: 'system-contract',
        workspace: 'workspace-1',
        name: 'System contract',
        description: '',
        in_schema_ids: ['system'],
        out_schema_ids: ['contract'],
        fields: [{ id: 'protocol', name: 'Protocol', type: 'text' }],
        groups: [],
        color: null,
        icon: null,
        created_at: new Date(0),
        updated_at: new Date(0)
      }
    ] as RelationSchemaDbResult[];

    expect(
      buildEntityProjection('system-1', entities, schemas, relations, relationSchemas, {
        depth: 0
      })
    ).toMatchObject({
      domain: 'domain-1',
      contracts: ['contract-1'],
      metadata: { id: 'system-1', schemaId: 'system' }
    });

    expect(
      buildEntityProjection('system-1', entities, schemas, relations, relationSchemas, {
        depth: 1
      })
    ).toMatchObject({
      domain: { metadata: { id: 'domain-1', schemaId: 'domain' } },
      contracts: [
        {
          protocol: 'Kafka',
          entity: {
            metadata: { id: 'contract-1', schemaId: 'contract' },
            annual_cost: { amount: 1200, currency: 'USD' }
          }
        }
      ]
    });
  });

  it('stops nested targets at depth zero', () => {
    const entities = [
      entity('root', 'root', { child: ['child'] }),
      entity('child', 'child', { grandchild: ['grandchild'] }),
      entity('grandchild', 'grandchild', {})
    ];
    const schemas = [
      schema('root', [
        {
          id: 'child',
          name: 'Child',
          type: 'reference',
          schemaId: 'child',
          minCount: 0,
          maxCount: 1
        }
      ]),
      schema('child', [
        {
          id: 'grandchild',
          name: 'Grandchild',
          type: 'reference',
          schemaId: 'grandchild',
          minCount: 0,
          maxCount: 1
        }
      ]),
      schema('grandchild', [])
    ];

    expect(buildEntityProjection('root', entities, schemas, [], [], { depth: 1 })).toMatchObject({
      child: { grandchild: 'grandchild', metadata: { id: 'child' } }
    });
  });
});
