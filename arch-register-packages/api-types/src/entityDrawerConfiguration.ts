import { z } from 'zod';
import { metricTraversalStepSchema, type MetricTraversalStep } from './metricContract';
import type { RelationSchema } from './relationSchemaContract';
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

/** Metadata fields supported by query drawer list rows in addition to schema fields. */
export const ENTITY_DRAWER_QUERY_METADATA_FIELDS = [
  { id: '_lifecycle', label: 'Lifecycle' }
] as const;

const labelOverrideSchema = z.string().min(1).max(120).optional();
const entityDrawerItemPresentationSchema = z.enum(['row', 'mini-panel']).optional();
export const entityDrawerSlotOptionsSchema = z.record(z.string(), z.unknown());

export const VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE =
  'Not yet available — no linked capability data yet.';

/** Aggregation and number-format options for a `rollup` drawer item. Kept local to this file
 *  so the generic drawer item contract doesn't depend on a specific capability's config model. */
export const entityDrawerRollupAggregationSchema = z.enum(['avg', 'sum', 'count']);
export const entityDrawerRollupFormatSchema = z.enum(['number', 'decimal1', 'currency', 'percent']);
export const entityDrawerRollupTraversalSchema = metricTraversalStepSchema;

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
    kind: z.literal('children'),
    childSchemaId: z.string().min(1),
    fieldId: z.string().min(1),
    label: labelOverrideSchema
  }),
  z.object({
    kind: z.literal('slot'),
    slotId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    presentation: entityDrawerItemPresentationSchema,
    options: entityDrawerSlotOptionsSchema.optional()
  }),
  z.object({
    kind: z.literal('rollup'),
    fieldId: z.string().min(1),
    sourceSchemaId: z.string().min(1).optional(),
    traversal: entityDrawerRollupTraversalSchema.optional(),
    aggregation: entityDrawerRollupAggregationSchema,
    format: entityDrawerRollupFormatSchema,
    label: labelOverrideSchema,
    showLabel: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('rollup-leaf-count'),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('placeholder'),
    message: z.string().min(1)
  }),
  z.object({
    kind: z.literal('typed-relation-list'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    attributes: z
      .array(z.object({ fieldId: z.string().min(1), label: labelOverrideSchema }))
      .optional()
  }),
  z.object({
    kind: z.literal('query'),
    queryText: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    presentation: z.enum(['chips', 'list']).optional(),
    fields: z.array(z.object({ fieldId: z.string().min(1), label: labelOverrideSchema })).optional()
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
    'invalid_query',
    'invalid_children_target',
    'unsupported_slot',
    'invalid_slot_options',
    'unsupported_slot_for_schema',
    'unsupported_rollup_schema',
    'invalid_rollup_traversal'
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
  groupId: z.string().nullable(),
  schemaId: z.string().nullable().optional()
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
      fixedPresentation: z.enum(['row', 'mini-panel']).optional(),
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
export type EntityDrawerRollupTraversal = MetricTraversalStep;
export type EntityDrawerSlotDefinition = {
  id: string;
  label: string;
  description: string;
  application: string;
  fixedPresentation?: 'row' | 'mini-panel';
  capabilityBinding?: { capabilityType: string; role: string };
  defaultOptions: Record<string, unknown>;
  optionFields: Array<{ id: string; label: string; description: string }>;
  optionsSchema: z.ZodTypeAny;
};

export const remapEntityDrawerProfiles = (
  profiles: EntityDrawerProfiles,
  schemaIdMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string> = new Map()
): EntityDrawerProfiles =>
  Object.fromEntries(
    Object.entries(profiles).flatMap(([schemaId, profile]) => {
      const mappedSchemaId = schemaIdMap.get(schemaId);
      if (!mappedSchemaId) return [];
      return [
        [
          mappedSchemaId,
          {
            ...profile,
            sections: profile.sections.map(section => ({
              ...section,
              items: section.items.map(item =>
                item.kind === 'children'
                  ? {
                      ...item,
                      childSchemaId: schemaIdMap.get(item.childSchemaId) ?? item.childSchemaId
                    }
                  : item.kind === 'rollup'
                    ? {
                        ...item,
                        ...(item.sourceSchemaId
                          ? {
                              sourceSchemaId:
                                schemaIdMap.get(item.sourceSchemaId) ?? item.sourceSchemaId
                            }
                          : {}),
                        ...(item.traversal
                          ? {
                              traversal:
                                item.traversal.kind === 'relation'
                                  ? {
                                      ...item.traversal,
                                      ...(item.traversal.ownerSchemaId
                                        ? {
                                            ownerSchemaId:
                                              schemaIdMap.get(item.traversal.ownerSchemaId) ??
                                              item.traversal.ownerSchemaId
                                          }
                                        : {})
                                    }
                                  : item.traversal.kind === 'typedRelation' ||
                                      item.traversal.kind === 'unboundTypedRelation'
                                    ? {
                                        ...item.traversal,
                                        relationSchemaId:
                                          relationSchemaIdMap.get(
                                            item.traversal.relationSchemaId
                                          ) ?? item.traversal.relationSchemaId
                                      }
                                    : item.traversal
                            }
                          : {})
                      }
                    : item
              )
            }))
          }
        ] as const
      ];
    })
  );

export const mergeEntityDrawerProfiles = (
  existing: EntityDrawerProfiles,
  incoming: EntityDrawerProfiles
): EntityDrawerProfiles => ({ ...incoming, ...existing });

type CapabilityConfigurationLike = {
  type: string;
  bindings: Record<string, WorkspaceCapabilityBinding>;
};

export type EntityDrawerRelationSchema = Pick<RelationSchema, 'id' | 'in' | 'out'>;

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

export const ENTITY_DRAWER_SLOT_DEFINITIONS: EntityDrawerSlotDefinition[] = [
  {
    id: 'entity.usage',
    label: 'Entity usage',
    description:
      'Visible entities, relations, documents, projects, and diagrams that reference the current entity.',
    application: 'Entity',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.governance-items',
    label: 'Governance items',
    description: 'Open governance cases associated with the current entity.',
    application: 'Governance',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.change-cases',
    label: 'Change cases',
    description: 'Change cases associated with the current entity.',
    application: 'Data Stewardship',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.assessments',
    label: 'Assessments',
    description: 'Assessments associated with the current entity.',
    application: 'Data Stewardship',
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
    ...(definition.fixedPresentation ? { fixedPresentation: definition.fixedPresentation } : {}),
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
    if (!binding) {
      result.set(definition.id, [...schemaIds]);
      continue;
    }
    const configuration = capabilityConfigurations.find(
      candidate => candidate.type === binding.capabilityType
    );
    const schemaId = configuration?.bindings[binding.role]?.target;
    if (schemaId?.kind !== 'entity_schema' || !schemaIds.has(schemaId.id)) continue;
    result.set(definition.id, [...(result.get(definition.id) ?? []), schemaId.id]);
  }
  return result;
};

export type EntityDrawerField = {
  id: string;
  name: string;
  type: string;
  archived?: boolean;
  groupId?: string;
  schemaId?: string;
  relationSchemaId?: string;
  direction?: 'in' | 'out';
};

export type EntityDrawerSchema = {
  id: string;
  name: string;
  fields: EntityDrawerField[];
  groups?: Array<{ id: string; name: string }>;
};

export type EntityDrawerQueryValidator = (args: {
  item: Extract<EntityDrawerItem, { kind: 'query' }>;
  schema: EntityDrawerSchema;
  schemaId: string;
  sectionId: string;
}) => string | null;

const fieldIsVisible = (field: EntityDrawerField): boolean => field.archived !== true;
const isRelationField = (field: EntityDrawerField): boolean =>
  field.type === 'reference' || field.type === 'containment' || field.type === 'typedRelation';

const rollupFieldIsValid = (field: EntityDrawerField | undefined): boolean =>
  field !== undefined &&
  fieldIsVisible(field) &&
  (field.type === 'number' || field.type === 'currency');

const relationEndpointAllowsSchema = (
  endpoint: RelationSchema['in'] | RelationSchema['out'],
  schemaId: string
): boolean => endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(schemaId);

const validateRollupTraversal = ({
  item,
  currentSchema,
  sourceSchema,
  schemas,
  relationSchemas
}: {
  item: Extract<EntityDrawerItem, { kind: 'rollup' }>;
  currentSchema: EntityDrawerSchema;
  sourceSchema: EntityDrawerSchema | undefined;
  schemas: EntityDrawerSchema[];
  relationSchemas: EntityDrawerRelationSchema[];
}): string | null => {
  if (!item.traversal) {
    if (item.sourceSchemaId !== undefined) {
      return 'A roll-up source schema requires a traversal.';
    }
    if (!rollupFieldIsValid(currentSchema.fields.find(field => field.id === item.fieldId))) {
      return null;
    }
    return null;
  }
  if (!sourceSchema || !item.sourceSchemaId) {
    return 'A relation roll-up must identify an existing source schema.';
  }

  const step = item.traversal;
  if (step.kind === 'relation') {
    if (step.direction === 'forward') {
      const field = currentSchema.fields.find(candidate => candidate.id === step.fieldId);
      if (
        !field ||
        !fieldIsVisible(field) ||
        !['reference', 'containment'].includes(field.type) ||
        field.schemaId !== item.sourceSchemaId ||
        (step.ownerSchemaId !== undefined && step.ownerSchemaId !== currentSchema.id)
      ) {
        return 'The roll-up relation does not point from the current schema to its source schema.';
      }
      return null;
    }

    const owner = schemas.find(
      candidate => candidate.id === (step.ownerSchemaId ?? item.sourceSchemaId)
    );
    const field = owner?.fields.find(candidate => candidate.id === step.fieldId);
    if (
      !owner ||
      owner.id !== item.sourceSchemaId ||
      !field ||
      !fieldIsVisible(field) ||
      !['reference', 'containment'].includes(field.type) ||
      field.schemaId !== currentSchema.id
    ) {
      return 'The backward roll-up relation must be owned by the source schema and target the current schema.';
    }
    return null;
  }

  if (step.kind === 'typedRelation') {
    const field = currentSchema.fields.find(candidate => candidate.id === step.fieldId);
    const relationSchema = relationSchemas.find(
      candidate => candidate.id === step.relationSchemaId
    );
    const targetEndpoint = step.direction === 'in' ? relationSchema?.out : relationSchema?.in;
    if (
      !field ||
      !fieldIsVisible(field) ||
      field.type !== 'typedRelation' ||
      field.relationSchemaId !== step.relationSchemaId ||
      field.direction !== step.direction ||
      !relationSchema ||
      !targetEndpoint ||
      !relationEndpointAllowsSchema(targetEndpoint, item.sourceSchemaId)
    ) {
      return 'The typed relation roll-up does not point to its source schema.';
    }
    return null;
  }

  const relationSchema = relationSchemas.find(candidate => candidate.id === step.relationSchemaId);
  const currentAtIn = relationSchema
    ? relationEndpointAllowsSchema(relationSchema.in, currentSchema.id)
    : false;
  const currentAtOut = relationSchema
    ? relationEndpointAllowsSchema(relationSchema.out, currentSchema.id)
    : false;
  const sourceAllowed = (endpoint: RelationSchema['in'] | RelationSchema['out']) =>
    relationEndpointAllowsSchema(endpoint, item.sourceSchemaId!);
  const validDirection =
    step.direction === 'both'
      ? (currentAtIn || currentAtOut) &&
        (sourceAllowed(relationSchema?.in ?? { schemaIds: [] }) ||
          sourceAllowed(relationSchema?.out ?? { schemaIds: [] }))
      : step.direction === 'in'
        ? currentAtIn && sourceAllowed(relationSchema?.out ?? { schemaIds: [] })
        : currentAtOut && sourceAllowed(relationSchema?.in ?? { schemaIds: [] });
  return relationSchema && validDirection
    ? null
    : 'The unbound typed relation roll-up does not point to its source schema.';
};

/**
 * Converts the pre-built-in Strategy children slot while reading old stored configurations. This
 * intentionally happens before schema parsing so workspaces do not need a data migration.
 */
export const normalizeLegacyEntityDrawerConfiguration = (raw: unknown): unknown => {
  if (!raw || typeof raw !== 'object' || !('profiles' in raw)) return raw;
  const profiles = raw.profiles;
  if (!profiles || typeof profiles !== 'object') return raw;

  return {
    ...raw,
    profiles: Object.fromEntries(
      Object.entries(profiles).map(([schemaId, profile]) => {
        if (!profile || typeof profile !== 'object' || !('sections' in profile)) {
          return [schemaId, profile];
        }
        const sections = profile.sections;
        if (!Array.isArray(sections)) return [schemaId, profile];
        return [
          schemaId,
          {
            ...profile,
            sections: sections.map(section => {
              if (!section || typeof section !== 'object' || !('items' in section)) return section;
              const items = section.items;
              if (!Array.isArray(items)) return section;
              return {
                ...section,
                items: items.flatMap(item => {
                  if (!item || typeof item !== 'object' || item.kind !== 'slot') {
                    return [item];
                  }
                  if (item.slotId === 'vendor.capabilities-funded') {
                    return [
                      {
                        kind: 'placeholder',
                        message: VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE
                      }
                    ];
                  }
                  if (item.slotId === 'strategy.children') {
                    return [
                      {
                        kind: 'children',
                        childSchemaId: schemaId,
                        fieldId: 'parent',
                        ...('label' in item && typeof item.label === 'string'
                          ? { label: item.label }
                          : {})
                      }
                    ];
                  }
                  if (item.slotId === 'data-stewardship.change-cases') {
                    return [{ ...item, slotId: 'entity.change-cases' }];
                  }
                  return [normalizeFixedPresentationSlotItem(item)];
                })
              };
            })
          }
        ];
      })
    )
  };
};

const fixedPresentationForSlot = (slotId: string): 'row' | 'mini-panel' | undefined =>
  ENTITY_DRAWER_SLOT_DEFINITIONS.find(definition => definition.id === slotId)?.fixedPresentation;

const normalizeFixedPresentationSlotItem = (
  item: Extract<EntityDrawerItem, { kind: 'slot' }>
): Extract<EntityDrawerItem, { kind: 'slot' }> => {
  if (!fixedPresentationForSlot(item.slotId) || item.presentation === undefined) return item;
  const { presentation: _presentation, ...withoutPresentation } = item;
  return withoutPresentation;
};

export const resolveEntityDrawerSlotItemPresentation = (
  item: Extract<EntityDrawerItem, { kind: 'slot' }>
): Extract<EntityDrawerItem, { kind: 'slot' }> => {
  const fixedPresentation = fixedPresentationForSlot(item.slotId);
  return fixedPresentation ? { ...item, presentation: fixedPresentation } : item;
};

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
  const typedRelationItems: EntityDrawerItem[] = fields
    .filter(field => field.type === 'typedRelation')
    .map(field => ({ kind: 'typed-relation-list', fieldId: field.id }));
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
  schemas: EntityDrawerSchema[]
): EntityDrawerConfiguration => ({
  version: 1,
  profiles: Object.fromEntries(
    schemas.map(schema => [schema.id, buildDefaultEntityDrawerProfile(schema, [])])
  )
});

const validateItem = (
  item: EntityDrawerItem,
  schema: EntityDrawerSchema,
  schemas: EntityDrawerSchema[],
  relationSchemas: EntityDrawerRelationSchema[],
  schemaId: string,
  sectionId: string,
  diagnostics: EntityDrawerDiagnostic[],
  queryValidator?: EntityDrawerQueryValidator
): EntityDrawerItem | null => {
  if (item.kind === 'metadata') return item;
  if (item.kind === 'placeholder') return item;
  if (item.kind === 'query') {
    const validationError = queryValidator?.({ item, schema, schemaId, sectionId });
    if (validationError) {
      diagnostics.push({
        code: 'invalid_query',
        schemaId,
        sectionId,
        itemId: item.queryText,
        message: validationError
      });
      return null;
    }
    return item;
  }
  if (item.kind === 'children') {
    const childSchema = schemas.find(candidate => candidate.id === item.childSchemaId);
    const field = childSchema?.fields.find(candidate => candidate.id === item.fieldId);
    const valid =
      childSchema != null &&
      field != null &&
      fieldIsVisible(field) &&
      field.type === 'containment' &&
      field.schemaId === schemaId;
    if (!valid) {
      diagnostics.push({
        code: 'invalid_children_target',
        schemaId,
        sectionId,
        itemId: `${item.childSchemaId}:${item.fieldId}`,
        message: `Drawer children target '${item.childSchemaId}.${item.fieldId}' is missing, archived, or does not contain this schema.`
      });
      return null;
    }
    return item;
  }
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
    return { ...item, options: normalizedOptions };
  }
  if (item.kind === 'rollup' || item.kind === 'rollup-leaf-count') {
    if (item.kind === 'rollup' && item.sourceSchemaId && !item.traversal) {
      diagnostics.push({
        code: 'invalid_rollup_traversal',
        schemaId,
        sectionId,
        itemId: item.fieldId,
        message: 'A roll-up source schema requires a traversal.'
      });
      return null;
    }
    if (item.kind === 'rollup' && item.traversal) {
      const sourceSchema = schemas.find(candidate => candidate.id === item.sourceSchemaId);
      const traversalError = validateRollupTraversal({
        item,
        currentSchema: schema,
        sourceSchema,
        schemas,
        relationSchemas
      });
      const sourceField = sourceSchema?.fields.find(field => field.id === item.fieldId);
      if (traversalError) {
        diagnostics.push({
          code: 'invalid_rollup_traversal',
          schemaId,
          sectionId,
          itemId: item.fieldId,
          message: traversalError
        });
        return null;
      }
      if (!rollupFieldIsValid(sourceField)) {
        diagnostics.push({
          code: 'missing_or_archived_field',
          schemaId,
          sectionId,
          itemId: `${item.sourceSchemaId}.${item.fieldId}`,
          message: `Roll-up source field '${item.sourceSchemaId}.${item.fieldId}' is missing, archived, or not numeric.`
        });
        return null;
      }
      return item;
    }
    const supportsSubtreeRollup = schema.fields.some(
      candidate => candidate.id === 'parent' && candidate.type === 'containment'
    );
    if (!supportsSubtreeRollup) {
      diagnostics.push({
        code: 'unsupported_rollup_schema',
        schemaId,
        sectionId,
        itemId: item.kind === 'rollup' ? item.fieldId : item.kind,
        message: `Drawer roll-up requires a 'parent' containment field on '${schemaId}'.`
      });
      return null;
    }
    if (item.kind === 'rollup-leaf-count') return item;
    const field = schema.fields.find(candidate => candidate.id === item.fieldId);
    if (!field || !fieldIsVisible(field) || !['number', 'currency'].includes(field.type)) {
      diagnostics.push({
        code: 'missing_or_archived_field',
        schemaId,
        sectionId,
        itemId: item.fieldId,
        message: `Roll-up field '${item.fieldId}' is missing, archived, or not numeric.`
      });
      return null;
    }
    return item;
  }
  if (item.kind === 'typed-relation-list') {
    const field = schema.fields.find(candidate => candidate.id === item.fieldId);
    if (!field || !fieldIsVisible(field) || field.type !== 'typedRelation') {
      diagnostics.push({
        code: 'missing_relation_field',
        schemaId,
        sectionId,
        itemId: item.fieldId,
        message: `Drawer typed-relation-list field '${item.fieldId}' is missing, archived, or not a typed relation.`
      });
      return null;
    }
    return item;
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
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = [],
  relationSchemas: EntityDrawerRelationSchema[] = [],
  queryValidator?: EntityDrawerQueryValidator
): { effective: EntityDrawerConfiguration; diagnostics: EntityDrawerDiagnostic[] } => {
  const defaults = buildFallbackEntityDrawerConfiguration(schemas);
  const supportedSlotSchemaIds = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  const diagnostics: EntityDrawerDiagnostic[] = [];
  if (raw === null || raw === undefined) return { effective: defaults, diagnostics };

  const parsed = entityDrawerConfigurationSchema.safeParse(
    normalizeLegacyEntityDrawerConfiguration(raw)
  );
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
        const resolved = validateItem(
          item,
          schema,
          schemas,
          relationSchemas,
          schemaId,
          section.id,
          diagnostics,
          queryValidator
        );
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
        return [
          resolved.kind === 'slot' ? resolveEntityDrawerSlotItemPresentation(resolved) : resolved
        ];
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
        groupId: field.groupId ?? null,
        ...(field.schemaId !== undefined ? { schemaId: field.schemaId } : {})
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
      ...(definition.fixedPresentation ? { fixedPresentation: definition.fixedPresentation } : {}),
      supportedSchemaIds: supportedSlotSchemaIds.get(definition.id) ?? [],
      defaultOptions: definition.defaultOptions,
      optionFields: definition.optionFields
    }))
  };
};
