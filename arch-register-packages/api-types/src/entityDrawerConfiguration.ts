import { z } from 'zod';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  strategyModelViewConfigSchema
} from './app/strategy-model/strategyModelViewConfig';
import { businessGlossaryCapabilityDefinition } from './app/business-glossary/glossaryCapability';
import { getWorkspaceCapabilityDefinition, resolveCapabilityFieldId } from './integrationCatalog';
import type { WorkspaceCapabilityBinding } from './workspaceCapabilityContract';

export const entityDrawerMetadataSlotSchema = z.enum([
  'slug',
  'description',
  'owner',
  'lifecycle',
  'targetLifecycle',
  'targetLifecycleDate',
  'tags',
  'publicId',
  'namespace'
]);

const labelOverrideSchema = z.string().min(1).max(120).optional();
const entityDrawerItemPresentationSchema = z.enum(['row', 'mini-panel']).optional();
export const entityDrawerSlotOptionsSchema = z.record(z.string(), z.unknown());

export const entityDrawerItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    presentation: entityDrawerItemPresentationSchema
  }),
  z.object({
    kind: z.literal('metadata'),
    slot: entityDrawerMetadataSlotSchema,
    label: labelOverrideSchema
  }),
  z.object({
    kind: z.literal('relation'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    presentation: entityDrawerItemPresentationSchema
  }),
  z.object({
    kind: z.literal('slot'),
    slotId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    presentation: entityDrawerItemPresentationSchema,
    options: entityDrawerSlotOptionsSchema.optional()
  })
]);

export const entityDrawerBadgeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('metadata'),
    slot: entityDrawerMetadataSlotSchema,
    label: labelOverrideSchema
  })
]);

export const entityDrawerProfileSchema = z.object({
  header: z.object({ badges: z.array(entityDrawerBadgeSchema) }).default({ badges: [] }),
  sections: z.array(
    z.object({
      id: z.string().min(1).max(120),
      title: z.string().min(1).max(120),
      showTitle: z.boolean().optional(),
      layout: z.enum(['rows', 'stat-grid']).optional(),
      collapsible: z.boolean().default(true),
      items: z.array(entityDrawerItemSchema)
    })
  )
});

export const entityDrawerConfigurationSchema = z.object({
  version: z.literal(1),
  profiles: z.record(z.string().min(1), entityDrawerProfileSchema)
});

export const entityDrawerDiagnosticSchema = z.object({
  code: z.enum([
    'invalid_configuration',
    'unknown_version',
    'missing_schema',
    'missing_or_archived_field',
    'missing_relation_field',
    'unsupported_slot',
    'invalid_slot_options',
    'unsupported_slot_for_schema'
  ]),
  schemaId: z.string().optional(),
  sectionId: z.string().optional(),
  itemId: z.string().optional(),
  message: z.string()
});

export const entityDrawerCatalogFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  archived: z.boolean(),
  groupId: z.string().nullable()
});

export const entityDrawerCatalogSchema = z.object({
  schemas: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fields: z.array(entityDrawerCatalogFieldSchema)
    })
  ),
  metadataSlots: z.array(
    z.object({ id: entityDrawerMetadataSlotSchema, label: z.string(), description: z.string() })
  ),
  slots: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      application: z.string(),
      supportedSchemaIds: z.array(z.string()),
      defaultOptions: entityDrawerSlotOptionsSchema,
      optionFields: z.array(
        z.object({ id: z.string(), label: z.string(), description: z.string() })
      )
    })
  )
});

export type EntityDrawerMetadataSlot = z.infer<typeof entityDrawerMetadataSlotSchema>;
export type EntityDrawerItem = z.infer<typeof entityDrawerItemSchema>;
export type EntityDrawerBadge = z.infer<typeof entityDrawerBadgeSchema>;
export type EntityDrawerProfile = z.infer<typeof entityDrawerProfileSchema>;
export type EntityDrawerConfiguration = z.infer<typeof entityDrawerConfigurationSchema>;
export type EntityDrawerProfiles = EntityDrawerConfiguration['profiles'];
export type EntityDrawerDiagnostic = z.infer<typeof entityDrawerDiagnosticSchema>;
export type EntityDrawerCatalog = z.infer<typeof entityDrawerCatalogSchema>;
export type EntityDrawerSlotDefinition = {
  id: string;
  label: string;
  description: string;
  application: string;
  capabilityBinding?: { capabilityType: string; role: string };
  defaultOptions: Record<string, unknown>;
  optionFields: Array<{ id: string; label: string; description: string }>;
  optionsSchema: z.ZodTypeAny;
};

export const remapEntityDrawerProfiles = (
  profiles: EntityDrawerProfiles,
  schemaIdMap: ReadonlyMap<string, string>
): EntityDrawerProfiles =>
  Object.fromEntries(
    Object.entries(profiles).flatMap(([schemaId, profile]) => {
      const mappedSchemaId = schemaIdMap.get(schemaId);
      return mappedSchemaId ? [[mappedSchemaId, profile] as const] : [];
    })
  );

