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
  resolveEntityDrawerConfiguration,
  VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE
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
        { kind: 'typed-relation-list', fieldId: 'typed_relation' },
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

  it('accepts and resolves static placeholder items without diagnostics', () => {
    const config = entityDrawerConfigurationSchema.parse({
      version: 1,
      profiles: {
        service: {
          sections: [
            {
              id: 'content',
              title: 'Content',
              items: [{ kind: 'placeholder', message: 'Not available yet.' }]
            }
          ]
        }
      }
    });

    const result = resolveEntityDrawerConfiguration(config, [schema]);
    expect(result.effective.profiles.service?.sections[0]?.items).toEqual([
      { kind: 'placeholder', message: 'Not available yet.' }
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('accepts and resolves generic query items without diagnostics', () => {
    const config = entityDrawerConfigurationSchema.parse({
      version: 1,
      profiles: {
        service: {
          sections: [
            {
              id: 'content',
              title: 'Content',
              items: [
                {
                  kind: 'query',
                  queryText: 'subtree(parent).->"Business Capability Supports Entity"',
                  label: 'Realized by'
                }
              ]
            }
          ]
        }
      }
    });

    const result = resolveEntityDrawerConfiguration(config, [schema]);
    expect(result.effective.profiles.service?.sections[0]?.items).toEqual([
      {
        kind: 'query',
        queryText: 'subtree(parent).->"Business Capability Supports Entity"',
        label: 'Realized by'
      }
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('accepts list query presentation with configured fields', () => {
    const config = entityDrawerConfigurationSchema.parse({
      version: 1,
      profiles: {
        service: {
          sections: [
            {
              id: 'content',
              title: 'Content',
              items: [
                {
                  kind: 'query',
                  queryText: '<-"Contract".vendor',
                  label: 'Contracts',
                  presentation: 'list',
                  fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
                }
              ]
            }
          ]
        }
      }
    });

    expect(config.profiles.service?.sections[0]?.items).toEqual([
      {
        kind: 'query',
        queryText: '<-"Contract".vendor',
        label: 'Contracts',
        presentation: 'list',
        fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
      }
    ]);
  });

  it('omits query items rejected by the runtime query validator', () => {
    const result = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          service: {
            sections: [
              {
                id: 'content',
                title: 'Content',
                items: [{ kind: 'query', queryText: 'missing', fields: [{ fieldId: 'stale' }] }]
              }
            ]
          }
        }
      },
      [schema],
      [],
      [],
      () => "Result field 'stale' is not available on the query target."
    );

    expect(result.effective.profiles.service?.sections[0]?.items).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'invalid_query',
        message: "Result field 'stale' is not available on the query target."
      })
    ]);
  });

  it('rejects a query item with an empty queryText', () => {
    expect(() =>
      entityDrawerConfigurationSchema.parse({
        version: 1,
        profiles: {
          service: {
            sections: [
              { id: 'content', title: 'Content', items: [{ kind: 'query', queryText: '' }] }
            ]
          }
        }
      })
    ).toThrow();
  });

  it('normalizes the legacy Vendor capabilities-funded slot to a placeholder', () => {
    expect(
      normalizeLegacyEntityDrawerConfiguration({
        version: 1,
        profiles: {
          vendor: {
            sections: [
              {
                id: 'capabilities-funded',
                title: 'Capabilities funded',
                items: [{ kind: 'slot', slotId: 'vendor.capabilities-funded' }]
              }
            ]
          }
        }
      })
    ).toEqual({
      version: 1,
      profiles: {
        vendor: {
          sections: [
            {
              id: 'capabilities-funded',
              title: 'Capabilities funded',
              items: [
                { kind: 'placeholder', message: VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE }
              ]
            }
          ]
        }
      }
    });
  });

  it('normalizes the legacy Data Stewardship change-case slot', () => {
    expect(
      normalizeLegacyEntityDrawerConfiguration({
        version: 1,
        profiles: {
          service: {
            sections: [
              {
                id: 'cases',
                title: 'Cases',
                items: [
                  {
                    kind: 'slot',
                    slotId: 'data-stewardship.change-cases',
                    showLabel: false
                  }
                ]
              }
            ]
          }
        }
      })
    ).toEqual({
      version: 1,
      profiles: {
        service: {
          sections: [
            {
              id: 'cases',
              title: 'Cases',
              items: [{ kind: 'slot', slotId: 'entity.change-cases', showLabel: false }]
            }
          ]
        }
      }
    });
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
    fields: [
      ...schema.fields,
      { id: 'parent', name: 'Parent', type: 'containment' },
      { id: 'annual_investment', name: 'Annual investment', type: 'currency' }
    ]
  };
  it('validates provider options', () => {
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

  it('advertises capability-bound slots only for their configured schema', () => {
    const catalog = buildEntityDrawerCatalog(
      [schema, { ...schema, id: 'other', name: 'Other' }],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } }
        }
      ]
    );
    expect(catalog.slots.map(slot => slot.id)).not.toContain('strategy.linked-objectives');
    expect(catalog.slots.map(slot => slot.id)).not.toContain('strategy.linked-initiatives');
    expect(catalog.slots.map(slot => slot.id)).not.toContain('vendor.spend');
    expect(catalog.slots.map(slot => slot.id)).not.toContain('vendor.applications-supplied');
    expect(catalog.slots.map(slot => slot.id)).not.toContain('vendor.capabilities-funded');
    expect(catalog.slots.find(slot => slot.id === 'entity.change-cases')).toMatchObject({
      supportedSchemaIds: ['service', 'other']
    });
  });

  it('accepts one-hop relation roll-ups without a parent containment field', () => {
    const vendorSchema = {
      id: 'vendor',
      name: 'Vendor',
      fields: [{ id: 'name', name: 'Name', type: 'text' }]
    };
    const contractSchema = {
      id: 'contract',
      name: 'Contract',
      fields: [
        { id: 'vendor', name: 'Vendor', type: 'containment', schemaId: 'vendor' },
        { id: 'annual_cost', name: 'Annual cost', type: 'currency' }
      ]
    };
    const config = {
      version: 1 as const,
      profiles: {
        vendor: {
          sections: [
            {
              id: 'spend',
              title: 'Spend',
              items: [
                {
                  kind: 'rollup' as const,
                  sourceSchemaId: 'contract',
                  fieldId: 'annual_cost',
                  traversal: {
                    kind: 'relation' as const,
                    fieldId: 'vendor',
                    direction: 'backward' as const,
                    ownerSchemaId: 'contract'
                  },
                  aggregation: 'count' as const,
                  format: 'number' as const
                }
              ]
            }
          ]
        }
      }
    };
    const result = resolveEntityDrawerConfiguration(config, [vendorSchema, contractSchema], [], []);

    expect(result.diagnostics).toEqual([]);
    expect(result.effective.profiles.vendor?.sections[0]?.items).toEqual(
      config.profiles.vendor.sections[0]?.items
    );
  });

  it('accepts the generic change-case slot for a non-Data-Entity profile', () => {
    const result = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          service: {
            sections: [
              {
                id: 'cases',
                title: 'Cases',
                items: [{ kind: 'slot', slotId: 'entity.change-cases' }]
              }
            ]
          }
        }
      },
      [schema]
    );

    expect(result.effective.profiles.service?.sections[0]?.items).toEqual([
      expect.objectContaining({
        kind: 'slot',
        slotId: 'entity.change-cases',
        options: {}
      })
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(buildDefaultEntityDrawerConfiguration([schema]).profiles.service?.sections).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'application-content' })])
    );
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

  it('does not advertise the removed Risk coverage provider slot', () => {
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
      expect.arrayContaining([{ kind: 'slot', slotId: 'risk.affected-entities' }])
    );
    expect(items).not.toEqual(expect.arrayContaining([{ kind: 'slot', slotId: 'risk.coverage' }]));

    const catalog = buildEntityDrawerCatalog([riskSchema], [configuration]);
    expect(catalog.slots.find(slot => slot.id === 'risk.coverage')).toBeUndefined();
    expect(catalog.slots.find(slot => slot.id === 'risk.affected-entities')).toBeUndefined();
  });
});
