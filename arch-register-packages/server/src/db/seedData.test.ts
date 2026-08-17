import { describe, expect, it } from 'vitest';
import { seedEntities } from './seedData/entities';
import { seedRelationSchemas, seedRelations } from './seedData/relations';
import { seedAssessments, seedProjectEntities } from './seedData/projects';
import { seedEnums, seedSchemas } from './seedData/catalog';
import { GLOSSARY_IDS, STRATEGY_IDS } from './seedData/constants';
import { seededProjects } from './seedFixtures';
import { seedAssessmentTypes } from './seedData/workspace';
import { seedWorkspaceDashboards } from './seedData/views';
import { materializeDerivedFields } from '../domain/derived/derivedFields';
import { RISK_AFFECTS_TARGET_SCHEMA_IDS } from './seedData/constants';

describe('schema presentation categories', () => {
  it('categorizes every seeded entity and relation schema', () => {
    expect(seedSchemas.every(schema => (schema.category?.trim() ?? '').length > 0)).toBe(true);
    expect(seedRelationSchemas.every(schema => (schema.category?.trim() ?? '').length > 0)).toBe(
      true
    );
    expect(seedSchemas.find(schema => schema.name === 'Data Entity')?.category).toBe('Data');
    expect(seedSchemas.find(schema => schema.name === 'Risk')?.category).toBe('Governance');
    expect(seedSchemas.find(schema => schema.name === 'Term')?.category).toBe('Glossary');
  });
});

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