export const mergeEntityDrawerProfiles = (
  existing: EntityDrawerProfiles,
  incoming: EntityDrawerProfiles
): EntityDrawerProfiles => ({ ...incoming, ...existing });

type CapabilityConfigurationLike = {
  type: string;
  bindings: Record<string, WorkspaceCapabilityBinding>;
  view_config?: unknown;
};

export const ENTITY_DRAWER_METADATA_SLOTS: EntityDrawerCatalog['metadataSlots'] = [
  { id: 'publicId', label: 'Public ID', description: 'The stable public identifier.' },
  { id: 'slug', label: 'Slug', description: 'The entity slug, when present.' },
  { id: 'description', label: 'Description', description: 'The entity description.' },
  { id: 'owner', label: 'Owner', description: 'The assigned owner.' },
  { id: 'lifecycle', label: 'Lifecycle', description: 'The entity lifecycle state.' },
  { id: 'targetLifecycle', label: 'Target lifecycle', description: 'The target lifecycle state.' },
  { id: 'targetLifecycleDate', label: 'Target lifecycle date', description: 'The target date.' },
  { id: 'tags', label: 'Tags', description: 'The entity tags.' },
  { id: 'namespace', label: 'Namespace', description: 'The entity namespace.' }
];

const emptyOptionsSchema = z.record(z.string(), z.unknown());
const strategyRollupOptionsSchema = z.object({
  rollups: z.array(
    z.object({
      fieldId: z.string().min(1),
      aggregation: z.enum(['avg', 'sum']),
      format: z.enum(['number', 'decimal1', 'currency', 'percent']).default('decimal1')
    })
  )
});

