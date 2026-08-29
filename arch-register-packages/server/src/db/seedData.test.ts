import { describe, expect, it } from 'vitest';
import { seedEntities } from './seedData/entities';
import { seedRelationSchemas, seedRelations } from './seedData/relations';
import { seedAssessments, seedProjectEntities } from './seedData/projects';
import { seedCategories, seedEnums, seedSchemas, seedSharedFieldGroups } from './seedData/catalog';
import {
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  GLOSSARY_IDS,
  STRATEGY_IDS,
  WORKSPACE_ID
} from './seedData/constants';
import { seedTemplateDefinitions } from './seedData/templateDefinitions';
import { seededProjects } from './seedFixtures';
import { seedAssessmentTypes } from './seedData/workspace';
import { seedWorkspaceDashboards } from './seedData/views';
import { materializeDerivedFields } from '../domain/derived/derivedFields';
import { RISK_AFFECTS_TARGET_SCHEMA_IDS } from './seedData/constants';

describe('schema presentation categories', () => {
  const categoryNamesById = new Map(seedCategories.map(category => [category.id, category.name]));
  const categoryNameOf = (categoryId: string | null | undefined) =>
    categoryId ? categoryNamesById.get(categoryId) : undefined;

  it('categorizes every seeded entity and relation schema', () => {
    expect(seedSchemas.every(schema => !!schema.category_id)).toBe(true);
    expect(seedRelationSchemas.every(schema => !!schema.category_id)).toBe(true);
    expect(
      categoryNameOf(seedSchemas.find(schema => schema.name === 'Data Entity')?.category_id)
    ).toBe('Data');
    expect(categoryNameOf(seedSchemas.find(schema => schema.name === 'Risk')?.category_id)).toBe(
      'Governance'
    );
    expect(categoryNameOf(seedSchemas.find(schema => schema.name === 'Term')?.category_id)).toBe(
      'Glossary'
    );
    expect(
      categoryNameOf(seedSchemas.find(schema => schema.name === 'Business Capability')?.category_id)
    ).toBe('Strategy');
  });
});

