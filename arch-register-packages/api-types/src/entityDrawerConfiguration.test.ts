import { describe, expect, it } from 'vitest';
import {
  buildEntityDrawerCatalog,
  buildDefaultEntityDrawerConfiguration,
  buildDefaultEntityDrawerProfile,
  buildFallbackEntityDrawerProfile,
  entityDrawerConfigurationSchema,
  mergeEntityDrawerProfiles,
  normalizeLegacyEntityDrawerConfiguration,
  remapEntityDrawerProfiles,
  resolveEntityDrawerConfiguration
} from './entityDrawerConfiguration';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'owner', name: 'Owner', type: 'principal' },
    { id: 'score', name: 'Score', type: 'number' },
    { id: 'depends_on', name: 'Depends on', type: 'reference' },
    { id: 'typed_relation', name: 'Typed relation', type: 'typedRelation' },
    { id: 'retired', name: 'Retired', type: 'text', archived: true }
  ],
  groups: [{ id: 'core', name: 'Core' }]
};

describe('entity drawer configuration', () => {
  it('remaps imported profiles and keeps destination profiles on merge', () => {
    const incoming = { source: buildDefaultEntityDrawerProfile(schema) };
    const remapped = remapEntityDrawerProfiles(incoming, new Map([['source', 'target']]));
    const existing = {
      target: { ...buildDefaultEntityDrawerProfile(schema), header: { badges: [] } }
    };

    expect(remapped.target).toEqual(incoming.source);
    expect(mergeEntityDrawerProfiles(existing, remapped)).toEqual(existing);
  });

  it('derives a stable default profile from schema fields and metadata', () => {
    const profile = buildDefaultEntityDrawerProfile(schema);
    expect(profile.sections.flatMap(section => section.items)).toEqual(
      expect.arrayContaining([
        { kind: 'field', fieldId: 'name' },
        { kind: 'relation', fieldId: 'depends_on' },
        { kind: 'relation', fieldId: 'typed_relation', presentation: 'mini-panel' },
        { kind: 'metadata', slot: 'publicId' }
      ])
    );
    expect(profile.sections.flatMap(section => section.items)).not.toContainEqual({
      kind: 'field',
      fieldId: 'retired'
    });
    expect(profile.sections.find(section => section.id === 'typed-relations')).toMatchObject({
      showTitle: false,
      collapsible: false
    });
  });

  it('omits stale fields and unsupported slots while retaining defaults', () => {
    const config = entityDrawerConfigurationSchema.parse({
      version: 1,
      profiles: {
        service: {
          sections: [
            {
              id: 'custom',
              title: 'Custom',
              items: [
                { kind: 'field', fieldId: 'retired' },
                { kind: 'field', fieldId: 'missing' },
                { kind: 'slot', slotId: 'not-registered' }
              ]
            }
          ]
        }
      }
    });
    const result = resolveEntityDrawerConfiguration(config, [schema]);
    expect(result.effective.profiles.service!.sections[0]!.items).toEqual([]);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'missing_or_archived_field',
      'missing_or_archived_field',
      'unsupported_slot'
    ]);
  });

  it('fails closed for unknown versions', () => {
    const result = resolveEntityDrawerConfiguration({ version: 2, profiles: {} }, [schema]);
    expect(result.effective.profiles.service!).toBeDefined();
    expect(result.diagnostics[0]!.code).toBe('unknown_version');
  });

  it('uses defaults without diagnostics when no configuration has been stored', () => {
    const result = resolveEntityDrawerConfiguration(null, [schema]);

    expect(result.effective.profiles.service!).toEqual(buildFallbackEntityDrawerProfile(schema));
    expect(result.diagnostics).toEqual([]);
  });

  it('uses the generic attribute and metadata fallback despite capability bindings', () => {
    const groupedSchema = {
      ...schema,
      fields: schema.fields.map(field =>
        field.id === 'score' ? { ...field, groupId: 'core' } : field
      )
    };
    const result = resolveEntityDrawerConfiguration(
      null,
      [groupedSchema],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } }
        }
      ]
    );
    const profile = result.effective.profiles.service!;

    expect(profile).toEqual(buildFallbackEntityDrawerProfile(groupedSchema));
    expect(profile.sections.map(section => section.id)).toEqual([
      'attributes',
      'group:core',
      'metadata'
    ]);
    expect(profile.sections.flatMap(section => section.items)).toEqual(
      expect.arrayContaining([
        { kind: 'relation', fieldId: 'depends_on' },
        { kind: 'relation', fieldId: 'typed_relation', presentation: 'mini-panel' },
        { kind: 'field', fieldId: 'score' }
      ])
    );
    expect(profile.sections.map(section => section.id)).not.toEqual(
      expect.arrayContaining(['related', 'typed-relations', 'application-content'])
    );
  });

  it('keeps an explicit stored profile instead of merging the generic fallback into it', () => {
    const explicit = {
      version: 1 as const,
      profiles: {
        service: {
          header: { badges: [{ kind: 'metadata' as const, slot: 'publicId' as const }] },
          sections: [{ id: 'custom', title: 'Custom', collapsible: false, items: [] }]
        }
      }
    };

    const result = resolveEntityDrawerConfiguration(explicit, [schema]);

    expect(result.effective.profiles.service).toEqual(explicit.profiles.service);
  });

  const schemaWithParent = {
    ...schema,
    fields: [...schema.fields, { id: 'parent', name: 'Parent', type: 'containment' }]
  };

  it('builds provider defaults and validates provider options', () => {
    const result = buildDefaultEntityDrawerConfiguration(
      [schemaWithParent],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } },
          view_config: {
            fields: [
              {
                fieldId: 'score',
                table: null,
                rollup: { aggregation: 'sum', format: 'number' },
                drawer: false,
                overlay: null
              }
            ]
          }
        }
      ]
    );
    const applicationSection = result.profiles.service!.sections.find(
      section => section.id === 'application-content'
    );
    expect(applicationSection?.items).toEqual([
      { kind: 'slot', slotId: 'strategy.realized-by' },
      { kind: 'slot', slotId: 'strategy.linked-objectives' },
      { kind: 'slot', slotId: 'strategy.linked-initiatives' },
      { kind: 'rollup', fieldId: 'score', aggregation: 'sum', format: 'number' },
      { kind: 'rollup-leaf-count' }
    ]);

    const invalid = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          service: {
            sections: [
              {
                id: 'content',
                title: 'Content',
                items: [
                  { kind: 'rollup', fieldId: 'missing', aggregation: 'sum', format: 'number' }
                ]
              }
            ]
          }
        }
      },
      [schemaWithParent],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } }
        }
      ]
    );
    expect(invalid.diagnostics.at(-1)?.code).toBe('missing_or_archived_field');

    const noParent = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          service: {
            sections: [{ id: 'content', title: 'Content', items: [{ kind: 'rollup-leaf-count' }] }]
          }
        }
      },
      [schema],
      []
    );
    expect(noParent.diagnostics.at(-1)?.code).toBe('unsupported_rollup_schema');
  });

  it('only advertises provider slots for their configured schema', () => {
    const catalog = buildEntityDrawerCatalog(
      [schema, { ...schema, id: 'other', name: 'Other' }],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } }
        }
      ]
    );
    expect(catalog.slots.map(slot => slot.id)).toContain('strategy.realized-by');
    expect(
      catalog.slots.find(slot => slot.id === 'strategy.realized-by')?.supportedSchemaIds
    ).toEqual(['service']);
    expect(catalog.slots.map(slot => slot.id)).not.toContain('strategy.rollup');
    expect(catalog.slots.map(slot => slot.id)).not.toContain('vendor.spend');
  });

  it('validates cross-schema containment children and omits invalid targets', () => {
    const parentSchema = {
      ...schema,
      id: 'vendor',
      name: 'Vendor'
    };
    const childSchema = {
      id: 'contract',
      name: 'Contract',
      fields: [
        {
          id: 'vendor',
          name: 'Vendor',
          type: 'containment',
          schemaId: 'vendor',
          archived: false
        }
      ]
    };
    const result = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          vendor: {
            sections: [
              {
                id: 'children',
                title: 'Children',
                items: [
                  { kind: 'children', childSchemaId: 'contract', fieldId: 'vendor' },
                  { kind: 'children', childSchemaId: 'service', fieldId: 'depends_on' }
                ]
              }
            ]
          }
        }
      },
      [parentSchema, childSchema, schema]
    );

    expect(result.effective.profiles.vendor?.sections[0]?.items).toEqual([
      { kind: 'children', childSchemaId: 'contract', fieldId: 'vendor' }
    ]);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'invalid_children_target'
    ]);
  });

  it('normalizes the legacy Strategy children slot at read time', () => {
    const strategySchema = {
      id: 'business_capability',
      name: 'Business Capability',
      fields: [
        {
          id: 'parent',
          name: 'Parent',
          type: 'containment',
          schemaId: 'business_capability'
        }
      ]
    };
    const result = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          business_capability: {
            sections: [
              {
                id: 'children',
                title: 'Children',
                items: [{ kind: 'slot', slotId: 'strategy.children', label: 'Child capabilities' }]
              }
            ]
          }
        }
      },
      [strategySchema]
    );

    expect(result.effective.profiles.business_capability?.sections[0]?.items).toEqual([
      {
        kind: 'children',
        childSchemaId: 'business_capability',
        fieldId: 'parent',
        label: 'Child capabilities'
      }
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(normalizeLegacyEntityDrawerConfiguration(null)).toBeNull();
  });

  it('normalizes the legacy Strategy rollup slot at read time', () => {
    const strategySchema = {
      id: 'business_capability',
      name: 'Business Capability',
      fields: [
        { id: 'parent', name: 'Parent', type: 'containment', schemaId: 'business_capability' },
        { id: 'maturity', name: 'Maturity', type: 'number' }
      ]
    };
    const result = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          business_capability: {
            sections: [
              {
                id: 'rollup',
                title: 'Roll-up',
                items: [
                  {
                    kind: 'slot',
                    slotId: 'strategy.rollup',
                    options: {
                      rollups: [{ fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' }]
                    }
                  }
                ]
              }
            ]
          }
        }
      },
      [strategySchema]
    );

    expect(result.effective.profiles.business_capability?.sections[0]?.items).toEqual([
      { kind: 'rollup', fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' },
      { kind: 'rollup-leaf-count' }
    ]);
    expect(result.diagnostics).toEqual([]);

    const dropped = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          business_capability: {
            sections: [
              {
                id: 'rollup',
                title: 'Roll-up',
                items: [{ kind: 'slot', slotId: 'strategy.rollup' }]
              }
            ]
          }
        }
      },
      [strategySchema]
    );
    expect(dropped.effective.profiles.business_capability?.sections[0]?.items).toEqual([]);
  });

  it('remaps nested containment-child schema references', () => {
    const profiles = {
      parent: {
        header: { badges: [] },
        sections: [
          {
            id: 'children',
            title: 'Children',
            collapsible: true,
            items: [{ kind: 'children' as const, childSchemaId: 'child', fieldId: 'parent' }]
          }
        ]
      }
    };
    expect(
      remapEntityDrawerProfiles(
        profiles,
        new Map([
          ['parent', 'p2'],
          ['child', 'c2']
        ])
      )
    ).toEqual({
      p2: {
        header: { badges: [] },
        sections: [
          {
            id: 'children',
            title: 'Children',
            collapsible: true,
            items: [{ kind: 'children', childSchemaId: 'c2', fieldId: 'parent' }]
          }
        ]
      }
    });
  });

  it('includes the residual-risk derivedBadge in the default profile for a risk-bound schema', () => {
    const riskSchema = {
      id: 'risk',
      name: 'Risk',
      fields: [{ id: 'category', name: 'Category', type: 'select' }]
    };
    const configuration = {
      type: 'risk-compliance',
      bindings: { risk: { target: { kind: 'entity_schema', id: 'risk' } } }
    } as const;

    const result = resolveEntityDrawerConfiguration(null, [riskSchema], [configuration]);
    expect(result.effective.profiles.risk!.header.badges).toEqual(
      expect.arrayContaining([{ kind: 'derivedBadge', badgeId: 'risk.residualBand' }])
    );
  });

  it('drops an unsupported derivedBadge with a diagnostic', () => {
    const riskSchema = { id: 'risk', name: 'Risk', fields: [] };
    const raw = {
      version: 1,
      profiles: {
        risk: {
          header: { badges: [{ kind: 'derivedBadge', badgeId: 'unknown.badge' }] },
          sections: []
        }
      }
    };

    const result = resolveEntityDrawerConfiguration(raw, [riskSchema], []);
    expect(result.effective.profiles.risk!.header.badges).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'unsupported_badge', itemId: 'unknown.badge' })
    ]);
  });

  it('advertises Risk & Compliance provider slots for the configured Risk schema', () => {
    const riskSchema = {
      id: 'risk',
      name: 'Risk',
      fields: [
        { id: 'mitigating_controls', name: 'Mitigated by', type: 'typedRelation' },
        { id: 'affected_entities', name: 'Affects', type: 'typedRelation' }
      ]
    };
    const configuration = {
      type: 'risk-compliance',
      bindings: { risk: { target: { kind: 'entity_schema', id: 'risk' } } }
    } as const;

    const result = resolveEntityDrawerConfiguration(null, [riskSchema], [configuration]);
    const items = result.effective.profiles.risk!.sections.flatMap(section => section.items);
    expect(items).not.toEqual(
      expect.arrayContaining([
        { kind: 'slot', slotId: 'risk.coverage' },
        { kind: 'slot', slotId: 'risk.affected-entities' }
      ])
    );

    const catalog = buildEntityDrawerCatalog([riskSchema], [configuration]);
    expect(catalog.slots.find(slot => slot.id === 'risk.coverage')?.supportedSchemaIds).toEqual([
      'risk'
    ]);
    expect(
      catalog.slots.find(slot => slot.id === 'risk.affected-entities')?.supportedSchemaIds
    ).toEqual(['risk']);
  });

  it('derives the API specification profile and provider slot from the capability binding', () => {
    const apiSchema = {
      id: 'api',
      name: 'API',
      fields: [
        { id: 'protocols', name: 'Protocols', type: 'select' },
        { id: 'contract_version', name: 'API version', type: 'text' },
        { id: 'providers', name: 'Providers', type: 'typedRelation' },
        { id: 'consumers', name: 'Consumers', type: 'typedRelation' }
      ]
    };
    const configuration = {
      type: 'api-specification',
      bindings: {
        api: {
          target: { kind: 'entity_schema', id: 'api' },
          fieldMappings: { api_version: 'contract_version' }
        }
      }
    } as const;

    const result = buildDefaultEntityDrawerConfiguration([apiSchema], [configuration]);
    const profile = result.profiles.api!;
    const items = profile.sections.flatMap(section => section.items);

    expect(profile.header.badges).toEqual([
      { kind: 'field', fieldId: 'protocols', showLabel: false },
      { kind: 'metadata', slot: 'lifecycle' }
    ]);
    expect(items).toEqual(
      expect.arrayContaining([
        { kind: 'field', fieldId: 'contract_version', label: 'API version' },
        { kind: 'metadata', slot: 'owner' },
        { kind: 'relation', fieldId: 'providers', label: 'Providers' },
        { kind: 'relation', fieldId: 'consumers', label: 'Consumers' },
        { kind: 'slot', slotId: 'api-specification.catalog', showLabel: false }
      ])
    );

    const catalog = buildEntityDrawerCatalog([apiSchema], [configuration]);
    expect(catalog.slots.find(slot => slot.id === 'api-specification.catalog')).toMatchObject({
      supportedSchemaIds: ['api']
    });
  });

  it('derives the Data Entity profile with stewardship fields and supported provider slots', () => {
    const dataEntitySchema = {
      id: 'data-entity',
      name: 'Data Entity',
      fields: [
        { id: 'classification', name: 'Classification', type: 'select' },
        { id: 'retention_policy', name: 'Retention Policy', type: 'typedRelation' },
        { id: 'steward', name: 'Steward', type: 'principal' },
        { id: 'custodian', name: 'Custodian', type: 'principal' },
        { id: 'review_date', name: 'Review Date', type: 'date' },
        { id: 'review_status', name: 'Review Status', type: 'derived' },
        { id: 'stewardship_status', name: 'Stewardship Status', type: 'derived' },
        { id: 'regulatory_tags', name: 'Regulatory Tags', type: 'select' },
        { id: 'processing_purposes', name: 'Processing Purposes', type: 'select' },
        {
          id: 'permitted_residency_regions',
          name: 'Permitted Residency Regions',
          type: 'select'
        }
      ]
    };
    const configuration = {
      type: 'data-stewardship',
      bindings: { dataEntity: { target: { kind: 'entity_schema', id: 'data-entity' } } }
    } as const;

    const profile = buildDefaultEntityDrawerConfiguration([dataEntitySchema], [configuration])
      .profiles['data-entity']!;

    expect(profile.header.badges).toEqual([
      { kind: 'field', fieldId: 'classification', showLabel: false }
    ]);
    expect(profile.sections.map(section => section.id)).toEqual([
      'attributes',
      'stewardship',
      'coverage',
      'queue-items',
      'cases',
      'assessments'
    ]);
    expect(profile.sections.flatMap(section => section.items)).toEqual(
      expect.arrayContaining([
        { kind: 'metadata', slot: 'owner' },
        { kind: 'field', fieldId: 'steward' },
        { kind: 'field', fieldId: 'review_status' },
        {
          kind: 'relation',
          fieldId: 'retention_policy',
          presentation: 'mini-panel'
        },
        { kind: 'slot', slotId: 'data-stewardship.coverage', showLabel: false },
        { kind: 'slot', slotId: 'data-stewardship.queue-items', showLabel: false },
        { kind: 'slot', slotId: 'data-stewardship.change-cases', showLabel: false },
        { kind: 'slot', slotId: 'data-stewardship.assessments', showLabel: false }
      ])
    );
    expect(profile.sections.flatMap(section => section.items)).not.toEqual(
      expect.arrayContaining([
        { kind: 'slot', slotId: 'data-stewardship.exceptions' },
        { kind: 'slot', slotId: 'data-stewardship.flows' },
        { kind: 'slot', slotId: 'data-stewardship.systems' }
      ])
    );
  });

  it('derives the glossary term profile from mapped capability fields', () => {
    const termSchema = {
      id: 'term',
      name: 'Term',
      fields: [
        { id: 'meaning', name: 'Meaning', type: 'longtext' },
        { id: 'aliases', name: 'Aliases', type: 'text' },
        { id: 'short_names', name: 'Short names', type: 'text' },
        { id: 'topics', name: 'Topics', type: 'reference' },
        { id: 'maturity', name: 'Maturity', type: 'select' }
      ]
    };
    const configuration = {
      type: 'business-glossary',
      bindings: {
        term: {
          target: { kind: 'entity_schema', id: 'term' },
          fieldMappings: {
            definition: 'meaning',
            synonyms: 'aliases',
            abbreviations: 'short_names',
            categories: 'topics',
            status: 'maturity'
          }
        },
        category: { target: { kind: 'entity_schema', id: 'category' } }
      }
    } as const;

    const profile = buildDefaultEntityDrawerConfiguration([termSchema], [configuration]).profiles
      .term!;

    expect(profile.header.badges).toEqual([
      { kind: 'field', fieldId: 'maturity', showLabel: false },
      { kind: 'metadata', slot: 'lifecycle' }
    ]);
    expect(profile.sections.flatMap(section => section.items)).toEqual(
      expect.arrayContaining([
        { kind: 'field', fieldId: 'meaning' },
        { kind: 'field', fieldId: 'aliases' },
        { kind: 'field', fieldId: 'short_names' },
        { kind: 'relation', fieldId: 'topics' },
        { kind: 'metadata', slot: 'owner' },
        { kind: 'slot', slotId: 'business-glossary.usage', label: 'Usage & backlinks' }
      ])
    );
    expect(profile.sections.map(section => section.id)).toEqual(['attributes', 'details']);
    expect(profile.sections.find(section => section.id === 'details')?.items).toEqual(
      expect.arrayContaining([
        { kind: 'metadata', slot: 'owner' },
        { kind: 'relation', fieldId: 'topics' },
        { kind: 'slot', slotId: 'business-glossary.usage', label: 'Usage & backlinks' }
      ])
    );
  });

  it('derives the Vendor Management profile with fields and provider slots in drawer order', () => {
    const vendorSchema = {
      id: 'vendor',
      name: 'Vendor',
      fields: [
        { id: 'category', name: 'Category', type: 'select' },
        { id: 'tier', name: 'Tier', type: 'select' },
        { id: 'status', name: 'Status', type: 'select' },
        { id: 'relationship_owner', name: 'Relationship Owner', type: 'text' },
        { id: 'cost_centre', name: 'Cost Centre', type: 'select' },
        { id: 'security_risk', name: 'Security Risk', type: 'number' },
        { id: 'concentration_risk', name: 'Concentration Risk', type: 'number' },
        { id: 'financial_risk', name: 'Financial Risk', type: 'number' },
        { id: 'compliance_risk', name: 'Compliance Risk', type: 'number' },
        { id: 'criticality', name: 'Criticality', type: 'number' }
      ]
    };
    const configuration = {
      type: 'vendor-management',
      bindings: {
        vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
        contract: { target: { kind: 'entity_schema', id: 'contract' } }
      }
    } as const;

    const profile = buildDefaultEntityDrawerConfiguration([vendorSchema], [configuration]).profiles
      .vendor!;

    expect(profile.header.badges).toEqual([
      { kind: 'field', fieldId: 'tier', showLabel: false },
      { kind: 'field', fieldId: 'status', showLabel: false }
    ]);
    expect(profile.sections.map(section => section.id)).toEqual([
      'risk-profile',
      'attributes',
      'spend',
      'contracts',
      'applications-supplied',
      'technology-lifecycle',
      'capabilities-funded'
    ]);
    expect(profile.sections[0]?.items).toEqual(
      expect.arrayContaining([
        { kind: 'field', fieldId: 'security_risk', presentation: 'mini-panel' },
        { kind: 'field', fieldId: 'criticality', presentation: 'mini-panel' },
        {
          kind: 'slot',
          slotId: 'vendor.risk',
          label: 'vmRisk',
          presentation: 'mini-panel'
        }
      ])
    );
    expect(profile.sections[0]?.layout).toBe('stat-grid');
    expect(profile.sections[2]?.items).toEqual([
      { kind: 'slot', slotId: 'vendor.spend', label: 'Spend', showLabel: false }
    ]);
  });

  it('derives the Contract profile with the legacy drawer order and Systems used slot', () => {
    const contractSchema = {
      id: 'contract',
      name: 'Contract',
      fields: [
        { id: 'vendor', name: 'Vendor', type: 'containment' },
        { id: 'contract_start', name: 'Contract Start', type: 'date' },
        { id: 'contract_end', name: 'Contract End', type: 'date' },
        { id: 'annual_cost', name: 'Annual Cost', type: 'currency' },
        { id: 'setup_fee', name: 'Setup Fee', type: 'currency' },
        { id: 'system', name: 'Used by', type: 'typedRelation' },
        { id: 'contract_type', name: 'Contract Type', type: 'select' },
        { id: 'auto_renew', name: 'Auto-Renew', type: 'boolean' },
        { id: 'notice_period_days', name: 'Notice Period (Days)', type: 'number' },
        { id: 'contract_owner', name: 'Contract Owner', type: 'text' }
      ]
    };
    const configuration = {
      type: 'vendor-management',
      bindings: {
        vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
        contract: { target: { kind: 'entity_schema', id: 'contract' } }
      }
    } as const;

    const profile = buildDefaultEntityDrawerConfiguration([contractSchema], [configuration])
      .profiles.contract!;

    expect(profile.header.badges).toEqual([
      { kind: 'field', fieldId: 'contract_type', showLabel: false }
    ]);
    expect(profile.sections.map(section => section.id)).toEqual([
      'vendor',
      'terms',
      'cost',
      'systems-used'
    ]);
    expect(profile.sections[0]?.items).toEqual([
      { kind: 'relation', fieldId: 'vendor', label: 'Provided by' }
    ]);
    expect(
      profile.sections[1]?.items.map(item =>
        item.kind === 'field' || item.kind === 'relation' ? item.fieldId : item.kind
      )
    ).toEqual([
      'contract_start',
      'contract_end',
      'contract_type',
      'notice_period_days',
      'auto_renew',
      'contract_owner'
    ]);
    expect(profile.sections[2]?.layout).toBe('stat-grid');
    expect(profile.sections[2]?.items).toEqual([
      { kind: 'field', fieldId: 'annual_cost', presentation: 'mini-panel' },
      { kind: 'field', fieldId: 'setup_fee', presentation: 'mini-panel' }
    ]);
    expect(profile.sections[3]?.items).toEqual([
      { kind: 'slot', slotId: 'contract.systems-used', label: 'Systems used', showLabel: false }
    ]);
  });
});
