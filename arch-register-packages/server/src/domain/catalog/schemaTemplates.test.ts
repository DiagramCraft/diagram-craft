import { describe, expect, it } from 'vitest';
import {
  instantiateTemplate,
  instantiateTemplateDefinitions,
  instantiateTemplateComposition,
  resolveTemplateSavedViews,
  SCHEMA_TEMPLATES,
  type SymbolicSavedView
} from './schemaTemplates';
import { buildDerivedPlan, evaluateDerivedFields } from '../derived/derivedFields';
import { compileRelationSchemaWithSharedGroups } from './relationSchemaHelpers';

describe('instantiateTemplate', () => {
  it('assigns a presentation category to every built-in entity and relation schema', () => {
    for (const template of SCHEMA_TEMPLATES) {
      expect(template.schemas.every(schema => schema.category.trim().length > 0)).toBe(true);
      expect(
        (template.relationSchemas ?? []).every(schema => schema.category.trim().length > 0)
      ).toBe(true);

      const definitions = instantiateTemplateDefinitions('ws-1', template.id);
      expect(definitions.schemas.every(schema => (schema.category?.trim() ?? '').length > 0)).toBe(
        true
      );
      expect(
        definitions.relationSchemas.every(schema => (schema.category?.trim() ?? '').length > 0)
      ).toBe(true);
    }
  });

  it('classifies built-ins and composes one full model with multiple concerns', () => {
    expect(
      SCHEMA_TEMPLATES.filter(template => template.category === 'full').map(t => t.id)
    ).toEqual([
      'default',
      'backstage',
      'c4',
      'itil',
      'ddd',
      'team-topologies',
      'data-mesh',
      'archimate'
    ]);
    expect(
      SCHEMA_TEMPLATES.filter(template => template.category === 'cross-cutting').map(t => t.id)
    ).toEqual(['glossary', 'information-governance', 'security', 'risk-compliance', 'strategy']);

    const definitions = instantiateTemplateComposition('ws-1', 'default', [
      'glossary',
      'security',
      'risk-compliance'
    ]);

    expect(definitions.selectedTemplates.map(template => template.id)).toEqual([
      'default',
      'glossary',
      'security',
      'risk-compliance'
    ]);
    expect(definitions.schemas.map(schema => schema.name)).toContain('Risk');
    expect(definitions.schemas.map(schema => schema.name)).toContain('Risk & Compliance — Risk');
    expect(definitions.schemas.map(schema => schema.name)).toContain('Control');
    expect(definitions.schemas.map(schema => schema.name)).toContain('Risk & Compliance — Control');
    expect(definitions.dashboardGroups.map(group => group.name)).toEqual(['Risk & Compliance']);
  });

  it('materializes the optional business glossary template', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'glossary');
    const term = definitions.schemas.find(schema => schema.name === 'Term');
    const category = definitions.schemas.find(schema => schema.name === 'Term Category');
    const aliases = term?.fields.find(field => field.id === 'synonyms');
    const categories = term?.fields.find(field => field.id === 'categories');

    expect(term).toBeDefined();
    expect(category).toBeDefined();
    expect(aliases).toMatchObject({ minCardinality: 0, maxCardinality: -1 });
    expect(term?.fields.find(field => field.id === 'abbreviations')).toMatchObject({
      minCardinality: 0,
      maxCardinality: -1
    });
    expect(categories).toMatchObject({
      type: 'reference',
      schemaId: category?.id,
      minCount: 0,
      maxCount: -1
    });
    expect(definitions.capabilityConfigurations).toEqual([
      expect.objectContaining({
        type: 'business-glossary',
        bindings: expect.objectContaining({
          term: { target: { kind: 'entity_schema', id: term?.id } },
          category: { target: { kind: 'entity_schema', id: category?.id } }
        })
      })
    ]);
  });

  it('materializes the optional strategy template with nested Business Capabilities', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'strategy');
    const businessCapability = definitions.schemas.find(
      schema => schema.name === 'Business Capability'
    );
    const objective = definitions.schemas.find(schema => schema.name === 'Objective');
    const outcome = definitions.schemas.find(schema => schema.name === 'Outcome');
    const initiative = definitions.schemas.find(schema => schema.name === 'Initiative');
    const measure = definitions.schemas.find(schema => schema.name === 'Measure');

    expect(businessCapability).toMatchObject({ category: 'Strategy' });
    expect(objective).toBeDefined();
    expect(outcome).toBeDefined();
    expect(initiative).toBeDefined();
    expect(measure).toBeDefined();
    expect(objective?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'supported_capabilities',
          name: 'Supports',
          type: 'typedRelation',
          direction: 'in'
        }),
        expect.objectContaining({
          id: 'affected_entities',
          name: 'Affects',
          type: 'typedRelation',
          direction: 'in'
        })
      ])
    );
    expect(businessCapability?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'parent',
          name: 'Parent Capability',
          type: 'containment',
          schemaId: businessCapability?.id,
          minCount: 0,
          maxCount: 1
        }),
        expect.objectContaining({
          id: 'capability_level',
          name: 'Capability Level',
          type: 'derived',
          expression:
            "entity.parent == null ? 'L1' : 'L' + ((entity.parent.capability_level |> replace('L', '') |> toNumber) + 1)",
          resultType: 'text'
        }),
        expect.objectContaining({
          id: 'supporting_objectives',
          name: 'Supported by Objectives',
          type: 'typedRelation',
          direction: 'out'
        }),
        expect.objectContaining({
          id: 'supported_entities',
          name: 'Supports Entities',
          type: 'typedRelation',
          direction: 'in'
        })
      ])
    );

    const relationNames = definitions.relationSchemas.map(schema => schema.name);
    expect(relationNames).toContain('Objective Supports Business Capability');
    expect(relationNames).toContain('Business Capability Supports Entity');
    expect(relationNames).toContain('Objective Affects Entity');
    expect(definitions.relationSchemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Objective Supports Business Capability',
          in_label: 'Supports Business Capabilities',
          out_label: 'Supported by Objectives',
          in_schema_ids: [objective?.id],
          out_schema_ids: [businessCapability?.id]
        }),
        expect.objectContaining({
          name: 'Business Capability Supports Entity',
          in_label: 'Supports Entities',
          out_label: 'Supported by Business Capabilities',
          in_schema_ids: [businessCapability?.id],
          out_schema_ids: 'any'
        }),
        expect.objectContaining({
          name: 'Objective Affects Entity',
          in_label: 'Affects Entities',
          out_label: 'Affected by Objective'
        })
      ])
    );
    const affectsRelation = definitions.relationSchemas.find(
      relationSchema => relationSchema.name === 'Objective Affects Entity'
    );
    expect(affectsRelation?.in_schema_ids).toEqual([objective?.id]);
    expect(affectsRelation?.out_schema_ids).toBe('any');

    expect(definitions.capabilityConfigurations).toEqual([
      expect.objectContaining({
        type: 'strategy-model',
        bindings: expect.objectContaining({
          objective: { target: { kind: 'entity_schema', id: objective?.id } },
          outcome: { target: { kind: 'entity_schema', id: outcome?.id } },
          initiative: { target: { kind: 'entity_schema', id: initiative?.id } },
          measure: { target: { kind: 'entity_schema', id: measure?.id } },
          business_capability: {
            target: { kind: 'entity_schema', id: businessCapability?.id }
          }
        })
      })
    ]);
  });

  it('preserves date fields in enriched templates', () => {
    const schemas = instantiateTemplate('ws-1', 'security');
    const threat = schemas.find(schema => schema.name === 'Threat');
    const control = schemas.find(schema => schema.name === 'Control');
    const risk = schemas.find(schema => schema.name === 'Risk');

    expect(threat?.fields).toContainEqual({
      id: 'discovered_on',
      name: 'Discovered On',
      type: 'date'
    });
    expect(control?.fields).toContainEqual({
      id: 'last_verified',
      name: 'Last Verified',
      type: 'date'
    });
    expect(risk?.fields).toContainEqual({
      id: 'review_due',
      name: 'Review Due',
      type: 'date'
    });
  });

  it('keeps reference field resolution working alongside date fields', () => {
    const schemas = instantiateTemplate('ws-1', 'data-mesh');
    const dataProduct = schemas.find(schema => schema.name === 'Data Product');
    const sourceSystem = schemas.find(schema => schema.name === 'Source System');

    expect(dataProduct?.fields).toContainEqual({
      id: 'review_date',
      name: 'Review Date',
      type: 'date'
    });

    const sourceSystemsField = dataProduct?.fields.find(field => field.id === 'source_systems');
    expect(sourceSystemsField).toMatchObject({
      id: 'source_systems',
      type: 'reference',
      schemaId: sourceSystem?.id
    });
  });

  it('materializes the Backstage API participation relations', () => {
    const schemas = instantiateTemplate('ws-1', 'backstage');
    const component = schemas.find(schema => schema.name === 'Component');
    const api = schemas.find(schema => schema.name === 'API');

    expect(component?.fields.find(field => field.id === 'consumes_apis')).toMatchObject({
      id: 'consumes_apis',
      type: 'typedRelation',
      direction: 'in'
    });
    expect(api?.fields.find(field => field.id === 'consumers')).toMatchObject({
      id: 'consumers',
      type: 'typedRelation',
      direction: 'out'
    });
  });

  it('keeps technology release scoped to the default catalog template', () => {
    const defaultTemplate = SCHEMA_TEMPLATES.find(template => template.id === 'default');
    expect(defaultTemplate?.schemas).toContainEqual(
      expect.objectContaining({ name: 'Technology Release' })
    );

    for (const template of SCHEMA_TEMPLATES.filter(template => template.id !== 'default')) {
      expect(template.schemas).not.toContainEqual(
        expect.objectContaining({ name: 'Technology Release' })
      );
    }
  });

  it('defines an enum for every select field in every built-in template', () => {
    for (const template of SCHEMA_TEMPLATES) {
      const enumIds = new Set(template.enums.map(enumeration => enumeration.id));
      const selectFields = template.schemas.flatMap(schema =>
        schema.fields.filter(field => field.type === 'select')
      );

      expect(
        selectFields.every(field => typeof field.enumId === 'string' && enumIds.has(field.enumId))
      ).toBe(true);
      expect(template.enums.every(enumeration => enumeration.options.length > 0)).toBe(true);
    }
  });

  it('materializes information governance as reusable enums plus a retention policy schema/relation', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'information-governance');

    expect(definitions.schemas.map(schema => schema.name)).toEqual([
      'Retention Policy',
      'Data Entity'
    ]);
    expect(definitions.enums.map(enumeration => enumeration.name)).toEqual([
      'Data Flow Direction',
      'Regulatory Tags',
      'Processing Purposes',
      'Residency Regions',
      'Retention Time Unit',
      'Communication Protocol',
      'PII Classification'
    ]);
    expect(
      definitions.enums.find(enumeration => enumeration.name === 'Regulatory Tags')?.options
    ).toEqual(expect.arrayContaining([{ value: 'gdpr', label: 'GDPR' }]));
    expect(
      definitions.enums.find(enumeration => enumeration.name === 'Processing Purposes')?.options
    ).toEqual(expect.arrayContaining([{ value: 'analytics', label: 'Analytics' }]));
    expect(
      definitions.enums.find(enumeration => enumeration.name === 'Residency Regions')?.options
    ).toEqual(expect.arrayContaining([{ value: 'eu', label: 'EU' }]));

    expect(definitions.fieldGroups.map(fieldGroup => fieldGroup.name)).toEqual([
      'Information Asset Stewardship',
      'Data Flow Governance'
    ]);
    expect(definitions.fieldGroups[0]!.fields.map(field => field.id)).toEqual([
      'steward',
      'custodian',
      'review_date',
      'regulatory_tags',
      'processing_purposes',
      'permitted_residency_regions'
    ]);
    expect(
      definitions.fieldGroups[0]!.fields.filter(field => field.type === 'principal').map(f => f.id)
    ).toEqual(['steward', 'custodian']);
    expect(definitions.fieldGroups[1]!.fields.map(field => field.id)).toEqual([
      'regulatory_tags',
      'processing_purposes',
      'source_residency_region',
      'destination_residency_region'
    ]);

    const [retentionPolicySchema, dataEntitySchema] = definitions.schemas;
    expect(dataEntitySchema!.shared_field_group_links?.map(link => link.groupId)).toEqual([
      definitions.fieldGroups[0]!.id
    ]);
    expect(dataEntitySchema!.fields).toEqual([
      expect.objectContaining({ id: 'classification', type: 'select' })
    ]);

    expect(definitions.relationSchemas.map(relationSchema => relationSchema.name)).toEqual([
      'Subject to Retention Policy'
    ]);
    const [assignmentRelationSchema] = definitions.relationSchemas;
    expect(assignmentRelationSchema!.in_schema_ids).toBe('any');
    expect(assignmentRelationSchema!.out_schema_ids).toEqual([retentionPolicySchema!.id]);
    expect(assignmentRelationSchema!.fields).toEqual([
      expect.objectContaining({ id: 'activated_from', type: 'date' })
    ]);

    expect(definitions.capabilityConfigurations).toEqual([
      {
        type: 'retention',
        bindings: {
          policy: { target: { kind: 'entity_schema', id: retentionPolicySchema!.id } },
          assignment: {
            target: { kind: 'relation_schema', id: assignmentRelationSchema!.id }
          }
        }
      }
    ]);
  });

  it('materializes the Data Flow composition extension with shared governance fields', () => {
    const informationGovernanceOnly = instantiateTemplateComposition('ws-1', undefined, [
      'information-governance'
    ]);
    expect(
      informationGovernanceOnly.relationSchemas.some(relation => relation.name === 'Data Flow')
    ).toBe(false);

    const definitions = instantiateTemplateComposition(
      'ws-1',
      'default',
      ['information-governance'],
      new Date(),
      {
        dependencyMappings: [
          {
            dependencyId: 'information-governance:data-flow:system',
            targets: [{ templateId: 'default', symId: 'system' }]
          }
        ]
      }
    );
    const system = definitions.schemas.find(schema => schema.name === 'System');
    const dataFlow = definitions.relationSchemas.find(relation => relation.name === 'Data Flow');
    const governanceGroup = definitions.fieldGroups.find(
      fieldGroup => fieldGroup.name === 'Data Flow Governance'
    );

    expect(dataFlow).toBeDefined();
    expect(dataFlow?.in_schema_ids).toEqual([system?.id]);
    expect(dataFlow?.out_schema_ids).toEqual([system?.id]);
    expect(dataFlow?.shared_field_group_links).toEqual([{ groupId: governanceGroup?.id }]);
    expect(dataFlow?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'direction', type: 'select' }),
        expect.objectContaining({ id: 'data_classification', type: 'select' }),
        expect.objectContaining({ id: 'protocol', type: 'select' }),
        expect.objectContaining({
          id: 'data_entities',
          type: 'entityRelation',
          schemaId: definitions.schemas.find(schema => schema.name === 'Data Entity')?.id
        })
      ])
    );
    expect(system?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'data_flows_out',
          type: 'typedRelation',
          relationSchemaId: dataFlow?.id,
          direction: 'out'
        }),
        expect.objectContaining({
          id: 'data_flows_in',
          type: 'typedRelation',
          relationSchemaId: dataFlow?.id,
          direction: 'in'
        })
      ])
    );

    const compiledDataFlow = compileRelationSchemaWithSharedGroups(
      dataFlow!,
      definitions.fieldGroups
    );
    expect(compiledDataFlow.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'regulatory_tags', groupId: governanceGroup?.id }),
        expect.objectContaining({ id: 'processing_purposes', groupId: governanceGroup?.id }),
        expect.objectContaining({ id: 'source_residency_region', groupId: governanceGroup?.id }),
        expect.objectContaining({
          id: 'destination_residency_region',
          groupId: governanceGroup?.id
        })
      ])
    );
    expect(compiledDataFlow.groups).toEqual([
      expect.objectContaining({ id: governanceGroup?.id, name: 'Data Flow Governance' })
    ]);
    expect(
      definitions.enums.filter(enumeration => enumeration.name === 'PII Classification')
    ).toHaveLength(1);
  });

  it('requires and applies one-to-many mappings for cross-cutting dependencies', () => {
    expect(() =>
      instantiateTemplateComposition('ws-1', 'default', ['information-governance'])
    ).toThrow("Template dependency 'information-governance:data-flow:system' has no mapping");

    const definitions = instantiateTemplateComposition(
      'ws-1',
      'default',
      ['information-governance'],
      new Date(),
      {
        dependencyMappings: [
          {
            dependencyId: 'information-governance:data-flow:system',
            targets: [
              { templateId: 'default', symId: 'system' },
              { templateId: 'default', symId: 'component' }
            ]
          }
        ]
      }
    );
    const dataFlow = definitions.relationSchemas.find(relation => relation.name === 'Data Flow');
    const dataFlowTargets = new Set(dataFlow?.in_schema_ids);
    expect(dataFlowTargets).toEqual(
      new Set([
        definitions.schemas.find(schema => schema.name === 'System')?.id,
        definitions.schemas.find(schema => schema.name === 'Component')?.id
      ])
    );
    for (const schemaName of ['System', 'Component']) {
      expect(definitions.schemas.find(schema => schema.name === schemaName)?.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'data_flows_out', relationSchemaId: dataFlow?.id }),
          expect.objectContaining({ id: 'data_flows_in', relationSchemaId: dataFlow?.id })
        ])
      );
    }
  });

  it('materializes enums and document definitions with remapped references', () => {
    const definitions = instantiateTemplateDefinitions(
      'ws-1',
      'security',
      new Date('2026-01-01T00:00:00.000Z')
    );
    const enumIds = new Set(definitions.enums.map(enumeration => enumeration.id));
    const securitySelects = definitions.schemas.flatMap(schema =>
      schema.fields.filter(field => field.type === 'select')
    );

    expect(definitions.enums).toHaveLength(6);
    expect(securitySelects.every(field => enumIds.has(field.enumId))).toBe(true);
    expect(definitions.documentTypes).toEqual([
      expect.objectContaining({
        name: 'Architecture Decision Record',
        workspace: 'ws-1'
      })
    ]);
    expect(definitions.documentTemplates).toEqual([
      expect.objectContaining({
        name: 'Architecture Decision Record',
        workspace: 'ws-1',
        document_type_id: definitions.documentTypes[0]!.id,
        metadata_defaults: { status: 'Proposed' }
      })
    ]);
  });

  it('materializes the default Contract relation with remapped endpoints and enum', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'default');
    const system = definitions.schemas.find(schema => schema.name === 'System');
    const contract = definitions.schemas.find(schema => schema.name === 'Contract');
    const vendor = definitions.schemas.find(schema => schema.name === 'Vendor');
    const relation = definitions.relationSchemas.find(schema => schema.name === 'System Contract');
    const purpose = relation?.fields.find(field => field.id === 'purpose');

    expect(vendor).toBeDefined();
    expect(vendor?.fields).toEqual([]);
    expect(contract?.fields).toContainEqual({
      id: 'vendor',
      name: 'Vendor',
      predicate: 'provided by',
      type: 'containment',
      schemaId: vendor?.id,
      minCount: 1,
      maxCount: 1,
      requirementLevel: 'required'
    });
    expect(contract?.fields).not.toContainEqual(expect.objectContaining({ id: 'vendor_name' }));
    expect(relation?.in_schema_ids).toEqual([system?.id]);
    expect(relation?.out_schema_ids).toEqual([contract?.id]);
    expect(relation?.in_label).toBe('Uses Contract');
    expect(relation?.out_label).toBe('Used by System');
    expect(purpose).toMatchObject({
      type: 'select',
      enumId: definitions.enums.find(e => e.name === 'Contract Purpose')?.id
    });
    expect(system?.fields).toContainEqual(
      expect.objectContaining({
        id: 'contracts',
        type: 'typedRelation',
        relationSchemaId: relation?.id,
        direction: 'in'
      })
    );
    expect(contract?.fields).toContainEqual(
      expect.objectContaining({
        id: 'system',
        type: 'typedRelation',
        relationSchemaId: relation?.id,
        direction: 'out'
      })
    );
  });

  it('materializes API participation relations for Components, Systems, and APIs', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'default');
    const component = definitions.schemas.find(schema => schema.name === 'Component');
    const system = definitions.schemas.find(schema => schema.name === 'System');
    const api = definitions.schemas.find(schema => schema.name === 'API');
    const provides = definitions.relationSchemas.find(schema => schema.name === 'Provides API');
    const consumes = definitions.relationSchemas.find(schema => schema.name === 'Consumes API');

    expect(provides?.in_schema_ids).toEqual([component?.id, system?.id]);
    expect(provides?.out_schema_ids).toEqual([api?.id]);
    expect(provides?.in_label).toBe('Provides APIs');
    expect(provides?.out_label).toBe('Provided by Component or System');
    expect(consumes?.in_schema_ids).toEqual([component?.id, system?.id]);
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
    expect(system?.fields).toContainEqual(
      expect.objectContaining({
        id: 'consumes_apis',
        type: 'typedRelation',
        relationSchemaId: consumes?.id,
        direction: 'in'
      })
    );
    expect(api?.fields).toContainEqual(
      expect.objectContaining({
        id: 'providers',
        type: 'typedRelation',
        relationSchemaId: provides?.id,
        direction: 'out'
      })
    );
  });

  it('materializes the API capability as a workspace configuration', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'default');
    const api = definitions.schemas.find(schema => schema.name === 'API');

    expect(definitions.capabilityConfigurations).toEqual([
      {
        type: 'api-specification',
        bindings: {
          api: { target: { kind: 'entity_schema', id: api?.id } }
        }
      }
    ]);
  });

  it('seeds the reusable PII classification fieldgroup for the default catalog', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'default');
    const fieldGroup = definitions.fieldGroups.find(group => group.name === 'PII Classification');
    const enumIds = new Set(definitions.enums.map(enumeration => enumeration.id));

    expect(fieldGroup).toBeDefined();
    expect(fieldGroup?.fields).toEqual([
      expect.objectContaining({
        id: 'pii_classification',
        name: 'PII Classification',
        type: 'select',
        enumId: expect.any(String)
      }),
      { id: 'pii_scope', name: 'PII Scope', type: 'text' }
    ]);
    const classificationField = fieldGroup?.fields.find(field => field.id === 'pii_classification');
    expect(classificationField?.type === 'select' && enumIds.has(classificationField.enumId)).toBe(
      true
    );

    for (const schemaName of ['API', 'Component', 'System']) {
      const schema = definitions.schemas.find(item => item.name === schemaName);
      expect(schema?.shared_field_group_links).toEqual([{ groupId: fieldGroup?.id }]);
    }
  });

  it('materializes the risk-compliance schemas with numeric and derived fields', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'risk-compliance');
    const risk = definitions.schemas.find(schema => schema.name === 'Risk');
    const control = definitions.schemas.find(schema => schema.name === 'Control');
    const framework = definitions.schemas.find(schema => schema.name === 'Framework');
    const complianceRequirement = definitions.schemas.find(
      schema => schema.name === 'Compliance Requirement'
    );

    expect(risk).toBeDefined();
    expect(control).toBeDefined();
    expect(framework).toBeDefined();
    expect(complianceRequirement).toBeDefined();

    expect(risk?.fields).toContainEqual({
      id: 'likelihood',
      name: 'Likelihood',
      type: 'number',
      min: 1,
      max: 5
    });
    expect(risk?.fields).toContainEqual({
      id: 'impact',
      name: 'Impact',
      type: 'number',
      min: 1,
      max: 5
    });
    expect(risk?.fields).toContainEqual(
      expect.objectContaining({
        id: 'inherent_risk_score',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'entity.likelihood * entity.impact',
        resultType: 'number'
      })
    );
    expect(risk?.fields).toContainEqual(
      expect.objectContaining({
        id: 'residual_risk_score',
        type: 'derived',
        requirementLevel: 'optional',
        resultType: 'number'
      })
    );

    expect(complianceRequirement?.fields).toContainEqual({
      id: 'framework',
      name: 'Framework',
      predicate: 'belongs to',
      type: 'containment',
      schemaId: framework?.id,
      minCount: 1,
      maxCount: 1,
      requirementLevel: 'required'
    });

    expect(definitions.dashboardWidgets).toHaveLength(8);
    expect(
      definitions.dashboardWidgets.find(widget => widget.id === 'top-risks-by-score')
    ).toMatchObject({
      config: { schema: risk?.id, fieldId: 'residual_risk_score' }
    });
    expect(
      definitions.dashboardWidgets.find(widget => widget.id === 'compliance-coverage')
    ).toMatchObject({ config: { schema: complianceRequirement?.id } });
    expect(
      definitions.dashboardWidgets.find(widget => widget.id === 'overdue-risk-control-reviews')
    ).toMatchObject({
      type: 'Assessments',
      config: { mode: 'overdue', label: 'Overdue risk and control reviews' }
    });
  });

  it('materializes the risk-compliance typed relations with correctly remapped endpoints', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'risk-compliance');
    const risk = definitions.schemas.find(schema => schema.name === 'Risk');
    const control = definitions.schemas.find(schema => schema.name === 'Control');
    const complianceRequirement = definitions.schemas.find(
      schema => schema.name === 'Compliance Requirement'
    );
    const riskControl = definitions.relationSchemas.find(
      schema => schema.name === 'Risk Mitigation'
    );
    const controlRequirement = definitions.relationSchemas.find(
      schema => schema.name === 'Control Compliance'
    );

    expect(riskControl?.in_schema_ids).toEqual([risk?.id]);
    expect(riskControl?.out_schema_ids).toEqual([control?.id]);
    expect(riskControl?.in_label).toBe('Mitigated by Control');
    expect(riskControl?.out_label).toBe('Mitigates Risk');
    expect(controlRequirement?.in_schema_ids).toEqual([control?.id]);
    expect(controlRequirement?.out_schema_ids).toEqual([complianceRequirement?.id]);
    expect(controlRequirement?.in_label).toBe('Satisfies Compliance Requirements');
    expect(controlRequirement?.out_label).toBe('Satisfied by Control');

    expect(risk?.fields).toContainEqual(
      expect.objectContaining({
        id: 'mitigating_controls',
        type: 'typedRelation',
        relationSchemaId: riskControl?.id,
        direction: 'in'
      })
    );
    expect(control?.fields).toContainEqual(
      expect.objectContaining({
        id: 'mitigated_risks',
        type: 'typedRelation',
        relationSchemaId: riskControl?.id,
        direction: 'out'
      })
    );
    expect(control?.fields).toContainEqual(
      expect.objectContaining({
        id: 'satisfied_requirements',
        type: 'typedRelation',
        relationSchemaId: controlRequirement?.id,
        direction: 'in'
      })
    );
    expect(complianceRequirement?.fields).toContainEqual(
      expect.objectContaining({
        id: 'satisfying_controls',
        type: 'typedRelation',
        relationSchemaId: controlRequirement?.id,
        direction: 'out'
      })
    );
  });

  it('always evaluates the residual risk score to a non-negative integer', () => {
    const definitions = instantiateTemplateDefinitions('ws-1', 'risk-compliance');
    const risk = definitions.schemas.find(schema => schema.name === 'Risk')!;
    const plan = buildDerivedPlan(risk.fields);

    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      for (let impact = 1; impact <= 5; impact++) {
        for (const mitigation_effectiveness of ['none', 'partial', 'substantial', 'full']) {
          const values = evaluateDerivedFields(
            plan,
            { likelihood, impact, mitigation_effectiveness },
            { objectType: 'entity', objectId: 'e-1' }
          );

          expect(values.inherent_risk_score).toBe(likelihood * impact);
          expect(typeof values.residual_risk_score).toBe('number');
          expect(Number.isInteger(values.residual_risk_score)).toBe(true);
          expect(values.residual_risk_score as number).toBeGreaterThanOrEqual(0);
          expect(values.residual_risk_score as number).toBeLessThanOrEqual(
            values.inherent_risk_score as number
          );
        }
      }
    }
  });

  describe('template saved views', () => {
    it('resolves a schema-scoped strategy view to real schema ids and passes field ids through', () => {
      const definitions = instantiateTemplateDefinitions('ws-1', 'strategy');
      const objective = definitions.schemas.find(schema => schema.name === 'Objective');
      const initiative = definitions.schemas.find(schema => schema.name === 'Initiative');
      const objectivesView = definitions.views.find(view => view.name === 'Objectives');
      const initiativesView = definitions.views.find(view => view.name === 'Initiatives');

      expect(objectivesView).toMatchObject({
        workspace: 'ws-1',
        project_id: null,
        project_scope: null,
        view_mode: 'table',
        filters: { schemaId: objective?.id },
        config: { table: { fieldIds: ['status', 'target_date'] } }
      });
      expect(initiativesView).toMatchObject({
        filters: { schemaId: initiative?.id },
        config: { table: { fieldIds: ['status', 'objectives', 'outcomes'] } }
      });
    });

    it('resolves a typedRelation PathStep inside a saved view filter to real ids', () => {
      const definitions = instantiateTemplateDefinitions('ws-1', 'risk-compliance');
      const risk = definitions.schemas.find(schema => schema.name === 'Risk');
      const control = definitions.schemas.find(schema => schema.name === 'Control');
      const riskControl = definitions.relationSchemas.find(
        schema => schema.name === 'Risk Mitigation'
      );
      const view = definitions.views.find(item => item.name === 'Risks With Mitigating Controls');

      expect(view?.filters).toMatchObject({
        schemaId: risk?.id,
        root: {
          kind: 'relationExists',
          path: [
            {
              kind: 'typedRelation',
              fieldId: 'mitigating_controls',
              relationSchemaId: riskControl?.id,
              direction: 'in',
              ownerSchemaIds: [control?.id]
            }
          ]
        }
      });
    });

    it('resolves the generic strategy traceability preset paths to real ids', () => {
      const definitions = instantiateTemplateDefinitions('ws-1', 'strategy');
      const objective = definitions.schemas.find(schema => schema.name === 'Objective');
      const capability = definitions.schemas.find(schema => schema.name === 'Business Capability');
      const traceability = definitions.views.find(view => view.name === 'Strategy Traceability');
      const objectiveCapability = definitions.relationSchemas.find(
        schema => schema.name === 'Objective Supports Business Capability'
      );

      expect(traceability).toMatchObject({
        view_mode: 'traceability',
        filters: { schemaId: objective?.id },
        config: {
          traceability: {
            paths: expect.arrayContaining([
              expect.objectContaining({
                id: 'supporting-capabilities',
                targetSchemaIds: [capability?.id],
                path: [
                  expect.objectContaining({
                    kind: 'unboundTypedRelation',
                    relationSchemaId: objectiveCapability?.id
                  })
                ]
              })
            ])
          }
        }
      });
    });

    it('resolves nested filter and backward-step schema ids via a synthetic query', () => {
      const idMap = new Map([
        ['schema-a', 'real-a'],
        ['schema-b', 'real-b']
      ]);
      const relationSchemaIdMap = new Map([['rel-a', 'real-rel-a']]);
      const views: SymbolicSavedView[] = [
        {
          id: 'synthetic',
          name: 'Synthetic',
          viewMode: 'table',
          filters: {
            schemaId: 'schema-a',
            root: {
              kind: 'predicate',
              path: [
                {
                  kind: 'backward',
                  fieldId: 'owner',
                  ownerSchemaId: 'schema-b',
                  filter: {
                    kind: 'predicate',
                    path: [
                      {
                        kind: 'typedRelation',
                        fieldId: 'related',
                        relationSchemaId: 'rel-a',
                        direction: 'out',
                        ownerSchemaIds: ['schema-a', 'schema-b']
                      }
                    ],
                    fieldId: 'name',
                    op: 'equals',
                    value: 'x'
                  }
                }
              ],
              fieldId: 'status',
              op: 'equals',
              value: 'active'
            }
          },
          config: null
        }
      ];

      const [resolved] = resolveTemplateSavedViews(
        views,
        'ws-1',
        idMap,
        relationSchemaIdMap,
        new Date('2026-01-01T00:00:00.000Z')
      );

      expect(resolved!.filters).toMatchObject({
        schemaId: 'real-a',
        root: {
          kind: 'predicate',
          path: [
            {
              kind: 'backward',
              ownerSchemaId: 'real-b',
              filter: {
                kind: 'predicate',
                path: [
                  {
                    kind: 'typedRelation',
                    relationSchemaId: 'real-rel-a',
                    ownerSchemaIds: ['real-a', 'real-b']
                  }
                ]
              }
            }
          ]
        }
      });
    });

    it('composes saved views from multiple cross-cutting templates into a flat list', () => {
      const definitions = instantiateTemplateComposition('ws-1', 'default', [
        'strategy',
        'risk-compliance'
      ]);
      const names = definitions.views.map(view => view.name);

      expect(names).toEqual(
        expect.arrayContaining([
          'Objectives',
          'Initiatives',
          'Open Risks',
          'Risks With Mitigating Controls'
        ])
      );
    });

    it('resolves every declared template saved-view schema reference to a real id', () => {
      for (const template of SCHEMA_TEMPLATES) {
        if (!template.views || template.views.length === 0) continue;

        const definitions = instantiateTemplateDefinitions('ws-1', template.id);
        const symIds = new Set([
          ...template.schemas.map(schema => schema.symId),
          ...(template.relationSchemas ?? []).map(schema => schema.symId)
        ]);
        const resolvedIds = new Set([
          ...definitions.schemas.map(schema => schema.id),
          ...definitions.relationSchemas.map(schema => schema.id)
        ]);

        for (const view of definitions.views) {
          const collectIds = (value: unknown): string[] => {
            if (typeof value === 'string') return [value];
            if (Array.isArray(value)) return value.flatMap(collectIds);
            if (value && typeof value === 'object') {
              return Object.values(value as Record<string, unknown>).flatMap(collectIds);
            }
            return [];
          };

          for (const id of collectIds(view.filters)) {
            expect(symIds.has(id)).toBe(false);
          }
          if (view.filters.schemaId) {
            expect(resolvedIds.has(view.filters.schemaId)).toBe(true);
          }
        }
      }
    });
  });
});