describe('business glossary seed data', () => {
  it('seeds glossary schemas, status values, categories, and example terms', () => {
    const termSchema = seedSchemas.find(schema => schema.id === GLOSSARY_IDS.termSchema);
    const categorySchema = seedSchemas.find(
      schema => schema.id === GLOSSARY_IDS.termCategorySchema
    );
    const statusEnum = seedEnums.find(enumeration => enumeration.id === GLOSSARY_IDS.statusEnum);
    const terms = seedEntities.filter(entity => entity.schema_id === GLOSSARY_IDS.termSchema);
    const categories = seedEntities.filter(
      entity => entity.schema_id === GLOSSARY_IDS.termCategorySchema
    );

    expect(termSchema?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'definition', type: 'longtext' }),
        expect.objectContaining({ id: 'synonyms', minCardinality: 0, maxCardinality: -1 }),
        expect.objectContaining({ id: 'abbreviations', minCardinality: 0, maxCardinality: -1 }),
        expect.objectContaining({
          id: 'categories',
          type: 'reference',
          schemaId: GLOSSARY_IDS.termCategorySchema,
          maxCount: -1
        }),
        expect.objectContaining({ id: 'status', enumId: GLOSSARY_IDS.statusEnum })
      ])
    );
    expect(categorySchema?.fields).toEqual([]);
    expect(statusEnum?.options.map(option => option.value)).toEqual([
      'draft',
      'proposed',
      'approved'
    ]);
    expect(categories).toHaveLength(3);
    expect(terms).toHaveLength(4);
    expect(terms.find(term => term.name === 'Customer Account')?.data).toMatchObject({
      synonyms: ['Client Account', 'Customer Profile'],
      abbreviations: ['CA'],
      categories: [GLOSSARY_IDS.categories.customer],
      status: 'approved'
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
    expect(provides?.in_label).toBe('Provides APIs');
    expect(provides?.out_label).toBe('Provided by Component or System');
    expect(consumes?.in_schema_ids).toEqual([
      component?.id,
      '00000000-0000-0000-0000-000000000002'
    ]);
    expect(consumes?.out_schema_ids).toEqual([api?.id]);
    expect(consumes?.in_label).toBe('Consumes APIs');
    expect(consumes?.out_label).toBe('Consumed by Component or System');
    expect(component?.fields).toContainEqual(
      expect.objectContaining({
        id: 'provides_apis',
        type: 'typedRelation',
        relationSchemaId: provides?.id,
        direction: 'in'
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

  it('seeds a required ordered multi-valued protocol field on APIs', () => {
    const api = seedSchemas.find(schema => schema.name === 'API');
    const protocolField = api?.fields.find(field => field.id === 'protocols');
    const notificationsApi = seedEntities.find(entity => entity.public_id === 'API-5');

    expect(protocolField).toEqual(
      expect.objectContaining({
        type: 'select',
        requirementLevel: 'required',
        minCardinality: 1,
        maxCardinality: -1
      })
    );
    expect(notificationsApi?.data.protocols).toEqual(['kafka', 'https-rest']);
  });

  it('seeds fields and values on risk and compliance typed relations', () => {
    const riskAffects = seedRelationSchemas.find(schema => schema.name === 'Risk Affects');
    const riskMitigation = seedRelationSchemas.find(schema => schema.name === 'Risk Mitigation');
    const controlCompliance = seedRelationSchemas.find(
      schema => schema.name === 'Control Compliance'
    );
    const riskAffectsRelations = seedRelations.filter(
      relation => relation.schema_id === riskAffects?.id
    );
    const riskRelation = seedRelations.find(relation => relation.schema_id === riskMitigation?.id);
    const complianceRelation = seedRelations.find(
      relation => relation.schema_id === controlCompliance?.id
    );

    expect(riskMitigation?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'effectiveness', type: 'select' }),
        expect.objectContaining({ id: 'coverage', type: 'number' }),
        expect.objectContaining({ id: 'reviewed_on', type: 'date' })
      ])
    );
    expect(controlCompliance?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'status', type: 'select' }),
        expect.objectContaining({ id: 'evidence', type: 'text' }),
        expect.objectContaining({ id: 'verified_on', type: 'date' })
      ])
    );
    const risk = seedSchemas.find(schema => schema.name === 'Risk');
    const control = seedSchemas.find(schema => schema.name === 'Control');
    const complianceRequirement = seedSchemas.find(
      schema => schema.name === 'Compliance Requirement'
    );
    expect(riskAffects?.in_schema_ids).toEqual([risk?.id]);
    expect(riskAffects?.out_schema_ids).toBe('any');
    expect(riskAffects?.in_label).toBe('Affects Entities');
    expect(riskAffects?.out_label).toBe('Affected by Risk');
    expect(riskMitigation?.in_label).toBe('Mitigated by Control');
    expect(riskMitigation?.out_label).toBe('Mitigates Risk');
    expect(controlCompliance?.in_label).toBe('Satisfies Compliance Requirements');
    expect(controlCompliance?.out_label).toBe('Satisfied by Control');
    for (const schemaId of RISK_AFFECTS_TARGET_SCHEMA_IDS) {
      const schema = seedSchemas.find(candidate => candidate.id === schemaId);
      expect(schema?.fields).not.toContainEqual(
        expect.objectContaining({
          relationSchemaId: riskAffects?.id,
          direction: 'out'
        })
      );
    }
    expect(riskAffectsRelations).toHaveLength(7);
    expect(riskAffectsRelations.map(relation => relation.out_entity_id)).toEqual(
      expect.arrayContaining([
        '00000000-0000-0000-0002-000000000001',
        '00000000-0000-0000-0002-000000000002',
        '00000000-0000-0000-0002-000000000004',
        '00000000-0000-0000-0003-000000000003',
        '00000000-0000-0000-0005-000000000001',
        '00000000-0000-0000-0008-000000000001',
        '00000000-0000-0000-0008-000000000003'
      ])
    );
    expect(risk?.fields).toContainEqual(
      expect.objectContaining({
        id: 'affected_entities',
        type: 'typedRelation',
        relationSchemaId: riskAffects?.id,
        direction: 'in'
      })
    );
    expect(risk?.fields).toContainEqual(
      expect.objectContaining({
        id: 'mitigating_controls',
        type: 'typedRelation',
        relationSchemaId: riskMitigation?.id,
        direction: 'in'
      })
    );
    expect(control?.fields).toContainEqual(
      expect.objectContaining({
        id: 'mitigated_risks',
        type: 'typedRelation',
        relationSchemaId: riskMitigation?.id,
        direction: 'out'
      })
    );
    expect(control?.fields).toContainEqual(
      expect.objectContaining({
        id: 'satisfied_requirements',
        type: 'typedRelation',
        relationSchemaId: controlCompliance?.id,
        direction: 'in'
      })
    );
    expect(complianceRequirement?.fields).toContainEqual(
      expect.objectContaining({
        id: 'satisfying_controls',
        type: 'typedRelation',
        relationSchemaId: controlCompliance?.id,
        direction: 'out'
      })
    );
    expect(riskRelation?.data).toMatchObject({ effectiveness: 'substantial', coverage: 90 });
    expect(complianceRelation?.data).toMatchObject({ status: 'met' });
  });

  it('binds every seeded typed relation to both endpoint schemas', () => {
    const schemasById = new Map(seedSchemas.map(schema => [schema.id, schema]));

    for (const relation of seedRelationSchemas) {
      for (const [direction, schemaIds] of [
        ['in', relation.in_schema_ids],
        ['out', relation.out_schema_ids]
      ] as const) {
        if (schemaIds === 'any') continue;
        if (relation.name === 'Risk Affects' && direction === 'out') continue;
        for (const schemaId of schemaIds) {
          const schema = schemasById.get(schemaId);
          expect(schema, `${relation.name} ${direction} endpoint schema`).toBeDefined();
          expect(
            schema?.fields,
            `${relation.name} ${direction} binding on ${schema?.name ?? schemaId}`
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: 'typedRelation',
                relationSchemaId: relation.id,
                direction
              })
            ])
          );
        }
      }
    }
  });
});

describe('strategy project context seed data', () => {
  it('associates strategy examples with projects through project entities', () => {
    expect(seedProjectEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          project_id: seededProjects.portalRedesign.id,
          entity_id: STRATEGY_IDS.objectives.improveCustomerRetention,
          entity_type_id: null
        }),
        expect.objectContaining({
          project_id: seededProjects.authMigration.id,
          entity_id: STRATEGY_IDS.objectives.strengthenPlatformReliability,
          entity_type_id: null
        }),
        expect.objectContaining({
          project_id: seededProjects.portalRedesign.id,
          entity_id: STRATEGY_IDS.initiatives.portalRedesign,
          entity_type_id: null
        }),
        expect.objectContaining({
          project_id: seededProjects.checkoutRevamp.id,
          entity_id: STRATEGY_IDS.initiatives.observabilityUplift,
          entity_type_id: null
        })
      ])
    );
  });
});
