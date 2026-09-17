import { z } from 'zod';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  strategyModelViewConfigSchema
} from './app/strategy-model/strategyModelViewConfig';

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
export const entityDrawerSlotOptionsSchema = z.record(z.string(), z.unknown());

export const entityDrawerItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), fieldId: z.string().min(1), label: labelOverrideSchema }),
  z.object({
    kind: z.literal('metadata'),
    slot: entityDrawerMetadataSlotSchema,
    label: labelOverrideSchema
  }),
  z.object({ kind: z.literal('relation'), fieldId: z.string().min(1), label: labelOverrideSchema }),
  z.object({
    kind: z.literal('slot'),
    slotId: z.string().min(1),
    label: labelOverrideSchema,
    options: entityDrawerSlotOptionsSchema.optional()
  })
]);

export const entityDrawerBadgeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), fieldId: z.string().min(1), label: labelOverrideSchema }),
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

type CapabilityConfigurationLike = {
  type: string;
  bindings: Record<string, { target?: { kind: string; id: string } | undefined }>;
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
    id: 'data-stewardship.exceptions',
    label: 'Exceptions',
    description: 'Exceptions associated with this dataset.',
    application: 'Data Stewardship',
    capabilityBinding: { capabilityType: 'data-stewardship', role: 'dataEntity' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'data-stewardship.flows',
    label: 'Flows',
    description: 'Data flows associated with this dataset.',
    application: 'Data Stewardship',
    capabilityBinding: { capabilityType: 'data-stewardship', role: 'dataEntity' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'data-stewardship.systems',
    label: 'Systems',
    description: 'Systems associated with this dataset.',
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

const fieldItem = (field: EntityDrawerField): EntityDrawerItem =>
  isRelationField(field)
    ? { kind: 'relation', fieldId: field.id }
    : { kind: 'field', fieldId: field.id };

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
      .map(fieldItem)
  }));
  const ungrouped = fields
    .filter(field => !field.groupId && !isRelationField(field))
    .map(fieldItem);
  const relationItems = fields.filter(isRelationField).map(fieldItem);
  const sections = [
    ...(ungrouped.length > 0
      ? [{ id: 'attributes', title: 'Attributes', collapsible: false, items: ungrouped }]
      : []),
    ...groups.filter(group => group.items.length > 0),
    ...(relationItems.length > 0
      ? [{ id: 'related', title: 'Related entities', collapsible: true, items: relationItems }]
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

export const buildDefaultEntityDrawerConfiguration = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): EntityDrawerConfiguration => ({
  version: 1,
  profiles: Object.fromEntries(
    schemas.map(schema => [
      schema.id,
      buildDefaultEntityDrawerProfile(
        schema,
        getDefaultProviderItems(schemas, schema.id, capabilityConfigurations)
      )
    ])
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
  const defaults = buildDefaultEntityDrawerConfiguration(schemas, capabilityConfigurations);
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
