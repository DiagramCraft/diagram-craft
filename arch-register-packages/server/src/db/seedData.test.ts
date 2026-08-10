import { describe, expect, it } from 'vitest';
import {
  seedAssessmentTypes,
  seedAssessments,
  seedEntities,
  seedRelationSchemas,
  seedRelations,
  seedSchemas,
  seedWorkspaceDashboards
} from './seedData';
import { materializeDerivedFields } from '../domain/derived/derivedFields';

describe('dashboard assessment seed data', () => {
  it('seeds the standard assessment types in display order', () => {
    expect(seedAssessmentTypes.map(type => [type.name, type.sort_order])).toEqual([
      ['Risk & compliance', 0],
      ['Quality Review', 1],
      ['Project', 2]
    ]);
  });

  it('assigns the seeded review and dashboard widget to Risk & compliance', () => {
    const riskComplianceType = seedAssessmentTypes.find(type => type.name === 'Risk & compliance');
    const assessment = seedAssessments.find(
      item => item.name === 'Quarterly risk and control review'
    );
    const widget = seedWorkspaceDashboards[0]?.layout.find(
      item => item.id === 'overdue-risk-control-reviews'
    );

    expect(assessment?.assessment_type_id).toBe(riskComplianceType?.id);
    expect(widget).toMatchObject({
      type: 'Assessments',
      config: {
        mode: 'overdue',
        assessmentTypeId: riskComplianceType?.id
      }
    });
  });
});

describe('contract allocation seed data', () => {
  it('seeds allocation, derived budget/allocated fields, and the allocation validation', () => {
    const system = seedSchemas.find(schema => schema.name === 'System');
    const contract = seedSchemas.find(schema => schema.name === 'Contract');
    const systemContract = seedRelationSchemas.find(schema => schema.name === 'System Contract');

    expect(system?.fields).toContainEqual(
      expect.objectContaining({
        id: 'budget',
        type: 'derived',
        expression: 'entity.contracts.map(.allocation * .entity.annual_cost.amount / 100) |> sum'
      })
    );
    expect(system?.fields).toContainEqual(
      expect.objectContaining({
        id: 'contracts',
        type: 'typedRelation',
        direction: 'in'
      })
    );
    expect(contract?.fields).toContainEqual(
      expect.objectContaining({
        id: 'allocated',
        type: 'derived',
        expression: 'entity.system.map(.allocation) |> sum'
      })
    );
    expect(contract?.fields).toContainEqual(
      expect.objectContaining({
        id: 'system',
        type: 'typedRelation',
        direction: 'out'
      })
    );
    expect(contract?.validation_rules).toContainEqual(
      expect.objectContaining({
        expression: 'entity.allocated <= 100',
        severity: 'error'
      })
    );
    expect(systemContract?.fields).toContainEqual(
      expect.objectContaining({ id: 'allocation', min: 0, max: 100 })
    );

    const systemBudget = materializeDerivedFields(
      system?.fields ?? [],
      {},
      { objectType: 'entity', objectId: 'system-1' },
      [],
      {
        contracts: [
          { allocation: 60, entity: { annual_cost: { amount: 125000, currency: 'USD' } } },
          { allocation: 40, entity: { annual_cost: { amount: 30000, currency: 'USD' } } }
        ]
      }
    );
    expect(systemBudget.budget).toBe(87000);

    const contractAllocated = materializeDerivedFields(
      contract?.fields ?? [],
      {},
      { objectType: 'entity', objectId: 'contract-1' },
      [],
      { system: [{ allocation: 60 }, { allocation: 40 }] }
    );
    expect(contractAllocated.allocated).toBe(100);
    expect(
      seedRelations.filter(relation => relation.schema_id === systemContract?.id)
    ).toHaveLength(3);
  });
});

describe('API participation seed data', () => {
  it('seeds typed provider and consumer relations instead of generic API arrays', () => {
    const component = seedSchemas.find(schema => schema.name === 'Component');
    const api = seedSchemas.find(schema => schema.name === 'API');
    const provides = seedRelationSchemas.find(schema => schema.name === 'Provides API');
    const consumes = seedRelationSchemas.find(schema => schema.name === 'Consumes API');
    const apiGateway = seedEntities.find(entity => entity.public_id === 'CMP-1');

    expect(provides?.in_schema_ids).toEqual([
      component?.id,
      '00000000-0000-0000-0000-000000000002'
    ]);
    expect(provides?.out_schema_ids).toEqual([api?.id]);
    expect(consumes?.in_schema_ids).toEqual([
      component?.id,
      '00000000-0000-0000-0000-000000000002'
    ]);
    expect(consumes?.out_schema_ids).toEqual([api?.id]);
    expect(component?.fields).toContainEqual(
      expect.objectContaining({
        id: 'provides_apis',
        type: 'typedRelation',
        relationSchemaId: provides?.id,
        direction: 'out'
      })
    );
    expect(apiGateway?.data).not.toHaveProperty('provides_apis');
    expect(apiGateway?.data).not.toHaveProperty('consumes_apis');
    expect(
      seedRelations.filter(
        relation => relation.schema_id === provides?.id || relation.schema_id === consumes?.id
      )
    ).toHaveLength(16);
  });
});