export const ENTITY_DRAWER_SLOT_DEFINITIONS: EntityDrawerSlotDefinition[] = [
  {
    id: 'api-specification.catalog',
    label: 'API specification catalog',
    description: 'Sources, revisions, diagnostics, and normalized API operations or messages.',
    application: 'API & Integration Catalog',
    capabilityBinding: { capabilityType: 'api-specification', role: 'api' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'business-glossary.usage',
    label: 'Glossary usage',
    description: 'Where this term is used.',
    application: 'Business Glossary',
    capabilityBinding: { capabilityType: 'business-glossary', role: 'term' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'data-stewardship.coverage',
    label: 'Stewardship coverage',
    description: 'Dataset coverage and ownership.',
    application: 'Data Stewardship',
    capabilityBinding: { capabilityType: 'data-stewardship', role: 'dataEntity' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'data-stewardship.queue-items',
    label: 'Stewardship queue',
    description: 'Open stewardship queue items.',
    application: 'Data Stewardship',
    capabilityBinding: { capabilityType: 'data-stewardship', role: 'dataEntity' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'data-stewardship.change-cases',
    label: 'Change cases',
    description: 'Related change cases.',
    application: 'Data Stewardship',
    capabilityBinding: { capabilityType: 'data-stewardship', role: 'dataEntity' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'data-stewardship.assessments',
    label: 'Assessments',
    description: 'Related assessments.',
    application: 'Data Stewardship',
    capabilityBinding: { capabilityType: 'data-stewardship', role: 'dataEntity' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'strategy.rollup',
    label: 'Strategy roll-up',
    description: 'Roll-up summary for this capability.',
    application: 'Strategy Model',
    capabilityBinding: { capabilityType: 'strategy-model', role: 'business_capability' },
    defaultOptions: { rollups: [] },
    optionFields: [
      {
        id: 'rollups',
        label: 'Roll-ups',
        description: 'JSON array of fieldId, aggregation, and format entries.'
      }
    ],
    optionsSchema: strategyRollupOptionsSchema
  },
  {
    id: 'strategy.children',
    label: 'Child capabilities',
    description: 'Capabilities below this one.',
    application: 'Strategy Model',
    capabilityBinding: { capabilityType: 'strategy-model', role: 'business_capability' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'strategy.realized-by',
    label: 'Realized by',
    description: 'Products and initiatives realizing this capability.',
    application: 'Strategy Model',
    capabilityBinding: { capabilityType: 'strategy-model', role: 'business_capability' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'strategy.linked-objectives',
    label: 'Linked objectives',
    description: 'Objectives linked to this capability.',
    application: 'Strategy Model',
    capabilityBinding: { capabilityType: 'strategy-model', role: 'business_capability' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'strategy.linked-initiatives',
    label: 'Linked initiatives',
    description: 'Initiatives linked to this capability.',
    application: 'Strategy Model',
    capabilityBinding: { capabilityType: 'strategy-model', role: 'business_capability' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'risk.coverage',
    label: 'Risk coverage',
    description: 'Controls and coverage for this risk.',
    application: 'Risk & Compliance',
    capabilityBinding: { capabilityType: 'risk-compliance', role: 'risk' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'risk.affected-entities',
    label: 'Affected entities',
    description: 'Entities affected by this risk.',
    application: 'Risk & Compliance',
    capabilityBinding: { capabilityType: 'risk-compliance', role: 'risk' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'risk.mitigated-risks',
    label: 'Mitigated risks',
    description: 'Risks mitigated by this control.',
    application: 'Risk & Compliance',
    capabilityBinding: { capabilityType: 'risk-compliance', role: 'control' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'risk.protected-entities',
    label: 'Protected entities',
    description: 'Entities protected by this control.',
    application: 'Risk & Compliance',
    capabilityBinding: { capabilityType: 'risk-compliance', role: 'control' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.spend',
    label: 'Spend',
    description: 'Spend summary for this vendor.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.risk',
    label: 'Risk profile',
    description: 'Derived risk profile for this vendor.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.contracts',
    label: 'Contracts',
    description: 'Contracts associated with this vendor.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.applications-supplied',
    label: 'Applications supplied',
    description: 'Applications supplied by this vendor.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.technology-lifecycle',
    label: 'Technology lifecycle',
    description: 'Technology lifecycle summary.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.capabilities-funded',
    label: 'Capabilities funded',
    description: 'Capabilities funded by this vendor.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'contract.systems-used',
    label: 'Systems used',
    description: 'Systems used by this contract.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'contract' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  }
];

export const ENTITY_DRAWER_SLOTS: EntityDrawerCatalog['slots'] = ENTITY_DRAWER_SLOT_DEFINITIONS.map(
  definition => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    application: definition.application,
    supportedSchemaIds: [],
    defaultOptions: definition.defaultOptions,
    optionFields: definition.optionFields
  })
);

export const getEntityDrawerSlotSchemaIds = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): ReadonlyMap<string, string[]> => {
  const schemaIds = new Set(schemas.map(schema => schema.id));
  const result = new Map<string, string[]>();
  for (const definition of ENTITY_DRAWER_SLOT_DEFINITIONS) {
    const binding = definition.capabilityBinding;
    if (!binding) continue;
    const configuration = capabilityConfigurations.find(
      candidate => candidate.type === binding.capabilityType
    );
    const schemaId = configuration?.bindings[binding.role]?.target;
    if (schemaId?.kind !== 'entity_schema' || !schemaIds.has(schemaId.id)) continue;
    result.set(definition.id, [...(result.get(definition.id) ?? []), schemaId.id]);
  }
  return result;
};

const getDefaultProviderItems = (
  schemas: EntityDrawerSchema[],
  schemaId: string,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  const supported = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  const schema = schemas.find(candidate => candidate.id === schemaId);
  const items: EntityDrawerItem[] = [];
  for (const definition of ENTITY_DRAWER_SLOT_DEFINITIONS) {
    if (!supported.get(definition.id)?.includes(schemaId)) continue;
    const options =
      definition.id === 'strategy.rollup'
        ? (() => {
            const configuration = capabilityConfigurations.find(
              candidate => candidate.type === 'strategy-model'
            );
            const parsed = strategyModelViewConfigSchema.safeParse(
              configuration?.view_config ?? DEFAULT_STRATEGY_VIEW_CONFIG
            );
            const view = parsed.success ? parsed.data : DEFAULT_STRATEGY_VIEW_CONFIG;
            return {
              rollups: view.fields.flatMap(field =>
                field.rollup &&
                schema?.fields.some(
                  candidate =>
                    candidate.id === field.fieldId &&
                    fieldIsVisible(candidate) &&
                    ['number', 'currency'].includes(candidate.type)
                )
                  ? [
                      {
                        fieldId: field.fieldId,
                        aggregation: field.rollup.aggregation,
                        format: field.rollup.format
                      }
                    ]
                  : []
              )
            };
          })()
        : definition.defaultOptions;
    items.push({
      kind: 'slot',
      slotId: definition.id,
      ...(Object.keys(options).length > 0 ? { options } : {})
    });
  }
  return items;
};

export type EntityDrawerField = {
  id: string;
  name: string;
  type: string;
  archived?: boolean;
  groupId?: string;
};

export type EntityDrawerSchema = {
  id: string;
  name: string;
  fields: EntityDrawerField[];
  groups?: Array<{ id: string; name: string }>;
};

const fieldIsVisible = (field: EntityDrawerField): boolean => field.archived !== true;
const isRelationField = (field: EntityDrawerField): boolean =>
  field.type === 'reference' || field.type === 'containment' || field.type === 'typedRelation';

const fieldItem = (
  field: EntityDrawerField,
  presentation?: 'row' | 'mini-panel'
): EntityDrawerItem => {
  const resolvedPresentation =
    presentation ?? (field.type === 'typedRelation' ? 'mini-panel' : undefined);
  return isRelationField(field)
    ? {
        kind: 'relation',
        fieldId: field.id,
        ...(resolvedPresentation ? { presentation: resolvedPresentation } : {})
      }
    : {
        kind: 'field',
        fieldId: field.id,
        ...(resolvedPresentation ? { presentation: resolvedPresentation } : {})
      };
};

type BusinessGlossaryFieldIds = {
  definition: string;
  synonyms: string;
  abbreviations: string;
  categories: string;
  status: string;
};

const businessGlossaryFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): BusinessGlossaryFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'business-glossary'
  );
  const binding = configuration?.bindings.term;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) {
    return null;
  }

  const role = businessGlossaryCapabilityDefinition.bindingRoles.find(item => item.id === 'term');
  if (!role) return null;

  const fieldIdFor = (roleId: keyof BusinessGlossaryFieldIds) => {
    const fieldRole = role.fieldRoles.find(field => field.id === roleId);
    return fieldRole ? resolveCapabilityFieldId(binding, fieldRole) : null;
  };
  const definition = fieldIdFor('definition');
  const synonyms = fieldIdFor('synonyms');
  const abbreviations = fieldIdFor('abbreviations');
  const categories = fieldIdFor('categories');
  const status = fieldIdFor('status');
  if (!definition || !synonyms || !abbreviations || !categories || !status) return null;

  const fieldIds = { definition, synonyms, abbreviations, categories, status };
  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const categoriesField = schema.fields.find(field => field.id === fieldIds.categories);
  if (!categoriesField || !isRelationField(categoriesField)) return null;

  return fieldIds;
};

const buildBusinessGlossaryDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: BusinessGlossaryFieldIds
): EntityDrawerProfile => {
  const item = (fieldId: string, kind: 'field' | 'relation' = 'field'): EntityDrawerItem => ({
    kind,
    fieldId
  });
  const usageItems = providerItems.map(providerItem =>
    providerItem.kind === 'slot' && providerItem.slotId === 'business-glossary.usage'
      ? { ...providerItem, label: 'Usage & backlinks' }
      : providerItem
  );

  return {
    header: {
      badges: [
        { kind: 'field', fieldId: fieldIds.status, showLabel: false },
        { kind: 'metadata', slot: 'lifecycle' }
      ]
    },
    sections: [
      {
        id: 'attributes',
        title: 'Attributes',
        collapsible: false,
        items: [item(fieldIds.definition), item(fieldIds.synonyms), item(fieldIds.abbreviations)]
      },
      {
        id: 'details',
        title: 'Details',
        collapsible: true,
        items: [
          { kind: 'metadata', slot: 'owner' },
          item(fieldIds.categories, 'relation'),
          ...usageItems
        ]
      }
    ]
  };
};

type DataStewardshipFieldIds = {
  classification: string;
  retentionPolicy: string;
  steward: string;
  custodian: string;
  reviewDate: string;
  reviewStatus: string;
  stewardshipStatus: string;
  regulatoryTags: string;
  processingPurposes: string;
  permittedResidencyRegions: string;
};

type ApiSpecificationFieldIds = {
  apiVersion: string;
  protocols: string;
  providers: string;
  consumers: string;
};

const apiSpecificationFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): ApiSpecificationFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'api-specification'
  );
  const binding = configuration?.bindings.api;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const definition = getWorkspaceCapabilityDefinition('api-specification');
  const apiRole = definition?.bindingRoles.find(role => role.id === 'api');
  const apiVersionRole = apiRole?.fieldRoles.find(role => role.id === 'api_version');
  const apiVersion = apiVersionRole
    ? resolveCapabilityFieldId(binding, apiVersionRole)
    : 'api_version';
  const fieldIds: ApiSpecificationFieldIds = {
    apiVersion,
    protocols: 'protocols',
    providers: 'providers',
    consumers: 'consumers'
  };
  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const providerField = schema.fields.find(field => field.id === fieldIds.providers);
  const consumerField = schema.fields.find(field => field.id === fieldIds.consumers);
  if (providerField?.type !== 'typedRelation' || consumerField?.type !== 'typedRelation') {
    return null;
  }
  return fieldIds;
};

const buildApiSpecificationDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: ApiSpecificationFieldIds
): EntityDrawerProfile => {
  const provider = (slotId: string): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot ? { ...slot, showLabel: false } : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [
        { kind: 'field', fieldId: fieldIds.protocols, showLabel: false },
        { kind: 'metadata', slot: 'lifecycle' }
      ]
    },
    sections: [
      section('attributes', 'Attributes', [
        { kind: 'field', fieldId: fieldIds.apiVersion, label: 'API version' },
        { kind: 'metadata', slot: 'owner' }
      ]),
      section('providers', 'Providers', [
        { kind: 'relation', fieldId: fieldIds.providers, label: 'Providers' }
      ]),
      section('consumers', 'Consumers', [
        { kind: 'relation', fieldId: fieldIds.consumers, label: 'Consumers' }
      ]),
      section('specification', 'Specification', [provider('api-specification.catalog')])
    ].filter(section => section.items.length > 0)
  };
};

const dataStewardshipFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): DataStewardshipFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'data-stewardship'
  );
  const binding = configuration?.bindings.dataEntity;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const fieldIds: DataStewardshipFieldIds = {
    classification: 'classification',
    retentionPolicy: 'retention_policy',
    steward: 'steward',
    custodian: 'custodian',
    reviewDate: 'review_date',
    reviewStatus: 'review_status',
    stewardshipStatus: 'stewardship_status',
    regulatoryTags: 'regulatory_tags',
    processingPurposes: 'processing_purposes',
    permittedResidencyRegions: 'permitted_residency_regions'
  };

  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const retentionPolicy = schema.fields.find(field => field.id === fieldIds.retentionPolicy);
  if (!retentionPolicy || !isRelationField(retentionPolicy)) return null;

  return fieldIds;
};

const buildDataStewardshipDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: DataStewardshipFieldIds
): EntityDrawerProfile => {
  const field = (
    fieldId: string,
    kind: 'field' | 'relation' = 'field',
    presentation?: 'row' | 'mini-panel'
  ): EntityDrawerItem => ({
    kind,
    fieldId,
    ...(presentation ? { presentation } : {})
  });
  const provider = (slotId: string): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot ? { ...slot, showLabel: false } : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [{ kind: 'field', fieldId: fieldIds.classification, showLabel: false }]
    },
    sections: [
      section('attributes', 'Attributes', [
        field(fieldIds.classification),
        field(fieldIds.retentionPolicy, 'relation', 'mini-panel')
      ]),
      section('stewardship', 'Stewardship', [
        { kind: 'metadata', slot: 'owner' },
        field(fieldIds.steward),
        field(fieldIds.custodian),
        field(fieldIds.reviewDate),
        field(fieldIds.reviewStatus),
        field(fieldIds.stewardshipStatus),
        field(fieldIds.regulatoryTags),
        field(fieldIds.processingPurposes),
        field(fieldIds.permittedResidencyRegions)
      ]),
      section('coverage', 'Coverage', [provider('data-stewardship.coverage')], true),
      section('queue-items', 'Queue items', [provider('data-stewardship.queue-items')], true),
      section('cases', 'Cases', [provider('data-stewardship.change-cases')], true),
      section('assessments', 'Assessments', [provider('data-stewardship.assessments')], true)
    ].filter(section => section.items.length > 0)
  };
};

