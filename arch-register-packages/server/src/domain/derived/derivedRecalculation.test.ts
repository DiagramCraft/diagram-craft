import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult } from '../catalog/db/relationDatabase';
import { recalculateEntityDerivedFields } from './derivedRecalculation';

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

const typedRelation = {
  id: 'relation-1',
  schema_id: 'system-contract',
  in_entity_id: 'system-1',
  out_entity_id: 'contract-1'
} as RelationDbResult;

describe('derived recalculation', () => {
  it('recalculates derived values from generic and typed relation projections', async () => {
    const entities = [
      entity('domain-1', 'domain', {}),
      entity('system-1', 'system', { domain: ['domain-1'] }),
      entity('contract-1', 'contract', { annual_cost: { amount: 2000, currency: 'USD' } })
    ];
    const schemas = [
      schema('domain', []),
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
        },
        {
          id: 'domain_name',
          name: 'Domain name',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'entity.domain.metadata.name',
          resultType: 'text'
        },
        {
          id: 'total',
          name: 'Total',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'entity.contracts.map(.entity.annual_cost.amount) |> sum',
          resultType: 'number'
        }
      ]),
      schema('contract', [{ id: 'annual_cost', name: 'Annual cost', type: 'currency' }])
    ];

    const db = {
      catalog: {
        listEntities: async () => entities,
        listSchemas: async () => schemas,
        updateEntityDerivedFields: async (
          _workspace: string,
          id: string,
          data: Record<string, unknown>
        ) => {
          const target = entities.find(candidate => candidate.id === id)!;
          target.data = data;
        }
      },
      relation: {
        listRelationsForEntities: async () => ({ outgoing: [typedRelation], incoming: [] })
      }
    } as unknown as DatabaseAdapter;

    await recalculateEntityDerivedFields(db, 'workspace-1', ['contract-1']);
    expect(entities.find(candidate => candidate.id === 'system-1')?.data.total).toBe(2000);
    expect(entities.find(candidate => candidate.id === 'system-1')?.data.domain_name).toBe(
      'domain-1'
    );

    entities.find(candidate => candidate.id === 'contract-1')!.data.annual_cost = {
      amount: 2500,
      currency: 'USD'
    };
    await recalculateEntityDerivedFields(db, 'workspace-1', ['contract-1']);
    expect(entities.find(candidate => candidate.id === 'system-1')?.data.total).toBe(2500);
  });
});