describe('template-backed catalog seed data', () => {
  it('uses the composed templates for every default-workspace definition', () => {
    const defaultSchemas = seedSchemas.filter(schema => schema.workspace === WORKSPACE_ID);
    const defaultEnums = seedEnums.filter(enumeration => enumeration.workspace === WORKSPACE_ID);
    const defaultFieldGroups = seedSharedFieldGroups.filter(
      fieldGroup => fieldGroup.workspace === WORKSPACE_ID
    );

    expect(seedTemplateDefinitions.selectedTemplates.map(template => template.id)).toEqual([
      'default',
      'glossary',
      'information-governance',
      'risk-compliance',
      'strategy'
    ]);
    expect(defaultSchemas).toEqual(seedTemplateDefinitions.schemas);
    expect(defaultEnums).toEqual(seedTemplateDefinitions.enums);
    expect(defaultFieldGroups).toEqual(seedTemplateDefinitions.fieldGroups);
    expect(seedRelationSchemas).toEqual(seedTemplateDefinitions.relationSchemas);
  });

  it('has no unresolved template references in the generated catalog definitions', () => {
    const schemaIds = new Set(seedSchemas.map(schema => schema.id));
    const enumIds = new Set(seedEnums.map(enumeration => enumeration.id));
    const fieldGroupIds = new Set(seedSharedFieldGroups.map(fieldGroup => fieldGroup.id));
    const relationSchemaIds = new Set(seedRelationSchemas.map(relationSchema => relationSchema.id));

    for (const schema of seedSchemas.filter(item => item.workspace === WORKSPACE_ID)) {
      for (const field of schema.fields) {
        if (field.type === 'select') expect(enumIds.has(field.enumId)).toBe(true);
        if (field.type === 'reference' || field.type === 'containment') {
          expect(schemaIds.has(field.schemaId)).toBe(true);
        }
        if (field.type === 'typedRelation') {
          expect(relationSchemaIds.has(field.relationSchemaId)).toBe(true);
        }
      }
      for (const link of schema.shared_field_group_links ?? []) {
        expect(fieldGroupIds.has(link.groupId)).toBe(true);
      }
    }

    for (const relationSchema of seedRelationSchemas) {
      for (const field of relationSchema.fields) {
        if (field.type === 'select') expect(enumIds.has(field.enumId)).toBe(true);
        if (field.type === 'entityRelation') expect(schemaIds.has(field.schemaId)).toBe(true);
      }
      for (const link of relationSchema.shared_field_group_links ?? []) {
        expect(fieldGroupIds.has(link.groupId)).toBe(true);
      }
    }
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

describe('business capability strategy seed data', () => {
  it('seeds a nested Business Capability schema and dedicated objective relation', () => {
    const businessCapability = seedSchemas.find(schema => schema.name === 'Business Capability');
    const objective = seedSchemas.find(schema => schema.id === STRATEGY_IDS.objectiveSchema);
    const supportsCapability = seedRelationSchemas.find(
      schema => schema.name === 'Objective Supports Business Capability'
    );

    expect(businessCapability?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'parent',
          type: 'containment',
          schemaId: STRATEGY_IDS.businessCapabilitySchema,
          minCount: 0,
          maxCount: 1
        }),
        expect.objectContaining({
          id: 'capability_level',
          type: 'derived',
          expression:
            "entity.parent == null ? 'L1' : 'L' + ((entity.parent.capability_level |> replace('L', '') |> toNumber) + 1)",
          resultType: 'text'
        }),
        expect.objectContaining({
          id: 'supporting_objectives',
          type: 'typedRelation',
          direction: 'out'
        }),
        expect.objectContaining({
          id: 'supported_entities',
          type: 'typedRelation',
          relationSchemaId: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
          direction: 'in'
        })
      ])
    );
    expect(objective?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'supported_capabilities',
          type: 'typedRelation',
          direction: 'in'
        })
      ])
    );
    expect(supportsCapability).toMatchObject({
      in_schema_ids: [STRATEGY_IDS.objectiveSchema],
      out_schema_ids: [STRATEGY_IDS.businessCapabilitySchema],
      in_label: 'Supports Business Capabilities',
      out_label: 'Supported by Objectives'
    });
    const capabilities = seedEntities.filter(
      entity => entity.schema_id === STRATEGY_IDS.businessCapabilitySchema
    );
    expect(capabilities).toHaveLength(5);
    expect(
      capabilities.find(capability => capability.name === 'Self-Service Management')?.data
    ).toMatchObject({
      parent: [STRATEGY_IDS.businessCapabilities.customerEngagement]
    });
    expect(
      capabilities.find(capability => capability.name === 'Account Management')?.data
    ).toMatchObject({
      parent: [STRATEGY_IDS.businessCapabilities.selfServiceManagement]
    });
    expect(seedRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
          in_entity_id: STRATEGY_IDS.businessCapabilities.selfServiceManagement,
          out_entity_id: '00000000-0000-0000-0002-000000000001'
        }),
        expect.objectContaining({
          schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
          in_entity_id: STRATEGY_IDS.businessCapabilities.observabilityManagement,
          out_entity_id: '00000000-0000-0000-0002-000000000006'
        }),
        expect.objectContaining({
          schema_id: supportsCapability?.id,
          in_entity_id: STRATEGY_IDS.objectives.improveCustomerRetention,
          out_entity_id: STRATEGY_IDS.businessCapabilities.selfServiceManagement
        }),
        expect.objectContaining({
          schema_id: supportsCapability?.id,
          in_entity_id: STRATEGY_IDS.objectives.strengthenPlatformReliability,
          out_entity_id: STRATEGY_IDS.businessCapabilities.observabilityManagement
        })
      ])
    );
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