type VendorManagementFieldIds = {
  category: string;
  tier: string;
  status: string;
  relationshipOwner: string;
  costCentre: string;
  securityRisk: string;
  concentrationRisk: string;
  financialRisk: string;
  complianceRisk: string;
  criticality: string;
};

const vendorManagementFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): VendorManagementFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const binding = configuration?.bindings.vendor;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const fieldIds: VendorManagementFieldIds = {
    category: 'category',
    tier: 'tier',
    status: 'status',
    relationshipOwner: 'relationship_owner',
    costCentre: 'cost_centre',
    securityRisk: 'security_risk',
    concentrationRisk: 'concentration_risk',
    financialRisk: 'financial_risk',
    complianceRisk: 'compliance_risk',
    criticality: 'criticality'
  };
  return Object.values(fieldIds).every(fieldId =>
    schema.fields.some(field => field.id === fieldId && fieldIsVisible(field))
  )
    ? fieldIds
    : null;
};

const buildVendorManagementDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: VendorManagementFieldIds
): EntityDrawerProfile => {
  const item = (fieldId: string): Extract<EntityDrawerItem, { kind: 'field' }> => ({
    kind: 'field',
    fieldId
  });
  const provider = (
    slotId: string,
    label: string,
    showLabel = true,
    presentation?: 'row' | 'mini-panel'
  ): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot
      ? {
          ...slot,
          label,
          ...(showLabel ? {} : { showLabel: false }),
          ...(presentation ? { presentation } : {})
        }
      : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [
        { kind: 'field', fieldId: fieldIds.tier, showLabel: false },
        { kind: 'field', fieldId: fieldIds.status, showLabel: false }
      ]
    },
    sections: [
      {
        ...section('risk-profile', 'Risk profile', [
          { ...item(fieldIds.securityRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.concentrationRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.financialRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.complianceRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.criticality), presentation: 'mini-panel' },
          provider('vendor.risk', 'vmRisk', true, 'mini-panel')
        ]),
        layout: 'stat-grid' as const
      },
      section('attributes', 'Attributes', [
        item(fieldIds.category),
        item(fieldIds.tier),
        item(fieldIds.status),
        item(fieldIds.relationshipOwner),
        item(fieldIds.costCentre)
      ]),
      section('spend', 'Spend', [provider('vendor.spend', 'Spend', false)], true),
      section('contracts', 'Contracts', [provider('vendor.contracts', 'Contracts', false)], true),
      section(
        'applications-supplied',
        'Applications supplied',
        [provider('vendor.applications-supplied', 'Applications supplied', false)],
        true
      ),
      section(
        'technology-lifecycle',
        'Technology lifecycle',
        [provider('vendor.technology-lifecycle', 'Technology lifecycle', false)],
        true
      ),
      section(
        'capabilities-funded',
        'Capabilities funded',
        [provider('vendor.capabilities-funded', 'Capabilities funded', false)],
        true
      )
    ].filter(section => section.items.length > 0)
  };
};

type VendorManagementContractFieldIds = {
  vendor: string;
  contractStart: string;
  contractEnd: string;
  contractType: string;
  noticePeriodDays: string;
  autoRenew: string;
  contractOwner: string;
  annualCost: string;
  setupFee: string;
  system: string;
};

const vendorManagementContractFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): VendorManagementContractFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const binding = configuration?.bindings.contract;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const fieldIds: VendorManagementContractFieldIds = {
    vendor: 'vendor',
    contractStart: 'contract_start',
    contractEnd: 'contract_end',
    contractType: 'contract_type',
    noticePeriodDays: 'notice_period_days',
    autoRenew: 'auto_renew',
    contractOwner: 'contract_owner',
    annualCost: 'annual_cost',
    setupFee: 'setup_fee',
    system: 'system'
  };
  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const vendorField = schema.fields.find(field => field.id === fieldIds.vendor);
  const systemField = schema.fields.find(field => field.id === fieldIds.system);
  if (!vendorField || !isRelationField(vendorField)) return null;
  if (systemField?.type !== 'typedRelation') return null;

  return fieldIds;
};

const buildVendorManagementContractDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: VendorManagementContractFieldIds
): EntityDrawerProfile => {
  const field = (
    fieldId: string,
    presentation?: 'row' | 'mini-panel'
  ): Extract<EntityDrawerItem, { kind: 'field' }> => ({
    kind: 'field',
    fieldId,
    ...(presentation ? { presentation } : {})
  });
  const relation = (fieldId: string, label: string): EntityDrawerItem => ({
    kind: 'relation',
    fieldId,
    label
  });
  const provider = (slotId: string, label: string, showLabel = true): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot ? { ...slot, label, ...(showLabel ? {} : { showLabel: false }) } : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [{ kind: 'field', fieldId: fieldIds.contractType, showLabel: false }]
    },
    sections: [
      section('vendor', 'Vendor', [relation(fieldIds.vendor, 'Provided by')]),
      section('terms', 'Terms', [
        field(fieldIds.contractStart),
        field(fieldIds.contractEnd),
        field(fieldIds.contractType),
        field(fieldIds.noticePeriodDays),
        field(fieldIds.autoRenew),
        field(fieldIds.contractOwner)
      ]),
      {
        ...section('cost', 'Cost', [
          field(fieldIds.annualCost, 'mini-panel'),
          field(fieldIds.setupFee, 'mini-panel')
        ]),
        layout: 'stat-grid' as const
      },
      section(
        'systems-used',
        'Systems used',
        [provider('contract.systems-used', 'Systems used', false)],
        true
      )
    ].filter(section => section.items.length > 0)
  };
};

export const buildDefaultEntityDrawerProfile = (
  schema: EntityDrawerSchema,
  providerItems: EntityDrawerItem[] = []
): EntityDrawerProfile => {
  const fields = schema.fields.filter(fieldIsVisible);
  const groups = (schema.groups ?? []).map(group => ({
    id: `group:${group.id}`,
    title: group.name,
    collapsible: true,
    items: fields
      .filter(field => field.groupId === group.id && !isRelationField(field))
      .map(field => fieldItem(field))
  }));
  const ungrouped = fields
    .filter(field => !field.groupId && !isRelationField(field))
    .map(field => fieldItem(field));
  const typedRelationItems = fields
    .filter(field => field.type === 'typedRelation')
    .map(field => fieldItem(field, 'mini-panel'));
  const relationItems = fields
    .filter(field => isRelationField(field) && field.type !== 'typedRelation')
    .map(field => fieldItem(field));
  const sections = [
    ...(ungrouped.length > 0
      ? [{ id: 'attributes', title: 'Attributes', collapsible: false, items: ungrouped }]
      : []),
    ...groups.filter(group => group.items.length > 0),
    ...(relationItems.length > 0
      ? [{ id: 'related', title: 'Related entities', collapsible: true, items: relationItems }]
      : []),
    ...(typedRelationItems.length > 0
      ? [
          {
            id: 'typed-relations',
            title: 'Related data',
            showTitle: false,
            collapsible: false,
            items: typedRelationItems
          }
        ]
      : []),
    {
      id: 'metadata',
      title: 'Details',
      collapsible: true,
      items: ENTITY_DRAWER_METADATA_SLOTS.map(slot => ({
        kind: 'metadata' as const,
        slot: slot.id
      }))
    },
    ...(providerItems.length > 0
      ? [
          {
            id: 'application-content',
            title: 'Application content',
            collapsible: true,
            items: providerItems
          }
        ]
      : [])
  ];
  return { header: { badges: [] }, sections };
};

/**
 * Builds the generic drawer used when a workspace has no stored drawer profile.
 *
 * This deliberately mirrors the schema-driven part of the entity overview: fields stay in
 * schema order, grouped fields stay inside their schema field groups, and metadata is shown in a
 * separate details section. Application-specific profiles and provider slots are authored in
 * seed/template/workspace configuration instead of being inferred here.
 */
export const buildFallbackEntityDrawerProfile = (
  schema: EntityDrawerSchema
): EntityDrawerProfile => {
  const fields = schema.fields.filter(fieldIsVisible);
  const groups = (schema.groups ?? []).map(group => ({
    id: `group:${group.id}`,
    title: group.name,
    collapsible: false,
    items: fields.filter(field => field.groupId === group.id).map(field => fieldItem(field))
  }));
  const ungrouped = fields.filter(field => !field.groupId).map(field => fieldItem(field));

  return {
    header: { badges: [] },
    sections: [
      ...(ungrouped.length > 0
        ? [{ id: 'attributes', title: 'Attributes', collapsible: false, items: ungrouped }]
        : []),
      ...groups.filter(group => group.items.length > 0),
      {
        id: 'metadata',
        title: 'Details',
        collapsible: true,
        items: ENTITY_DRAWER_METADATA_SLOTS.map(slot => ({
          kind: 'metadata' as const,
          slot: slot.id
        }))
      }
    ]
  };
};

export const buildFallbackEntityDrawerConfiguration = (
  schemas: EntityDrawerSchema[]
): EntityDrawerConfiguration => ({
  version: 1,
  profiles: Object.fromEntries(
    schemas.map(schema => [schema.id, buildFallbackEntityDrawerProfile(schema)])
  )
});

export const buildDefaultEntityDrawerConfiguration = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): EntityDrawerConfiguration => ({
  version: 1,
  profiles: Object.fromEntries(
    schemas.map(schema => {
      const providerItems = getDefaultProviderItems(schemas, schema.id, capabilityConfigurations);
      const glossaryFieldIds = businessGlossaryFieldIds(schema, capabilityConfigurations);
      const dataStewardshipFieldIdsValue = dataStewardshipFieldIds(
        schema,
        capabilityConfigurations
      );
      const apiSpecificationFieldIdsValue = apiSpecificationFieldIds(
        schema,
        capabilityConfigurations
      );
      const vendorFieldIds = vendorManagementFieldIds(schema, capabilityConfigurations);
      const contractFieldIds = vendorManagementContractFieldIds(schema, capabilityConfigurations);
      return [
        schema.id,
        glossaryFieldIds
          ? buildBusinessGlossaryDefaultProfile(providerItems, glossaryFieldIds)
          : dataStewardshipFieldIdsValue
            ? buildDataStewardshipDefaultProfile(providerItems, dataStewardshipFieldIdsValue)
            : apiSpecificationFieldIdsValue
              ? buildApiSpecificationDefaultProfile(providerItems, apiSpecificationFieldIdsValue)
              : vendorFieldIds
                ? buildVendorManagementDefaultProfile(providerItems, vendorFieldIds)
                : contractFieldIds
                  ? buildVendorManagementContractDefaultProfile(providerItems, contractFieldIds)
                  : buildDefaultEntityDrawerProfile(schema, providerItems)
      ];
    })
  )
});

const validateItem = (
  item: EntityDrawerItem,
  schema: EntityDrawerSchema,
  schemaId: string,
  sectionId: string,
  diagnostics: EntityDrawerDiagnostic[]
): EntityDrawerItem | null => {
  if (item.kind === 'metadata') return item;
  if (item.kind === 'slot') {
    const definition = ENTITY_DRAWER_SLOT_DEFINITIONS.find(slot => slot.id === item.slotId);
    if (!definition) {
      diagnostics.push({
        code: 'unsupported_slot',
        schemaId,
        sectionId,
        itemId: item.slotId,
        message: `Unsupported drawer slot '${item.slotId}'.`
      });
      return null;
    }
    const options = definition.optionsSchema.safeParse(item.options ?? definition.defaultOptions);
    if (!options.success) {
      diagnostics.push({
        code: 'invalid_slot_options',
        schemaId,
        sectionId,
        itemId: item.slotId,
        message: `Invalid options for drawer slot '${item.slotId}'.`
      });
      return null;
    }
    const normalizedOptions = options.data as Record<string, unknown>;
    if (item.slotId === 'strategy.rollup') {
      const rollups = Array.isArray(normalizedOptions['rollups'])
        ? normalizedOptions['rollups']
        : [];
      normalizedOptions['rollups'] = rollups.filter(value => {
        if (!value || typeof value !== 'object' || !('fieldId' in value)) return false;
        const fieldId = value.fieldId;
        const field =
          typeof fieldId === 'string'
            ? schema.fields.find(candidate => candidate.id === fieldId)
            : undefined;
        const valid =
          field != null && fieldIsVisible(field) && ['number', 'currency'].includes(field.type);
        if (!valid) {
          diagnostics.push({
            code: 'missing_or_archived_field',
            schemaId,
            sectionId,
            itemId: typeof fieldId === 'string' ? fieldId : item.slotId,
            message: `Strategy roll-up field '${String(fieldId)}' is missing, archived, or not numeric.`
          });
        }
        return valid;
      });
    }
    return { ...item, options: normalizedOptions };
  }
  const field = schema.fields.find(candidate => candidate.id === item.fieldId);
  if (!field || !fieldIsVisible(field)) {
    diagnostics.push({
      code: item.kind === 'relation' ? 'missing_relation_field' : 'missing_or_archived_field',
      schemaId,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer field '${item.fieldId}' is missing or archived.`
    });
    return null;
  }
  if (item.kind === 'relation' && !isRelationField(field)) {
    diagnostics.push({
      code: 'missing_relation_field',
      schemaId,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer relation '${item.fieldId}' is no longer a relation field.`
    });
    return null;
  }
  return item;
};

export const resolveEntityDrawerConfiguration = (
  raw: unknown,
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): { effective: EntityDrawerConfiguration; diagnostics: EntityDrawerDiagnostic[] } => {
  const defaults = buildFallbackEntityDrawerConfiguration(schemas);
  const supportedSlotSchemaIds = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  const diagnostics: EntityDrawerDiagnostic[] = [];
  if (raw === null || raw === undefined) return { effective: defaults, diagnostics };

  const parsed = entityDrawerConfigurationSchema.safeParse(raw);
  if (!parsed.success) {
    const version = raw && typeof raw === 'object' && 'version' in raw ? raw.version : undefined;
    diagnostics.push({
      code:
        typeof version === 'number' && version !== 1 ? 'unknown_version' : 'invalid_configuration',
      message:
        typeof version === 'number' && version !== 1
          ? `Unsupported drawer configuration version '${version}'.`
          : 'The stored drawer configuration is invalid.'
    });
    return { effective: defaults, diagnostics };
  }

  const profiles = { ...defaults.profiles };
  for (const [schemaId, profile] of Object.entries(parsed.data.profiles)) {
    const schema = schemas.find(candidate => candidate.id === schemaId);
    if (!schema) {
      diagnostics.push({
        code: 'missing_schema',
        schemaId,
        message: `Schema '${schemaId}' no longer exists.`
      });
      continue;
    }
    const sections = profile.sections.map(section => ({
      ...section,
      items: section.items.flatMap(item => {
        const resolved = validateItem(item, schema, schemaId, section.id, diagnostics);
        if (!resolved) return [];
        if (item.kind === 'slot' && !supportedSlotSchemaIds.get(item.slotId)?.includes(schemaId)) {
          diagnostics.push({
            code: 'unsupported_slot_for_schema',
            schemaId,
            sectionId: section.id,
            itemId: item.slotId,
            message: `Drawer slot '${item.slotId}' is not available for this schema.`
          });
          return [];
        }
        return [resolved];
      })
    }));
    const badges = profile.header.badges.filter(badge => {
      if (badge.kind === 'metadata') return true;
      const field = schema.fields.find(candidate => candidate.id === badge.fieldId);
      if (!field || !fieldIsVisible(field)) {
        diagnostics.push({
          code: 'missing_or_archived_field',
          schemaId,
          itemId: badge.fieldId,
          message: `Drawer badge field '${badge.fieldId}' is missing or archived.`
        });
        return false;
      }
      return true;
    });
    profiles[schemaId] = { header: { badges }, sections };
  }
  return { effective: { version: 1, profiles }, diagnostics };
};

export const buildEntityDrawerCatalog = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): EntityDrawerCatalog => {
  const supportedSlotSchemaIds = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  return {
    schemas: schemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      fields: schema.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        archived: field.archived === true,
        groupId: field.groupId ?? null
      }))
    })),
    metadataSlots: ENTITY_DRAWER_METADATA_SLOTS,
    slots: ENTITY_DRAWER_SLOT_DEFINITIONS.filter(definition => {
      const binding = definition.capabilityBinding;
      return !binding || (supportedSlotSchemaIds.get(definition.id)?.length ?? 0) > 0;
    }).map(definition => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      application: definition.application,
      supportedSchemaIds: supportedSlotSchemaIds.get(definition.id) ?? [],
      defaultOptions: definition.defaultOptions,
      optionFields: definition.optionFields
    }))
  };
};
